const CACHE_VERSION = "v3";
const BASE_CACHE_PREFIX = "fc-career-manager-squad-";
const CACHE_PREFIX = `${BASE_CACHE_PREFIX}${CACHE_VERSION}-`;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PositionGroup = "Goalkeeper" | "Defender" | "Midfielder" | "Attacker";

export type PositionPtBr = "GOL" | "DEF" | "MID" | "ATA";

export type FormationGroup = "GOL" | "DEF" | "MID" | "ATA";

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
  Defender:   "DEF",
  Midfielder: "MID",
  Attacker:   "ATA",
};

export const PT_BR_TO_POSITION: Record<PositionPtBr, PositionGroup> = {
  GOL: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  ATA: "Attacker",
};

export const FORMATION_GROUP: Record<PositionPtBr, FormationGroup> = {
  GOL: "GOL",
  DEF: "DEF",
  MID: "MID",
  ATA: "ATA",
};

const POSITION_SORT: Record<PositionGroup, number> = {
  Goalkeeper: 0,
  Defender:   1,
  Midfielder: 2,
  Attacker:   3,
};

/** Migrate a position override from old 11-code system to new 4-category system. */
export function migratePositionOverride(pos: string | undefined): PositionPtBr | undefined {
  if (!pos) return undefined;
  const VALID: PositionPtBr[] = ["GOL", "DEF", "MID", "ATA"];
  if ((VALID as string[]).includes(pos)) return pos as PositionPtBr;
  if (["ZAG", "LAT"].includes(pos)) return "DEF";
  if (["VOL", "MC", "MEI", "PE", "PD", "SA", "CA"].includes(pos)) return "MID";
  return undefined;
}

function normalizePosToGroup(pos: string): PositionGroup {
  const p = (pos ?? "").toUpperCase().trim();
  if (["GOALKEEPER", "GK", "GOL"].includes(p)) return "Goalkeeper";
  if (["DEFENDER", "CB", "SW", "LB", "RB", "LWB", "RWB", "WB", "ZAG", "LAT",
       "CENTREBACK", "FULLBACK"].includes(p)) return "Defender";
  if (["ATTACKER", "FORWARD", "ST", "FW", "WF", "CA", "ATA", "STRIKER", "BROADFORWARD"].includes(p)) return "Attacker";
  return "Midfielder";
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

async function readDbSquad(teamId: number): Promise<SquadResult | null> {
  if (teamId <= 0) return null;
  try {
    const res = await fetch(`/api/squad/${teamId}`);
    if (res.status === 204 || !res.ok) return null;
    const data = await res.json() as {
      players: SquadPlayer[];
      source: string;
      cachedAt: number;
      schemaVersion?: string;
    };
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

export function clearSquadCache(teamId: number, clubName = ""): void {
  localStorage.removeItem(getCacheKey(teamId, clubName));
}

export function clearAllSquadCaches(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(BASE_CACHE_PREFIX)) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
}

export async function fetchSquadFromBackend(teamId: number): Promise<SquadResult | null> {
  if (teamId <= 0) return null;
  try {
    const res = await fetch(`/api/squad/${teamId}/fetch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      players: SquadPlayer[];
      source: string;
      cachedAt: number;
    };
    if (!Array.isArray(data.players) || data.players.length === 0) return null;
    return {
      players: sortSquad(reNormalizePlayers(data.players as SquadPlayer[])),
      source: "api-football",
      cachedAt: data.cachedAt ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export async function getSquad(teamId: number, clubName: string): Promise<SquadResult> {
  const localCached = readLocalCache(teamId, clubName);
  if (localCached) return localCached;

  const dbResult = await readDbSquad(teamId);
  if (dbResult) {
    writeLocalCache(teamId, clubName, dbResult);
    return dbResult;
  }

  return { players: [], source: "api-football", cachedAt: Date.now() };
}

/**
 * Increments every player's age by 1 in the localStorage squad cache.
 * Called when a new season starts. Does not affect the server DB —
 * real ages are restored on the next manual squad refresh from the API.
 */
export function ageSquadInCache(teamId: number, clubName: string): void {
  try {
    const key = getCacheKey(teamId, clubName);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const data = JSON.parse(raw) as SquadResult;
    if (!Array.isArray(data.players)) return;
    data.players = data.players.map((p) => ({ ...p, age: p.age + 1 }));
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

/**
 * Returns all players from every squad cached in localStorage,
 * deduplicated by player ID and sorted by name.
 */
export function getAllCachedPlayers(): SquadPlayer[] {
  const seen = new Set<number>();
  const all: SquadPlayer[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(CACHE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw) as SquadResult;
      if (!Array.isArray(data.players)) continue;
      const players = reNormalizePlayers(data.players);
      for (const p of players) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          all.push(p);
        }
      }
    }
  } catch {}
  return all.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
