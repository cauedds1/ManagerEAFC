import { ClubEntry } from "@/types/club";
import { DOMESTIC_LEAGUES, INTERNATIONAL_LEAGUES, LeagueInfo } from "./footballApiMap";

const API_BASE = "https://v3.football.api-sports.io";
const API_KEY_STORAGE = "fc-career-manager-api-key";
const CACHE_KEY = "fc-career-manager-clubs";
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

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE);
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key.trim());
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchLeagueTeams(league: LeagueInfo, apiKey: string): Promise<ClubEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/teams?league=${league.id}&season=2025`, {
      headers: { "x-apisports-key": apiKey },
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json.response)) return [];

    return (json.response as ApiTeamItem[]).map((item) => ({
      id: item.team.id,
      name: item.team.name,
      logo: item.team.logo,
      league: league.displayName ?? league.name,
      leagueId: league.id,
      country: item.team.country,
    }));
  } catch {
    return [];
  }
}

export async function fetchAndCacheClubList(onProgress?: ProgressCallback): Promise<ClubEntry[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const teamsMap = new Map<number, ClubEntry>();
  const total = DOMESTIC_LEAGUES.length + INTERNATIONAL_LEAGUES.length;
  let loaded = 0;

  for (const league of DOMESTIC_LEAGUES) {
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

  try {
    const data: CacheData = { clubs, cachedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded — data still in memory
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
}
