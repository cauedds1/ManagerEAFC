import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const CACHE_PREFIX = 'fc_cache_';
const DEFAULT_TTL = 1000 * 60 * 60 * 6;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return AsyncStorage.getItem(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
  await AsyncStorage.setItem(key, value);
}

async function storageRemove(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
  await AsyncStorage.removeItem(key);
}

export function useOfflineCache() {
  const get = useCallback(async <T>(key: string): Promise<T | null> => {
    try {
      const raw = await storageGet(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      const isExpired = Date.now() - entry.timestamp > entry.ttl;
      if (isExpired) {
        await storageRemove(`${CACHE_PREFIX}${key}`);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  }, []);

  const set = useCallback(async <T>(key: string, data: T, ttl = DEFAULT_TTL): Promise<void> => {
    try {
      const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
      await storageSet(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
    } catch {}
  }, []);

  const remove = useCallback(async (key: string): Promise<void> => {
    await storageRemove(`${CACHE_PREFIX}${key}`);
  }, []);

  const getOrFetch = useCallback(async <T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl = DEFAULT_TTL
  ): Promise<T> => {
    const cached = await get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fetcher();
    await set(key, fresh, ttl);
    return fresh;
  }, [get, set]);

  return { get, set, remove, getOrFetch };
}
