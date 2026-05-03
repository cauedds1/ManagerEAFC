import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';

const SOUND_KEY = 'fc_notif_sound_enabled';

let _enabled = true;
let _sound: { replayAsync: () => Promise<unknown>; unloadAsync: () => Promise<unknown> } | null = null;
let _loading: Promise<void> | null = null;

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

async function ensureSoundLoaded(): Promise<void> {
  if (_sound || _loading || Platform.OS === 'web') return;
  _loading = (async () => {
    try {
      const av = await import('expo-av');
      const asset = require('../assets/sounds/notification.mp3');
      const { sound } = await av.Audio.Sound.createAsync(asset, { volume: 0.6 });
      _sound = sound as unknown as typeof _sound extends infer T ? T : never;
    } catch {
      _sound = null;
    } finally {
      _loading = null;
    }
  })();
  await _loading;
}

export function playNotificationSound(type: 'noticias' | 'diretoria' = 'noticias'): void {
  if (!_enabled) return;
  if (Platform.OS !== 'web') {
    void ensureSoundLoaded().then(() => {
      if (_sound) void _sound.replayAsync().catch(() => {});
    });
    const style = type === 'diretoria'
      ? Haptics.NotificationFeedbackType.Warning
      : Haptics.NotificationFeedbackType.Success;
    void Haptics.notificationAsync(style).catch(() => {});
  }
}
