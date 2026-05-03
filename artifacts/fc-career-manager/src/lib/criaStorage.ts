import { putCareerData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function key(careerId: string): string {
  return `fc-career-manager-cria-ids-${careerId}`;
}

/**
 * Lista permanente de IDs de jogadores que são "Cria do Clube".
 * Selo persiste mesmo após venda — se o jogador for recontratado,
 * a marca volta automaticamente.
 */
export function getCriaIds(careerId: string): number[] {
  return sessionGet<number[]>(key(careerId))
    ?? lsGet<number[]>(key(careerId))
    ?? [];
}

export function isCria(careerId: string, playerId: number): boolean {
  return getCriaIds(careerId).includes(playerId);
}

export function addCriaId(careerId: string, playerId: number): void {
  const list = getCriaIds(careerId);
  if (list.includes(playerId)) return;
  const next = [...list, playerId];
  sessionSet(key(careerId), next);
  lsSet(key(careerId), next);
  void putCareerData(careerId, "criaIds", next);
}
