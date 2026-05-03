import type { TransferRecord } from "@/types/transfer";
import { putSeasonData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";
import { isCria, findCriaByName, relinkCriaToNewPlayerId } from "@/lib/criaStorage";
import { emitReturningCriaNews } from "@/lib/basePromotionNews";
import { getActiveCareer } from "@/lib/careerStorage";

function readLang(): "pt" | "en" {
  try {
    const s = localStorage.getItem("fc_lang");
    if (s === "pt" || s === "en") return s;
  } catch {}
  return "pt";
}

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

export async function saveTransfersAsync(seasonId: string, list: TransferRecord[]): Promise<void> {
  sessionSet(transfersKey(seasonId), list);
  await putSeasonData(seasonId, "transfers", list);
}

function returningCriaDedupeKey(careerId: string): string {
  return `fc-career-manager-returning-cria-emitted-${careerId}`;
}

function hasEmittedReturningCria(careerId: string, transferId: string): boolean {
  try {
    const raw = localStorage.getItem(returningCriaDedupeKey(careerId));
    if (!raw) return false;
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) && arr.includes(transferId);
  } catch { return false; }
}

function markEmittedReturningCria(careerId: string, transferId: string): void {
  try {
    const raw = localStorage.getItem(returningCriaDedupeKey(careerId));
    const arr: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!arr.includes(transferId)) {
      arr.push(transferId);
      localStorage.setItem(returningCriaDedupeKey(careerId), JSON.stringify(arr.slice(-200)));
    }
  } catch {}
}

export function maybeEmitReturningCriaForTransfer(seasonId: string, transfer: TransferRecord): void {
  try {
    if (transfer.type !== "compra" || !transfer.careerId || typeof transfer.playerId !== "number") return;
    if (hasEmittedReturningCria(transfer.careerId, transfer.id)) return;
    let isReturningCria = isCria(transfer.careerId, transfer.playerId);
    if (!isReturningCria) {
      const original = findCriaByName(transfer.careerId, transfer.playerName);
      if (original) {
        relinkCriaToNewPlayerId(transfer.careerId, original, transfer.playerId);
        isReturningCria = true;
      }
    }
    if (isReturningCria) {
      const club = getActiveCareer(transfer.careerId)?.clubName ?? "";
      emitReturningCriaNews(seasonId, transfer.careerId, transfer.playerName, club, readLang());
      markEmittedReturningCria(transfer.careerId, transfer.id);
    }
  } catch (err) {
    console.error("[transfers] returning-cria news failed", err);
  }
}

export function addTransfer(seasonId: string, transfer: TransferRecord): void {
  const list = [...getTransfers(seasonId), transfer];
  saveTransfers(seasonId, list);
  if (!transfer.windowPending) {
    maybeEmitReturningCriaForTransfer(seasonId, transfer);
  }
}

export function updateTransfer(seasonId: string, id: string, changes: Partial<TransferRecord>): void {
  const list = getTransfers(seasonId).map((t) => t.id === id ? { ...t, ...changes } : t);
  saveTransfers(seasonId, list);
}

export function removeTransfer(seasonId: string, id: string): void {
  const list = getTransfers(seasonId).filter((t) => t.id !== id);
  saveTransfers(seasonId, list);
}

export function generatePlayerId(): number {
  return Date.now() + Math.floor(Math.random() * 10_000);
}

export function generateTransferId(): string {
  return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
