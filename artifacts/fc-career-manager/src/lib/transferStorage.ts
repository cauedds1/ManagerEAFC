import type { TransferRecord } from "@/types/transfer";
import { putSeasonData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";

function transfersKey(seasonId: string): string {
  return `fc-career-manager-transfers-${seasonId}`;
}

export function getTransfers(seasonId: string): TransferRecord[] {
  return sessionGet<TransferRecord[]>(transfersKey(seasonId)) ?? [];
}

export function saveTransfers(seasonId: string, list: TransferRecord[]): void {
  sessionSet(transfersKey(seasonId), list);
  void putSeasonData(seasonId, "transfers", list);
}

export function addTransfer(seasonId: string, transfer: TransferRecord): void {
  const list = getTransfers(seasonId);
  list.push(transfer);
  saveTransfers(seasonId, list);
}

export function updateTransfer(seasonId: string, id: string, changes: Partial<TransferRecord>): void {
  const list = getTransfers(seasonId);
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...changes };
  saveTransfers(seasonId, list);
}

export function generatePlayerId(): number {
  return Date.now() + Math.floor(Math.random() * 10_000);
}

export function generateTransferId(): string {
  return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
