import { putSeasonData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";

const KEY = (seasonId: string) => `fc-injuries-${seasonId}`;

export interface InjuryRecord {
  id: string;
  playerId: number;
  injuryName: string;
  matchDate: string;
  matchId: string;
  opponent: string;
  minute?: number;
  releasedAt?: string;
  createdAt: number;
}

export function getInjuries(seasonId: string): InjuryRecord[] {
  return sessionGet<InjuryRecord[]>(KEY(seasonId)) ?? [];
}

// Returns the set of player IDs with an active (non-released) injury for the
// current season. Use this to filter players out of selection UIs (match
// registration bench, substitute pickers, etc.).
export function getActiveInjuredIds(seasonId: string): Set<number> {
  const ids = new Set<number>();
  for (const r of getInjuries(seasonId)) {
    if (!r.releasedAt) ids.add(r.playerId);
  }
  return ids;
}

export function saveInjuries(seasonId: string, records: InjuryRecord[]): void {
  sessionSet(KEY(seasonId), records);
  void putSeasonData(seasonId, "injuries", records);
}

export function upsertInjury(seasonId: string, record: InjuryRecord): void {
  const existing = getInjuries(seasonId);
  const idx = existing.findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    saveInjuries(seasonId, existing.map((r) => r.id === record.id ? record : r));
  } else {
    saveInjuries(seasonId, [...existing, record]);
  }
}

export function releaseInjury(seasonId: string, injuryId: string, releasedAt: string): void {
  saveInjuries(
    seasonId,
    getInjuries(seasonId).map((r) => r.id === injuryId ? { ...r, releasedAt } : r),
  );
}

export function updateInjuryName(seasonId: string, injuryId: string, name: string): void {
  saveInjuries(
    seasonId,
    getInjuries(seasonId).map((r) => r.id === injuryId ? { ...r, injuryName: name } : r),
  );
}

export function injuryIdForOccurrence(matchId: string, playerId: number): string {
  return `inj-${matchId}-${playerId}`;
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}
