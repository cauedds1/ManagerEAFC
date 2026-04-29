export type MatchLocation = "casa" | "fora" | "neutro";
export type MatchResult = "vitoria" | "empate" | "derrota";

export const LOCATION_LABELS: Record<MatchLocation, string> = {
  casa:   "Casa",
  fora:   "Fora",
  neutro: "Neutro",
};

export const LOCATION_ICONS: Record<MatchLocation, string> = {
  casa:   "🏠",
  fora:   "✈️",
  neutro: "⚖️",
};

export type GoalType =
  | "normal"
  | "cabeca"
  | "bicicleta"
  | "voleio"
  | "fora_area"
  | "falta"
  | "penalti"
  | "contra_ataque";

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  normal:        "Gol normal",
  cabeca:        "De cabeça",
  bicicleta:     "De bicicleta",
  voleio:        "Voleio",
  fora_area:     "Fora da área",
  falta:         "Falta",
  penalti:       "Pênalti",
  contra_ataque: "Contra-ataque",
};

export const GOAL_TYPE_ICONS: Record<GoalType, string> = {
  normal:        "⚽",
  cabeca:        "🤕",
  bicicleta:     "🔄",
  voleio:        "🦵",
  fora_area:     "💥",
  falta:         "🎯",
  penalti:       "🥅",
  contra_ataque: "⚡",
};

export interface GoalEntry {
  id: string;
  minute: number;
  assistPlayerId?: number;
  goalType?: GoalType;
}

export interface OpponentGoalEntry {
  id: string;
  minute: number;
  playerName?: string;
}

export interface PlayerMatchStats {
  startedOnBench: boolean;
  rating: number;
  goals: GoalEntry[];
  ownGoal: boolean;
  ownGoalMinute?: number;
  missedPenalty: boolean;
  missedPenaltyMinute?: number;
  injured: boolean;
  injuryMinute?: number;
  substituted: boolean;
  substitutedAtMinute?: number;
  substitutedInPlayerId?: number;
  substitutedForPlayerId?: number;
  yellowCard?: boolean;
  yellowCardMinute?: number;
  yellowCard2?: boolean;
  yellowCard2Minute?: number;
  redCard?: boolean;
  redCardMinute?: number;
  shots?: number;
  shotsOnTargetPct?: number;
  passes?: number;
  passAccuracy?: number;
  keyPasses?: number;
  dribblesCompleted?: number;
  dribblesSuccessRate?: number;
  ballRecoveries?: number;
  ballLosses?: number;
  saves?: number;
  penaltiesSaved?: number;
}

export interface MatchStats {
  myShots: number;
  opponentShots: number;
  possessionPct: number;
  penaltyGoals?: number;
}

export interface PenaltyKick {
  playerId?: number;
  scored: boolean;
}

export interface PenaltyShootout {
  myScore: number;
  opponentScore: number;
  kicks: PenaltyKick[];
  goalkeeperSaves?: number;
}

export interface PlayerSnapshotEntry {
  name: string;
  photo: string;
  positionPtBr: string;
  number?: number;
}

export interface MatchRecord {
  id: string;
  careerId: string;
  season: string;
  date: string;
  tournament: string;
  stage: string;
  location: MatchLocation;
  opponent: string;
  myScore: number;
  opponentScore: number;
  starterIds: number[];
  subIds: number[];
  playerStats: Record<number, PlayerMatchStats>;
  matchStats: MatchStats;
  motmPlayerId?: number;
  motmPlayerName?: string;
  opponentGoals?: OpponentGoalEntry[];
  tablePositionBefore?: number;
  opponentLogoUrl?: string;
  observations?: string;
  hasExtraTime?: boolean;
  penaltyShootout?: PenaltyShootout;
  formation?: string;
  createdAt: number;
  playerSnapshot?: Record<number, PlayerSnapshotEntry>;
}

export function getMatchResult(myScore: number, opponentScore: number): MatchResult {
  if (myScore > opponentScore) return "vitoria";
  if (myScore < opponentScore) return "derrota";
  return "empate";
}

export function getMatchResultFull(
  myScore: number,
  opponentScore: number,
  penaltyShootout?: PenaltyShootout,
): MatchResult {
  if (penaltyShootout) {
    if (penaltyShootout.myScore > penaltyShootout.opponentScore) return "vitoria";
    if (penaltyShootout.myScore < penaltyShootout.opponentScore) return "derrota";
  }
  return getMatchResult(myScore, opponentScore);
}

export const RESULT_STYLE: Record<MatchResult, { label: string; bg: string; color: string; border: string }> = {
  vitoria: { label: "V", bg: "rgba(16,185,129,0.18)",  color: "#34d399", border: "rgba(16,185,129,0.3)" },
  empate:  { label: "E", bg: "rgba(148,163,184,0.12)", color: "#94a3b8", border: "rgba(148,163,184,0.2)" },
  derrota: { label: "D", bg: "rgba(239,68,68,0.18)",   color: "#f87171", border: "rgba(239,68,68,0.3)" },
};
