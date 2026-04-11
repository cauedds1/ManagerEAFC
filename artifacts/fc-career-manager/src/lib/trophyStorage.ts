export interface Trophy {
  id: string;
  competitionName: string;
  seasonLabel: string;
  addedAt: number;
}

const key = (careerId: string) => `fc-cm-trophies-${careerId}`;

export function getTrophies(careerId: string): Trophy[] {
  try {
    return JSON.parse(localStorage.getItem(key(careerId)) || "[]");
  } catch {
    return [];
  }
}

export function addTrophy(careerId: string, data: Omit<Trophy, "id" | "addedAt">): Trophy {
  const trophy: Trophy = { ...data, id: crypto.randomUUID(), addedAt: Date.now() };
  const all = getTrophies(careerId);
  all.unshift(trophy);
  localStorage.setItem(key(careerId), JSON.stringify(all));
  return trophy;
}

export function removeTrophy(careerId: string, id: string): void {
  const all = getTrophies(careerId).filter((t) => t.id !== id);
  localStorage.setItem(key(careerId), JSON.stringify(all));
}
