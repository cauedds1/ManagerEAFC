import type { Mood, FanMoral, PlayerSeasonStats, PlayerOverride } from '@/lib/api';
import { putSeasonData, putCareerData } from '@/lib/apiStorage';
import { sessionGet, sessionSet } from '@/lib/sessionStore';
import { localCache } from '@/lib/localCache';

export type ExtendedPlayerSeasonStats = PlayerSeasonStats & {
  totalOwnGoals?: number;
  totalMissedPenalties?: number;
};

function statsKey(seasonId: string): string {
  return `fc-career-manager-stats-${seasonId}`;
}

function overridesKey(careerId: string): string {
  return `fc-career-manager-overrides-${careerId}`;
}

function lsGet<T>(key: string): T | null {
  try {
    const raw = localCache.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}

function lsSet(key: string, value: unknown): void {
  try { localCache.setItem(key, JSON.stringify(value)); } catch {}
}

export function defaultStats(playerId: number): ExtendedPlayerSeasonStats {
  return {
    playerId,
    goals: 0,
    assists: 0,
    avgRating: 0,
    appearances: 0,
    matchesAsStarter: 0,
    matchesAsSubstitute: 0,
    totalMinutes: 0,
    yellowCards: 0,
    redCards: 0,
    totalOwnGoals: 0,
    totalMissedPenalties: 0,
    recentRatings: [],
    mood: 'neutro' as Mood,
    fanMoral: 'neutro' as FanMoral,
  };
}

export function getAllPlayerStats(seasonId: string): Record<number, ExtendedPlayerSeasonStats> {
  const raw = sessionGet<Record<number, ExtendedPlayerSeasonStats>>(statsKey(seasonId))
    ?? lsGet<Record<number, ExtendedPlayerSeasonStats>>(statsKey(seasonId))
    ?? {};
  for (const [k, stats] of Object.entries(raw)) {
    if (stats.playerId === undefined || stats.playerId === null) {
      stats.playerId = Number(k);
    }
  }
  return raw;
}

export function getPlayerStats(seasonId: string, playerId: number): ExtendedPlayerSeasonStats {
  return getAllPlayerStats(seasonId)[playerId] ?? defaultStats(playerId);
}

export function setPlayerStats(
  seasonId: string,
  playerId: number,
  stats: ExtendedPlayerSeasonStats,
  syncDb = true,
): void {
  const all = getAllPlayerStats(seasonId);
  all[playerId] = stats;
  sessionSet(statsKey(seasonId), all);
  lsSet(statsKey(seasonId), all);
  if (syncDb) {
    void putSeasonData(seasonId, 'player_stats', Object.values(all));
  }
}

export function syncAllPlayerStats(seasonId: string): Promise<void> {
  const all = getAllPlayerStats(seasonId);
  lsSet(statsKey(seasonId), all);
  return putSeasonData(seasonId, 'player_stats', Object.values(all));
}

export function copyPlayerMoodsToNewSeason(fromSeasonId: string, toSeasonId: string): void {
  const fromStats = getAllPlayerStats(fromSeasonId);
  const toStats = getAllPlayerStats(toSeasonId);
  for (const [pid, stats] of Object.entries(fromStats)) {
    const playerId = Number(pid);
    toStats[playerId] = {
      ...defaultStats(playerId),
      mood: stats.mood,
      fanMoral: stats.fanMoral,
    };
  }
  sessionSet(statsKey(toSeasonId), toStats);
  lsSet(statsKey(toSeasonId), toStats);
  void putSeasonData(toSeasonId, 'player_stats', Object.values(toStats));
}

export function deletePlayerStats(seasonId: string, playerId: number): void {
  const all = getAllPlayerStats(seasonId);
  delete all[playerId];
  sessionSet(statsKey(seasonId), all);
  lsSet(statsKey(seasonId), all);
  void putSeasonData(seasonId, 'player_stats', Object.values(all));
}

export function getAllPlayerOverrides(careerId: string): Record<number, PlayerOverride> {
  return sessionGet<Record<number, PlayerOverride>>(overridesKey(careerId))
    ?? lsGet<Record<number, PlayerOverride>>(overridesKey(careerId))
    ?? {};
}

export function setPlayerOverride(
  careerId: string,
  playerId: number,
  patch: Partial<Omit<PlayerOverride, 'playerId'>>,
): void {
  const all = getAllPlayerOverrides(careerId);
  const existing = all[playerId] ?? { playerId };
  all[playerId] = { ...existing, ...patch, playerId };
  sessionSet(overridesKey(careerId), all);
  lsSet(overridesKey(careerId), all);
  void putCareerData(careerId, 'playerOverrides', Object.values(all));
}

export function deletePlayerOverride(careerId: string, playerId: number): void {
  const all = getAllPlayerOverrides(careerId);
  delete all[playerId];
  sessionSet(overridesKey(careerId), all);
  lsSet(overridesKey(careerId), all);
  void putCareerData(careerId, 'playerOverrides', Object.values(all));
}

export function hydratePlayerStatsCache(seasonId: string, data: Record<string, unknown>): void {
  const ps = data['player_stats'];
  if (Array.isArray(ps)) {
    const map: Record<number, ExtendedPlayerSeasonStats> = {};
    for (const s of ps as ExtendedPlayerSeasonStats[]) {
      if (s && typeof s.playerId === 'number') map[s.playerId] = s;
    }
    sessionSet(statsKey(seasonId), map);
  } else if (ps && typeof ps === 'object') {
    sessionSet(statsKey(seasonId), ps);
  }
}
