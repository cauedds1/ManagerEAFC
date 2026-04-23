import { Router } from "express";
import { db, squadPlayersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { isR2Configured, cacheExternalImage } from "../lib/r2Storage";

const router = Router();

const SQUAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

interface SquadPlayerBody {
  id: number;
  name: string;
  age: number;
  position: string;
  positionPtBr: string;
  photo: string;
  number?: number;
}

function normalizePosToGroup(pos: string): string {
  const p = (pos ?? "").toUpperCase().trim();
  if (["GOALKEEPER", "GK", "GOL"].includes(p)) return "Goalkeeper";
  if (["DEFENDER", "CB", "SW", "LB", "RB", "LWB", "RWB", "WB", "CENTREBACK", "FULLBACK", "ZAG", "LAT"].includes(p)) return "Defender";
  if (["MIDFIELDER", "CDM", "DM", "DMF", "CM", "LW", "LM", "RW", "RM", "CAM", "AM", "AMF", "CF", "SS",
       "VOL", "MC", "MEI", "PE", "PD", "SA", "DEFENSIVEMID", "CENTRALMID", "ATTACKINGMID", "LEFTWING", "RIGHTWING", "SECONDSTRIKER"].includes(p)) return "Midfielder";
  if (["ATTACKER", "FORWARD", "ST", "FW", "WF", "CA", "ATA", "STRIKER", "BROADFORWARD"].includes(p)) return "Attacker";
  return "Midfielder";
}

const POSITION_PT_BR: Record<string, string> = {
  Goalkeeper: "GOL",
  Defender:   "DEF",
  Midfielder: "MID",
  Attacker:   "ATA",
};

interface ApiFootballPlayer {
  id: number;
  name: string;
  age: number;
  number?: number;
  position: string;
  photo: string;
}

async function fetchApiFootballSquad(teamId: number, apiKey: string): Promise<SquadPlayerBody[] | null> {
  const res = await fetch(`${API_FOOTBALL_BASE}/players/squads?team=${teamId}`, {
    headers: { "x-apisports-key": apiKey },
  });
  if (!res.ok) return null;
  let json: { response?: Array<{ players?: ApiFootballPlayer[] }> };
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const raw = json.response?.[0]?.players;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  return raw.map((p) => {
    const pos = normalizePosToGroup(p.position);
    return {
      id: p.id,
      name: p.name,
      age: p.age ?? 0,
      position: pos,
      positionPtBr: POSITION_PT_BR[pos] ?? "MID",
      photo: p.photo ?? "",
      number: p.number ?? undefined,
    };
  });
}

async function buildAndSaveSquad(teamId: number): Promise<SquadPlayerBody[] | null> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return null;

  const players = await fetchApiFootballSquad(teamId, apiKey);
  if (!players || players.length === 0) return null;

  const cachedAt = Date.now();
  const values = players.map((p) => ({
    teamId,
    playerId: p.id,
    name: p.name,
    age: p.age ?? 0,
    position: p.position,
    positionPtBr: p.positionPtBr,
    photo: p.photo ?? "",
    playerNumber: p.number ?? null,
    source: "api-football@v2",
    cachedAt,
  }));

  await db.transaction(async (tx) => {
    await tx.delete(squadPlayersTable).where(eq(squadPlayersTable.teamId, teamId));
    const CHUNK = 100;
    for (let i = 0; i < values.length; i += CHUNK) {
      await tx.insert(squadPlayersTable).values(values.slice(i, i + CHUNK));
    }
  });

  if (isR2Configured()) {
    cacheSquadPhotosInBackground(teamId, players).catch(() => {});
  }

  return players;
}

const PHOTO_CACHE_DELAY_MS = 100;

async function cacheSquadPhotosInBackground(teamId: number, players: SquadPlayerBody[]): Promise<void> {
  for (const player of players) {
    if (!player.photo || !player.photo.includes("media.api-sports.io")) continue;
    try {
      const r2Url = await cacheExternalImage(player.photo, `cached-images/players/${player.id}.png`);
      if (r2Url) {
        await db
          .update(squadPlayersTable)
          .set({ photo: r2Url })
          .where(
            sql`team_id = ${teamId} AND player_id = ${player.id}`,
          );
      }
    } catch {
      // ignore individual failures
    }
    await new Promise((r) => setTimeout(r, PHOTO_CACHE_DELAY_MS));
  }
}

function rowsToResponse(rows: typeof squadPlayersTable.$inferSelect[]) {
  const [rawSource, schemaVersion = null] = rows[0].source.split("@");
  return {
    players: rows.map((r) => ({
      id: r.playerId,
      name: r.name,
      age: r.age,
      position: r.position,
      positionPtBr: r.positionPtBr,
      photo: r.photo,
      number: r.playerNumber ?? undefined,
    })),
    source: rawSource,
    cachedAt: Number(rows[0].cachedAt),
    schemaVersion,
  };
}

router.get("/squad/:teamId", async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId ?? "", 10);
    if (isNaN(teamId) || teamId <= 0) {
      return res.status(400).json({ error: "Invalid teamId" });
    }

    const rows = await db
      .select()
      .from(squadPlayersTable)
      .where(eq(squadPlayersTable.teamId, teamId));

    const cachedAt = rows.length > 0 ? Number(rows[0].cachedAt) : 0;
    const wrongSource = rows.length > 0 && rows.some((r) => r.source !== "api-football@v2");
    const stale = rows.length === 0 || wrongSource || Date.now() - cachedAt > SQUAD_TTL_MS;

    if (!stale) return res.json(rowsToResponse(rows));

    if (!process.env.API_FOOTBALL_KEY) return res.status(204).end();

    const players = await buildAndSaveSquad(teamId);
    if (!players || players.length === 0) {
      if (rows.length > 0) return res.json(rowsToResponse(rows));
      return res.status(204).end();
    }

    const freshRows = await db
      .select()
      .from(squadPlayersTable)
      .where(eq(squadPlayersTable.teamId, teamId));

    if (freshRows.length === 0) return res.status(204).end();
    return res.json(rowsToResponse(freshRows));
  } catch (err) {
    console.error("GET /squad/:teamId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/squad/:teamId/fetch", async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId ?? "", 10);
    if (isNaN(teamId) || teamId <= 0) {
      return res.status(400).json({ error: "Invalid teamId" });
    }

    if (!process.env.API_FOOTBALL_KEY) {
      return res.status(503).json({ error: "API_FOOTBALL_KEY not configured on server" });
    }

    const players = await buildAndSaveSquad(teamId);
    if (!players) {
      return res.status(502).json({ error: "Failed to fetch squad from API-Football" });
    }

    return res.json({
      players,
      source: "api-football@v2",
      cachedAt: Date.now(),
      schemaVersion: "v2",
    });
  } catch (err) {
    console.error("POST /squad/:teamId/fetch error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/squad/:teamId", async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId ?? "", 10);
    if (isNaN(teamId) || teamId <= 0) {
      return res.status(400).json({ error: "Invalid teamId" });
    }

    const body = req.body as {
      players?: SquadPlayerBody[];
      source?: string;
      cachedAt?: number;
      schemaVersion?: string;
    };

    const { players, source, cachedAt, schemaVersion } = body;
    if (!Array.isArray(players) || typeof source !== "string" || typeof cachedAt !== "number") {
      return res.status(400).json({ error: "players, source, and cachedAt required" });
    }

    if (players.length === 0) {
      return res.status(400).json({ error: "players array must not be empty" });
    }

    const storedSource = schemaVersion ? `${source}@${schemaVersion}` : source;

    const values = players.map((p) => ({
      teamId,
      playerId: p.id,
      name: p.name,
      age: p.age ?? 0,
      position: p.position,
      positionPtBr: p.positionPtBr,
      photo: p.photo ?? "",
      playerNumber: p.number ?? null,
      source: storedSource,
      cachedAt,
    }));

    await db.transaction(async (tx) => {
      await tx.delete(squadPlayersTable).where(eq(squadPlayersTable.teamId, teamId));
      const CHUNK = 100;
      for (let i = 0; i < values.length; i += CHUNK) {
        await tx.insert(squadPlayersTable).values(values.slice(i, i + CHUNK));
      }
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("PUT /squad/:teamId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
