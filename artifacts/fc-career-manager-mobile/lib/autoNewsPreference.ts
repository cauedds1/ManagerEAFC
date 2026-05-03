import { localCache } from '@/lib/localCache';

type Listener = (careerId: string, enabled: boolean) => void;
const _listeners = new Set<Listener>();

function storageKey(careerId: string): string {
  return `fc_auto_news_enabled_${careerId}`;
}

export function getAutoNewsEnabled(careerId: string): boolean {
  return localCache.getItem(storageKey(careerId)) === '1';
}

export function setAutoNewsEnabled(careerId: string, enabled: boolean): void {
  if (enabled) localCache.setItem(storageKey(careerId), '1');
  else localCache.removeItem(storageKey(careerId));
  for (const l of _listeners) {
    try { l(careerId, enabled); } catch {}
  }
}

export function onAutoNewsToggled(listener: Listener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
