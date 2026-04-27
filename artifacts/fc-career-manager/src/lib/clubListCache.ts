import { ClubEntry } from "@/types/club";
import { DOMESTIC_LEAGUES, INTERNATIONAL_LEAGUES } from "./footballApiMap";

// International league IDs (API-Football):
//   2 = UEFA Champions League  (82 teams in 2025 — 82 is team count, NOT the ID)
//   3 = UEFA Europa League     (77 teams)
//   848 = UEFA Conference League (164 teams)
//   13 = CONMEBOL Libertadores (47 teams)
// ID 14 (CONMEBOL Sudamericana) is SKIPPED — returns European U19 teams (bad data).

export const CACHE_KEY = "fc-career-manager-clubs-v3";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface CacheData {
  clubs: ClubEntry[];
  cachedAt: number;
}

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

export async function fetchBackendClubList(): Promise<ClubEntry[]> {
  const all = [...DOMESTIC_LEAGUES, ...INTERNATIONAL_LEAGUES];
  const leagues = all.map((l) => ({ id: l.id, name: l.displayName ?? l.name, country: l.country }));

  const res = await fetch("/api/clubs/fetch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ leagues }),
  });

  if (res.status === 503) throw new ApiAuthError("API_FOOTBALL_KEY não configurada no servidor");
  if (res.status === 429) throw new ApiRateLimitError();
  if (!res.ok) throw new Error(`clubs/fetch failed: ${res.status}`);

  const dbClubs = await getDbClubs();
  if (dbClubs && dbClubs.length > 0) {
    const cachedAt = Date.now();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ clubs: dbClubs, cachedAt }));
    } catch {}
    return dbClubs;
  }
  return [];
}
