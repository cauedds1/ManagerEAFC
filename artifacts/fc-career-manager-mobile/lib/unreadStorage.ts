import { localCache } from '@/lib/localCache';

const noticiasSeenKey  = (seasonId: string) => `fc-noticias-seen-at-${seasonId}`;
const diretoriaSeenKey = (careerId: string) => `fc-diretoria-seen-at-${careerId}`;

export function getNoticiasSeenAt(seasonId: string): number {
  return Number(localCache.getItem(noticiasSeenKey(seasonId)) ?? 0);
}

export function markNoticiasRead(seasonId: string): void {
  localCache.setItem(noticiasSeenKey(seasonId), String(Date.now()));
}

export function initNoticiasSeenAt(seasonId: string): void {
  if (!localCache.getItem(noticiasSeenKey(seasonId))) {
    markNoticiasRead(seasonId);
  }
}

export function getDiretoriaSeenAt(careerId: string): number {
  return Number(localCache.getItem(diretoriaSeenKey(careerId)) ?? 0);
}

export function markDiretoriaRead(careerId: string): void {
  localCache.setItem(diretoriaSeenKey(careerId), String(Date.now()));
}

export function countUnreadAfter<T extends { createdAt?: number; triggeredAt?: number }>(
  items: T[],
  seenAt: number,
): number {
  if (seenAt === 0) return 0;
  return items.filter((it) => (it.triggeredAt ?? it.createdAt ?? 0) > seenAt).length;
}
