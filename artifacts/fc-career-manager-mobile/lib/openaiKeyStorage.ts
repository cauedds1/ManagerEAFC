import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'fc_openai_key';

export async function getOpenAIKey(): Promise<string> {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(KEY) ?? '';
    return (await SecureStore.getItemAsync(KEY)) ?? '';
  } catch {
    return '';
  }
}

export async function setOpenAIKey(key: string): Promise<void> {
  const trimmed = key.trim();
  try {
    if (Platform.OS === 'web') {
      if (trimmed) localStorage.setItem(KEY, trimmed);
      else localStorage.removeItem(KEY);
    } else {
      if (trimmed) await SecureStore.setItemAsync(KEY, trimmed);
      else await SecureStore.deleteItemAsync(KEY);
    }
  } catch {}
}

export async function clearOpenAIKey(): Promise<void> {
  try {
    if (Platform.OS === 'web') localStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {}
}
