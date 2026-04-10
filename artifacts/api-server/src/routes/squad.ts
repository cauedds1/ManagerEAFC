import { Router } from "express";
import { db, squadPlayersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const SQUAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const MSMC_BASE = "https://api.msmc.cc/api/eafc";

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
  if (["LB", "RB", "LWB", "RWB", "WB", "LAT"].includes(p)) return "FullBack";
  if (["CB", "SW", "DEFENDER", "CENTREBACK"].includes(p)) return "CentreBack";
  if (["CDM", "DM", "DMF", "VOL"].includes(p)) return "DefensiveMid";
  if (["LW", "LM", "PE", "ME"].includes(p)) return "LeftWing";
  if (["RW", "RM", "PD", "MD"].includes(p)) return "RightWing";
  if (["CAM", "AM", "AMF", "MEI"].includes(p)) return "AttackingMid";
  if (["CM", "MC"].includes(p)) return "CentralMid";
  if (p === "MIDFIELDER") return "DefensiveMid";
  if (["CF", "SS", "SA"].includes(p)) return "SecondStriker";
  if (["ST", "FW", "WF", "CA"].includes(p)) return "Striker";
  if (["ATTACKER", "FORWARD", "ATA"].includes(p)) return "BroadForward";
  if (p === "CENTREBACK") return "CentreBack";
  if (p === "FULLBACK") return "FullBack";
  if (p === "DEFENSIVEMID") return "DefensiveMid";
  if (p === "CENTRALMID") return "CentralMid";
  if (p === "ATTACKINGMID") return "AttackingMid";
  if (p === "LEFTWING") return "LeftWing";
  if (p === "RIGHTWING") return "RightWing";
  if (p === "SECONDSTRIKER") return "SecondStriker";
  if (p === "STRIKER") return "Striker";
  if (p === "GOALKEEPER") return "Goalkeeper";
  if (p === "BROADFORWARD") return "BroadForward";
  return "CentralMid";
}

const POSITION_PT_BR: Record<string, string> = {
  Goalkeeper: "GOL",
  CentreBack: "ZAG",
  FullBack: "LAT",
  DefensiveMid: "VOL",
  CentralMid: "MC",
  AttackingMid: "MEI",
  LeftWing: "PE",
  RightWing: "PD",
  SecondStriker: "SA",
  Striker: "CA",
  BroadForward: "ATA",
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

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
      positionPtBr: POSITION_PT_BR[pos] ?? "MC",
      photo: p.photo ?? "",
      number: p.number ?? undefined,
    };
  });
}

async function fetchMsmcPositions(fc26Name: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await fetch(`${MSMC_BASE}/players?game=fc26&team=${encodeURIComponent(fc26Name)}`);
    if (!res.ok) return map;
    const raw = await res.json();
    const arr: Array<{ name?: string; position?: string }> = Array.isArray(raw) ? raw : (raw?.data ?? []);
    for (const p of arr) {
      if (p.name && p.position) {
        map.set(normalizeName(p.name), p.position);
      }
    }
  } catch {}
  return map;
}

async function buildAndSaveSquad(teamId: number, fc26Name?: string): Promise<SquadPlayerBody[] | null> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return null;

  const players = await fetchApiFootballSquad(teamId, apiKey);
  if (!players || players.length === 0) return null;

  if (fc26Name) {
    const posMap = await fetchMsmcPositions(fc26Name);
    if (posMap.size > 0) {
      for (const p of players) {
        const key = normalizeName(p.name);
        const msmcPos = posMap.get(key);
        if (msmcPos) {
          const normalized = normalizePosToGroup(msmcPos);
          p.position = normalized;
          p.positionPtBr = POSITION_PT_BR[normalized] ?? "MC";
        }
      }
    }
  }

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

  return players;
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

    if (rows.length === 0) return res.status(204).end();

    const cachedAt = Number(rows[0].cachedAt);
    if (Date.now() - cachedAt > SQUAD_TTL_MS) return res.status(204).end();

    const [rawSource, schemaVersion = null] = rows[0].source.split("@");

    return res.json({
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
      cachedAt,
      schemaVersion,
    });
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

    const { fc26Name } = req.body as { fc26Name?: string };

    const players = await buildAndSaveSquad(teamId, fc26Name);
    if (!players) {
      return res.status(502).json({ error: "Failed to fetch squad from API-Football" });
    }

    return res.json({
      players,
      source: "api-football",
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
