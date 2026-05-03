/**
 * Synchronous in-memory cache backed by AsyncStorage. Mirrors the web's
 * `localStorage` API surface so that ports of business-logic engines from
 * the web codebase (which call `localStorage.getItem/setItem` directly)
 * keep working unchanged on React Native.
 *
 * IMPORTANT: call `hydrateLocalCache()` once at app boot before any port is
 * read from. Otherwise reads return null until AsyncStorage finishes loading.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const memory = new Map<string, string>();
let hydrated = false;
const KEY_PREFIX = 'fc_lc_';

export async function hydrateLocalCache(): Promise<void> {
  if (hydrated) return;
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const prefixed = allKeys.filter((k) => k.startsWith(KEY_PREFIX));
    if (prefixed.length > 0) {
      const pairs = await AsyncStorage.multiGet(prefixed);
      for (const [k, v] of pairs) {
        if (v != null) memory.set(k.slice(KEY_PREFIX.length), v);
      }
    }
  } catch {}
  hydrated = true;
}

export function isHydrated(): boolean {
  return hydrated;
}

export const localCache = {
  getItem(key: string): string | null {
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    memory.set(key, value);
    void AsyncStorage.setItem(KEY_PREFIX + key, value).catch(() => {});
  },
  removeItem(key: string): void {
    memory.delete(key);
    void AsyncStorage.removeItem(KEY_PREFIX + key).catch(() => {});
  },
  clear(): void {
    const toRemove = [...memory.keys()].map((k) => KEY_PREFIX + k);
    memory.clear();
    if (toRemove.length > 0) {
      void AsyncStorage.multiRemove(toRemove).catch(() => {});
    }
  },
};

if (typeof globalThis !== 'undefined' && typeof (globalThis as { localStorage?: unknown }).localStorage === 'undefined') {
  (globalThis as unknown as { localStorage: typeof localCache }).localStorage = localCache;
}
