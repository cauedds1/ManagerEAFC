const PREFIX = "fc-career-manager-lineup-";

export function getCustomLineup(careerId: string): number[] | null {
  try {
    const raw = localStorage.getItem(PREFIX + careerId);
    if (!raw) return null;
    return JSON.parse(raw) as number[];
  } catch {
    return null;
  }
}

export function setCustomLineup(careerId: string, playerIds: number[]): void {
  try {
    localStorage.setItem(PREFIX + careerId, JSON.stringify(playerIds));
  } catch {}
}

export function clearCustomLineup(careerId: string): void {
  try {
    localStorage.removeItem(PREFIX + careerId);
  } catch {}
}
