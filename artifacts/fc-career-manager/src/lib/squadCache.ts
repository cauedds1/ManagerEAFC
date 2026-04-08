import { APIFOOTBALL_TO_FC26_NAME } from "./footballApiMap";
import { getApiKey } from "./clubListCache";

const API_BASE = "https://v3.football.api-sports.io";
const MSMC_BASE = "https://api.msmc.cc/api/eafc";
const CACHE_PREFIX = "fc-career-manager-squad-";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type PositionGroup =
  | "Goalkeeper"
  | "CentreBack"
  | "FullBack"
  | "DefensiveMid"
  | "CentralMid"
  | "AttackingMid"
  | "LeftWing"
  | "RightWing"
  | "SecondStriker"
  | "Striker"
  | "BroadForward"; // usado para "Attacker" genérico da API-Football

export type PositionPtBr = "GOL" | "ZAG" | "LAT" | "VOL" | "MC" | "MEI" | "PE" | "PD" | "SA" | "CA" | "ATA";

export type FormationGroup = "GOL" | "ZAG" | "VOL" | "ATA";

export type SquadSource = "api-football" | "fc26";

export interface SquadPlayer {
  id: number;
  name: string;
  age: number;
  position: PositionGroup;
  positionPtBr: PositionPtBr;
  photo: string;
  number?: number;
}

export interface SquadResult {
  players: SquadPlayer[];
  source: SquadSource;
  cachedAt: number;
}

const POSITION_PT_BR: Record<PositionGroup, PositionPtBr> = {
  Goalkeeper:   "GOL",
  CentreBack:   "ZAG",
  FullBack:     "LAT",
  DefensiveMid: "VOL",
  CentralMid:   "MC",
  AttackingMid: "MEI",
  LeftWing:     "PE",
  RightWing:    "PD",
  SecondStriker:"SA",
  Striker:      "CA",
  BroadForward: "ATA", // "Attacker" genérico da API-Football
};

export const FORMATION_GROUP: Record<PositionPtBr, FormationGroup> = {
  GOL: "GOL",
  ZAG: "ZAG",
  LAT: "ZAG",
  VOL: "VOL",
  MC:  "VOL",
  MEI: "VOL",
  PE:  "ATA",
  PD:  "ATA",
  SA:  "ATA",
  CA:  "ATA",
  ATA: "ATA",
};

const POSITION_SORT: Record<PositionGroup, number> = {
  Goalkeeper:   0,
  CentreBack:   1,
  FullBack:     2,
  DefensiveMid: 3,
  CentralMid:   4,
  AttackingMid: 5,
  LeftWing:     6,
  RightWing:    7,
  SecondStriker:8,
  Striker:      9,
  BroadForward: 9,
};

function normalizePosToGroup(pos: string): PositionGroup {
  const p = (pos ?? "").toUpperCase().trim();

  // Goalkeeper
  if (["GOALKEEPER", "GK", "GOL"].includes(p)) return "Goalkeeper";

  // Full backs (lateral)
  if (["LB", "RB", "LWB", "RWB", "WB", "LAT"].includes(p)) return "FullBack";

  // Centre backs (incluindo "Defender" genérico da API-Football)
  if (["CB", "SW", "DEFENDER", "CENTREBACK"].includes(p)) return "CentreBack";

  // Defensive midfielders (volante)
  if (["CDM", "DM", "DMF", "VOL"].includes(p)) return "DefensiveMid";

  // Left wing / left mid (ponta esquerda)
  if (["LW", "LM", "PE", "ME"].includes(p)) return "LeftWing";

  // Right wing / right mid (ponta direita)
  if (["RW", "RM", "PD", "MD"].includes(p)) return "RightWing";

  // Attacking midfielders (meia ofensivo)
  if (["CAM", "AM", "AMF", "MEI"].includes(p)) return "AttackingMid";

  // Central midfielders
  if (["CM", "MC"].includes(p)) return "CentralMid";

  // Broad "Midfielder" from API-Football → volante (broad VOL)
  if (p === "MIDFIELDER") return "DefensiveMid";

  // Second striker / false 9 (segundo atacante)
  if (["CF", "SS", "SA"].includes(p)) return "SecondStriker";

  // Striker / centre forward (centroavante)
  if (["ST", "FW", "WF", "CA"].includes(p)) return "Striker";

  // Broad "Attacker" / "Forward" from API-Football → ATA genérico
  if (["ATTACKER", "FORWARD", "ATA"].includes(p)) return "BroadForward";

  // Backward compat: old group names stored in cache
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

  return "CentralMid"; // safe fallback
}

function sortSquad(players: SquadPlayer[]): SquadPlayer[] {
  return [...players].sort((a, b) => {
    const orderDiff = POSITION_SORT[a.position] - POSITION_SORT[b.position];
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

function getCacheKey(teamId: number, clubName: string): string {
  if (teamId > 0) return `${CACHE_PREFIX}${teamId}`;
  return `${CACHE_PREFIX}name-${clubName.toLowerCase().replace(/\s+/g, "_")}`;
}

function reNormalizePlayers(players: SquadPlayer[]): SquadPlayer[] {
  return players.map((p) => {
    const pos = normalizePosToGroup(p.position);
    return { ...p, position: pos, positionPtBr: POSITION_PT_BR[pos] };
  });
}

function readLocalCache(teamId: number, clubName: string): SquadResult | null {
  try {
    const raw = localStorage.getItem(getCacheKey(teamId, clubName));
    if (!raw) return null;
    const data = JSON.parse(raw) as SquadResult;
    if (Date.now() - data.cachedAt >= CACHE_TTL_MS) return null;
    data.players = reNormalizePlayers(data.players);
    return data;
  } catch {
    return null;
  }
}

function writeLocalCache(teamId: number, clubName: string, result: SquadResult): void {
  try {
    localStorage.setItem(getCacheKey(teamId, clubName), JSON.stringify(result));
  } catch {}
}

// ---------------------------------------------------------------------------
// DB cache layer
// ---------------------------------------------------------------------------

async function readDbSquad(teamId: number): Promise<SquadResult | null> {
  if (teamId <= 0) return null;
  try {
    const res = await fetch(`/api/squad/${teamId}`);
    if (res.status === 204 || !res.ok) return null;
    const data = await res.json() as { players: SquadPlayer[]; source: string; cachedAt: number };
    if (!Array.isArray(data.players) || data.players.length === 0) return null;
    return {
      players: reNormalizePlayers(data.players as SquadPlayer[]),
      source: data.source as SquadSource,
      cachedAt: data.cachedAt,
    };
  } catch {
    return null;
  }
}

function writeDbSquad(teamId: number, result: SquadResult): void {
  if (teamId <= 0) return;
  fetch(`/api/squad/${teamId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      players: result.players,
      source: result.source,
      cachedAt: result.cachedAt,
    }),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function clearSquadCache(teamId: number, clubName = ""): void {
  localStorage.removeItem(getCacheKey(teamId, clubName));
}

export function clearAllSquadCaches(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
}

interface ApiFootballPlayer {
  id: number;
  name: string;
  age: number;
  number?: number;
  position: string;
  photo: string;
}

async function fetchFromApiFootball(
  teamId: number,
  apiKey: string
): Promise<SquadPlayer[] | null> {
  const res = await fetch(`${API_BASE}/players/squads?team=${teamId}`, {
    headers: { "x-apisports-key": apiKey },
  });
  if (res.status === 401 || res.status === 403) throw new Error("auth");
  if (res.status === 429) throw new Error("rate-limit");
  if (!res.ok) return null;

  let json: { response?: Array<{ players?: ApiFootballPlayer[] }> };
  try {
    json = await res.json();
  } catch {
    return null;
  }

  const playersRaw = json.response?.[0]?.players;
  if (!Array.isArray(playersRaw) || playersRaw.length === 0) return null;

  return playersRaw.map((p) => {
    const pos = normalizePosToGroup(p.position);
    return {
      id: p.id,
      name: p.name,
      age: p.age ?? 0,
      position: pos,
      positionPtBr: POSITION_PT_BR[pos],
      photo: p.photo ?? "",
      number: p.number ?? undefined,
    };
  });
}

interface MsmcPlayer {
  id?: string;
  name?: string;
  age?: string;
  position?: string;
  card?: string;
}

async function fetchFromMsmc(fc26Name: string): Promise<SquadPlayer[] | null> {
  try {
    const res = await fetch(
      `${MSMC_BASE}/players?game=fc26&team=${encodeURIComponent(fc26Name)}`
    );
    if (!res.ok) return null;
    const raw = await res.json();
    const arr: MsmcPlayer[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
    if (arr.length === 0) return null;

    return arr.slice(0, 50).map((p, i) => {
      const pos = normalizePosToGroup(p.position ?? "");
      return {
        id: parseInt(p.id ?? String(i), 10) || i,
        name: p.name ?? "Desconhecido",
        age: parseInt(p.age ?? "0", 10) || 0,
        position: pos,
        positionPtBr: POSITION_PT_BR[pos],
        photo: p.card ?? "",
        number: undefined,
      };
    });
  } catch {
    return null;
  }
}

export async function getSquad(teamId: number, clubName: string): Promise<SquadResult> {
  // Layer 1: localStorage (sync, fast)
  const localCached = readLocalCache(teamId, clubName);
  if (localCached) return localCached;

  // Layer 2: DB cache (async, survives browser cache clears)
  const dbCached = await readDbSquad(teamId);
  if (dbCached) {
    // Warm localStorage so subsequent calls are instant
    writeLocalCache(teamId, clubName, dbCached);
    return dbCached;
  }

  // Layer 3: External APIs (API-Football → msmc.cc fallback)
  const apiKey = getApiKey();
  const fc26Name = APIFOOTBALL_TO_FC26_NAME[clubName] ?? clubName;

  if (apiKey && teamId > 0) {
    try {
      const players = await fetchFromApiFootball(teamId, apiKey);
      if (players && players.length > 0) {
        const result: SquadResult = {
          players: sortSquad(players),
          source: "api-football",
          cachedAt: Date.now(),
        };
        writeLocalCache(teamId, clubName, result);
        writeDbSquad(teamId, result); // fire-and-forget
        return result;
      }
    } catch (err) {
      if (err instanceof Error && (err.message === "auth" || err.message === "rate-limit")) {
        // Auth/rate-limit: fall through to msmc.cc
      }
    }
  }

  // Fallback: msmc.cc (works without API key)
  const msmcPlayers = await fetchFromMsmc(fc26Name);
  if (msmcPlayers && msmcPlayers.length > 0) {
    const result: SquadResult = {
      players: sortSquad(msmcPlayers),
      source: "fc26",
      cachedAt: Date.now(),
    };
    writeLocalCache(teamId, clubName, result);
    writeDbSquad(teamId, result); // fire-and-forget
    return result;
  }

  return { players: [], source: "fc26", cachedAt: Date.now() };
}
