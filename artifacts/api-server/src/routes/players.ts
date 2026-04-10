import { Router } from "express";
import { db, squadPlayersTable, clubsTable } from "@workspace/db";
import { ilike, sql, gt } from "drizzle-orm";
import { mapPosition } from "../lib/positions";

const router = Router();

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const MSMC_BASE = "https://api.msmc.cc/api/eafc";

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

interface DbRow { playerId: number; name: string; photo: string; age: number; positionPtBr: string; teamId: number; source: string; }

// Source priority: api-football sync/squad > api-football search > msmc squad > msmc search
function sourcePriority(source: string): number {
  const s = source ?? "";
  if (s.startsWith("api-football@sync") || s.startsWith("api-football@v")) return 0;
  if (s.startsWith("api-football")) return 1;
  if (s.startsWith("fc26") || s.startsWith("msmc") && !s.includes("search")) return 2;
  return 3;
}

// Returns a dedup key: "lastname|firstinitial" to catch "J. Doku" vs "Jérémy Doku"
function nameKey(name: string): string {
  const parts = name.trim().toLowerCase().replace(/\./g, "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name.toLowerCase();
  const last = parts[parts.length - 1];
  const firstInitial = parts[0]?.[0] ?? "";
  return `${last}|${firstInitial}`;
}

function deduplicateByName(rows: DbRow[]): DbRow[] {
  // Sort: best source first, then longer (more complete) name wins within same source
  const sorted = [...rows].sort((a, b) => {
    const sp = sourcePriority(a.source) - sourcePriority(b.source);
    if (sp !== 0) return sp;
    return b.name.length - a.name.length; // prefer full name over abbreviated
  });

  const byExact = new Map<string, DbRow>();
  const byKey = new Map<string, DbRow>();

  for (const r of sorted) {
    const exact = r.name.toLowerCase().trim();
    const key = nameKey(r.name);
    // Only add if neither exact nor abbreviated version seen yet
    if (!byExact.has(exact) && !byKey.has(key)) {
      byExact.set(exact, r);
      byKey.set(key, r);
    }
  }

  return Array.from(byExact.values());
}

function formatResponse(rows: DbRow[]) {
  return deduplicateByName(rows).slice(0, 12).map((r) => ({
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
  const apiKey = process.env.API_FOOTBALL_KEY ?? "";

  if (!q || q.length < 2) return res.json({ players: [] });

  try {
    // ── 1. Search DB ──────────────────────────────────────────────────────────
    const dbRows = await db
      .select()
      .from(squadPlayersTable)
      .where(ilike(squadPlayersTable.name, `%${q}%`))
      .orderBy(sql`length(name)`)
      .limit(60); // fetch more so deduplication can pick the best-sourced entry

    const dedupedRows = deduplicateByName(dbRows);
    if (dedupedRows.length >= 5) {
      return res.json({ players: dedupedRows.slice(0, 12).map((r) => ({
        id: r.playerId, name: r.name, photo: r.photo, age: r.age, position: r.positionPtBr, teamId: r.teamId,
      })) });
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
      .limit(60);

    return res.json({ players: formatResponse(merged) });
  } catch (err) {
    console.error("GET /players/search error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /players/sync ───────────────────────────────────────────────────────
// Bulk-fetches squads from API-Football for all clubs in the DB and caches
// players with real face photos. Only processes clubs not yet synced from API.
router.post("/players/sync", async (req, res) => {
  const apiKey = process.env.API_FOOTBALL_KEY ?? "";
  if (!apiKey) {
    return res.status(503).json({ error: "API_FOOTBALL_KEY not configured on server" });
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    const MAX_PER_RUN = 90; // stay under 100 req/day free tier

    // 1. Get all clubs with valid API-Football IDs
    const allClubs = await db
      .select({ id: clubsTable.id, name: clubsTable.name })
      .from(clubsTable)
      .where(gt(clubsTable.id, 0));

    if (allClubs.length === 0) {
      return res.json({ teams: 0, players: 0, message: "Nenhum clube encontrado no banco. Atualize a lista de clubes primeiro." });
    }

    // 2. Find which clubs already have API-Football sourced squads (skip them)
    const syncedTeamRows = await db
      .selectDistinct({ teamId: squadPlayersTable.teamId })
      .from(squadPlayersTable)
      .where(ilike(squadPlayersTable.source, "api-football%"));

    const syncedIds = new Set(syncedTeamRows.map((r) => r.teamId));
    const pending = allClubs.filter((c) => !syncedIds.has(c.id));
    const toProcess = pending.slice(0, MAX_PER_RUN);
    const remaining = Math.max(0, pending.length - toProcess.length);

    if (toProcess.length === 0) {
      return res.json({
        teams: 0,
        players: 0,
        message: `Todos os ${allClubs.length} times já estão sincronizados com fotos reais.`,
      });
    }

    const clubs = toProcess;

    let teamsProcessed = 0;
    let playersInserted = 0;
    const cachedAt = Date.now();

    for (const club of clubs) {
      try {
        const afRes = await fetch(
          `${API_FOOTBALL_BASE}/players/squads?team=${club.id}`,
          { headers: { "x-apisports-key": apiKey.trim() }, signal: AbortSignal.timeout(10000) }
        );

        if (afRes.status === 429) {
          // Rate limit hit — stop and report
          return res.json({
            teams: teamsProcessed,
            players: playersInserted,
            message: `Limite de API atingido após ${teamsProcessed} times. Tente novamente amanhã.`,
          });
        }

        if (!afRes.ok) {
          await sleep(300);
          continue;
        }

        const data = await afRes.json() as { response?: Array<{ players?: ApiPlayerItem["player"][] }> };
        const playersRaw = data.response?.[0]?.players ?? [];

        if (playersRaw.length > 0) {
          const values = playersRaw
            .filter((p: ApiPlayerItem["player"]) => p?.id && p?.name)
            .map((p: ApiPlayerItem["player"]) => {
              const pos = String((p as unknown as Record<string, unknown>).position ?? "");
              return {
                teamId: club.id,
                playerId: p.id,
                name: p.name,
                age: p.age ?? 0,
                position: pos,
                positionPtBr: mapPosition(pos),
                photo: p.photo ?? "",
                playerNumber: null as number | null,
                source: "api-football@sync",
                cachedAt,
              };
            });

          if (values.length > 0) {
            await db
              .insert(squadPlayersTable)
              .values(values)
              .onConflictDoUpdate({
                target: [squadPlayersTable.teamId, squadPlayersTable.playerId],
                set: {
                  photo: sql`excluded.photo`,
                  age: sql`excluded.age`,
                  source: sql`excluded.source`,
                  cachedAt: sql`excluded.cached_at`,
                },
              });
            playersInserted += values.length;
          }
        }

        teamsProcessed++;
        await sleep(300); // respect API rate limits (300ms = ~3 req/s well under 100/day limit)
      } catch {
        await sleep(300);
        continue;
      }
    }

    const doneMsg = `${teamsProcessed} times sincronizados, ${playersInserted} jogadores com fotos reais.`;
    const remainMsg = remaining > 0 ? ` Clique novamente para sincronizar mais ${remaining} times.` : " Tudo sincronizado!";
    return res.json({
      teams: teamsProcessed,
      players: playersInserted,
      remaining,
      message: doneMsg + remainMsg,
    });
  } catch (err) {
    console.error("POST /players/sync error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
