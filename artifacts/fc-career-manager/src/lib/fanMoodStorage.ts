import { putSeasonData } from "@/lib/apiStorage";

const DEFAULT_SCORE = 50;
const fanMoodKey = (seasonId: string) => `fc-fan-mood-${seasonId}`;

export interface FanMoodInfo {
  score: number;
  label: string;
  emoji: string;
  color: string;
}

export function getFanMoodLabel(score: number): { label: string; emoji: string; color: string } {
  if (score < 20) return { label: "Revoltada",    emoji: "😡", color: "#ef4444" };
  if (score < 40) return { label: "Insatisfeita", emoji: "😤", color: "#f97316" };
  if (score < 60) return { label: "Neutra",        emoji: "😐", color: "#eab308" };
  if (score < 80) return { label: "Animada",       emoji: "🔥", color: "#22c55e" };
  return            { label: "Eufórica",       emoji: "🙌", color: "#16a34a" };
}

export function getFanMood(seasonId: string): number {
  try {
    const raw = localStorage.getItem(fanMoodKey(seasonId));
    if (raw === null) return DEFAULT_SCORE;
    const v = Number(raw);
    return isNaN(v) ? DEFAULT_SCORE : Math.max(0, Math.min(100, v));
  } catch {
    return DEFAULT_SCORE;
  }
}

export async function setFanMood(seasonId: string, score: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  try {
    localStorage.setItem(fanMoodKey(seasonId), String(clamped));
  } catch {}
  await putSeasonData(seasonId, "fan_mood", clamped);
}

export function computeFanMoodDelta(
  myScore: number,
  opponentScore: number,
  isClassico: boolean,
): number {
  const isWin = myScore > opponentScore;
  const isDraw = myScore === opponentScore;
  const isLoss = myScore < opponentScore;

  if (isClassico && isLoss) return -16;
  if (isLoss && opponentScore >= 4) return -14;
  if (isLoss) return -8;
  if (isDraw) return -2;
  if (isClassico && isWin) return +12;
  if (isWin && myScore >= 4) return +10;
  return +6;
}

export function hydrateFanMoodCache(seasonId: string, data: Record<string, unknown>): void {
  try {
    if (typeof data["fan_mood"] === "number") {
      localStorage.setItem(fanMoodKey(seasonId), String(data["fan_mood"]));
    }
  } catch {}
}
