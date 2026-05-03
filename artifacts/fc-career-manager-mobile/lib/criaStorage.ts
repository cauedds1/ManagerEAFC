import { putCareerData } from '@/lib/apiStorage';
import { sessionGet, sessionSet } from '@/lib/sessionStore';
import { localCache } from '@/lib/localCache';

export interface CriaRecord {
  playerId: number;
  playerName: string;
  promotedSeasonId: string;
  promotedSeasonLabel: string;
  promotedAt: number;
}

function nameKey(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function lsGet<T>(key: string): T | null {
  try {
    const raw = localCache.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function lsSet(key: string, value: unknown): void {
  try { localCache.setItem(key, JSON.stringify(value)); } catch {}
}

function key(careerId: string): string       { return `fc-career-manager-cria-records-${careerId}`; }
function legacyKey(careerId: string): string { return `fc-career-manager-cria-ids-${careerId}`; }

function loadRecords(careerId: string): CriaRecord[] {
  const fresh = sessionGet<CriaRecord[]>(key(careerId)) ?? lsGet<CriaRecord[]>(key(careerId));
  if (fresh) return fresh;
  const legacy = sessionGet<number[]>(legacyKey(careerId)) ?? lsGet<number[]>(legacyKey(careerId));
  if (Array.isArray(legacy) && legacy.length > 0) {
    const migrated = legacy.map<CriaRecord>((id) => ({
      playerId: id,
      playerName: '',
      promotedSeasonId: '',
      promotedSeasonLabel: '',
      promotedAt: 0,
    }));
    save(careerId, migrated);
    return migrated;
  }
  return [];
}

export function findCriaByName(careerId: string, name: string): CriaRecord | undefined {
  if (!name) return undefined;
  const k = nameKey(name);
  return loadRecords(careerId).find((r) => r.playerName && nameKey(r.playerName) === k);
}

export function relinkCriaToNewPlayerId(
  careerId: string,
  originalRecord: CriaRecord,
  newPlayerId: number,
): void {
  const list = loadRecords(careerId);
  if (list.some((r) => r.playerId === newPlayerId)) return;
  save(careerId, [...list, { ...originalRecord, playerId: newPlayerId }]);
}

function save(careerId: string, list: CriaRecord[]): void {
  sessionSet(key(careerId), list);
  lsSet(key(careerId), list);
  void putCareerData(careerId, 'criaRecords', list);
}

export function getCriaRecords(careerId: string): CriaRecord[] {
  return loadRecords(careerId);
}

export function getCriaIds(careerId: string): number[] {
  return loadRecords(careerId).map((r) => r.playerId);
}

export function isCria(careerId: string, playerId: number): boolean {
  return loadRecords(careerId).some((r) => r.playerId === playerId);
}

export function getCriaRecord(careerId: string, playerId: number): CriaRecord | undefined {
  return loadRecords(careerId).find((r) => r.playerId === playerId);
}

export function buildCriaTooltipMap(
  careerId: string,
  template: string,
  fallback: string,
): Map<number, string> {
  const out = new Map<number, string>();
  for (const r of loadRecords(careerId)) {
    if (r.promotedSeasonLabel) {
      out.set(r.playerId, template.replace('{season}', r.promotedSeasonLabel));
    } else {
      out.set(r.playerId, fallback);
    }
  }
  return out;
}

export function addCriaId(
  careerId: string,
  playerId: number,
  promotedSeasonId = '',
  promotedSeasonLabel = '',
  playerName = '',
): void {
  const list = loadRecords(careerId);
  if (list.some((r) => r.playerId === playerId)) return;
  save(careerId, [...list, {
    playerId,
    playerName,
    promotedSeasonId,
    promotedSeasonLabel,
    promotedAt: Date.now(),
  }]);
}
