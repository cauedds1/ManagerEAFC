import type { PositionPtBr } from "@/lib/squadCache";
import { putCareerData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";

export interface BasePlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: PositionPtBr;
  age: number;
  nationality: string;
  overall: number;
  potentialMin: number;
  potentialMax: number;
  photo?: string;
  addedAt: number;
  promotedAt?: number;
  promotedAsId?: number;
}

export const BASE_MAX_SLOTS = 25;
export const BASE_MIN_AGE = 15;
export const BASE_MAX_AGE = 19;
export const BASE_LEAVE_AGE = 20;

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
  return `fc-career-manager-base-players-${careerId}`;
}

function lastAdvanceKey(careerId: string): string {
  return `fc-career-manager-base-last-advance-${careerId}`;
}

export function getBasePlayers(careerId: string): BasePlayer[] {
  const list = sessionGet<BasePlayer[]>(key(careerId))
    ?? lsGet<BasePlayer[]>(key(careerId))
    ?? [];
  return list.filter((p) => !p.promotedAt);
}

export function getAllBasePlayersRaw(careerId: string): BasePlayer[] {
  return sessionGet<BasePlayer[]>(key(careerId))
    ?? lsGet<BasePlayer[]>(key(careerId))
    ?? [];
}

export function saveBasePlayers(careerId: string, players: BasePlayer[]): void {
  sessionSet(key(careerId), players);
  lsSet(key(careerId), players);
  void putCareerData(careerId, "basePlayers", players);
}

export function addBasePlayer(careerId: string, player: BasePlayer): void {
  const all = getAllBasePlayersRaw(careerId);
  saveBasePlayers(careerId, [...all, player]);
}

export function updateBasePlayer(careerId: string, id: string, patch: Partial<BasePlayer>): void {
  const all = getAllBasePlayersRaw(careerId);
  saveBasePlayers(careerId, all.map((p) => p.id === id ? { ...p, ...patch } : p));
}

export function removeBasePlayer(careerId: string, id: string): void {
  const all = getAllBasePlayersRaw(careerId);
  saveBasePlayers(careerId, all.filter((p) => p.id !== id));
}

export function generateBasePlayerId(): string {
  return `base-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Indicador "pronto pra promover": idade ≥ 18 ou OVR ≥ 80% do potentialMin. */
export function isReadyToPromote(p: BasePlayer): boolean {
  if (p.age >= 18) return true;
  return p.overall >= Math.round(p.potentialMin * 0.8);
}

export function getLastAdvanceSeasonId(careerId: string): string | null {
  return sessionGet<string>(lastAdvanceKey(careerId))
    ?? lsGet<string>(lastAdvanceKey(careerId))
    ?? null;
}

export function setLastAdvanceSeasonId(careerId: string, seasonId: string): void {
  sessionSet(lastAdvanceKey(careerId), seasonId);
  lsSet(lastAdvanceKey(careerId), seasonId);
  void putCareerData(careerId, "baseLastAdvanceSeasonId", seasonId);
}

export interface BaseAdvanceResult {
  aged: BasePlayer[];
  leftDueToAge: BasePlayer[];
}

/**
 * Advance one season for all base players:
 *  - age + 1
 *  - OVR grows toward potentialMax (factor 0.20–0.40 of remaining gap)
 *  - players turning 20 are removed (returned in leftDueToAge)
 */
export function advanceBaseSeason(careerId: string): BaseAdvanceResult {
  const all = getAllBasePlayersRaw(careerId);
  const aged: BasePlayer[] = [];
  const leftDueToAge: BasePlayer[] = [];
  const kept: BasePlayer[] = [];

  for (const p of all) {
    if (p.promotedAt) {
      kept.push(p);
      continue;
    }
    const newAge = p.age + 1;
    const gap = Math.max(0, p.potentialMax - p.overall);
    const factor = 0.20 + Math.random() * 0.20;
    const growth = Math.round(gap * factor);
    const newOverall = Math.min(p.potentialMax, p.overall + growth);
    const updated: BasePlayer = { ...p, age: newAge, overall: newOverall };
    if (newAge >= BASE_LEAVE_AGE) {
      leftDueToAge.push(updated);
    } else {
      aged.push(updated);
      kept.push(updated);
    }
  }

  saveBasePlayers(careerId, kept);
  return { aged, leftDueToAge };
}
