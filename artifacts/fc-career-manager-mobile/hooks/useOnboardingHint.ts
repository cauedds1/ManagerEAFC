import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'fc_hint_';

export function useOnboardingHint(key: string): [boolean, () => void] {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(PREFIX + key)
      .then((v) => { if (!cancelled) setShouldShow(v !== '1'); })
      .catch(() => { if (!cancelled) setShouldShow(true); });
    return () => { cancelled = true; };
  }, [key]);

  const dismiss = useCallback(() => {
    setShouldShow(false);
    AsyncStorage.setItem(PREFIX + key, '1').catch(() => {});
  }, [key]);

  return [shouldShow, dismiss];
}

export async function resetOnboardingHints(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {}
}
