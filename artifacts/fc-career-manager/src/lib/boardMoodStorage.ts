import { putSeasonData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";

const DEFAULT_SCORE = 50;
const boardMoodKey = (seasonId: string) => `fc-board-mood-${seasonId}`;
const crisisKey = (seasonId: string) => `fc-board-crisis-${seasonId}`;

const LEAGUE_EXPECTED_OVR: Record<string, number> = {
  "Premier League": 78,
  "La Liga": 76,
  "Bundesliga": 76,
  "Serie A": 76,
  "Ligue 1": 74,
  "Championship": 70,
  "Serie B": 70,
  "Eredivisie": 72,
  "Primeira Liga": 70,
  "Liga Profesional": 70,
  "Brasileirão": 70,
  "Campeonato Brasileiro": 70,
  "League One": 64,
  "League Two": 60,
};

function getLeagueExpectedOvr(league: string): number {
  if (LEAGUE_EXPECTED_OVR[league] != null) return LEAGUE_EXPECTED_OVR[league];
  const lower = league.toLowerCase();
  for (const [key, val] of Object.entries(LEAGUE_EXPECTED_OVR)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  return 68;
}

export interface BoardMoodLabelInfo {
  label: string;
  emoji: string;
  color: string;
}

export function getBoardMoodLabel(score: number, lang: string = "pt"): BoardMoodLabelInfo {
  const isEn = lang === "en";
  if (score >= 80) return { label: isEn ? "Satisfied" : "Satisfeita", emoji: "💼", color: "#16a34a" };
  if (score >= 60) return { label: isEn ? "Stable" : "Estável", emoji: "👔", color: "#22c55e" };
  if (score >= 40) return { label: isEn ? "Watching" : "Observando", emoji: "📊", color: "#eab308" };
  if (score >= 20) return { label: isEn ? "Concerned" : "Preocupada", emoji: "😟", color: "#f97316" };
  return { label: isEn ? "In Crisis" : "Em Crise", emoji: "🚨", color: "#ef4444" };
}

export function getBoardMood(seasonId: string): number {
  const raw = sessionGet<string | number>(boardMoodKey(seasonId));
  if (raw === null) return DEFAULT_SCORE;
  const v = Number(raw);
  return isNaN(v) ? DEFAULT_SCORE : Math.max(0, Math.min(100, v));
}

export async function setBoardMood(seasonId: string, score: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  sessionSet(boardMoodKey(seasonId), clamped);
  await putSeasonData(seasonId, "board_mood", clamped);
}

export interface BoardMoodDeltaParams {
  myScore: number;
  opponentScore: number;
  isClassico?: boolean;
  matchCount: number;
  squadAvgOvr?: number | null;
  league?: string;
  projeto?: string;
  leaguePosition?: { position: number; totalTeams: number } | null;
  objectivePenalty?: number;
}

export function computeBoardMoodDelta(params: BoardMoodDeltaParams): number {
  const { myScore, opponentScore, matchCount, squadAvgOvr, league, projeto, leaguePosition, objectivePenalty } = params;
  const isWin = myScore > opponentScore;
  const isLoss = myScore < opponentScore;

  // Step 1: base delta (spec: win +4, draw +1, loss -6; no classico modifier for board)
  let delta = 0;
  if (isWin) delta = 4;
  else if (!isLoss) delta = 1; // draw
  else delta = -6;

  // Step 2: expectation factor (losses only)
  if (isLoss && squadAvgOvr != null && league) {
    const expectedOvr = getLeagueExpectedOvr(league);
    const diff = squadAvgOvr - expectedOvr;
    if (diff <= -10) {
      delta = Math.ceil(delta * 0.5); // losses cost 50% less
    } else if (diff >= 10) {
      delta = Math.floor(delta * 1.5); // losses cost 50% more
    }
  }

  // Step 3: project modifier (losses only)
  if (isLoss && projeto) {
    const p = projeto.toLowerCase();
    const isSurvival = p.includes("sobrev") || p.includes("survival") || p.includes("relega");
    const isTitle = p.includes("título") || p.includes("titulo") || p.includes("title") || p.includes("campe") || p.includes("champion");
    const isPromotion = p.includes("promoção") || p.includes("promotion") || p.includes("subir") || p.includes("promot");

    if (isSurvival) {
      const inZone = leaguePosition ? leaguePosition.position > leaguePosition.totalTeams - 3 : false;
      if (!inZone) delta = Math.ceil(delta * 0.7); // out of zone → 30% less impact
    }
    if (isTitle) delta = Math.floor(delta * 1.2); // 20% more demanding
    if (isPromotion && leaguePosition && leaguePosition.position <= 3) {
      delta = Math.ceil(delta * 0.8); // in promo spot → somewhat lenient
    }
  }

  // Step 4: grace period — first 8 matches, halve any negative delta
  const inGrace = matchCount <= 8;
  if (inGrace && delta < 0) delta = Math.ceil(delta / 2);

  // Step 5: objective penalty (applied after all other modifiers)
  if (objectivePenalty && objectivePenalty > 0) {
    delta -= objectivePenalty;
  }

  return delta;
}

export function hydrateBoardMoodCache(seasonId: string, data: Record<string, unknown>): void {
  if (typeof data["board_mood"] === "number") {
    sessionSet(boardMoodKey(seasonId), data["board_mood"]);
  }
}

export function getBoardCrisisStreak(seasonId: string): number {
  const raw = sessionGet<number>(crisisKey(seasonId));
  return typeof raw === "number" ? raw : 0;
}

export function setBoardCrisisStreak(seasonId: string, streak: number): void {
  sessionSet(crisisKey(seasonId), streak);
  void putSeasonData(seasonId, "board_crisis_streak", streak);
}

export function hydrateBoardCrisisCache(seasonId: string, data: Record<string, unknown>): void {
  if (typeof data["board_crisis_streak"] === "number") {
    sessionSet(crisisKey(seasonId), data["board_crisis_streak"]);
  }
}
