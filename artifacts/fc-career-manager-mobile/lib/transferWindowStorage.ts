// PORTED FROM artifacts/fc-career-manager/src/lib/transferWindowStorage.ts — adapted for React Native (AsyncStorage-backed localCache, no DOM).
import { putSeasonData } from '@/lib/apiStorage';
import { sessionGet, sessionSet } from '@/lib/sessionStore';

export interface TransferWindowState {
  open: boolean;
  openCount: number;
}

function windowKey(seasonId: string): string {
  return `fc-career-manager-transfer-window-${seasonId}`;
}

export function getTransferWindow(seasonId: string): TransferWindowState {
  return sessionGet<TransferWindowState>(windowKey(seasonId)) ?? { open: false, openCount: 0 };
}

export function saveTransferWindow(seasonId: string, state: TransferWindowState): void {
  sessionSet(windowKey(seasonId), state);
  void putSeasonData(seasonId, 'transferWindow', state);
}

export function hydrateTransferWindowCache(seasonId: string, data: Record<string, unknown>): void {
  const v = data['transferWindow'] as TransferWindowState | undefined;
  if (v && typeof v === 'object') sessionSet(windowKey(seasonId), v);
}
