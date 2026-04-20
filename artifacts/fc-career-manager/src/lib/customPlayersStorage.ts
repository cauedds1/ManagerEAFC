import type { SquadPlayer } from "@/lib/squadCache";
import { putCareerData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";

function hiddenKey(careerId: string): string {
  return `fc-career-manager-hidden-players-${careerId}`;
}

function formerKey(careerId: string): string {
  return `fc-career-manager-former-players-${careerId}`;
}

export function getFormerPlayers(careerId: string): SquadPlayer[] {
  return sessionGet<SquadPlayer[]>(formerKey(careerId)) ?? [];
}

export function saveFormerPlayers(careerId: string, players: SquadPlayer[]): void {
  sessionSet(formerKey(careerId), players);
  void putCareerData(careerId, "formerPlayers", players);
}

export function addFormerPlayer(careerId: string, player: SquadPlayer): void {
  const existing = getFormerPlayers(careerId);
  if (existing.some((p) => p.id === player.id)) return;
  saveFormerPlayers(careerId, [...existing, player]);
}

export function getHiddenPlayerIds(careerId: string): number[] {
  return sessionGet<number[]>(hiddenKey(careerId)) ?? [];
}

export function addHiddenPlayerId(careerId: string, id: number): void {
  const existing = getHiddenPlayerIds(careerId);
  if (existing.includes(id)) return;
  const next = [...existing, id];
  sessionSet(hiddenKey(careerId), next);
  void putCareerData(careerId, "hiddenPlayerIds", next);
}

function key(careerId: string): string {
  return `fc-career-manager-custom-players-${careerId}`;
}

export function getCustomPlayers(careerId: string): SquadPlayer[] {
  return sessionGet<SquadPlayer[]>(key(careerId)) ?? [];
}

export function saveCustomPlayers(careerId: string, players: SquadPlayer[]): void {
  sessionSet(key(careerId), players);
  void putCareerData(careerId, "customPlayers", players);
}

export function addCustomPlayer(careerId: string, player: SquadPlayer): void {
  saveCustomPlayers(careerId, [...getCustomPlayers(careerId), player]);
}

export function removeCustomPlayer(careerId: string, playerId: number): void {
  saveCustomPlayers(careerId, getCustomPlayers(careerId).filter((p) => p.id !== playerId));
}

export function generateCustomPlayerId(): number {
  return -(Date.now() + Math.floor(Math.random() * 10_000));
}
