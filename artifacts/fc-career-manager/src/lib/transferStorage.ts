import type { TransferRecord } from "@/types/transfer";
import { putSeasonData } from "@/lib/apiStorage";

function transfersKey(seasonId: string): string {
  return `fc-career-manager-transfers-${seasonId}`;
}

export function getTransfers(seasonId: string): TransferRecord[] {
  try {
    const raw = localStorage.getItem(transfersKey(seasonId));
    if (!raw) return [];
    return JSON.parse(raw) as TransferRecord[];
  } catch {
    return [];
  }
}

export function saveTransfers(seasonId: string, list: TransferRecord[]): void {
  try {
    localStorage.setItem(transfersKey(seasonId), JSON.stringify(list));
  } catch {}
  void putSeasonData(seasonId, "transfers", list);
}

export function addTransfer(seasonId: string, transfer: TransferRecord): void {
  const list = getTransfers(seasonId);
  list.push(transfer);
  saveTransfers(seasonId, list);
}

export function generatePlayerId(): number {
  return Date.now() + Math.floor(Math.random() * 10_000);
}

export function generateTransferId(): string {
  return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
