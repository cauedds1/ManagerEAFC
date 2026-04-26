import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const TOKEN_KEY = 'fc_auth_token';

export function getApiUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) return apiUrl;
  return 'http://localhost:8080';
}

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function deleteToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

async function request<T>(
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

export interface User {
  id: number;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'ultra';
}

export interface Coach {
  name: string;
  photo?: string;
  nationality?: string;
}

export interface Career {
  id: string;
  coach: Coach;
  clubId: number;
  clubName: string;
  clubLogo?: string;
  clubLeague?: string;
  clubCountry?: string;
  clubStadium?: string;
  clubFounded?: number;
  clubPrimary?: string;
  clubSecondary?: string;
  clubDescription?: string;
  season: string;
  projeto?: string;
  currentSeasonId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Season {
  id: string;
  careerId: string;
  label: string;
  isActive: boolean;
  finalized: boolean;
  createdAt: number;
}

export interface Club {
  id: number;
  name: string;
  logo: string;
  league: string;
  leagueId: number;
  country?: string;
}

export interface CreateCareerBody {
  coach: Coach;
  clubId: number;
  clubName: string;
  clubLogo?: string;
  clubLeague?: string;
  clubCountry?: string;
  clubPrimary?: string;
  clubSecondary?: string;
  season?: string;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    register: (email: string, password: string, name: string) =>
      request<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),

    me: () =>
      request<{ user: User }>('/api/auth/me'),
  },

  careers: {
    list: () =>
      request<Career[]>('/api/careers'),

    create: (body: CreateCareerBody) =>
      request<{ id: string }>('/api/careers', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    update: (id: string, body: Partial<CreateCareerBody>) =>
      request<{ ok: boolean }>(`/api/careers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),

    delete: (id: string) =>
      request<{ ok: boolean }>(`/api/careers/${id}`, {
        method: 'DELETE',
      }),

    seasons: (careerId: string) =>
      request<Season[]>(`/api/careers/${careerId}/seasons`),

    createSeason: (careerId: string, label: string, isActive?: boolean) =>
      request<{ id: string }>(`/api/careers/${careerId}/seasons`, {
        method: 'POST',
        body: JSON.stringify({ label, isActive }),
      }),
  },

  clubs: {
    list: () =>
      request<{ clubs: Club[]; cachedAt: number }>('/api/clubs'),
  },
};
