const CACHE_VERSION = "v2";
const BASE_CACHE_PREFIX = "fc-career-manager-squad-";
const CACHE_PREFIX = `${BASE_CACHE_PREFIX}${CACHE_VERSION}-`;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
  | "BroadForward";

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
  BroadForward: "ATA",
};

export const PT_BR_TO_POSITION: Record<PositionPtBr, PositionGroup> = {
  GOL: "Goalkeeper",
  ZAG: "CentreBack",
  LAT: "FullBack",
  VOL: "DefensiveMid",
  MC:  "CentralMid",
  MEI: "AttackingMid",
  PE:  "LeftWing",
  PD:  "RightWing",
  SA:  "SecondStriker",
  CA:  "Striker",
  ATA: "BroadForward",
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
    if (data.schemaVersion !== CACHE_VERSION) return null;
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

export async function fetchSquadFromBackend(teamId: number, fc26Name?: string): Promise<SquadResult | null> {
  if (teamId <= 0) return null;
  try {
    const res = await fetch(`/api/squad/${teamId}/fetch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fc26Name: fc26Name ?? null }),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      players: SquadPlayer[];
      source: string;
      cachedAt: number;
      schemaVersion?: string;
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

export async function getSquad(teamId: number, clubName: string, fc26Name?: string): Promise<SquadResult> {
  const localCached = readLocalCache(teamId, clubName);
  if (localCached) return localCached;

  const dbCached = await readDbSquad(teamId);
  if (dbCached) {
    writeLocalCache(teamId, clubName, dbCached);
    return dbCached;
  }

  const fetched = await fetchSquadFromBackend(teamId, fc26Name);
  if (fetched) {
    writeLocalCache(teamId, clubName, fetched);
    return fetched;
  }

  return { players: [], source: "api-football", cachedAt: Date.now() };
}
