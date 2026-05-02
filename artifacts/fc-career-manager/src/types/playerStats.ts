export type Mood = "excelente" | "bom" | "neutro" | "insatisfeito" | "irritado";
export type FanMoral = "idolo" | "querido" | "neutro" | "contestado" | "vaiado";
export type TeamRole = "esporadico" | "rodizio" | "promessa" | "importante" | "crucial";

export const MOOD_LABELS: Record<Mood, string> = {
  excelente:    "Excelente",
  bom:          "Bom",
  neutro:       "Neutro",
  insatisfeito: "Insatisfeito",
  irritado:     "Irritado",
};

export const MOOD_COLORS: Record<Mood, { bg: string; color: string }> = {
  excelente:    { bg: "rgba(16,185,129,0.18)",  color: "#34d399" },
  bom:          { bg: "rgba(132,204,22,0.18)",  color: "#a3e635" },
  neutro:       { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
  insatisfeito: { bg: "rgba(249,115,22,0.18)",  color: "#fb923c" },
  irritado:     { bg: "rgba(239,68,68,0.18)",   color: "#f87171" },
};

export const FAN_MORAL_LABELS: Record<FanMoral, string> = {
  idolo:      "Ídolo",
  querido:    "Querido",
  neutro:     "Neutro",
  contestado: "Contestado",
  vaiado:     "Vaiado",
};

export const FAN_MORAL_COLORS: Record<FanMoral, { bg: string; color: string }> = {
  idolo:      { bg: "rgba(245,158,11,0.18)",  color: "#fbbf24" },
  querido:    { bg: "rgba(16,185,129,0.18)",  color: "#34d399" },
  neutro:     { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
  contestado: { bg: "rgba(249,115,22,0.18)",  color: "#fb923c" },
  vaiado:     { bg: "rgba(239,68,68,0.18)",   color: "#f87171" },
};

export const ROLE_LABELS: Record<TeamRole, string> = {
  esporadico: "Esporádico",
  rodizio:    "Rodízio",
  promessa:   "Promessa",
  importante: "Importante",
  crucial:    "Crucial",
};

export const ROLE_COLORS: Record<TeamRole, { bg: string; color: string }> = {
  esporadico: { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
  rodizio:    { bg: "rgba(59,130,246,0.18)",  color: "#60a5fa" },
  promessa:   { bg: "rgba(132,204,22,0.18)",  color: "#a3e635" },
  importante: { bg: "rgba(16,185,129,0.18)",  color: "#34d399" },
  crucial:    { bg: "rgba(245,158,11,0.18)",  color: "#fbbf24" },
};

export interface PlayerSeasonStats {
  playerId: number;
  goals: number;
  assists: number;
  matchesAsStarter: number;
  matchesAsSubstitute: number;
  totalMinutes: number;
  yellowCards: number;
  redCards: number;
  totalOwnGoals: number;
  totalMissedPenalties: number;
  recentRatings: number[];
  mood: Mood;
  fanMoral: FanMoral;
  motmCount?: number;
}

export interface OvrHistoryEntry {
  ovr: number;
  date: number;
}

export interface MarketValueEntry {
  value: number;
  date: number;
}

export interface PlayerOverride {
  playerId: number;
  nameOverride?: string;
  photoOverride?: string;
  shirtNumber?: number;
  overall?: number;
  ovrUpdatedAt?: number;
  salary?: number;
  positionOverride?: string;
  ovrHistory?: OvrHistoryEntry[];
  nationality?: string;
  height?: string;
  weight?: string;
  preferredFoot?: "right" | "left" | "both";
  contractStart?: string;
  contractEnd?: string;
  marketValue?: number;
  marketValueHistory?: MarketValueEntry[];
  salaryHistory?: MarketValueEntry[];
}
