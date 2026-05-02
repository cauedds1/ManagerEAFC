import { Router } from "express";
import { db, squadPlayersTable, clubsTable } from "@workspace/db";
import { eq, ilike, inArray, sql, gt } from "drizzle-orm";
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

// Returns a dedup key: "lastname|firstinitial" to catch "J. Doku" vs "Jérémy Doku",
// "Vini Jr." vs "Vinícius Júnior", accented vs unaccented variants, etc.
function nameKey(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents: júnior → junior
    .replace(/\./g, "")                                // remove dots: Jr. → Jr
    .replace(/\bjunior\b/g, "jr")                     // junior → jr
    .replace(/\bsenior\b/g, "sr");                    // senior → sr
  const parts = normalized.split(/\s+/).filter(Boolean);
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
    const msmcTeamNames = new Set<string>();
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
            photo: "",
            playerNumber: null,
            source: "msmc@search",
            cachedAt,
          });
          if (p.team) msmcTeamNames.add(p.team);
        }
      }
    } catch (e) {
      console.warn("msmc player search failed:", e);
    }

    // ── 3. API-Football — fetch squads by team ID (free tier compatible) ───────
    // The /players?search= endpoint requires league+team on free tier (returns 0 results).
    // Instead, use the team names from msmc to look up club IDs and fetch full squads.
    const allDiscoveredTeamIds: number[] = [];
    if (apiKey && msmcTeamNames.size > 0) {
      // Strip common club prefixes to improve DB matching (e.g. "CA Osasuna" → "Osasuna")
      const STRIP_PREFIXES = /^(ca|cf|rc|rcd|ud|sd|ss|as|ac|afc|fc|sc|sk|fk|bk|vfl|vfb|rb|tsv|sv|hsv|if|is|il|ik|gd|sl|sp|nk|hk|sfc|rsc|rsca)\s+/i;

      const stripTeamName = (raw: string) => raw.replace(STRIP_PREFIXES, "").trim();

      // Find which clubs in our DB match these team names
      const afTeamIds: number[] = [];
      for (const rawName of msmcTeamNames) {
        const stripped = stripTeamName(rawName);
        const words = stripped.split(/\s+/).filter((w) => w.length > 3);
        const lastWord = words[words.length - 1] ?? stripped;
        // Try progressively simpler variants: full → stripped → last significant word
        const candidates = [...new Set([rawName, stripped, lastWord])].filter(Boolean);
        let found = false;
        for (const candidate of candidates) {
          const rows = await db
            .select({ id: clubsTable.id })
            .from(clubsTable)
            .where(ilike(clubsTable.name, `%${candidate}%`))
            .limit(1);
          if (rows.length > 0) {
            afTeamIds.push(rows[0].id);
            found = true;
            break;
          }
        }
        if (!found) console.warn(`[players/search] no club match for team: "${rawName}"`);
      }

      // Only fetch squads for teams not already synced as api-football@v2
      const unsyncedIds: number[] = [];
      for (const teamId of afTeamIds) {
        if (teamId <= 0) continue;
        const existing = await db
          .select({ teamId: squadPlayersTable.teamId })
          .from(squadPlayersTable)
          .where(eq(squadPlayersTable.teamId, teamId))
          .limit(1);
        if (existing.length === 0) unsyncedIds.push(teamId);
      }
      // Track all discovered team IDs (synced or unsynced) for the supplemental query
      allDiscoveredTeamIds.push(...afTeamIds.filter((id) => id > 0));

      // Fetch squad for each unsynced team (max 3 per search to stay under rate limits)
      for (const teamId of unsyncedIds.slice(0, 3)) {
        try {
          const squadRes = await fetch(
            `${API_FOOTBALL_BASE}/players/squads?team=${teamId}`,
            { headers: { "x-apisports-key": apiKey }, signal: AbortSignal.timeout(10000) }
          );
          if (!squadRes.ok) continue;

          const data = await squadRes.json() as { response?: Array<{ players?: ApiPlayerItem["player"][] }> };
          const playersRaw = data.response?.[0]?.players ?? [];
          for (const p of playersRaw.filter((pl: ApiPlayerItem["player"]) => pl?.id && pl?.name)) {
            const pos = String((p as unknown as Record<string, unknown>).position ?? "");
            toInsert.push({
              teamId,
              playerId: p.id,
              name: p.name,
              age: p.age ?? 0,
              position: pos,
              positionPtBr: mapPosition(pos),
              photo: p.photo ?? "",
              playerNumber: null,
              source: "api-football@v2",
              cachedAt,
            });
          }
        } catch (e) {
          console.warn(`Squad fetch failed for team ${teamId}:`, e);
        }
      }
    }

    // ── 4. Upsert to DB (cache everything for future searches) ────────────────
    const msmcRows = toInsert.filter((r) => (r.source as string).startsWith("msmc"));
    const afRows   = toInsert.filter((r) => (r.source as string).startsWith("api-football"));

    const CHUNK = 50;
    if (msmcRows.length > 0) {
      for (let i = 0; i < msmcRows.length; i += CHUNK) {
        await db
          .insert(squadPlayersTable)
          .values(msmcRows.slice(i, i + CHUNK))
          .onConflictDoNothing();
      }
    }
    // api-football rows — always update photo/age/name so real face photo wins
    if (afRows.length > 0) {
      for (let i = 0; i < afRows.length; i += CHUNK) {
        await db
          .insert(squadPlayersTable)
          .values(afRows.slice(i, i + CHUNK))
          .onConflictDoUpdate({
            target: [squadPlayersTable.teamId, squadPlayersTable.playerId],
            set: {
              photo:       sql`excluded.photo`,
              age:         sql`excluded.age`,
              name:        sql`excluded.name`,
              positionPtBr: sql`excluded.position_pt_br`,
              source:      sql`excluded.source`,
              cachedAt:    sql`excluded.cached_at`,
            },
          });
      }
    }

    // ── 5. Re-query and return (includes freshly inserted + pre-existing) ─────
    const merged = await db
      .select()
      .from(squadPlayersTable)
      .where(ilike(squadPlayersTable.name, `%${q}%`))
      .orderBy(sql`length(name)`)
      .limit(60);

    // ── 6. Supplement: api-football@v2 records from discovered teams ───────────
    // API-Football stores abbreviated names (e.g. "A. Budimir") that don't match
    // a query like "ante b", so the ILIKE re-query misses them. We fix this by
    // fetching all players from the discovered teams and merging via nameKey dedup,
    // which picks the api-football@v2 record (real photo) over the msmc one.
    if (allDiscoveredTeamIds.length > 0) {
      const msmcNameKeys = new Set(
        toInsert
          .filter((r) => (r.source as string).startsWith("msmc"))
          .map((r) => nameKey(r.name as string))
      );
      if (msmcNameKeys.size > 0) {
        const afTeamPlayers = await db
          .select()
          .from(squadPlayersTable)
          .where(inArray(squadPlayersTable.teamId, allDiscoveredTeamIds))
          .limit(200);
        // Only include those whose nameKey matches an msmc result we actually found
        const relevant = afTeamPlayers.filter((r) => msmcNameKeys.has(nameKey(r.name)));
        merged.push(...relevant);
      }
    }

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
      .where(eq(squadPlayersTable.source, "api-football@v2"));

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
                source: "api-football@v2",
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

router.get("/players/team-details", async (req, res) => {
  const apiKey = process.env.API_FOOTBALL_KEY ?? "";
  if (!apiKey) return res.status(503).json({ error: "API_FOOTBALL_KEY not configured" });

  const teamId = parseInt(String(req.query.teamId ?? ""), 10);
  const baseSeason = parseInt(String(req.query.season ?? ""), 10) || new Date().getFullYear();

  if (!teamId) return res.status(400).json({ error: "teamId required" });

  type PlayerInfo = { playerId: number; nationality: string; height: string; weight: string };

  async function fetchForSeason(season: number): Promise<PlayerInfo[]> {
    const results: PlayerInfo[] = [];
    let page = 1;
    while (true) {
      const url = `${API_FOOTBALL_BASE}/players?team=${teamId}&season=${season}&page=${page}`;
      let afRes: Response;
      try {
        afRes = await fetch(url, {
          headers: { "x-apisports-key": apiKey },
          signal: AbortSignal.timeout(15000),
        });
      } catch { break; }
      if (!afRes.ok) break;
      const data = await afRes.json() as {
        response?: Array<{
          player: {
            id: number;
            nationality?: string;
            height?: string;
            weight?: string;
          };
        }>;
        paging?: { current: number; total: number };
      };
      for (const item of (data.response ?? [])) {
        if (!item.player?.id) continue;
        results.push({
          playerId: item.player.id,
          nationality: item.player.nationality ?? "",
          height: item.player.height ?? "",
          weight: item.player.weight ?? "",
        });
      }
      const paging = data.paging;
      if (!paging || paging.current >= paging.total) break;
      page++;
    }
    return results;
  }

  try {
    let players = await fetchForSeason(baseSeason);
    if (players.length === 0) {
      players = await fetchForSeason(baseSeason - 1);
    }
    return res.json({ players });
  } catch (err) {
    console.error("GET /players/team-details error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
