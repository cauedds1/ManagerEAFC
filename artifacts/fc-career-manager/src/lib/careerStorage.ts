import { Career, CoachProfile } from "@/types/career";
import { ClubEntry } from "@/types/club";
import { getCurrentSeason } from "@/lib/api";
import { createSeason } from "@/lib/seasonStorage";

const CAREERS_KEY = "fc-career-manager-careers";
const LEGACY_CLUB_KEY = "fc-career-manager-club";
const SYNCED_KEY = "fc-career-manager-synced-ids";
const AUTH_TOKEN_KEY = "fc_auth_token";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getSyncedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SYNCED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markSynced(id: string): void {
  const synced = getSyncedIds();
  synced.add(id);
  try {
    localStorage.setItem(SYNCED_KEY, JSON.stringify([...synced]));
  } catch {}
}

export function listCareers(): Career[] {
  try {
    const raw = localStorage.getItem(CAREERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Career[];
  } catch {
    return [];
  }
}

export class AuthExpiredError extends Error {
  constructor() { super("AUTH_EXPIRED"); }
}

export async function fetchCareersFromApi(): Promise<Career[]> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return listCareers();
  const res = await fetch("/api/careers", { headers: getAuthHeaders() });
  if (res.status === 401) throw new AuthExpiredError();
  if (!res.ok) return listCareers();
  const data = await res.json() as Career[];
  if (!Array.isArray(data)) return listCareers();
  try { localStorage.setItem(CAREERS_KEY, JSON.stringify(data)); } catch {}
  return data;
}

export function saveCareer(career: Career): void {
  const careers = listCareers();
  const idx = careers.findIndex((c) => c.id === career.id);
  if (idx >= 0) {
    careers[idx] = { ...career, updatedAt: Date.now() };
  } else {
    careers.push(career);
  }
  try {
    localStorage.setItem(CAREERS_KEY, JSON.stringify(careers));
  } catch {}
  syncCareerToDb(career).catch(() => {});
}

export function deleteCareer(id: string): void {
  const careers = listCareers().filter((c) => c.id !== id);
  try {
    localStorage.setItem(CAREERS_KEY, JSON.stringify(careers));
  } catch {}
  fetch(`/api/careers/${id}`, { method: "DELETE", headers: getAuthHeaders() }).catch(() => {});
}

export interface CareerExtras {
  projeto?: string;
  competitions?: string[];
  clubDescription?: string;
  clubTitles?: import("@/types/career").ClubTitle[];
}

export function createCareer(coach: CoachProfile, club: ClubEntry, extras?: CareerExtras): Career {
  return {
    id: generateId(),
    coach,
    clubId: club.id,
    clubName: club.name,
    clubLogo: club.logo,
    clubLeague: club.league,
    clubCountry: club.country,
    ...(club.stadium ? { clubStadium: club.stadium } : {}),
    ...(club.founded ? { clubFounded: club.founded } : {}),
    season: getCurrentSeason(),
    ...(extras?.projeto ? { projeto: extras.projeto } : {}),
    ...(extras?.competitions?.length ? { competitions: extras.competitions } : {}),
    ...(extras?.clubDescription ? { clubDescription: extras.clubDescription } : {}),
    ...(extras?.clubTitles?.length ? { clubTitles: extras.clubTitles } : {}),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function updateCareerSeason(id: string, season: string): void {
  const careers = listCareers();
  const idx = careers.findIndex((c) => c.id === id);
  if (idx >= 0) {
    careers[idx] = { ...careers[idx], season, updatedAt: Date.now() };
    try {
      localStorage.setItem(CAREERS_KEY, JSON.stringify(careers));
    } catch {}
    fetch(`/api/careers/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ season }),
    }).catch(() => {});
  }
}

export function getActiveCareer(id?: string): Career | null {
  const careers = listCareers();
  if (!careers.length) return null;
  if (id) return careers.find((c) => c.id === id) ?? null;
  return careers[careers.length - 1];
}

export function migrateFromLegacy(): void {
  try {
    const raw = localStorage.getItem(LEGACY_CLUB_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as {
      club: { name: string; league: string; apiFootballId?: number; logo?: string };
      season: string;
      selectedAt: number;
    };
    if (!data.club?.name) return;

    const existing = listCareers();
    if (existing.length > 0) {
      localStorage.removeItem(LEGACY_CLUB_KEY);
      return;
    }

    const career: Career = {
      id: generateId(),
      coach: { name: "Técnico", nationality: "Brasil", nationalityFlag: "🇧🇷", age: 40 },
      clubId: data.club.apiFootballId ?? 0,
      clubName: data.club.name,
      clubLogo: data.club.logo ?? "",
      clubLeague: data.club.league,
      season: data.season,
      createdAt: data.selectedAt,
      updatedAt: data.selectedAt,
    };
    saveCareer(career);
    localStorage.removeItem(LEGACY_CLUB_KEY);
  } catch {}
}

async function syncCareerToDb(career: Career): Promise<void> {
  try {
    await fetch("/api/careers", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        id: career.id,
        coach: career.coach,
        clubId: career.clubId,
        clubName: career.clubName,
        clubLogo: career.clubLogo,
        clubLeague: career.clubLeague,
        clubCountry: career.clubCountry,
        clubStadium: career.clubStadium,
        clubFounded: career.clubFounded,
        clubPrimary: career.clubPrimary,
        clubSecondary: career.clubSecondary,
        clubDescription: career.clubDescription,
        clubTitles: career.clubTitles,
        season: career.season,
        projeto: career.projeto,
        competitions: career.competitions,
        currentSeasonId: career.currentSeasonId,
        createdAt: career.createdAt,
        updatedAt: career.updatedAt,
      }),
    });
  } catch {}
}

export async function ensureCareerAndSeason1(career: Career): Promise<string> {
  const synced = getSyncedIds();
  if (synced.has(career.id)) {
    return career.currentSeasonId ?? career.id;
  }

  await syncCareerToDb(career);

  const existingSeasons = await fetch(`/api/careers/${career.id}/seasons`, { headers: getAuthHeaders() })
    .then((r) => r.json())
    .catch(() => []) as Array<{ id: string }>;

  if (!existingSeasons.length) {
    await createSeason(
      career.id,
      career.season || getCurrentSeason(),
      career.competitions,
      true,
      career.id,
    );
  }

  markSynced(career.id);
  return career.currentSeasonId ?? career.id;
}
