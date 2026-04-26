import { QueryClient } from '@tanstack/react-query';
import { getApiUrl } from './api';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { TOKEN_KEY } from './api';

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const base = getApiUrl();
  const url = `${base}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errorMsg = body.error ?? errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}
