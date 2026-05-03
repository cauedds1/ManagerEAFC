// PORTED FROM artifacts/fc-career-manager/src/lib/notificationSound.ts — adapted
// for React Native. Web Audio APIs aren't available, so on native we fall back
// to a Haptics pulse keyed by event type. The user-facing toggle persists to
// SecureStore (mobile) / localStorage (web) just like the web version.

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';

const SOUND_KEY = 'fc_notif_sound_enabled';

let _enabled = true;

export function isSoundEnabled(): boolean {
  return _enabled;
}

export async function loadSoundPreference(): Promise<boolean> {
  try {
    const stored = Platform.OS === 'web'
      ? localStorage.getItem(SOUND_KEY)
      : await SecureStore.getItemAsync(SOUND_KEY);
    _enabled = stored === null ? true : stored === 'true';
  } catch {
    _enabled = true;
  }
  return _enabled;
}

export async function setSoundEnabled(enabled: boolean): Promise<void> {
  _enabled = enabled;
  try {
    if (Platform.OS === 'web') localStorage.setItem(SOUND_KEY, String(enabled));
    else await SecureStore.setItemAsync(SOUND_KEY, String(enabled));
  } catch {}
}

export function playNotificationSound(type: 'noticias' | 'diretoria' = 'noticias'): void {
  if (!_enabled) return;
  if (Platform.OS === 'web') return;
  const style = type === 'diretoria'
    ? Haptics.NotificationFeedbackType.Warning
    : Haptics.NotificationFeedbackType.Success;
  void Haptics.notificationAsync(style).catch(() => {});
}
