import type { MatchRecord } from "@/types/match";
import { getMatchResultFull } from "@/types/match";
import type { Season } from "@/types/career";

export interface MatchRecordEntry {
  value: number;
  scoreLine: string;
  date: string | null;
  matchId: string;
}

export interface OpponentRecordEntry {
  value: number;
  opponents: string[];
}

export interface SeasonRecordEntry {
  value: number;
  seasonLabel: string;
  seasonId: string;
}

export interface YearRecordEntry {
  value: number;
  year: string;
}

export interface AverageRecordEntry {
  value: number;
  seasonLabel: string;
  seasonId: string;
  matches: number;
}

export interface StreakRecordEntry {
  value: number;
  startDate: string | null;
  endDate: string | null;
}

// Section-specific entry shapes are used instead of one uniform
// `{value, label, ...}` because labels are i18n strings assembled in the
// view (PT-BR / EN), and each section needs a distinct contextual field
// (scoreLine, opponents, seasonId, year, dateRange).
export interface CareerRecords {
  partidas: {
    biggestWin:        MatchRecordEntry | null;
    biggestWinHome:    MatchRecordEntry | null;
    biggestWinAway:    MatchRecordEntry | null;
    biggestLoss:       MatchRecordEntry | null;
    biggestLossHome:   MatchRecordEntry | null;
    biggestLossAway:   MatchRecordEntry | null;
    highestDraw:       MatchRecordEntry | null;
    mostGoalsFor:      MatchRecordEntry | null;
    mostGoalsAgainst:  MatchRecordEntry | null;
    mostGoalsTotal:    MatchRecordEntry | null;
  };
  adversarios: {
    mostFaced:     OpponentRecordEntry | null;
    mostScoredVs:  OpponentRecordEntry | null;
    mostConcededVs:OpponentRecordEntry | null;
    mostBeaten:    OpponentRecordEntry | null;
    hardest:       OpponentRecordEntry | null;
  };
  temporada: {
    mostGoals:        SeasonRecordEntry | null;
    mostMatches:      SeasonRecordEntry | null;
    mostWins:         SeasonRecordEntry | null;
    mostDraws:        SeasonRecordEntry | null;
    mostLosses:       SeasonRecordEntry | null;
    mostCleanSheets:  SeasonRecordEntry | null;
    bestGoalsAvg:     AverageRecordEntry | null;
  };
  anoCivil: {
    mostGoals:  YearRecordEntry | null;
    mostWins:   YearRecordEntry | null;
    mostDraws:  YearRecordEntry | null;
    mostLosses: YearRecordEntry | null;
  };
  sequencias: {
    longestWinning:        StreakRecordEntry | null;
    longestUnbeaten:       StreakRecordEntry | null;
    longestCleanSheet:     StreakRecordEntry | null;
  };
}

const MIN_MATCHES_FOR_AVG = 5;

function scoreLineFor(m: MatchRecord, clubName: string): string {
  const us = clubName?.trim() || "—";
  const opp = m.opponent?.trim() || "—";
  if (m.location === "fora") {
    return `${opp} ${m.opponentScore}-${m.myScore} ${us}`;
  }
  return `${us} ${m.myScore}-${m.opponentScore} ${opp}`;
}

function pickByMaxThenRecent(
  matches: MatchRecord[],
  scoreFn: (m: MatchRecord) => number | null,
  clubName: string,
): MatchRecordEntry | null {
  let best: { m: MatchRecord; v: number } | null = null;
  for (const m of matches) {
    const v = scoreFn(m);
    if (v == null) continue;
    if (
      !best ||
      v > best.v ||
      (v === best.v && (m.date ?? "") > (best.m.date ?? ""))
    ) {
      best = { m, v };
    }
  }
  if (!best) return null;
  return {
    value: best.v,
    scoreLine: scoreLineFor(best.m, clubName),
    date: best.m.date || null,
    matchId: best.m.id,
  };
}

function isWin(m: MatchRecord): boolean {
  return getMatchResultFull(m.myScore, m.opponentScore, m.penaltyShootout) === "vitoria";
}
function isLoss(m: MatchRecord): boolean {
  return getMatchResultFull(m.myScore, m.opponentScore, m.penaltyShootout) === "derrota";
}
// A 1-1 won on penalties is a win, not a draw.
function isTrueDraw(m: MatchRecord): boolean {
  return m.myScore === m.opponentScore && !m.penaltyShootout;
}

function pickOpponent(
  byOpp: Map<string, number>,
  allowZero = false,
): OpponentRecordEntry | null {
  if (byOpp.size === 0) return null;
  let max = -Infinity;
  for (const v of byOpp.values()) if (v > max) max = v;
  if (max < 0) return null;
  if (!allowZero && max <= 0) return null;
  const opponents = Array.from(byOpp.entries())
    .filter(([, v]) => v === max)
    .map(([k]) => k)
    .sort((a, b) => a.localeCompare(b));
  return { value: max, opponents };
}

function pickSeasonMax(
  perSeason: Map<string, number>,
  seasonsById: Map<string, Season>,
): SeasonRecordEntry | null {
  if (perSeason.size === 0) return null;
  let bestId: string | null = null;
  let bestVal = -Infinity;
  for (const [id, v] of perSeason.entries()) {
    if (v > bestVal) { bestVal = v; bestId = id; }
  }
  if (bestId == null || bestVal < 0) return null;
  return {
    value: bestVal,
    seasonId: bestId,
    seasonLabel: seasonsById.get(bestId)?.label ?? bestId,
  };
}

function pickYearMax(perYear: Map<string, number>): YearRecordEntry | null {
  if (perYear.size === 0) return null;
  let bestY: string | null = null;
  let bestVal = -Infinity;
  for (const [y, v] of perYear.entries()) {
    if (v > bestVal) { bestVal = v; bestY = y; }
  }
  if (bestY == null || bestVal < 0) return null;
  return { value: bestVal, year: bestY };
}

function computeStreaks(matches: MatchRecord[]): CareerRecords["sequencias"] {
  const sorted = [...matches].sort((a, b) => {
    const da = a.date || "";
    const db = b.date || "";
    if (da !== db) return da.localeCompare(db);
    return a.createdAt - b.createdAt;
  });

  function bestStreak(qualifies: (m: MatchRecord) => boolean): StreakRecordEntry | null {
    let cur = 0, curStart: string | null = null, curEnd: string | null = null;
    let bestVal = 0, bestStart: string | null = null, bestEnd: string | null = null;
    for (const m of sorted) {
      if (qualifies(m)) {
        if (cur === 0) curStart = m.date || null;
        cur++;
        curEnd = m.date || null;
        if (cur > bestVal) { bestVal = cur; bestStart = curStart; bestEnd = curEnd; }
      } else {
        cur = 0; curStart = null; curEnd = null;
      }
    }
    if (bestVal === 0) return null;
    return { value: bestVal, startDate: bestStart, endDate: bestEnd };
  }

  return {
    longestWinning:    bestStreak(isWin),
    longestUnbeaten:   bestStreak((m) => !isLoss(m)),
    longestCleanSheet: bestStreak((m) => m.opponentScore === 0),
  };
}

export function computeCareerRecords(
  matches: MatchRecord[],
  seasons: Season[],
  clubName: string,
): CareerRecords {
  const seasonsById = new Map(seasons.map((s) => [s.id, s]));

  const winsAll   = matches.filter(isWin);
  const lossesAll = matches.filter(isLoss);
  const trueDraws = matches.filter(isTrueDraw);
  const winsHome  = winsAll.filter((m) => m.location === "casa");
  const winsAway  = winsAll.filter((m) => m.location === "fora");
  const lossHome  = lossesAll.filter((m) => m.location === "casa");
  const lossAway  = lossesAll.filter((m) => m.location === "fora");

  const diffWin  = (m: MatchRecord) => m.myScore - m.opponentScore;
  const diffLoss = (m: MatchRecord) => m.opponentScore - m.myScore;
  const totalDraw= (m: MatchRecord) => m.myScore + m.opponentScore;

  const partidas: CareerRecords["partidas"] = {
    biggestWin:       pickByMaxThenRecent(winsAll,   diffWin,                            clubName),
    biggestWinHome:   pickByMaxThenRecent(winsHome,  diffWin,                            clubName),
    biggestWinAway:   pickByMaxThenRecent(winsAway,  diffWin,                            clubName),
    biggestLoss:      pickByMaxThenRecent(lossesAll, diffLoss,                           clubName),
    biggestLossHome:  pickByMaxThenRecent(lossHome,  diffLoss,                           clubName),
    biggestLossAway:  pickByMaxThenRecent(lossAway,  diffLoss,                           clubName),
    highestDraw:      pickByMaxThenRecent(trueDraws, totalDraw,                          clubName),
    mostGoalsFor:     pickByMaxThenRecent(matches,   (m) => m.myScore,                   clubName),
    mostGoalsAgainst: pickByMaxThenRecent(matches,   (m) => m.opponentScore,             clubName),
    mostGoalsTotal:   pickByMaxThenRecent(matches,   (m) => m.myScore + m.opponentScore, clubName),
  };

  const facedByOpp     = new Map<string, number>();
  const scoredByOpp    = new Map<string, number>();
  const concededByOpp  = new Map<string, number>();
  const beatenByOpp    = new Map<string, number>();
  const lostToByOpp    = new Map<string, number>();

  for (const m of matches) {
    const opp = (m.opponent || "").trim();
    if (!opp) continue;
    facedByOpp.set(opp, (facedByOpp.get(opp) ?? 0) + 1);
    scoredByOpp.set(opp, (scoredByOpp.get(opp) ?? 0) + m.myScore);
    concededByOpp.set(opp, (concededByOpp.get(opp) ?? 0) + m.opponentScore);
    if (isWin(m))  beatenByOpp.set(opp, (beatenByOpp.get(opp) ?? 0) + 1);
    if (isLoss(m)) lostToByOpp.set(opp, (lostToByOpp.get(opp) ?? 0) + 1);
  }

  const adversarios: CareerRecords["adversarios"] = {
    mostFaced:     pickOpponent(facedByOpp),
    mostScoredVs:  pickOpponent(scoredByOpp,   true),
    mostConcededVs:pickOpponent(concededByOpp, true),
    mostBeaten:    pickOpponent(beatenByOpp),
    hardest:       pickOpponent(lostToByOpp),
  };

  const seasonGoals       = new Map<string, number>();
  const seasonMatches     = new Map<string, number>();
  const seasonWins        = new Map<string, number>();
  const seasonDraws       = new Map<string, number>();
  const seasonLosses      = new Map<string, number>();
  const seasonCleanSheets = new Map<string, number>();

  for (const m of matches) {
    const sid = m.season;
    if (!sid) continue;
    if (!seasonMatches.has(sid)) {
      seasonGoals.set(sid, 0);
      seasonMatches.set(sid, 0);
      seasonWins.set(sid, 0);
      seasonDraws.set(sid, 0);
      seasonLosses.set(sid, 0);
      seasonCleanSheets.set(sid, 0);
    }
    seasonGoals.set(sid, (seasonGoals.get(sid) ?? 0) + m.myScore);
    seasonMatches.set(sid, (seasonMatches.get(sid) ?? 0) + 1);
    if (isWin(m))      seasonWins.set(sid,   (seasonWins.get(sid)   ?? 0) + 1);
    if (isTrueDraw(m)) seasonDraws.set(sid,  (seasonDraws.get(sid)  ?? 0) + 1);
    if (isLoss(m))     seasonLosses.set(sid, (seasonLosses.get(sid) ?? 0) + 1);
    if (m.opponentScore === 0) seasonCleanSheets.set(sid, (seasonCleanSheets.get(sid) ?? 0) + 1);
  }

  let bestAvg: AverageRecordEntry | null = null;
  for (const [sid, count] of seasonMatches.entries()) {
    if (count < MIN_MATCHES_FOR_AVG) continue;
    const avg = (seasonGoals.get(sid) ?? 0) / count;
    if (!bestAvg || avg > bestAvg.value) {
      bestAvg = {
        value: Math.round(avg * 100) / 100,
        seasonId: sid,
        seasonLabel: seasonsById.get(sid)?.label ?? sid,
        matches: count,
      };
    }
  }

  const temporada: CareerRecords["temporada"] = {
    mostGoals:       pickSeasonMax(seasonGoals,       seasonsById),
    mostMatches:     pickSeasonMax(seasonMatches,     seasonsById),
    mostWins:        pickSeasonMax(seasonWins,        seasonsById),
    mostDraws:       pickSeasonMax(seasonDraws,       seasonsById),
    mostLosses:      pickSeasonMax(seasonLosses,      seasonsById),
    mostCleanSheets: pickSeasonMax(seasonCleanSheets, seasonsById),
    bestGoalsAvg:    bestAvg,
  };

  const yearGoals  = new Map<string, number>();
  const yearWins   = new Map<string, number>();
  const yearDraws  = new Map<string, number>();
  const yearLosses = new Map<string, number>();

  for (const m of matches) {
    const y = (m.date || "").slice(0, 4);
    if (!/^\d{4}$/.test(y)) continue;
    if (!yearGoals.has(y)) {
      yearGoals.set(y, 0);
      yearWins.set(y, 0);
      yearDraws.set(y, 0);
      yearLosses.set(y, 0);
    }
    yearGoals.set(y, (yearGoals.get(y) ?? 0) + m.myScore);
    if (isWin(m))      yearWins.set(y,   (yearWins.get(y)   ?? 0) + 1);
    if (isTrueDraw(m)) yearDraws.set(y,  (yearDraws.get(y)  ?? 0) + 1);
    if (isLoss(m))     yearLosses.set(y, (yearLosses.get(y) ?? 0) + 1);
  }

  const anoCivil: CareerRecords["anoCivil"] = {
    mostGoals:  pickYearMax(yearGoals),
    mostWins:   pickYearMax(yearWins),
    mostDraws:  pickYearMax(yearDraws),
    mostLosses: pickYearMax(yearLosses),
  };

  return {
    partidas,
    adversarios,
    temporada,
    anoCivil,
    sequencias: computeStreaks(matches),
  };
}
