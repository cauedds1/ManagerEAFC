/**
 * Single entry point called from registrar-partida (and any other place
 * that records a finished match) to keep all derived statistics and mood
 * scores consistent.  Runs:
 *
 *   1. Career aggregate (W/D/L/goals)
 *   2. Per-player season stats (goals, assists, ratings, cards, ownGoals, missed pens)
 *   3. Player performance engine (mood + fanMoral progression)
 *   4. Fan mood delta
 *   5. Board mood delta
 *
 * The function never throws — engine failures are logged but do not abort
 * the caller.  All persistence already happens through the underlying
 * storage adapters (memory cache + best-effort API push).
 */

import type { MatchRecord } from '@/lib/api';
import { recordMatchInAgg } from '@/lib/careerAggregateStats';
import {
  defaultStats,
  getPlayerStats,
  setPlayerStats,
  syncAllPlayerStats,
  hydratePlayerStatsCache,
  type ExtendedPlayerSeasonStats,
} from '@/lib/playerStatsStorage';
import { runPerformanceEngine } from '@/lib/playerPerformanceEngine';
import {
  computeFanMoodDelta,
  getFanMood,
  setFanMood,
  isEliteClub,
  hydrateFanMoodCache,
} from '@/lib/fanMoodStorage';
import {
  computeBoardMoodDelta,
  getBoardMood,
  setBoardMood,
  hydrateBoardMoodCache,
} from '@/lib/boardMoodStorage';

export interface ApplyMatchOptions {
  careerId: string;
  seasonId: string;
  match: MatchRecord;
  /** All matches in this season (including the new one) for unbeaten-streak math. */
  allMatches: MatchRecord[];
  /** Configured rivals — used to detect clássicos for mood deltas. */
  rivals?: string[];
  /** Squad average overall — feeds prestige calc in fan + board moods. */
  squadAvgOvr?: number | null;
  /** Average overall of the league (web caller provides; optional on mobile). */
  leagueAvgOvr?: number | null;
  /** Total titles won by the club (used as prestige fallback). */
  clubTotalTitles?: number;
  /** Used by the board engine — `'survival' | 'title' | 'promotion'` style strings. */
  projeto?: string;
  /** Used by the board engine — current league name for expected OVR. */
  league?: string;
  /** Current league position (board only). */
  leaguePosition?: { position: number; totalTeams: number } | null;
  /** Optional penalty already computed by the season-objectives module. */
  objectivePenalty?: number;
  /**
   * Squad roster used to resolve `match.playerStats` keys (which on mobile are
   * player **names**) back to numeric ids. Pass the squadPlayers list.
   */
  squad?: Array<{ id: number; name: string }>;
  /**
   * Optional season payload (api response data) used to hydrate engine caches
   * before applying the new match. Pass `seasonData?.data` if available.
   */
  seasonPayload?: Record<string, unknown> | null;
}

function isClassicoMatch(opponent: string, rivals?: string[]): boolean {
  if (!rivals || rivals.length === 0) return false;
  const q = opponent.toLowerCase().trim();
  return rivals.some((r) => r.toLowerCase().trim() === q);
}

function unbeatenStreak(allMatches: MatchRecord[]): number {
  const sorted = [...allMatches].sort((a, b) => a.createdAt - b.createdAt);
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const m = sorted[i];
    if (m.myScore >= m.opponentScore) streak++;
    else break;
  }
  return streak;
}

function updatePerPlayerStats(
  seasonId: string,
  match: MatchRecord,
  squad?: Array<{ id: number; name: string }>,
): Promise<void> {
  const nameToId = new Map<string, number>();
  if (squad) for (const p of squad) nameToId.set(p.name, p.id);

  const resolveKey = (key: string): number | null => {
    const asNum = Number(key);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
    const id = nameToId.get(key);
    return typeof id === 'number' && id > 0 ? id : null;
  };

  const psByPlayerId = new Map<number, MatchRecord['playerStats'][string]>();
  for (const [k, v] of Object.entries(match.playerStats)) {
    const id = resolveKey(k);
    if (id != null) psByPlayerId.set(id, v);
  }

  const allPlayerIds = new Set<number>([
    ...match.starterIds.filter((id) => id !== 0),
    ...match.subIds.filter((id) => id !== 0),
    ...psByPlayerId.keys(),
  ]);

  const assistCounts: Record<number, number> = {};
  for (const ps of psByPlayerId.values()) {
    for (const g of ps.goals) {
      if (g.assistPlayerId != null) {
        assistCounts[g.assistPlayerId] = (assistCounts[g.assistPlayerId] ?? 0) + 1;
      }
    }
  }

  for (const playerId of allPlayerIds) {
    const ps = psByPlayerId.get(playerId);
    const existing: ExtendedPlayerSeasonStats =
      getPlayerStats(seasonId, playerId) ?? defaultStats(playerId);

    const isStarter = match.starterIds.includes(playerId);
    const wasOnBench = match.subIds.includes(playerId);

    const playedThisMatch = ps && (
      isStarter || (wasOnBench && (ps.startedOnBench === false || (ps.rating ?? 0) > 0))
    );

    if (!playedThisMatch && !ps) continue;

    const recent = [...(existing.recentRatings ?? [])];
    if (ps && (ps.rating ?? 0) > 0) {
      recent.push(ps.rating);
      if (recent.length > 10) recent.splice(0, recent.length - 10);
    }

    const apps = (existing.appearances ?? 0) + (playedThisMatch ? 1 : 0);
    const ownGoalsThisMatch = ps?.ownGoal ? 1 : 0;
    const missedPenThisMatch = ps?.penaltyMissed ?? 0;
    const goalsThisMatch = ps ? ps.goals.length : 0;
    const assistsThisMatch = assistCounts[playerId] ?? 0;
    const yellowsThisMatch = ps?.yellowCard ? 1 : 0;
    const redsThisMatch = ps?.redCard ? 1 : 0;

    const sumRatings = recent.reduce((a, b) => a + b, 0);
    const avgRating = recent.length > 0 ? sumRatings / recent.length : (existing.avgRating ?? 0);

    const updated: ExtendedPlayerSeasonStats = {
      ...existing,
      playerId,
      goals:                 (existing.goals ?? 0) + goalsThisMatch,
      assists:               (existing.assists ?? 0) + assistsThisMatch,
      yellowCards:           (existing.yellowCards ?? 0) + yellowsThisMatch,
      redCards:              (existing.redCards ?? 0) + redsThisMatch,
      appearances:           apps,
      avgRating,
      matchesAsStarter:      (existing.matchesAsStarter ?? 0)    + (isStarter && playedThisMatch ? 1 : 0),
      matchesAsSubstitute:   (existing.matchesAsSubstitute ?? 0) + (wasOnBench && playedThisMatch && !isStarter ? 1 : 0),
      totalOwnGoals:         (existing.totalOwnGoals ?? 0)        + ownGoalsThisMatch,
      totalMissedPenalties:  (existing.totalMissedPenalties ?? 0) + missedPenThisMatch,
      recentRatings:         recent,
    };

    setPlayerStats(seasonId, playerId, updated, /* syncDb */ false);
  }

  return syncAllPlayerStats(seasonId);
}

export async function applyMatchToEngines(opts: ApplyMatchOptions): Promise<void> {
  const {
    careerId, seasonId, match, allMatches,
    rivals, squadAvgOvr, leagueAvgOvr, clubTotalTitles,
    projeto, league, leaguePosition, objectivePenalty,
    squad, seasonPayload,
  } = opts;

  if (seasonPayload) {
    try {
      hydratePlayerStatsCache(seasonId, seasonPayload);
      hydrateFanMoodCache(seasonId, seasonPayload);
      hydrateBoardMoodCache(seasonId, seasonPayload);
    } catch (err) {
      console.warn('[engines] hydrate caches failed:', err);
    }
  }

  try {
    recordMatchInAgg(careerId, match.myScore, match.opponentScore);
  } catch (err) {
    console.warn('[engines] recordMatchInAgg failed:', err);
  }

  try {
    await updatePerPlayerStats(seasonId, match, squad);
  } catch (err) {
    console.warn('[engines] updatePerPlayerStats failed:', err);
  }

  try {
    await runPerformanceEngine(seasonId);
  } catch (err) {
    console.warn('[engines] runPerformanceEngine failed:', err);
  }

  try {
    const isClassico = isClassicoMatch(match.opponent, rivals);
    const streak = unbeatenStreak(allMatches);
    const elite = isEliteClub(match.opponent);
    const fanDelta = computeFanMoodDelta(
      match.myScore, match.opponentScore,
      isClassico, streak, clubTotalTitles,
      squadAvgOvr ?? undefined, leagueAvgOvr ?? undefined, elite,
    );
    if (fanDelta !== 0) {
      await setFanMood(seasonId, getFanMood(seasonId) + fanDelta);
    }
  } catch (err) {
    console.warn('[engines] fan mood delta failed:', err);
  }

  try {
    const boardDelta = computeBoardMoodDelta({
      myScore: match.myScore,
      opponentScore: match.opponentScore,
      isClassico: isClassicoMatch(match.opponent, rivals),
      matchCount: allMatches.length,
      squadAvgOvr,
      league,
      projeto,
      leaguePosition,
      objectivePenalty,
    });
    if (boardDelta !== 0) {
      await setBoardMood(seasonId, getBoardMood(seasonId) + boardDelta);
    }
  } catch (err) {
    console.warn('[engines] board mood delta failed:', err);
  }
}
