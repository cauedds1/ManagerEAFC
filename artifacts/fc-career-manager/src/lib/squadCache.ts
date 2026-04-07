import { APIFOOTBALL_TO_FC26_NAME } from "./footballApiMap";
import { getApiKey } from "./clubListCache";

const API_BASE = "https://v3.football.api-sports.io";
const MSMC_BASE = "https://api.msmc.cc/api/eafc";
const CACHE_PREFIX = "fc-career-manager-squad-";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type PositionGroup = "Goalkeeper" | "Defender" | "Midfielder" | "Attacker";
export type PositionPtBr = "GOL" | "ZAG" | "VOL" | "ATA";
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
  Goalkeeper: "GOL",
  Defender: "ZAG",
  Midfielder: "VOL",
  Attacker: "ATA",
};

const POSITION_SORT: Record<PositionGroup, number> = {
  Goalkeeper: 0,
  Defender: 1,
  Midfielder: 2,
  Attacker: 3,
};

function normalizePosToGroup(pos: string): PositionGroup {
  const p = (pos ?? "").toUpperCase().trim();
  if (p === "GOALKEEPER" || p === "GK") return "Goalkeeper";
  if (p === "DEFENDER" || ["CB", "LB", "RB", "LWB", "RWB", "SW", "WB"].includes(p)) return "Defender";
  if (p === "MIDFIELDER" || ["CM", "CDM", "CAM", "LM", "RM", "DM", "AM", "DMF", "AMF"].includes(p)) return "Midfielder";
  if (p === "ATTACKER" || ["ST", "LW", "RW", "CF", "SS", "FW", "WF"].includes(p)) return "Attacker";
  return "Midfielder"; // safe fallback
}

function sortSquad(players: SquadPlayer[]): SquadPlayer[] {
  return [...players].sort((a, b) => {
    const orderDiff = POSITION_SORT[a.position] - POSITION_SORT[b.position];
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

function readCache(teamId: number): SquadResult | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${teamId}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as SquadResult;
    if (Date.now() - data.cachedAt >= CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(teamId: number, result: SquadResult): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${teamId}`, JSON.stringify(result));
  } catch {}
}

export function clearSquadCache(teamId: number): void {
  localStorage.removeItem(`${CACHE_PREFIX}${teamId}`);
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
  const cached = readCache(teamId);
  if (cached) return cached;

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
        writeCache(teamId, result);
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
    writeCache(teamId, result);
    return result;
  }

  return { players: [], source: "fc26", cachedAt: Date.now() };
}
