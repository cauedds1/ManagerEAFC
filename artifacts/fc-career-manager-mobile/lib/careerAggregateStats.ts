// PORTED FROM artifacts/fc-career-manager/src/lib/careerAggregateStats.ts — adapted for React Native (AsyncStorage-backed localCache, no DOM).
import { localCache } from '@/lib/localCache';

export interface CareerAggregateStats {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
}

const AGG_KEY_PREFIX = 'fc-agg-';

function aggKey(careerId: string): string {
  return `${AGG_KEY_PREFIX}${careerId}`;
}

function loadAgg(careerId: string): CareerAggregateStats {
  try {
    const raw = localCache.getItem(aggKey(careerId));
    if (!raw) return { matches: 0, wins: 0, draws: 0, losses: 0, goals: 0 };
    return JSON.parse(raw) as CareerAggregateStats;
  } catch {
    return { matches: 0, wins: 0, draws: 0, losses: 0, goals: 0 };
  }
}

function saveAgg(careerId: string, agg: CareerAggregateStats): void {
  localCache.setItem(aggKey(careerId), JSON.stringify(agg));
}

export function getCareerAgg(careerId: string): CareerAggregateStats {
  return loadAgg(careerId);
}

export function recordMatchInAgg(careerId: string, myScore: number, oppScore: number): void {
  const agg = loadAgg(careerId);
  agg.matches += 1;
  agg.goals += myScore;
  if (myScore > oppScore) agg.wins += 1;
  else if (myScore < oppScore) agg.losses += 1;
  else agg.draws += 1;
  saveAgg(careerId, agg);
}

export function recomputeCareerAgg(
  careerId: string,
  allMatches: { myScore: number; opponentScore: number }[],
): void {
  const agg: CareerAggregateStats = { matches: 0, wins: 0, draws: 0, losses: 0, goals: 0 };
  for (const m of allMatches) {
    agg.matches += 1;
    agg.goals += m.myScore;
    if (m.myScore > m.opponentScore) agg.wins += 1;
    else if (m.myScore < m.opponentScore) agg.losses += 1;
    else agg.draws += 1;
  }
  saveAgg(careerId, agg);
}

export function adjustCareerAgg(
  careerId: string,
  oldMyScore: number,
  oldOppScore: number,
  newMyScore: number,
  newOppScore: number,
): void {
  const agg = loadAgg(careerId);

  agg.goals = Math.max(0, agg.goals - oldMyScore) + newMyScore;

  if (oldMyScore > oldOppScore) agg.wins = Math.max(0, agg.wins - 1);
  else if (oldMyScore < oldOppScore) agg.losses = Math.max(0, agg.losses - 1);
  else agg.draws = Math.max(0, agg.draws - 1);

  if (newMyScore > newOppScore) agg.wins += 1;
  else if (newMyScore < newOppScore) agg.losses += 1;
  else agg.draws += 1;

  saveAgg(careerId, agg);
}

export function getAllCareersAgg(careerIds: string[]): CareerAggregateStats {
  const total: CareerAggregateStats = { matches: 0, wins: 0, draws: 0, losses: 0, goals: 0 };
  for (const id of careerIds) {
    const agg = loadAgg(id);
    total.matches += agg.matches;
    total.wins += agg.wins;
    total.draws += agg.draws;
    total.losses += agg.losses;
    total.goals += agg.goals;
  }
  return total;
}
