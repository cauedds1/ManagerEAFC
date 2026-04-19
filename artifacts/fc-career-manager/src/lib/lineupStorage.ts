import type { FormationKey } from "./formations";
import { putCareerData } from "@/lib/apiStorage";
import { sessionGet, sessionSet, sessionDel } from "@/lib/sessionStore";

const PREFIX = "fc-career-manager-lineup-";
const BENCH_PREFIX = "fc-career-manager-bench-";
const FORMATION_PREFIX = "fc-career-manager-formation-";

export function getCustomLineup(careerId: string): number[] | null {
  return sessionGet<number[]>(PREFIX + careerId);
}

export function setCustomLineup(careerId: string, playerIds: number[]): void {
  sessionSet(PREFIX + careerId, playerIds);
  void putCareerData(careerId, "lineup", playerIds);
}

export function clearCustomLineup(careerId: string): void {
  sessionDel(PREFIX + careerId);
  void putCareerData(careerId, "lineup", null);
}

export function getBenchOrder(careerId: string): number[] | null {
  return sessionGet<number[]>(BENCH_PREFIX + careerId);
}

export function setBenchOrder(careerId: string, playerIds: number[]): void {
  sessionSet(BENCH_PREFIX + careerId, playerIds);
  void putCareerData(careerId, "benchOrder", playerIds);
}

export function clearBenchOrder(careerId: string): void {
  sessionDel(BENCH_PREFIX + careerId);
  void putCareerData(careerId, "benchOrder", null);
}

export function getFormation(careerId: string): FormationKey | null {
  return sessionGet<FormationKey>(FORMATION_PREFIX + careerId);
}

export function setFormation(careerId: string, formation: FormationKey): void {
  sessionSet(FORMATION_PREFIX + careerId, formation);
  void putCareerData(careerId, "formation", formation);
}
