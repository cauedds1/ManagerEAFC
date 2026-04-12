import { putSeasonData } from "@/lib/apiStorage";

const rivalsKey = (seasonId: string) => `fc-rivals-${seasonId}`;
const rivalsLockedKey = (seasonId: string) => `fc-rivals-locked-${seasonId}`;

export const MAX_RIVALS = 3;

export function getSeasonRivals(seasonId: string): string[] {
  try {
    const raw = localStorage.getItem(rivalsKey(seasonId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function areRivalsLocked(seasonId: string): boolean {
  return localStorage.getItem(rivalsLockedKey(seasonId)) === "1";
}

export async function setSeasonRivals(seasonId: string, rivals: string[]): Promise<boolean> {
  if (areRivalsLocked(seasonId)) return false;
  const trimmed = rivals.slice(0, MAX_RIVALS);
  try {
    localStorage.setItem(rivalsKey(seasonId), JSON.stringify(trimmed));
  } catch {}
  await putSeasonData(seasonId, "rivals", trimmed);
  return true;
}

export async function lockRivals(seasonId: string): Promise<void> {
  try {
    localStorage.setItem(rivalsLockedKey(seasonId), "1");
  } catch {}
  await putSeasonData(seasonId, "rivalsLocked", true);
}

export function isRival(seasonId: string, opponentName: string): boolean {
  const rivals = getSeasonRivals(seasonId);
  const q = opponentName.toLowerCase().trim();
  return rivals.some((r) => r.toLowerCase().trim() === q);
}

export function hydrateRivalsCache(seasonId: string, data: Record<string, unknown>): void {
  try {
    if (Array.isArray(data["rivals"])) {
      localStorage.setItem(rivalsKey(seasonId), JSON.stringify(data["rivals"]));
    }
    if (data["rivalsLocked"] === true) {
      localStorage.setItem(rivalsLockedKey(seasonId), "1");
    }
  } catch {}
}

export const getRivals = getSeasonRivals;
