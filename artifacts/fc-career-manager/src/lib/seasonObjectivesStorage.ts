import { putSeasonData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";

export type ObjectiveType = "league_position" | "cup_round" | "custom";
export type ObjectiveStatus = "pending" | "achieved" | "failed";
export type ObjectiveSeverity = "minor" | "moderate" | "major";

export interface SeasonObjective {
  id: string;
  type: ObjectiveType;
  competition?: string;
  target: string;
  status: ObjectiveStatus;
  failSeverity?: ObjectiveSeverity;
  failedAtMatch?: number;
  achievedAtMatch?: number;
}

const objectivesKey = (seasonId: string) => `fc-season-objectives-${seasonId}`;

export function generateObjectiveId(): string {
  return `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function getSeasonObjectives(seasonId: string): SeasonObjective[] {
  return sessionGet<SeasonObjective[]>(objectivesKey(seasonId)) ?? [];
}

export function saveSeasonObjectives(seasonId: string, objectives: SeasonObjective[]): void {
  sessionSet(objectivesKey(seasonId), objectives);
  void putSeasonData(seasonId, "season_objectives", objectives);
}

export function markObjectiveFailed(
  seasonId: string,
  objectiveId: string,
  severity: ObjectiveSeverity,
  matchNumber: number,
): SeasonObjective[] {
  const objectives = getSeasonObjectives(seasonId);
  const updated = objectives.map((o) =>
    o.id === objectiveId
      ? { ...o, status: "failed" as const, failSeverity: severity, failedAtMatch: matchNumber }
      : o,
  );
  saveSeasonObjectives(seasonId, updated);
  return updated;
}

export function markObjectiveAchieved(
  seasonId: string,
  objectiveId: string,
  matchNumber: number,
): SeasonObjective[] {
  const objectives = getSeasonObjectives(seasonId);
  const updated = objectives.map((o) =>
    o.id === objectiveId
      ? { ...o, status: "achieved" as const, achievedAtMatch: matchNumber }
      : o,
  );
  saveSeasonObjectives(seasonId, updated);
  return updated;
}

export function hydrateSeasonObjectivesCache(seasonId: string, data: Record<string, unknown>): void {
  if (Array.isArray(data["season_objectives"])) {
    sessionSet(objectivesKey(seasonId), data["season_objectives"]);
  }
}

function normalizeRound(r: string): number {
  r = r.toLowerCase().trim();
  if (r.includes("group") || r.includes("fase de grupo") || r.includes("primeira fase") || r.includes("first round")) return 0;
  if (r.includes("oitava") || r.includes("round of 16") || r.includes("16") || r.includes("oitavas")) return 1;
  if (r.includes("quart") || r.includes("quarter")) return 2;
  if (r.includes("semi")) return 3;
  if (r.includes("final")) return 4;
  return -1;
}

export function computeCupFailureSeverity(
  targetRound: string,
  eliminatedAtRound: string,
  squadAvgOvr?: number | null,
  opponentAvgOvr?: number | null,
): ObjectiveSeverity {
  const targetIdx = normalizeRound(targetRound);
  const eliminatedIdx = normalizeRound(eliminatedAtRound);

  if (targetIdx < 0 || eliminatedIdx < 0) return "moderate";

  const diff = targetIdx - eliminatedIdx;

  let severity: ObjectiveSeverity;
  if (diff <= 0) severity = "minor";
  else if (diff === 1) severity = "moderate";
  else severity = "major";

  if (opponentAvgOvr != null && squadAvgOvr != null) {
    const ovrAdvantage = opponentAvgOvr - squadAvgOvr;
    if (ovrAdvantage >= 8 && severity === "major") severity = "moderate";
    else if (ovrAdvantage >= 5 && severity === "moderate") severity = "minor";
  }

  return severity;
}

export function isEliminatedBeforeTarget(stage: string, target: string): boolean {
  const stageIdx = normalizeRound(stage);
  const targetIdx = normalizeRound(target);
  if (stageIdx < 0 || targetIdx < 0) return false;
  return stageIdx < targetIdx;
}

export function severityBoardPenalty(severity: ObjectiveSeverity): number {
  if (severity === "major") return 15;
  if (severity === "moderate") return 10;
  return 5;
}
