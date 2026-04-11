import type { FormationKey } from "./formations";
import { putCareerData } from "@/lib/apiStorage";

const PREFIX = "fc-career-manager-lineup-";
const BENCH_PREFIX = "fc-career-manager-bench-";
const FORMATION_PREFIX = "fc-career-manager-formation-";

export function getCustomLineup(careerId: string): number[] | null {
  try {
    const raw = localStorage.getItem(PREFIX + careerId);
    if (!raw) return null;
    return JSON.parse(raw) as number[];
  } catch {
    return null;
  }
}

export function setCustomLineup(careerId: string, playerIds: number[]): void {
  try {
    localStorage.setItem(PREFIX + careerId, JSON.stringify(playerIds));
  } catch {}
  void putCareerData(careerId, "lineup", playerIds);
}

export function clearCustomLineup(careerId: string): void {
  try {
    localStorage.removeItem(PREFIX + careerId);
  } catch {}
  void putCareerData(careerId, "lineup", null);
}

export function getBenchOrder(careerId: string): number[] | null {
  try {
    const raw = localStorage.getItem(BENCH_PREFIX + careerId);
    if (!raw) return null;
    return JSON.parse(raw) as number[];
  } catch {
    return null;
  }
}

export function setBenchOrder(careerId: string, playerIds: number[]): void {
  try {
    localStorage.setItem(BENCH_PREFIX + careerId, JSON.stringify(playerIds));
  } catch {}
  void putCareerData(careerId, "benchOrder", playerIds);
}

export function clearBenchOrder(careerId: string): void {
  try {
    localStorage.removeItem(BENCH_PREFIX + careerId);
  } catch {}
  void putCareerData(careerId, "benchOrder", null);
}

export function getFormation(careerId: string): FormationKey | null {
  try {
    const raw = localStorage.getItem(FORMATION_PREFIX + careerId);
    if (!raw) return null;
    return raw as FormationKey;
  } catch {
    return null;
  }
}

export function setFormation(careerId: string, formation: FormationKey): void {
  try {
    localStorage.setItem(FORMATION_PREFIX + careerId, formation);
  } catch {}
  void putCareerData(careerId, "formation", formation);
}
