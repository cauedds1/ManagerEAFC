import { putCareerData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";

export interface Trophy {
  id: string;
  competitionName: string;
  seasonLabel: string;
  addedAt: number;
}

const key = (careerId: string) => `fc-cm-trophies-${careerId}`;

export function getTrophies(careerId: string): Trophy[] {
  return sessionGet<Trophy[]>(key(careerId)) ?? [];
}

export function addTrophy(careerId: string, data: Omit<Trophy, "id" | "addedAt">): Trophy {
  const trophy: Trophy = { ...data, id: crypto.randomUUID(), addedAt: Date.now() };
  const all = getTrophies(careerId);
  all.unshift(trophy);
  sessionSet(key(careerId), all);
  void putCareerData(careerId, "trophies", all);
  return trophy;
}

export function removeTrophy(careerId: string, id: string): void {
  const all = getTrophies(careerId).filter((t) => t.id !== id);
  sessionSet(key(careerId), all);
  void putCareerData(careerId, "trophies", all);
}
