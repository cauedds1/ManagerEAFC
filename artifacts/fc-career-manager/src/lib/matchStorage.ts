import type { MatchRecord, PlayerMatchStats } from "@/types/match";
import { getPlayerStats, setPlayerStats } from "@/lib/playerStatsStorage";
import type { PlayerSeasonStats } from "@/types/playerStats";

function matchesKey(careerId: string): string {
  return `fc-career-manager-matches-${careerId}`;
}

export function getMatches(careerId: string): MatchRecord[] {
  try {
    const raw = localStorage.getItem(matchesKey(careerId));
    if (!raw) return [];
    return JSON.parse(raw) as MatchRecord[];
  } catch {
    return [];
  }
}

export function addMatch(careerId: string, match: MatchRecord): void {
  const list = getMatches(careerId);
  list.push(match);
  try {
    localStorage.setItem(matchesKey(careerId), JSON.stringify(list));
  } catch {}
}

export function generateMatchId(): string {
  return `match-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateGoalId(): string {
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

const MAX_RECENT_RATINGS = 10;

export function applyMatchToPlayerStats(
  careerId: string,
  starterIds: number[],
  subIds: number[],
  playerStats: Record<number, PlayerMatchStats>,
): void {
  const allPlayerIds = [...starterIds, ...subIds];

  for (const playerId of allPlayerIds) {
    const current = getPlayerStats(careerId, playerId);
    const pStats = playerStats[playerId];
    if (!pStats) continue;

    const isStarter = starterIds.includes(playerId);

    let minutes: number;
    if (isStarter) {
      minutes = 90;
      if (pStats.substituted && pStats.substitutedAtMinute != null) {
        minutes = Math.min(90, Math.max(0, pStats.substitutedAtMinute));
      } else if (pStats.injured && pStats.injuryMinute != null) {
        minutes = Math.min(90, Math.max(0, pStats.injuryMinute));
      }
    } else {
      minutes = 0;
      for (const starterId of starterIds) {
        const sStats = playerStats[starterId];
        if (
          sStats?.substitutedInPlayerId === playerId &&
          sStats.substitutedAtMinute != null
        ) {
          minutes = Math.min(90, Math.max(0, 90 - sStats.substitutedAtMinute));
          break;
        }
      }
    }

    const goalsScored = pStats.goals.length;

    let assistsGiven = 0;
    for (const pId of allPlayerIds) {
      const ps = playerStats[pId];
      if (ps) {
        for (const g of ps.goals) {
          if (g.assistPlayerId === playerId) assistsGiven++;
        }
      }
    }

    const newRatings = [
      ...(current.recentRatings ?? []),
      pStats.rating,
    ].slice(-MAX_RECENT_RATINGS);

    const updated: PlayerSeasonStats = {
      ...current,
      matchesAsStarter: current.matchesAsStarter + (isStarter ? 1 : 0),
      matchesAsSubstitute: current.matchesAsSubstitute + (isStarter ? 0 : 1),
      totalMinutes: current.totalMinutes + Math.max(0, minutes),
      goals: current.goals + goalsScored,
      assists: current.assists + assistsGiven,
      yellowCards: current.yellowCards + (pStats.yellowCard ? 1 : 0),
      redCards: current.redCards + (pStats.redCard ? 1 : 0),
      totalOwnGoals: (current.totalOwnGoals ?? 0) + (pStats.ownGoal ? 1 : 0),
      totalMissedPenalties: (current.totalMissedPenalties ?? 0) + (pStats.missedPenalty ? 1 : 0),
      recentRatings: newRatings,
    };

    setPlayerStats(careerId, playerId, updated);
  }
}
