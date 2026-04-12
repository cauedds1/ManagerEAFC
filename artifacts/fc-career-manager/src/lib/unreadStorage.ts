import { getPosts } from "@/lib/noticiaStorage";
import { getNotifications } from "@/lib/diretoriaStorage";

const noticiasSeenKey = (seasonId: string) => `fc-noticias-seen-at-${seasonId}`;
const diretoriaSeenKey = (careerId: string) => `fc-diretoria-seen-at-${careerId}`;

export function getNoticiasSeenAt(seasonId: string): number {
  return Number(localStorage.getItem(noticiasSeenKey(seasonId)) ?? 0);
}

export function markNoticiasRead(seasonId: string): void {
  try {
    localStorage.setItem(noticiasSeenKey(seasonId), String(Date.now()));
  } catch {}
}

export function initNoticiasSeenAt(seasonId: string): void {
  if (!localStorage.getItem(noticiasSeenKey(seasonId))) {
    markNoticiasRead(seasonId);
  }
}

export function countUnreadNoticias(seasonId: string): number {
  const seenAt = getNoticiasSeenAt(seasonId);
  if (seenAt === 0) return 0;
  const posts = getPosts(seasonId);
  return posts.filter((p) => p.createdAt > seenAt).length;
}

export function getDiretoriaSeenAt(careerId: string): number {
  return Number(localStorage.getItem(diretoriaSeenKey(careerId)) ?? 0);
}

export function markDiretoriaRead(careerId: string): void {
  try {
    localStorage.setItem(diretoriaSeenKey(careerId), String(Date.now()));
  } catch {}
}

export function countUnreadDiretoria(careerId: string): number {
  const seenAt = getDiretoriaSeenAt(careerId);
  const notifications = getNotifications(careerId);
  if (seenAt === 0) {
    return notifications.length;
  }
  return notifications.filter((n) => (n.triggeredAt ?? 0) > seenAt).length;
}
