import { Router } from "express";
import { db, clubsTable } from "@workspace/db";

const router = Router();

const CLUBS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Retorna o season correto para ligas europeias (calendário Ago–Jun).
 *  Ex: abril/2026 → 2025; setembro/2026 → 2026 */
function currentSeason(): number {
  const now = new Date();
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

interface LeagueInput {
  id: number;
  name: string;
  country?: string;
}

interface ApiTeamItem {
  team: { id: number; name: string; logo: string; country: string };
  venue?: { name?: string; city?: string; capacity?: number };
}

router.get("/clubs", async (_req, res) => {
  try {
    const clubs = await db.select().from(clubsTable);
    if (clubs.length === 0) return res.status(204).end();

    const cachedAt = Number(clubs[0].cachedAt);
    if (Date.now() - cachedAt > CLUBS_TTL_MS) return res.status(204).end();

    return res.json({
      clubs: clubs.map((c) => ({
        id: c.id,
        name: c.name,
        logo: c.logoUrl,
        league: c.league,
        leagueId: c.leagueId,
        country: c.country ?? undefined,
      })),
      cachedAt,
    });
  } catch (err) {
    console.error("GET /clubs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/clubs", async (req, res) => {
  try {
    const body = req.body as {
      clubs?: Array<{
        id: number;
        name: string;
        logo: string;
        league: string;
        leagueId: number;
        country?: string;
      }>;
      cachedAt?: number;
    };

    const { clubs, cachedAt } = body;
    if (!Array.isArray(clubs) || clubs.length === 0 || typeof cachedAt !== "number") {
      return res.status(400).json({ error: "clubs array and cachedAt required" });
    }

    const values = clubs.map((c) => ({
      id: c.id,
      name: c.name,
      logoUrl: c.logo ?? "",
      league: c.league,
      leagueId: c.leagueId,
      country: c.country ?? null,
      cachedAt,
    }));

    await db.transaction(async (tx) => {
      await tx.delete(clubsTable);
      const CHUNK = 200;
      for (let i = 0; i < values.length; i += CHUNK) {
        await tx.insert(clubsTable).values(values.slice(i, i + CHUNK));
      }
    });

    return res.json({ ok: true, count: clubs.length });
  } catch (err) {
    console.error("PUT /clubs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clubs/fetch", async (req, res) => {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "API_FOOTBALL_KEY not configured on server" });
    }

    const { leagues } = req.body as { leagues?: LeagueInput[] };
    if (!Array.isArray(leagues) || leagues.length === 0) {
      return res.status(400).json({ error: "leagues array required" });
    }

    const teamsMap = new Map<number, {
      id: number; name: string; logo: string; league: string; leagueId: number; country: string;
    }>();

    for (const league of leagues) {
      try {
        const r = await fetch(`${API_FOOTBALL_BASE}/teams?league=${league.id}&season=${currentSeason()}`, {
          headers: { "x-apisports-key": apiKey },
        });
        if (!r.ok) continue;
        let json: { response?: unknown };
        try { json = await r.json(); } catch { continue; }
        if (!Array.isArray(json.response)) continue;
        for (const item of json.response as ApiTeamItem[]) {
          if (!teamsMap.has(item.team.id)) {
            teamsMap.set(item.team.id, {
              id: item.team.id,
              name: item.team.name,
              logo: item.team.logo ?? "",
              league: league.name,
              leagueId: league.id,
              country: item.team.country ?? league.country ?? "",
            });
          }
        }
        await new Promise((r) => setTimeout(r, 300));
      } catch {}
    }

    const clubs = Array.from(teamsMap.values());
    if (clubs.length === 0) {
      return res.status(502).json({ error: "No clubs fetched from API-Football" });
    }

    const cachedAt = Date.now();
    const values = clubs.map((c) => ({
      id: c.id,
      name: c.name,
      logoUrl: c.logo,
      league: c.league,
      leagueId: c.leagueId,
      country: c.country ?? null,
      cachedAt,
    }));

    await db.transaction(async (tx) => {
      await tx.delete(clubsTable);
      const CHUNK = 200;
      for (let i = 0; i < values.length; i += CHUNK) {
        await tx.insert(clubsTable).values(values.slice(i, i + CHUNK));
      }
    });

    return res.json({ ok: true, count: clubs.length });
  } catch (err) {
    console.error("POST /clubs/fetch error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/clubs", async (_req, res) => {
  try {
    await db.delete(clubsTable);
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /clubs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
