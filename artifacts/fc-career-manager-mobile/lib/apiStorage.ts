import { api } from '@/lib/api';
import type { SeasonGameData, CareerGameData } from '@/lib/api';

export async function putSeasonData(seasonId: string, key: string, value: unknown): Promise<void> {
  try {
    await api.seasonData.set(seasonId, key as keyof SeasonGameData, value);
  } catch {}
}

export async function putCareerData(careerId: string, key: string, value: unknown): Promise<void> {
  try {
    await api.careerData.set(careerId, key as keyof CareerGameData, value);
  } catch {}
}

export async function loadSeasonData(seasonId: string): Promise<Record<string, unknown>> {
  try {
    const res = await api.seasonData.get(seasonId);
    return (res.data ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function loadCareerData(careerId: string): Promise<Record<string, unknown>> {
  try {
    const res = await api.careerData.get(careerId);
    return (res.data ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}
