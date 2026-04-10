import { Router } from "express";
import { db, clubsTable, squadPlayersTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { mapPosition, AF_TO_FC26 } from "../lib/positions";

const router = Router();

const API_BASE = "https://v3.football.api-sports.io";
const MSMC_BASE = "https://api.msmc.cc/api/eafc";
const DELAY_MS = 150;

const ALL_LEAGUE_IDS = [
  // Domestic
  39, 40, 41, 42,       // England
  78, 79,               // Germany
  61,                   // France
  135,                  // Italy
  140, 141,             // Spain
  88,                   // Netherlands
  94,                   // Portugal
  128,                  // Argentina
  144,                  // Belgium
  169,                  // China
  179,                  // Scotland
  188,                  // Australia
  207,                  // Switzerland
  218,                  // Austria
  253,                  // USA (MLS)
  283,                  // Romania
  292,                  // South Korea
  307,                  // Saudi Arabia
  357,                  // Ireland
  106,                  // Poland
  113,                  // Sweden
  103,                  // Norway
  119,                  // Denmark
  // International
  2, 3, 848, 13,
];

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
                league: String(leagueId),
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

export default router;
