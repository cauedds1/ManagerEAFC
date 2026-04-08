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

export interface GoalEntry {
  id: string;
  minute: number;
  assistPlayerId?: number;
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
  passes?: number;
  passAccuracy?: number;
  keyPasses?: number;
  dribblesCompleted?: number;
  ballRecoveries?: number;
  ballLosses?: number;
  saves?: number;
  penaltiesSaved?: number;
}

export interface MatchStats {
  myShots: number;
  opponentShots: number;
  possessionPct: number;
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
  tablePositionBefore?: number;
  opponentLogoUrl?: string;
  createdAt: number;
}

export function getMatchResult(myScore: number, opponentScore: number): MatchResult {
  if (myScore > opponentScore) return "vitoria";
  if (myScore < opponentScore) return "derrota";
  return "empate";
}

export const RESULT_STYLE: Record<MatchResult, { label: string; bg: string; color: string; border: string }> = {
  vitoria: { label: "V", bg: "rgba(16,185,129,0.18)",  color: "#34d399", border: "rgba(16,185,129,0.3)" },
  empate:  { label: "E", bg: "rgba(148,163,184,0.12)", color: "#94a3b8", border: "rgba(148,163,184,0.2)" },
  derrota: { label: "D", bg: "rgba(239,68,68,0.18)",   color: "#f87171", border: "rgba(239,68,68,0.3)" },
};
