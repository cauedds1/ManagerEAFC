import { Router } from "express";
import { db, squadPlayersTable } from "@workspace/db";
import { ilike, sql } from "drizzle-orm";

const router = Router();

const API_BASE = "https://v3.football.api-sports.io";

function mapPosition(pos: string): string {
  const p = (pos ?? "").toLowerCase();
  if (p.includes("goalkeeper")) return "GOL";
  if (p.includes("centre-back") || p.includes("defender")) return "ZAG";
  if (p.includes("midfielder")) return "MC";
  if (p.includes("attacker") || p.includes("forward") || p.includes("winger")) return "CA";
  return "MC";
}

interface ApiPlayerItem {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    age: number;
    nationality: string;
    photo: string;
  };
  statistics: Array<{
    team?: { id: number; name: string; logo: string };
    games?: { position?: string; number?: number };
  }>;
}

router.get("/players/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const apiKey = String(req.query.apiKey ?? "").trim();

  if (!q || q.length < 2) return res.json({ players: [] });

  try {
    // 1. Search DB first (case-insensitive partial match)
    const dbRows = await db
      .select()
      .from(squadPlayersTable)
      .where(ilike(squadPlayersTable.name, `%${q}%`))
      .orderBy(sql`length(name)`)
      .limit(15);

    if (dbRows.length >= 5 || !apiKey) {
      return res.json({
        players: dbRows.slice(0, 12).map((r) => ({
          id: r.playerId,
          name: r.name,
          photo: r.photo,
          age: r.age,
          position: r.positionPtBr,
          teamId: r.teamId,
          source: "db",
        })),
      });
    }

    // 2. Not enough in DB — call API-Football and cache everything
    const apiRes = await fetch(
      `${API_BASE}/players?search=${encodeURIComponent(q)}&season=2024`,
      { headers: { "x-apisports-key": apiKey } }
    );

    if (!apiRes.ok) {
      return res.json({
        players: dbRows.slice(0, 12).map((r) => ({
          id: r.playerId,
          name: r.name,
          photo: r.photo,
          age: r.age,
          position: r.positionPtBr,
          teamId: r.teamId,
          source: "db",
        })),
      });
    }

    const data = await apiRes.json() as { response?: ApiPlayerItem[] };
    const items: ApiPlayerItem[] = Array.isArray(data.response) ? data.response : [];

    // Build rows to upsert
    const toInsert = items
      .filter((item) => item.player?.id && item.player?.name)
      .map((item) => {
        const pl = item.player;
        const stats = item.statistics?.[0] ?? {};
        const teamId = stats.team?.id ?? 0;
        const pos = stats.games?.position ?? "";
        return {
          teamId,
          playerId: pl.id,
          name: pl.name,
          age: pl.age ?? 0,
          position: pos,
          positionPtBr: mapPosition(pos),
          photo: pl.photo ?? "",
          playerNumber: stats.games?.number ?? null,
          source: "api-football@search",
          cachedAt: Date.now(),
        };
      });

    // Upsert in chunks — skip on conflict (already cached from squad fetch)
    const CHUNK = 50;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      await db
        .insert(squadPlayersTable)
        .values(toInsert.slice(i, i + CHUNK))
        .onConflictDoNothing();
    }

    // 3. Re-query so we include newly inserted rows + already-cached ones
    const merged = await db
      .select()
      .from(squadPlayersTable)
      .where(ilike(squadPlayersTable.name, `%${q}%`))
      .orderBy(sql`length(name)`)
      .limit(15);

    return res.json({
      players: merged.slice(0, 12).map((r) => ({
        id: r.playerId,
        name: r.name,
        photo: r.photo,
        age: r.age,
        position: r.positionPtBr,
        teamId: r.teamId,
        source: r.source,
      })),
    });
  } catch (err) {
    console.error("GET /players/search error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
