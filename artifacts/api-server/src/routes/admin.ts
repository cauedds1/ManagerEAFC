import { Router } from "express";
import { db, clubsTable, squadPlayersTable, careersTable, seasonsTable, careerDataTable, seasonDataTable } from "@workspace/db";
import { sql, eq, notInArray } from "drizzle-orm";
import { mapPosition, AF_TO_FC26 } from "../lib/positions";

const router = Router();

const API_BASE = "https://v3.football.api-sports.io";
const MSMC_BASE = "https://api.msmc.cc/api/eafc";
const DELAY_MS = 150;

const LEAGUE_MAP: Record<number, string> = {
  39: "Premier League", 40: "Championship", 41: "League One", 42: "League Two",
  78: "Bundesliga", 79: "2. Bundesliga",
  61: "Ligue 1",
  135: "Serie A",
  140: "LaLiga", 141: "LaLiga 2",
  88: "Eredivisie",
  94: "Liga Portugal",
  128: "Liga Profesional",
  144: "Pro League",
  169: "Super League",
  179: "Premiership",
  188: "A-League",
  207: "Super League",
  218: "Bundesliga",
  253: "MLS",
  283: "Liga 1",
  292: "K League 1",
  307: "Saudi Pro League",
  357: "League of Ireland",
  106: "Ekstraklasa",
  113: "Allsvenskan",
  103: "Eliteserien",
  119: "Superliga",
  2: "UEFA Champions League", 3: "UEFA Europa League",
  848: "UEFA Conference League", 13: "CONMEBOL Libertadores",
};

const ALL_LEAGUE_IDS = Object.keys(LEAGUE_MAP).map(Number);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retorna o season correto para ligas europeias (calendário Ago–Jun).
 *  Ex: abril/2026 → 2025; setembro/2026 → 2026 */
function currentSeason(): number {
  const now = new Date();
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

// Returns "lastname|firstinitial" — matches "J. Doku" to "Jérémy Doku"
function nameKey(name: string): string {
  const parts = name.trim().toLowerCase().replace(/\./g, "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name.toLowerCase();
  const last = parts[parts.length - 1];
  const firstInitial = parts[0]?.[0] ?? "";
  return `${last}|${firstInitial}`;
}

interface MsmcPlayerRaw {
  id?: string;
  name?: string;
  position?: string;
  age?: string | number;
  card?: string;
}

// GET /admin/seed — SSE stream that imports all clubs + squads
router.get("/admin/seed", async (req, res) => {
  const apiKey = process.env.API_FOOTBALL_KEY ?? "";
  if (!apiKey) {
    res.status(503).json({ error: "API_FOOTBALL_KEY not configured on server" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const emit = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
      (res as unknown as { flush: () => void }).flush();
    }
  };

  const headers = { "x-apisports-key": apiKey };
  const cachedAt = Date.now();
  let clubsSaved = 0;
  let playersSaved = 0;
  let requestCount = 0;

  try {
    // ── Phase 1: Fetch all clubs from all leagues ─────────────────────────────
    emit({ type: "phase", phase: 1, message: "Importando lista de times..." });

    const clubMap = new Map<number, typeof clubsTable.$inferInsert>();

    for (const leagueId of ALL_LEAGUE_IDS) {
      emit({ type: "league", leagueId, message: `Buscando times da liga ${leagueId}...` });

      try {
        const res2 = await fetch(`${API_BASE}/teams?league=${leagueId}&season=${currentSeason()}`, {
          headers,
          signal: AbortSignal.timeout(12000),
        });
        requestCount++;

        if (res2.status === 429) {
          emit({ type: "error", message: "Limite de requisições atingido (429). Tente novamente amanhã." });
          res.end();
          return;
        }

        if (res2.ok) {
          const data = await res2.json() as { response?: Array<{ team: { id: number; name: string; logo: string; country: string }; venue?: { name?: string; city?: string; capacity?: number } }> };
          for (const item of data.response ?? []) {
            if (!clubMap.has(item.team.id)) {
              clubMap.set(item.team.id, {
                id: item.team.id,
                name: item.team.name,
                logoUrl: item.team.logo ?? "",
                league: LEAGUE_MAP[leagueId] ?? String(leagueId),
                leagueId,
                country: item.team.country ?? null,
                cachedAt,
              });
            }
          }
        }
      } catch { /* skip league on error */ }

      await sleep(DELAY_MS);
    }

    // Upsert all clubs
    const clubValues = Array.from(clubMap.values());
    if (clubValues.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < clubValues.length; i += CHUNK) {
        await db.insert(clubsTable)
          .values(clubValues.slice(i, i + CHUNK))
          .onConflictDoUpdate({
            target: clubsTable.id,
            set: {
              name: sql`excluded.name`,
              logoUrl: sql`excluded.logo_url`,
              league: sql`excluded.league`,
              leagueId: sql`excluded.league_id`,
              country: sql`excluded.country`,
              cachedAt: sql`excluded.cached_at`,
            },
          });
      }
      clubsSaved = clubValues.length;
    }

    emit({
      type: "phase1_done",
      clubsSaved,
      message: `${clubsSaved} times salvos. Iniciando importação de elencos...`,
    });

    // ── Phase 2: Fetch squad for each club ────────────────────────────────────
    emit({ type: "phase", phase: 2, message: "Importando elencos..." });

    // Find which team IDs already have API-sourced squad data
    const existingSquads = await db
      .selectDistinct({ teamId: squadPlayersTable.teamId })
      .from(squadPlayersTable)
      .where(eq(squadPlayersTable.source, "api-football@v2"));
    const existingIds = new Set(existingSquads.map((r: { teamId: number }) => r.teamId));

    const allClubIds = Array.from(clubMap.keys()).filter((id) => !existingIds.has(id));
    const total = allClubIds.length;

    emit({ type: "squads_start", total, message: `${total} times sem elenco para importar` });

    let processed = 0;

    for (const teamId of allClubIds) {
      const clubName = clubMap.get(teamId)?.name ?? String(teamId);

      try {
        const afRes = await fetch(`${API_BASE}/players/squads?team=${teamId}`, {
          headers,
          signal: AbortSignal.timeout(12000),
        });
        requestCount++;

        if (afRes.status === 429) {
          emit({
            type: "rate_limit",
            processed,
            total,
            playersSaved,
            message: `Limite de req. atingido após ${processed}/${total} times. Reinicie amanhã — o que foi salvo persiste.`,
          });
          res.end();
          return;
        }

        if (afRes.ok) {
          const data = await afRes.json() as {
            response?: Array<{
              players?: Array<{ id: number; name: string; age: number; number?: number; position: string; photo: string }>;
            }>;
          };

          const playersRaw = data.response?.[0]?.players ?? [];
          if (playersRaw.length > 0) {
            const values = playersRaw
              .filter((p) => p?.id && p?.name)
              .map((p) => ({
                teamId,
                playerId: p.id,
                name: p.name,
                age: p.age ?? 0,
                position: p.position ?? "",
                positionPtBr: mapPosition(p.position ?? ""),
                photo: p.photo ?? "",
                playerNumber: p.number ?? null,
                source: "api-football@v2",
                cachedAt,
              }));

            if (values.length > 0) {
              await db.insert(squadPlayersTable)
                .values(values)
                .onConflictDoUpdate({
                  target: [squadPlayersTable.teamId, squadPlayersTable.playerId],
                  set: {
                    photo: sql`excluded.photo`,
                    age: sql`excluded.age`,
                    name: sql`excluded.name`,
                    positionPtBr: sql`excluded.position_pt_br`,
                    source: sql`excluded.source`,
                    cachedAt: sql`excluded.cached_at`,
                  },
                });
              playersSaved += values.length;
            }
          }
        }
      } catch { /* skip club on error */ }

      processed++;
      if (processed % 10 === 0 || processed === total) {
        emit({
          type: "progress",
          processed,
          total,
          playersSaved,
          clubName,
          message: `${processed}/${total} times — ${playersSaved} jogadores salvos`,
        });
      }

      await sleep(DELAY_MS);
    }

    // ── Done ──────────────────────────────────────────────────────────────────
    emit({
      type: "done",
      clubsSaved,
      playersSaved,
      requests: requestCount,
      message: `Concluído! ${clubsSaved} times e ${playersSaved} jogadores importados com fotos reais.`,
    });

    res.end();
  } catch (err) {
    console.error("GET /admin/seed error:", err);
    emit({ type: "error", message: "Erro interno no servidor." });
    res.end();
  }
});

// GET /admin/reenrich-positions — SSE stream that updates positionPtBr for all players
// using msmc.cc (EA FC 26) data. Uses AF_TO_FC26 to convert API-Football team names.
router.get("/admin/reenrich-positions", async (req, res) => {
  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const emit = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
      (res as unknown as { flush: () => void }).flush();
    }
  };

  try {
    // 1. Load all clubs from DB
    const clubs = await db
      .select({ id: clubsTable.id, name: clubsTable.name })
      .from(clubsTable);

    if (clubs.length === 0) {
      emit({ type: "error", message: "Nenhum clube encontrado no banco. Execute 'Importar tudo' primeiro." });
      res.end();
      return;
    }

    const total = clubs.length;
    emit({ type: "start", total, message: `Enriquecendo posições de ${total} times via msmc.cc...` });

    let processed = 0;
    let teamsEnriched = 0;
    let playersUpdated = 0;

    for (const club of clubs) {
      const fc26Name = AF_TO_FC26[club.name] ?? club.name;

      try {
        // 2. Fetch squad from msmc.cc
        const msmcRes = await fetch(
          `${MSMC_BASE}/players?game=fc26&team=${encodeURIComponent(fc26Name)}`,
          { signal: AbortSignal.timeout(10000) }
        );

        if (msmcRes.ok) {
          const raw = await msmcRes.json() as MsmcPlayerRaw[];
          const msmcPlayers: MsmcPlayerRaw[] = Array.isArray(raw) ? raw : [];

          if (msmcPlayers.length > 0) {
            // 3. Build name → position map from msmc.cc data (two keys: exact + nameKey)
            const exactMap = new Map<string, string>(); // lowercase name → positionPtBr
            const keyMap = new Map<string, string>();   // nameKey → positionPtBr

            for (const p of msmcPlayers) {
              if (!p.name || !p.position) continue;
              const ptBr = mapPosition(p.position);
              if (ptBr === "MC") continue; // skip generic fallback positions
              exactMap.set(p.name.toLowerCase().trim(), ptBr);
              keyMap.set(nameKey(p.name), ptBr);
            }

            if (exactMap.size === 0) {
              processed++;
              continue;
            }

            // 4. Load all DB players for this club
            const dbPlayers = await db
              .select({
                teamId: squadPlayersTable.teamId,
                playerId: squadPlayersTable.playerId,
                name: squadPlayersTable.name,
                positionPtBr: squadPlayersTable.positionPtBr,
              })
              .from(squadPlayersTable)
              .where(eq(squadPlayersTable.teamId, club.id));

            // 5. Find matches and build updates
            const updates: Array<{ teamId: number; playerId: number; positionPtBr: string }> = [];

            for (const dbPlayer of dbPlayers) {
              const exactMatch = exactMap.get(dbPlayer.name.toLowerCase().trim());
              const keyMatch = exactMatch === undefined ? keyMap.get(nameKey(dbPlayer.name)) : undefined;
              const newPos = exactMatch ?? keyMatch;

              if (newPos && newPos !== dbPlayer.positionPtBr) {
                updates.push({ teamId: dbPlayer.teamId, playerId: dbPlayer.playerId, positionPtBr: newPos });
              }
            }

            // 6. Apply updates in DB
            for (const upd of updates) {
              await db
                .update(squadPlayersTable)
                .set({ positionPtBr: upd.positionPtBr })
                .where(
                  sql`team_id = ${upd.teamId} AND player_id = ${upd.playerId}`
                );
            }

            if (updates.length > 0) {
              teamsEnriched++;
              playersUpdated += updates.length;
            }
          }
        }
      } catch { /* skip club on error */ }

      processed++;

      if (processed % 20 === 0 || processed === total) {
        emit({
          type: "progress",
          processed,
          total,
          teamsEnriched,
          playersUpdated,
          clubName: club.name,
          message: `${processed}/${total} times · ${playersUpdated} posições corrigidas`,
        });
      }

      await sleep(DELAY_MS);
    }

    emit({
      type: "done",
      processed: total,
      teamsEnriched,
      playersUpdated,
      message: `Concluído! ${teamsEnriched} times enriquecidos, ${playersUpdated} posições atualizadas.`,
    });

    res.end();
  } catch (err) {
    console.error("GET /admin/reenrich-positions error:", err);
    emit({ type: "error", message: "Erro interno no servidor." });
    res.end();
  }
});

// POST /admin/recover-career
//
// Recovers a career that was accidentally deleted by reconstructing the `careers` row
// from caller-supplied metadata and auto-discovering orphaned seasons from `season_data`.
//
// Requires header: x-admin-secret: <ADMIN_SECRET env var>
//
// Example (curl):
//   curl -X POST https://your-api/api/admin/recover-career \
//     -H "Content-Type: application/json" \
//     -H "x-admin-secret: YOUR_ADMIN_SECRET" \
//     -d '{
//       "career_id": "mc2j4k5xyz",
//       "user_id": 42,
//       "club_name": "Manchester City",
//       "club_id": 50,
//       "club_logo": "https://media.api-sports.io/football/teams/50.png",
//       "club_league": "Premier League",
//       "club_country": "England",
//       "club_primary": "#6CABDD",
//       "club_secondary": "#FFFFFF",
//       "coach": { "name": "João Silva", "nationality": "Brasil", "nationalityFlag": "🇧🇷", "age": 45 },
//       "season": "2024/25",
//       "season_ids": ["mc2j4k5xyz", "s-abc123-def"]
//     }'
//
// Fields:
//   career_id   (required) – the ID of the deleted career
//   user_id     (optional) – numeric user ID to own the career; defaults to null (shared)
//   coach       (optional) – coach object; defaults to placeholder
//   club_name   (optional) – club name; defaults to "Unknown Club"
//   club_id     (optional) – numeric club ID; defaults to 0
//   club_logo   (optional) – logo URL
//   club_league (optional) – league name
//   club_country/club_stadium/club_founded/club_primary/club_secondary/club_description – all optional
//   season      (optional) – career season label (e.g. "2024/25")
//   season_ids  (optional) – explicit list of season IDs to recover; if omitted, all orphaned
//                            season_ids found in season_data (not in seasons table) are used
router.post("/admin/recover-career", async (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || req.headers["x-admin-secret"] !== adminSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body as {
    career_id?: string;
    user_id?: number | null;
    coach?: object;
    club_name?: string;
    club_id?: number;
    club_logo?: string;
    club_league?: string;
    club_country?: string;
    club_stadium?: string;
    club_founded?: number;
    club_primary?: string;
    club_secondary?: string;
    club_description?: string;
    club_titles?: object[];
    season?: string;
    projeto?: string;
    competitions?: string[];
    season_ids?: string[];
  };

  const careerId = body.career_id?.trim();
  if (!careerId) {
    return res.status(400).json({ error: "career_id is required" });
  }

  try {
    // 1. Verify there are orphaned records in career_data for this career_id
    const orphanedCareerData = await db
      .select({ key: careerDataTable.key })
      .from(careerDataTable)
      .where(eq(careerDataTable.careerId, careerId))
      .limit(1);

    if (orphanedCareerData.length === 0) {
      return res.status(404).json({
        error: `Nenhum dado encontrado em career_data para career_id="${careerId}". Recuperação impossível sem dados.`,
      });
    }

    const now = Date.now();

    // 2. Reconstruct the careers row
    const coachFallback = { name: "Técnico", nationality: "Brasil", nationalityFlag: "🇧🇷", age: 40 };
    await db
      .insert(careersTable)
      .values({
        id: careerId,
        coachJson: JSON.stringify(body.coach ?? coachFallback),
        clubId: body.club_id ?? 0,
        clubName: body.club_name ?? "Unknown Club",
        clubLogo: body.club_logo ?? "",
        clubLeague: body.club_league ?? "",
        clubCountry: body.club_country ?? null,
        clubStadium: body.club_stadium ?? null,
        clubFounded: body.club_founded ?? null,
        clubPrimary: body.club_primary ?? null,
        clubSecondary: body.club_secondary ?? null,
        clubDescription: body.club_description ?? null,
        clubTitlesJson: body.club_titles ? JSON.stringify(body.club_titles) : null,
        season: body.season ?? "",
        projeto: body.projeto ?? null,
        competitionsJson: body.competitions ? JSON.stringify(body.competitions) : null,
        currentSeasonId: null,
        userId: body.user_id ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    // 3. Find season IDs to recover
    let targetSeasonIds: string[];

    if (body.season_ids && body.season_ids.length > 0) {
      targetSeasonIds = body.season_ids;
    } else {
      // Auto-discover: find all distinct season_ids in season_data that are not in seasons table
      const existingSeasonRows = await db.select({ id: seasonsTable.id }).from(seasonsTable);
      const existingSeasonIds = existingSeasonRows.map((r) => r.id);

      if (existingSeasonIds.length > 0) {
        const orphanedSeasons = await db
          .selectDistinct({ seasonId: seasonDataTable.seasonId })
          .from(seasonDataTable)
          .where(notInArray(seasonDataTable.seasonId, existingSeasonIds));
        targetSeasonIds = orphanedSeasons.map((r) => r.seasonId);
      } else {
        const orphanedSeasons = await db
          .selectDistinct({ seasonId: seasonDataTable.seasonId })
          .from(seasonDataTable);
        targetSeasonIds = orphanedSeasons.map((r) => r.seasonId);
      }
    }

    // 4. Sort season IDs by embedded timestamp (IDs are base36 timestamps or "s-<base36>-<random>")
    function extractTimestamp(id: string): number {
      const sMatch = id.match(/^s-([0-9a-z]+)-/);
      if (sMatch) return parseInt(sMatch[1], 36);
      const plain = id.match(/^([0-9a-z]+)/);
      if (plain) return parseInt(plain[1], 36);
      return 0;
    }
    targetSeasonIds.sort((a, b) => extractTimestamp(a) - extractTimestamp(b));

    // 5. Reconstruct seasons rows
    let recoveredSeasons = 0;
    let activatedSeasonId: string | null = null;

    for (let i = 0; i < targetSeasonIds.length; i++) {
      const seasonId = targetSeasonIds[i];
      const isLast = i === targetSeasonIds.length - 1;
      const label = `Temporada ${i + 1}`;

      const inserted = await db
        .insert(seasonsTable)
        .values({
          id: seasonId,
          careerId,
          label,
          competitionsJson: body.competitions ? JSON.stringify(body.competitions) : null,
          isActive: isLast,
          finalized: !isLast,
          createdAt: extractTimestamp(seasonId) || now,
        })
        .onConflictDoNothing()
        .returning({ id: seasonsTable.id });

      if (inserted.length > 0) {
        recoveredSeasons++;
        if (isLast) activatedSeasonId = seasonId;
      }
    }

    // 6. Update currentSeasonId on the careers row if we recovered at least one season
    if (activatedSeasonId) {
      await db
        .update(careersTable)
        .set({ currentSeasonId: activatedSeasonId, updatedAt: now })
        .where(eq(careersTable.id, careerId));
    }

    return res.json({
      ok: true,
      career_id: careerId,
      career_created: true,
      seasons_recovered: recoveredSeasons,
      active_season_id: activatedSeasonId,
      message: `Carreira "${body.club_name ?? careerId}" recuperada. ${recoveredSeasons} temporada(s) restaurada(s).`,
    });
  } catch (err) {
    console.error("POST /admin/recover-career error:", err);
    return res.status(500).json({ error: "Erro interno ao recuperar carreira", details: String(err) });
  }
});

export default router;
