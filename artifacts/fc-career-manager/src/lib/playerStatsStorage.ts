import type { PlayerSeasonStats, PlayerOverride } from "@/types/playerStats";
import { putSeasonData, putCareerData } from "@/lib/apiStorage";

function statsKey(seasonId: string): string {
  return `fc-career-manager-stats-${seasonId}`;
}

function overridesKey(careerId: string): string {
  return `fc-career-manager-overrides-${careerId}`;
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
  try {
    const raw = localStorage.getItem(statsKey(seasonId));
    if (!raw) return {};
    return JSON.parse(raw) as Record<number, PlayerSeasonStats>;
  } catch {
    return {};
  }
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
  try {
    localStorage.setItem(statsKey(seasonId), JSON.stringify(all));
  } catch {}
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
  try {
    localStorage.setItem(statsKey(toSeasonId), JSON.stringify(toStats));
  } catch {}
  void putSeasonData(toSeasonId, "player_stats", toStats);
}

export function getAllPlayerOverrides(careerId: string): Record<number, PlayerOverride> {
  try {
    const raw = localStorage.getItem(overridesKey(careerId));
    if (!raw) return {};
    return JSON.parse(raw) as Record<number, PlayerOverride>;
  } catch {
    return {};
  }
}

export function setPlayerOverride(
  careerId: string,
  playerId: number,
  patch: Partial<Omit<PlayerOverride, "playerId">>,
  logHistory = false,
): void {
  const all = getAllPlayerOverrides(careerId);
  const existing = all[playerId] ?? {};

  let ovrHistory = existing.ovrHistory ?? [];
  if (
    logHistory &&
    existing.overall != null &&
    patch.overall != null &&
    patch.overall !== existing.overall
  ) {
    ovrHistory = [...ovrHistory, { ovr: existing.overall, date: Date.now() }];
  }

  all[playerId] = {
    ...existing,
    ...patch,
    playerId,
    ovrHistory: ovrHistory.length > 0 ? ovrHistory : existing.ovrHistory,
  };
  try {
    localStorage.setItem(overridesKey(careerId), JSON.stringify(all));
  } catch {}
  void putCareerData(careerId, "overrides", all);
}
