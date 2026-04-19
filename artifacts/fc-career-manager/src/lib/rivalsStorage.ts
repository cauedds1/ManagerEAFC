import { putSeasonData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";

const rivalsKey = (seasonId: string) => `fc-rivals-${seasonId}`;
const rivalsLockedKey = (seasonId: string) => `fc-rivals-locked-${seasonId}`;

export const MAX_RIVALS = 3;

export function getSeasonRivals(seasonId: string): string[] {
  return sessionGet<string[]>(rivalsKey(seasonId)) ?? [];
}

export function areRivalsLocked(seasonId: string): boolean {
  return sessionGet<string>(rivalsLockedKey(seasonId)) === "1";
}

export async function setSeasonRivals(seasonId: string, rivals: string[]): Promise<boolean> {
  if (areRivalsLocked(seasonId)) return false;
  const trimmed = rivals.slice(0, MAX_RIVALS);
  sessionSet(rivalsKey(seasonId), trimmed);
  await putSeasonData(seasonId, "rivals", trimmed);
  return true;
}

export async function lockRivals(seasonId: string): Promise<void> {
  sessionSet(rivalsLockedKey(seasonId), "1");
  await putSeasonData(seasonId, "rivalsLocked", true);
}

export function isRival(seasonId: string, opponentName: string): boolean {
  const rivals = getSeasonRivals(seasonId);
  const q = opponentName.toLowerCase().trim();
  return rivals.some((r) => r.toLowerCase().trim() === q);
}

export function hydrateRivalsCache(seasonId: string, data: Record<string, unknown>): void {
  if (Array.isArray(data["rivals"])) {
    sessionSet(rivalsKey(seasonId), data["rivals"]);
  }
  if (data["rivalsLocked"] === true) {
    sessionSet(rivalsLockedKey(seasonId), "1");
  }
}

export const getRivals = getSeasonRivals;
