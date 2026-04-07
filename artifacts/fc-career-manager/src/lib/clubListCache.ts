import { ClubEntry } from "@/types/club";
import { DOMESTIC_LEAGUES, INTERNATIONAL_LEAGUES, LeagueInfo } from "./footballApiMap";

// International league IDs (API-Football):
//   2 = UEFA Champions League  (82 teams in 2025 — 82 is team count, NOT the ID)
//   3 = UEFA Europa League     (77 teams)
//   848 = UEFA Conference League (164 teams)
//   13 = CONMEBOL Libertadores (47 teams)
// ID 14 (CONMEBOL Sudamericana) is SKIPPED — returns European U19 teams (bad data).

const API_BASE = "https://v3.football.api-sports.io";
const API_KEY_STORAGE = "fc-career-manager-api-key";
export const CACHE_KEY = "fc-career-manager-clubs";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REQUEST_DELAY_MS = 500;

interface ApiTeamItem {
  team: {
    id: number;
    name: string;
    logo: string;
    country: string;
  };
}

interface CacheData {
  clubs: ClubEntry[];
  cachedAt: number;
}

export type ProgressCallback = (loaded: number, total: number, leagueName: string) => void;

export class ApiAuthError extends Error {
  constructor(message = "Chave de API inválida ou sem permissão") {
    super(message);
    this.name = "ApiAuthError";
  }
}

export class ApiRateLimitError extends Error {
  constructor(message = "Limite de requisições atingido. Tente novamente em breve.") {
    super(message);
    this.name = "ApiRateLimitError";
  }
}

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE);
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key.trim());
}

export function removeApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchLeagueTeams(league: LeagueInfo, apiKey: string): Promise<ClubEntry[]> {
  const res = await fetch(`${API_BASE}/teams?league=${league.id}&season=2025`, {
    headers: { "x-apisports-key": apiKey },
  });

  if (res.status === 401 || res.status === 403) {
    throw new ApiAuthError();
  }

  if (res.status === 429) {
    throw new ApiRateLimitError();
  }

  if (!res.ok) {
    // Other server errors: skip this league gracefully
    return [];
  }

  let json: { response?: unknown };
  try {
    json = await res.json();
  } catch {
    return [];
  }

  if (!Array.isArray(json.response)) return [];

  return (json.response as ApiTeamItem[]).map((item) => ({
    id: item.team.id,
    name: item.team.name,
    logo: item.team.logo,
    league: league.displayName ?? league.name,
    leagueId: league.id,
    country: item.team.country,
  }));
}

// ---------------------------------------------------------------------------
// DB cache layer (two-level cache: localStorage → DB → API-Football)
// ---------------------------------------------------------------------------

export async function getDbClubs(): Promise<ClubEntry[] | null> {
  try {
    const res = await fetch("/api/clubs");
    if (res.status === 204 || !res.ok) return null;
    const data = await res.json() as { clubs: ClubEntry[]; cachedAt: number };
    if (!Array.isArray(data.clubs) || data.clubs.length === 0) return null;
    return data.clubs;
  } catch {
    return null;
  }
}

function writeDbClubs(clubs: ClubEntry[], cachedAt: number): void {
  fetch("/api/clubs", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clubs, cachedAt }),
  }).catch(() => {});
}

function deleteDbClubs(): void {
  fetch("/api/clubs", { method: "DELETE" }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchAndCacheClubList(onProgress?: ProgressCallback): Promise<ClubEntry[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new ApiAuthError("Nenhuma chave de API configurada");

  const teamsMap = new Map<number, ClubEntry>();
  const total = DOMESTIC_LEAGUES.length + INTERNATIONAL_LEAGUES.length;
  let loaded = 0;

  for (const league of DOMESTIC_LEAGUES) {
    // Auth and rate-limit errors propagate to caller; other errors handled inside fetchLeagueTeams
    const teams = await fetchLeagueTeams(league, apiKey);
    for (const team of teams) {
      if (!teamsMap.has(team.id)) teamsMap.set(team.id, team);
    }
    loaded++;
    onProgress?.(loaded, total, league.displayName ?? league.name);
    if (loaded < total) await sleep(REQUEST_DELAY_MS);
  }

  for (const league of INTERNATIONAL_LEAGUES) {
    const teams = await fetchLeagueTeams(league, apiKey);
    for (const team of teams) {
      if (!teamsMap.has(team.id)) teamsMap.set(team.id, team);
    }
    loaded++;
    onProgress?.(loaded, total, league.name);
    if (loaded < total) await sleep(REQUEST_DELAY_MS);
  }

  const clubs = Array.from(teamsMap.values());

  if (clubs.length > 0) {
    const cachedAt = Date.now();
    // Layer 1: localStorage
    try {
      const data: CacheData = { clubs, cachedAt };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // quota exceeded — data still in memory
    }
    // Layer 2: DB (fire-and-forget)
    writeDbClubs(clubs, cachedAt);
  }

  return clubs;
}

export function getCachedClubList(): ClubEntry[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CacheData;
    if (Date.now() - data.cachedAt >= CACHE_TTL_MS) return null;
    return data.clubs;
  } catch {
    return null;
  }
}

export function isClubListCached(): boolean {
  return getCachedClubList() !== null;
}

export function getClubsByLeague(leagueId: number, clubs: ClubEntry[]): ClubEntry[] {
  return clubs
    .filter((c) => c.leagueId === leagueId)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function searchClubs(query: string, clubs: ClubEntry[]): ClubEntry[] {
  if (!query.trim()) return clubs;
  const q = query.toLowerCase().trim();
  return clubs
    .filter((c) => c.name.toLowerCase().includes(q) || c.league.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function clearClubCache(): void {
  localStorage.removeItem(CACHE_KEY);
  // Also clear DB cache (fire-and-forget)
  deleteDbClubs();
}
