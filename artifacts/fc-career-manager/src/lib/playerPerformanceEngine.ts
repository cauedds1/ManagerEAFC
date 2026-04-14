import type { Mood, FanMoral, PlayerSeasonStats } from "@/types/playerStats";
import { getAllPlayerStats, setPlayerStats } from "@/lib/playerStatsStorage";

const MOOD_LEVELS: Mood[] = ["irritado", "insatisfeito", "neutro", "bom", "excelente"];
const FAN_MORAL_LEVELS: FanMoral[] = ["vaiado", "contestado", "neutro", "querido", "idolo"];

function stepMood(current: Mood, delta: number): Mood {
  const idx = MOOD_LEVELS.indexOf(current);
  const safe = Math.max(0, Math.min(MOOD_LEVELS.length - 1, idx + delta));
  return MOOD_LEVELS[safe];
}

function stepFanMoral(current: FanMoral, delta: number): FanMoral {
  const idx = FAN_MORAL_LEVELS.indexOf(current);
  const safe = Math.max(0, Math.min(FAN_MORAL_LEVELS.length - 1, idx + delta));
  return FAN_MORAL_LEVELS[safe];
}

function avg(ratings: number[]): number {
  if (ratings.length === 0) return 6.5;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}

function computeNewMood(stats: PlayerSeasonStats): Mood {
  const current = stats.mood ?? "neutro";
  const recent = (stats.recentRatings ?? []).slice(-5);
  const recentAvg = avg(recent);
  const totalApps = (stats.matchesAsStarter ?? 0) + (stats.matchesAsSubstitute ?? 0);
  if (recent.length < 2) return current;

  let delta = 0;

  if (recentAvg >= 7.5) delta += 1;
  else if (recentAvg >= 6.5) delta += 0;
  else if (recentAvg < 5.5) delta -= 1;

  const ownGoals = stats.totalOwnGoals ?? 0;
  const missedPens = stats.totalMissedPenalties ?? 0;
  if (ownGoals > 0 && recent.length <= 3) delta -= 1;
  if (missedPens > 0 && recent.length <= 3) delta -= 1;

  if (stats.matchesAsSubstitute > stats.matchesAsStarter && totalApps >= 5 && recentAvg < 6.5) {
    delta -= 1;
  }

  if (delta > 0 && current === "excelente") return current;
  if (delta < 0 && current === "irritado") return current;
  return stepMood(current, delta);
}

function computeNewFanMoral(stats: PlayerSeasonStats): FanMoral {
  const current = stats.fanMoral ?? "neutro";
  const recent = (stats.recentRatings ?? []).slice(-8);
  const totalApps = (stats.matchesAsStarter ?? 0) + (stats.matchesAsSubstitute ?? 0);
  if (totalApps < 3) return current;

  const recentAvg = avg(recent);
  let delta = 0;

  if (recentAvg >= 7.5) delta += 1;
  else if (recentAvg < 5.5) delta -= 1;

  const contribution = (stats.goals ?? 0) + (stats.assists ?? 0);
  if (contribution >= 15 && delta >= 0) delta += 1;
  else if (contribution >= 8 && delta >= 0) delta += 1;
  else if (contribution < 3 && totalApps >= 12) delta -= 1;

  const ownGoals = stats.totalOwnGoals ?? 0;
  const missedPens = stats.totalMissedPenalties ?? 0;
  if (ownGoals >= 2) delta -= 1;
  if (missedPens >= 2) delta -= 1;

  if (stats.redCards >= 2) delta -= 1;

  if (delta > 0 && current === "idolo") return current;
  if (delta < 0 && current === "vaiado") return current;
  return stepFanMoral(current, delta);
}

export function runPerformanceEngine(seasonId: string): void {
  const allStats = getAllPlayerStats(seasonId);
  for (const [, stats] of Object.entries(allStats)) {
    const totalApps = (stats.matchesAsStarter ?? 0) + (stats.matchesAsSubstitute ?? 0);
    if (totalApps === 0) continue;
    const newMood = computeNewMood(stats);
    const newFanMoral = computeNewFanMoral(stats);
    if (newMood !== stats.mood || newFanMoral !== stats.fanMoral) {
      setPlayerStats(seasonId, stats.playerId, {
        ...stats,
        mood: newMood,
        fanMoral: newFanMoral,
      });
    }
  }
}

export function stepPlayerMood(seasonId: string, playerId: number, delta: number): void {
  const all = getAllPlayerStats(seasonId);
  const stats = all[playerId];
  if (!stats) return;
  setPlayerStats(seasonId, playerId, {
    ...stats,
    mood: stepMood(stats.mood ?? "neutro", delta),
  });
}

export function stepPlayerFanMoral(seasonId: string, playerId: number, delta: number): void {
  const all = getAllPlayerStats(seasonId);
  const stats = all[playerId];
  if (!stats) return;
  setPlayerStats(seasonId, playerId, {
    ...stats,
    fanMoral: stepFanMoral(stats.fanMoral ?? "neutro", delta),
  });
}
