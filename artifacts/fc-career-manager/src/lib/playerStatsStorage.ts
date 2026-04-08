import type { PlayerSeasonStats, PlayerOverride } from "@/types/playerStats";

function statsKey(careerId: string): string {
  return `fc-career-manager-stats-${careerId}`;
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
    mood: "neutro",
    fanMoral: "neutro",
  };
}

export function getAllPlayerStats(careerId: string): Record<number, PlayerSeasonStats> {
  try {
    const raw = localStorage.getItem(statsKey(careerId));
    if (!raw) return {};
    return JSON.parse(raw) as Record<number, PlayerSeasonStats>;
  } catch {
    return {};
  }
}

export function getPlayerStats(careerId: string, playerId: number): PlayerSeasonStats {
  return getAllPlayerStats(careerId)[playerId] ?? defaultStats(playerId);
}

export function setPlayerStats(
  careerId: string,
  playerId: number,
  stats: PlayerSeasonStats,
): void {
  const all = getAllPlayerStats(careerId);
  all[playerId] = stats;
  try {
    localStorage.setItem(statsKey(careerId), JSON.stringify(all));
  } catch {}
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
): void {
  const all = getAllPlayerOverrides(careerId);
  all[playerId] = { ...(all[playerId] ?? {}), ...patch, playerId };
  try {
    localStorage.setItem(overridesKey(careerId), JSON.stringify(all));
  } catch {}
}
