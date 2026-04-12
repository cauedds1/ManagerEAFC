import type { SquadPlayer } from "@/lib/squadCache";
import { putCareerData } from "@/lib/apiStorage";

function key(careerId: string): string {
  return `fc-career-manager-custom-players-${careerId}`;
}

export function getCustomPlayers(careerId: string): SquadPlayer[] {
  try {
    const raw = localStorage.getItem(key(careerId));
    if (!raw) return [];
    return JSON.parse(raw) as SquadPlayer[];
  } catch {
    return [];
  }
}

export function saveCustomPlayers(careerId: string, players: SquadPlayer[]): void {
  try {
    localStorage.setItem(key(careerId), JSON.stringify(players));
  } catch {}
  void putCareerData(careerId, "customPlayers", players);
}

export function addCustomPlayer(careerId: string, player: SquadPlayer): void {
  const list = getCustomPlayers(careerId);
  list.push(player);
  saveCustomPlayers(careerId, list);
}

export function removeCustomPlayer(careerId: string, playerId: number): void {
  const list = getCustomPlayers(careerId).filter((p) => p.id !== playerId);
  saveCustomPlayers(careerId, list);
}

export function generateCustomPlayerId(): number {
  return -(Date.now() + Math.floor(Math.random() * 10_000));
}
