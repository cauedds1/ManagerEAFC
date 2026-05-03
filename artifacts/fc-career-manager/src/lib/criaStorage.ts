import { putCareerData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";

export interface CriaRecord {
  playerId: number;
  promotedSeasonId: string;
  promotedSeasonLabel: string;
  promotedAt: number;
}

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function key(careerId: string): string {
  return `fc-career-manager-cria-records-${careerId}`;
}

function legacyKey(careerId: string): string {
  return `fc-career-manager-cria-ids-${careerId}`;
}

function loadRecords(careerId: string): CriaRecord[] {
  const fresh = sessionGet<CriaRecord[]>(key(careerId)) ?? lsGet<CriaRecord[]>(key(careerId));
  if (fresh) return fresh;
  // Legacy migration: previously we stored bare number IDs.
  const legacy = sessionGet<number[]>(legacyKey(careerId)) ?? lsGet<number[]>(legacyKey(careerId));
  if (Array.isArray(legacy) && legacy.length > 0) {
    const migrated = legacy.map<CriaRecord>((id) => ({
      playerId: id,
      promotedSeasonId: "",
      promotedSeasonLabel: "",
      promotedAt: 0,
    }));
    save(careerId, migrated);
    return migrated;
  }
  return [];
}

function save(careerId: string, list: CriaRecord[]): void {
  sessionSet(key(careerId), list);
  lsSet(key(careerId), list);
  void putCareerData(careerId, "criaRecords", list);
}

export function getCriaRecords(careerId: string): CriaRecord[] {
  return loadRecords(careerId);
}

/** Compat helper for views that only need the IDs. */
export function getCriaIds(careerId: string): number[] {
  return loadRecords(careerId).map((r) => r.playerId);
}

export function isCria(careerId: string, playerId: number): boolean {
  return loadRecords(careerId).some((r) => r.playerId === playerId);
}

export function getCriaRecord(careerId: string, playerId: number): CriaRecord | undefined {
  return loadRecords(careerId).find((r) => r.playerId === playerId);
}

/**
 * Builds a `playerId -> "Cria do clube · Promovido em {label}"` map for
 * use as tooltip text. Falls back to `fallback` for legacy records that
 * don't have a stored season label.
 */
export function buildCriaTooltipMap(
  careerId: string,
  template: string,
  fallback: string,
): Map<number, string> {
  const out = new Map<number, string>();
  for (const r of loadRecords(careerId)) {
    if (r.promotedSeasonLabel) {
      out.set(r.playerId, template.replace("{season}", r.promotedSeasonLabel));
    } else {
      out.set(r.playerId, fallback);
    }
  }
  return out;
}

export function addCriaId(
  careerId: string,
  playerId: number,
  promotedSeasonId = "",
  promotedSeasonLabel = "",
): void {
  const list = loadRecords(careerId);
  if (list.some((r) => r.playerId === playerId)) return;
  save(careerId, [...list, {
    playerId,
    promotedSeasonId,
    promotedSeasonLabel,
    promotedAt: Date.now(),
  }]);
}
