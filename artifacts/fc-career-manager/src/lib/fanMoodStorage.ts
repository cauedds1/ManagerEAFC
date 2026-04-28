import { putSeasonData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";
import { DASHBOARD } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

const DEFAULT_SCORE = 50;
const fanMoodKey = (seasonId: string) => `fc-fan-mood-${seasonId}`;

export interface FanMoodInfo {
  score: number;
  label: string;
  emoji: string;
  color: string;
}

export function getFanMoodLabel(score: number, lang: Lang = "pt"): { label: string; emoji: string; color: string } {
  const t = DASHBOARD[lang];
  if (score < 20) return { label: t.moodRevoltada,    emoji: "😡", color: "#ef4444" };
  if (score < 40) return { label: t.moodInsatisfeita, emoji: "😤", color: "#f97316" };
  if (score < 60) return { label: t.moodNeutra,       emoji: "😐", color: "#eab308" };
  if (score < 80) return { label: t.moodAnimada,      emoji: "🔥", color: "#22c55e" };
  return            { label: t.moodEuforica,      emoji: "🙌", color: "#16a34a" };
}

export function getFanMood(seasonId: string): number {
  const raw = sessionGet<string | number>(fanMoodKey(seasonId));
  if (raw === null) return DEFAULT_SCORE;
  const v = Number(raw);
  return isNaN(v) ? DEFAULT_SCORE : Math.max(0, Math.min(100, v));
}

export async function setFanMood(seasonId: string, score: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  sessionSet(fanMoodKey(seasonId), clamped);
  await putSeasonData(seasonId, "fan_mood", clamped);
}

const ELITE_CLUBS_KEYWORDS: readonly string[] = [
  // Premier League
  "manchester city", "man city",
  "manchester united", "man united", "man utd",
  "liverpool",
  "arsenal",
  "chelsea",
  "tottenham",
  // La Liga
  "real madrid",
  "barcelona",
  "atletico madrid", "atlético madrid",
  // Bundesliga
  "bayern",
  "borussia dortmund",
  // Serie A
  "juventus",
  "ac milan",
  "inter milan", "internazionale", "fc internazionale",
  "napoli",
  // Ligue 1
  "paris saint-germain", "paris sg", "psg",
  "olympique de marseille",
  // Netherlands
  "ajax",
  // Portugal
  "porto",
  "benfica",
  "sporting cp", "sporting lisboa",
  // Scotland
  "celtic",
  "rangers",
  // Turkey
  "galatasaray",
  "fenerbahce", "fenerbahçe",
  "besiktas", "beşiktaş",
  // Brazil
  "flamengo",
  "palmeiras",
  "corinthians",
  "santos",
  "grêmio", "gremio",
  "internacional",
  "atlético mineiro", "atletico mineiro",
  "cruzeiro",
  // Argentina
  "river plate",
  "boca juniors",
];

export function isEliteClub(opponentName: string): boolean {
  const lower = opponentName.toLowerCase().trim();
  for (const keyword of ELITE_CLUBS_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }
  return false;
}

export function computeFanMoodDelta(
  myScore: number,
  opponentScore: number,
  isClassico: boolean,
  unbeatenStreak: number = 0,
  clubTotalTitles?: number,
  mySquadOvr?: number,
  leagueAvgOvr?: number,
  isEliteOpponent: boolean = false,
): number {
  const isDraw = myScore === opponentScore;
  const isLoss = myScore < opponentScore;

  const prestige: "small" | "medium" | "large" =
    mySquadOvr != null && leagueAvgOvr != null
      ? mySquadOvr < leagueAvgOvr - 5  ? "small"
      : mySquadOvr > leagueAvgOvr + 5  ? "large"
      : "medium"
    : clubTotalTitles === undefined ? "medium"
    : clubTotalTitles <= 2          ? "small"
    : clubTotalTitles >= 10         ? "large"
    : "medium";

  if (isLoss) {
    let base: number;
    if (isClassico) {
      base = -16;
    } else if (opponentScore >= 4) {
      base = isEliteOpponent ? -10 : -14;
    } else {
      base = isEliteOpponent ? -6 : -9;
    }
    if (prestige === "large") return Math.round(base * 1.1);
    return base;
  }

  if (isDraw) {
    return unbeatenStreak >= 5 ? +1 : 0;
  }

  let base = 0;
  if (isClassico) base = +14;
  else if (myScore >= 4) base = +11;
  else base = +8;

  if (prestige === "small") base = Math.round(base * 1.25);
  else if (prestige === "large") base = Math.round(base * 0.85);

  const eliteBonus = isEliteOpponent
    ? prestige === "small" ? +5
    : prestige === "large" ? +1
    : +3
    : 0;

  let streakBonus = 0;
  if (unbeatenStreak >= 8) streakBonus = +7;
  else if (unbeatenStreak >= 5) streakBonus = +5;
  else if (unbeatenStreak >= 2) streakBonus = +3;

  return base + eliteBonus + streakBonus;
}

export function hydrateFanMoodCache(seasonId: string, data: Record<string, unknown>): void {
  if (typeof data["fan_mood"] === "number") {
    sessionSet(fanMoodKey(seasonId), data["fan_mood"]);
  }
}
