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

export function setSeasonRivals(seasonId: string, rivals: string[]): void {
  try {
    localStorage.setItem(rivalsKey(seasonId), JSON.stringify(rivals.slice(0, MAX_RIVALS)));
  } catch {}
}

export function areRivalsLocked(seasonId: string): boolean {
  return localStorage.getItem(rivalsLockedKey(seasonId)) === "1";
}

export function lockRivals(seasonId: string): void {
  try {
    localStorage.setItem(rivalsLockedKey(seasonId), "1");
  } catch {}
}

export function isRival(seasonId: string, opponentName: string): boolean {
  const rivals = getSeasonRivals(seasonId);
  const q = opponentName.toLowerCase().trim();
  return rivals.some((r) => r.toLowerCase().trim() === q);
}

export const getRivals = getSeasonRivals;
