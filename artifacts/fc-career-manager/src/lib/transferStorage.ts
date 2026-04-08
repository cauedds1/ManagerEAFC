import type { TransferRecord } from "@/types/transfer";

function transfersKey(careerId: string): string {
  return `fc-career-manager-transfers-${careerId}`;
}

export function getTransfers(careerId: string): TransferRecord[] {
  try {
    const raw = localStorage.getItem(transfersKey(careerId));
    if (!raw) return [];
    return JSON.parse(raw) as TransferRecord[];
  } catch {
    return [];
  }
}

export function addTransfer(careerId: string, transfer: TransferRecord): void {
  const list = getTransfers(careerId);
  list.push(transfer);
  try {
    localStorage.setItem(transfersKey(careerId), JSON.stringify(list));
  } catch {}
}

export function generatePlayerId(): number {
  return Date.now() + Math.floor(Math.random() * 10_000);
}

export function generateTransferId(): string {
  return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
