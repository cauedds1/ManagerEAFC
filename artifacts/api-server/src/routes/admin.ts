import { Router } from "express";
import { db, clubsTable, squadPlayersTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const router = Router();

const API_BASE = "https://v3.football.api-sports.io";
const DELAY_MS = 150;

const ALL_LEAGUE_IDS = [
  // Domestic
  39, 40, 41, 42,       // England
  78, 79,               // Germany
  61,                   // France
  135,                  // Italy
  140,                  // Spain
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

function mapPosition(pos: string): string {
  const p = (pos ?? "").toUpperCase().trim();
  if (["GK", "GOALKEEPER"].includes(p)) return "GOL";
  if (["LB", "RB", "LWB", "RWB", "WB"].includes(p)) return "LAT";
  if (["CB", "SW", "DEFENDER"].includes(p)) return "ZAG";
  if (["CDM", "DM", "DMF"].includes(p)) return "VOL";
  if (["LW", "LM"].includes(p)) return "PE";
  if (["RW", "RM"].includes(p)) return "PD";
  if (["CAM", "AM", "AMF"].includes(p)) return "MEI";
  if (["CM", "MIDFIELDER"].includes(p)) return "MC";
  if (["CF", "SS"].includes(p)) return "SA";
  if (["ST", "FW", "WF"].includes(p)) return "CA";
  if (["ATTACKER", "FORWARD"].includes(p)) return "ATA";
  return "MC";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET /admin/seed?apiKey=... — SSE stream that imports all clubs + squads
router.get("/admin/seed", async (req, res) => {
  const apiKey = String(req.query.apiKey ?? "").trim();
  if (!apiKey) {
    res.status(400).json({ error: "apiKey query param required" });
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
        const res2 = await fetch(`${API_BASE}/teams?league=${leagueId}&season=2025`, {
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
      .where(sql`source LIKE 'api-football%'`);
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
                source: "api-football@sync",
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

export default router;
