import { putSeasonData } from "@/lib/apiStorage";

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
  try {
    const raw = localStorage.getItem(KEY(seasonId));
    return raw ? (JSON.parse(raw) as InjuryRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveInjuries(seasonId: string, records: InjuryRecord[]): void {
  try {
    localStorage.setItem(KEY(seasonId), JSON.stringify(records));
  } catch {}
  void putSeasonData(seasonId, "injuries", records);
}

export function upsertInjury(seasonId: string, record: InjuryRecord): void {
  const records = getInjuries(seasonId);
  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  saveInjuries(seasonId, records);
}

export function releaseInjury(seasonId: string, injuryId: string, releasedAt: string): void {
  const records = getInjuries(seasonId);
  const idx = records.findIndex((r) => r.id === injuryId);
  if (idx >= 0) {
    records[idx].releasedAt = releasedAt;
    saveInjuries(seasonId, records);
  }
}

export function updateInjuryName(seasonId: string, injuryId: string, name: string): void {
  const records = getInjuries(seasonId);
  const idx = records.findIndex((r) => r.id === injuryId);
  if (idx >= 0) {
    records[idx].injuryName = name;
    saveInjuries(seasonId, records);
  }
}

export function injuryIdForOccurrence(matchId: string, playerId: number): string {
  return `inj-${matchId}-${playerId}`;
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}
