import type { MatchRecord } from '@/lib/api';

const KNOCKOUT_ORDER = ['oitavas', 'quartas', 'semi', 'final'] as const;
type KnockoutPhase = typeof KNOCKOUT_ORDER[number];

const KNOCKOUT_DISPLAY: Record<KnockoutPhase, string> = {
  oitavas: 'Oitavas',
  quartas: 'Quartas',
  semi: 'Semi',
  final: 'Final',
};

const GROUP_STAGE_CUPS = [
  'champions league', 'uefa champions league',
  'europa league', 'uefa europa league',
  'conference league', 'uefa conference league',
  'copa libertadores', 'libertadores',
  'copa sudamericana', 'sudamericana',
  'copa do brasil',
];
const GROUP_STAGE_MAX_ROUNDS = 6;

function normalizeKnockout(stage: string): KnockoutPhase | null {
  const s = stage.toLowerCase().trim();
  if (s.includes('oitava') || s.includes('round of 16') || s === '16') return 'oitavas';
  if (s.includes('quart') || s === 'quartas') return 'quartas';
  if (s.includes('semi')) return 'semi';
  if ((s === 'final' || s.includes('final')) && !s.includes('semi') && !s.includes('quart') && !s.includes('oitava')) return 'final';
  return null;
}

function isRoundStage(stage: string): boolean {
  return /^(rodada|round|jornada|matchday|gameweek)\s*\d+$/i.test(stage.trim());
}

function extractRoundNumber(stage: string): number | null {
  const m = stage.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function nextKnockoutPhase(phase: KnockoutPhase): string | null {
  const idx = KNOCKOUT_ORDER.indexOf(phase);
  if (idx < 0 || idx >= KNOCKOUT_ORDER.length - 1) return null;
  return KNOCKOUT_DISPLAY[KNOCKOUT_ORDER[idx + 1]];
}

function isGroupStageCup(tournament: string): boolean {
  const t = tournament.toLowerCase().trim();
  return GROUP_STAGE_CUPS.some((cup) => t.includes(cup));
}

export interface TwoLeggedContext {
  isSecondLeg: true;
  firstLeg: MatchRecord;
  tieId: string;
}

export interface AutoFillResult {
  stage: string;
  twoLeggedContext: { isSecondLeg: false } | TwoLeggedContext;
}

export function getAutoFillForTournament(
  allMatches: MatchRecord[],
  tournament: string,
): AutoFillResult {
  const tournamentNorm = tournament.trim().toLowerCase();
  if (!tournamentNorm) {
    return { stage: 'Rodada 1', twoLeggedContext: { isSecondLeg: false } };
  }

  const tournamentMatches = allMatches
    .filter((m) => m.tournament.trim().toLowerCase() === tournamentNorm)
    .sort((a, b) => b.createdAt - a.createdAt);

  if (tournamentMatches.length === 0) {
    return { stage: 'Rodada 1', twoLeggedContext: { isSecondLeg: false } };
  }

  const lastMatch = tournamentMatches[0];

  if (lastMatch.legType === 'first_leg') {
    return {
      stage: lastMatch.stage,
      twoLeggedContext: {
        isSecondLeg: true,
        firstLeg: lastMatch,
        tieId: lastMatch.tieId ?? `tie_${lastMatch.id}`,
      },
    };
  }

  const lastStage = lastMatch.stage;

  if (isRoundStage(lastStage)) {
    const num = extractRoundNumber(lastStage);
    if (num !== null) {
      if (isGroupStageCup(tournament) && num >= GROUP_STAGE_MAX_ROUNDS) {
        return { stage: 'Oitavas', twoLeggedContext: { isSecondLeg: false } };
      }
      return { stage: `Rodada ${num + 1}`, twoLeggedContext: { isSecondLeg: false } };
    }
  }

  const knockoutPhase = normalizeKnockout(lastStage);
  if (knockoutPhase) {
    const next = nextKnockoutPhase(knockoutPhase);
    if (next) {
      return { stage: next, twoLeggedContext: { isSecondLeg: false } };
    }
    return { stage: lastStage, twoLeggedContext: { isSecondLeg: false } };
  }

  return { stage: lastStage, twoLeggedContext: { isSecondLeg: false } };
}

export function computeAggregate(
  firstLeg: Pick<MatchRecord, 'myScore' | 'opponentScore'>,
  secondLeg: Pick<MatchRecord, 'myScore' | 'opponentScore'>,
): { myTotal: number; opponentTotal: number } {
  return {
    myTotal: firstLeg.myScore + secondLeg.myScore,
    opponentTotal: firstLeg.opponentScore + secondLeg.opponentScore,
  };
}

export function getMatchAggregateInfo(
  match: MatchRecord,
  allMatches: MatchRecord[],
): { myTotal: number; opponentTotal: number } | null {
  if (match.legType !== 'second_leg' || !match.tieId) return null;
  const firstLeg = allMatches.find(
    (m) => m.tieId === match.tieId && m.legType === 'first_leg',
  );
  if (!firstLeg) return null;
  return computeAggregate(firstLeg, match);
}
