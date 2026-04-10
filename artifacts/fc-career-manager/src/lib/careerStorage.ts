import { Career, CoachProfile } from "@/types/career";
import { ClubEntry } from "@/types/club";
import { getCurrentSeason } from "@/lib/api";

const CAREERS_KEY = "fc-career-manager-careers";
const LEGACY_CLUB_KEY = "fc-career-manager-club";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
}

export function deleteCareer(id: string): void {
  const careers = listCareers().filter((c) => c.id !== id);
  try {
    localStorage.setItem(CAREERS_KEY, JSON.stringify(careers));
  } catch {}
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
