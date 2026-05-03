import { localCache } from '@/lib/localCache';

function handledKey(seasonId: string): string {
  return `fc-auto-news-handled-${seasonId}`;
}

export function wasEventHandled(seasonId: string, key: string): boolean {
  try {
    const raw = localCache.getItem(handledKey(seasonId));
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return list.includes(key);
  } catch {
    return false;
  }
}

export function markEventHandled(seasonId: string, key: string): void {
  try {
    const raw = localCache.getItem(handledKey(seasonId));
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(key)) {
      list.push(key);
      if (list.length > 500) list.splice(0, list.length - 500);
      localCache.setItem(handledKey(seasonId), JSON.stringify(list));
    }
  } catch {}
}

export function clearHandledEvents(seasonId: string): void {
  try {
    localCache.removeItem(handledKey(seasonId));
  } catch {}
}
