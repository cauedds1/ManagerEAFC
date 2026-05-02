import type { PlayerSeasonStats, PlayerOverride } from "@/types/playerStats";
import { putSeasonData, putCareerData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";
import { migratePositionOverride, PT_BR_TO_POSITION, type PositionPtBr, type PositionGroup } from "@/lib/squadCache";

function statsKey(seasonId: string): string {
  return `fc-career-manager-stats-${seasonId}`;
}

function overridesKey(careerId: string): string {
  return `fc-career-manager-overrides-${careerId}`;
}

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}

function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function defaultStats(playerId: number): PlayerSeasonStats {
  return {
    playerId,
    goals: 0,
    assists: 0,
    matchesAsStarter: 0,
    matchesAsSubstitute: 0,
    totalMinutes: 0,
    yellowCards: 0,
    redCards: 0,
    totalOwnGoals: 0,
    totalMissedPenalties: 0,
    recentRatings: [],
    mood: "neutro",
    fanMoral: "neutro",
  };
}

export function getAllPlayerStats(seasonId: string): Record<number, PlayerSeasonStats> {
  const raw = sessionGet<Record<number, PlayerSeasonStats>>(statsKey(seasonId))
    ?? lsGet<Record<number, PlayerSeasonStats>>(statsKey(seasonId))
    ?? {};
  for (const [key, stats] of Object.entries(raw)) {
    if (stats.playerId === undefined || stats.playerId === null) {
      stats.playerId = Number(key);
    }
  }
  return raw;
}

export function getPlayerStats(seasonId: string, playerId: number): PlayerSeasonStats {
  return getAllPlayerStats(seasonId)[playerId] ?? defaultStats(playerId);
}

export function setPlayerStats(
  seasonId: string,
  playerId: number,
  stats: PlayerSeasonStats,
  syncDb = true,
): void {
  const all = getAllPlayerStats(seasonId);
  all[playerId] = stats;
  sessionSet(statsKey(seasonId), all);
  lsSet(statsKey(seasonId), all);
  if (syncDb) {
    void putSeasonData(seasonId, "player_stats", all);
  }
}

export function aggregatePlayerStats(seasonIds: string[]): Record<number, PlayerSeasonStats> {
  const result: Record<number, PlayerSeasonStats> = {};
  for (const sid of seasonIds) {
    const stats = getAllPlayerStats(sid);
    for (const [pid, s] of Object.entries(stats)) {
      const id = Number(pid);
      const ex = result[id];
      if (!ex) {
        result[id] = { ...s, recentRatings: [...(s.recentRatings ?? [])] };
      } else {
        result[id] = {
          ...ex,
          goals:                 ex.goals + s.goals,
          assists:               ex.assists + s.assists,
          matchesAsStarter:      ex.matchesAsStarter + s.matchesAsStarter,
          matchesAsSubstitute:   ex.matchesAsSubstitute + s.matchesAsSubstitute,
          totalMinutes:          ex.totalMinutes + s.totalMinutes,
          yellowCards:           ex.yellowCards + s.yellowCards,
          redCards:              ex.redCards + s.redCards,
          totalOwnGoals:         ex.totalOwnGoals + s.totalOwnGoals,
          totalMissedPenalties:  ex.totalMissedPenalties + s.totalMissedPenalties,
          recentRatings:         [...(ex.recentRatings ?? []), ...(s.recentRatings ?? [])],
        };
      }
    }
  }
  return result;
}

export function syncAllPlayerStats(seasonId: string): Promise<void> {
  const all = getAllPlayerStats(seasonId);
  lsSet(statsKey(seasonId), all);
  return putSeasonData(seasonId, "player_stats", all);
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
  void putSeasonData(toSeasonId, "player_stats", toStats);
}

export function deletePlayerStats(seasonId: string, playerId: number): void {
  const all = getAllPlayerStats(seasonId);
  delete all[playerId];
  sessionSet(statsKey(seasonId), all);
  lsSet(statsKey(seasonId), all);
  void putSeasonData(seasonId, "player_stats", all);
}

export function deletePlayerOverride(careerId: string, playerId: number): void {
  const all = getAllPlayerOverrides(careerId);
  delete all[playerId];
  sessionSet(overridesKey(careerId), all);
  try { localStorage.setItem(overridesKey(careerId), JSON.stringify(all)); } catch {}
  void putCareerData(careerId, "overrides", all);
}

export function getAllPlayerOverrides(careerId: string): Record<number, PlayerOverride> {
  return sessionGet<Record<number, PlayerOverride>>(overridesKey(careerId))
    ?? lsGet<Record<number, PlayerOverride>>(overridesKey(careerId))
    ?? {};
}

/**
 * Apply position/name/photo/number overrides to a list of squad players.
 * Returns a new array — original players are not mutated.
 * Used to ensure auto-fill / pickBestEleven respect user-trained positions.
 */
export function applyOverridesToPlayers<T extends {
  id: number;
  name: string;
  positionPtBr: PositionPtBr;
  position: PositionGroup;
  number?: number;
  photo: string;
}>(
  players: T[],
  overrides: Record<number, PlayerOverride>,
): T[] {
  return players.map((p) => {
    const ov = overrides[p.id];
    if (!ov) return p;
    const posOvr = migratePositionOverride(ov.positionOverride);
    const next = { ...p };
    if (ov.nameOverride) next.name = ov.nameOverride;
    if (ov.photoOverride) next.photo = ov.photoOverride;
    if (ov.shirtNumber != null) next.number = ov.shirtNumber;
    if (posOvr) {
      next.positionPtBr = posOvr;
      next.position = PT_BR_TO_POSITION[posOvr] ?? p.position;
    }
    return next;
  });
}

export function setPlayerOverride(
  careerId: string,
  playerId: number,
  patch: Partial<Omit<PlayerOverride, "playerId">>,
  logHistory = false,
  customDate?: number,
): void {
  const all = getAllPlayerOverrides(careerId);
  const existing = all[playerId] ?? {};

  let ovrHistory = existing.ovrHistory ?? [];
  const now = customDate ?? Date.now();
  const ovrIsChanging = patch.overall != null && patch.overall !== existing.overall;

  if (logHistory && existing.overall != null && ovrIsChanging) {
    ovrHistory = [...ovrHistory, { ovr: existing.overall, date: existing.ovrUpdatedAt ?? now }];
  }

  all[playerId] = {
    ...existing,
    ...patch,
    playerId,
    ovrUpdatedAt: ovrIsChanging ? now : existing.ovrUpdatedAt,
    ovrHistory: ovrHistory.length > 0 ? ovrHistory : existing.ovrHistory,
  };
  sessionSet(overridesKey(careerId), all);
  try { localStorage.setItem(overridesKey(careerId), JSON.stringify(all)); } catch {}
  void putCareerData(careerId, "overrides", all);
}
