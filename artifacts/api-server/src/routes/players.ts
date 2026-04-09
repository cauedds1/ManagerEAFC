import { Router } from "express";
import { db, squadPlayersTable } from "@workspace/db";
import { ilike, sql } from "drizzle-orm";

const router = Router();

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const MSMC_BASE = "https://api.msmc.cc/api/eafc";

// Maps English position codes (API-Football / msmc.cc) to pt-BR abbreviations
function mapPosition(pos: string): string {
  const p = (pos ?? "").toUpperCase().trim();
  if (["GK", "GOALKEEPER", "GOL"].includes(p)) return "GOL";
  if (["LB", "RB", "LWB", "RWB", "WB", "LAT"].includes(p)) return "LAT";
  if (["CB", "SW", "CENTRE-BACK", "CENTREBACK", "DEFENDER", "ZAG"].includes(p)) return "ZAG";
  if (["CDM", "DM", "DMF", "VOL"].includes(p)) return "VOL";
  if (["LW", "LM", "PE"].includes(p)) return "PE";
  if (["RW", "RM", "PD"].includes(p)) return "PD";
  if (["CAM", "AM", "AMF", "MEI"].includes(p)) return "MEI";
  if (["CM", "MC", "MIDFIELDER"].includes(p)) return "MC";
  if (["CF", "SS", "SA"].includes(p)) return "SA";
  if (["ST", "FW", "WF", "CA"].includes(p)) return "CA";
  if (["ATTACKER", "FORWARD", "ATA"].includes(p)) return "ATA";
  return "MC";
}

interface MsmcPlayer {
  id?: string;
  name?: string;
  age?: string | number;
  position?: string;
  card?: string;
  team?: string;
}

interface ApiPlayerItem {
  player: {
    id: number;
    name: string;
    age: number;
    nationality: string;
    photo: string;
  };
  statistics: Array<{
    team?: { id: number; name: string };
    games?: { position?: string; number?: number };
  }>;
}

interface DbRow { playerId: number; name: string; photo: string; age: number; positionPtBr: string; teamId: number; }
function formatResponse(rows: DbRow[]) {
  return rows.slice(0, 12).map((r) => ({
    id: r.playerId,
    name: r.name,
    photo: r.photo,
    age: r.age,
    position: r.positionPtBr,
    teamId: r.teamId,
  }));
}

router.get("/players/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const apiKey = String(req.query.apiKey ?? "").trim();

  if (!q || q.length < 2) return res.json({ players: [] });

  try {
    // ── 1. Search DB ──────────────────────────────────────────────────────────
    const dbRows = await db
      .select()
      .from(squadPlayersTable)
      .where(ilike(squadPlayersTable.name, `%${q}%`))
      .orderBy(sql`length(name)`)
      .limit(15);

    if (dbRows.length >= 5) {
      return res.json({ players: formatResponse(dbRows) });
    }

    const cachedAt = Date.now();
    const toInsert: typeof squadPlayersTable.$inferInsert[] = [];

    // ── 2. msmc.cc — free, EA FC 26 data, no API key ──────────────────────────
    try {
      const msmcRes = await fetch(
        `${MSMC_BASE}/players?name=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (msmcRes.ok) {
        const raw = await msmcRes.json() as MsmcPlayer[];
        const arr: MsmcPlayer[] = Array.isArray(raw) ? raw : [];
        for (const p of arr.slice(0, 20)) {
          const id = parseInt(String(p.id ?? "0"), 10);
          if (!id || !p.name) continue;
          const ptBr = mapPosition(p.position ?? "");
          toInsert.push({
            teamId: 0,
            playerId: id,
            name: p.name,
            age: parseInt(String(p.age ?? "0"), 10) || 0,
            position: p.position ?? "",
            positionPtBr: ptBr,
            photo: p.card ?? "",
            playerNumber: null,
            source: "msmc@search",
            cachedAt,
          });
        }
      }
    } catch (e) {
      console.warn("msmc player search failed:", e);
    }

    // ── 3. API-Football (optional, provides face photos) ──────────────────────
    if (apiKey) {
      try {
        const afRes = await fetch(
          `${API_FOOTBALL_BASE}/players?search=${encodeURIComponent(q)}&season=2024`,
          { headers: { "x-apisports-key": apiKey }, signal: AbortSignal.timeout(8000) }
        );
        if (afRes.ok) {
          const data = await afRes.json() as { response?: ApiPlayerItem[] };
          for (const item of (data.response ?? []).slice(0, 20)) {
            const pl = item.player;
            if (!pl?.id || !pl?.name) continue;
            const stats = item.statistics?.[0] ?? {};
            const teamId = stats.team?.id ?? 0;
            const pos = stats.games?.position ?? "";
            toInsert.push({
              teamId,
              playerId: pl.id,
              name: pl.name,
              age: pl.age ?? 0,
              position: pos,
              positionPtBr: mapPosition(pos),
              photo: pl.photo ?? "",
              playerNumber: stats.games?.number ?? null,
              source: "api-football@search",
              cachedAt,
            });
          }
        }
      } catch (e) {
        console.warn("API-Football player search failed:", e);
      }
    }

    // ── 4. Upsert to DB (cache everything for future searches) ────────────────
    if (toInsert.length > 0) {
      const CHUNK = 50;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        await db
          .insert(squadPlayersTable)
          .values(toInsert.slice(i, i + CHUNK))
          .onConflictDoNothing();
      }
    }

    // ── 5. Re-query and return (includes freshly inserted + pre-existing) ─────
    const merged = await db
      .select()
      .from(squadPlayersTable)
      .where(ilike(squadPlayersTable.name, `%${q}%`))
      .orderBy(sql`length(name)`)
      .limit(15);

    return res.json({ players: formatResponse(merged) });
  } catch (err) {
    console.error("GET /players/search error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
