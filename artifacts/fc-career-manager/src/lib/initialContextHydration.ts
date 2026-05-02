import type { Career, RecentMatch, TransferEntry } from "@/types/career";
import type { TransferRecord } from "@/types/transfer";
import type { MatchRecord, MatchLocation } from "@/types/match";
import {
  addTransfer,
  generatePlayerId,
  generateTransferId,
} from "@/lib/transferStorage";
import { addMatch, generateMatchId } from "@/lib/matchStorage";
import { setSeasonRivals, MAX_RIVALS } from "@/lib/rivalsStorage";

const HYDRATED_KEY = (careerId: string) => `fc-initial-hydrated-${careerId}`;

export function isInitialContextHydrated(careerId: string): boolean {
  try {
    return localStorage.getItem(HYDRATED_KEY(careerId)) === "1";
  } catch {
    return false;
  }
}

function markHydrated(careerId: string): void {
  try {
    localStorage.setItem(HYDRATED_KEY(careerId), "1");
  } catch {
    /* quota */
  }
}

function parseFee(raw?: string): number {
  if (!raw) return 0;
  const trimmed = raw.trim().replace(/€|\$|£/g, "").replace(/\s/g, "");
  if (!trimmed) return 0;
  const lower = trimmed.toLowerCase();
  const mMatch = lower.match(/^([\d.,]+)\s*m/);
  if (mMatch) {
    const base = parseFloat(mMatch[1].replace(/\./g, "").replace(",", "."));
    return isNaN(base) ? 0 : Math.round(base * 1_000_000);
  }
  const kMatch = lower.match(/^([\d.,]+)\s*k/);
  if (kMatch) {
    const base = parseFloat(kMatch[1].replace(/\./g, "").replace(",", "."));
    return isNaN(base) ? 0 : Math.round(base * 1_000);
  }
  const cleaned = lower.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

function parseScore(raw?: string): { my: number; opp: number } | null {
  if (!raw) return null;
  const m = raw.match(/(\d+)\s*[-x:]\s*(\d+)/);
  if (!m) return null;
  return { my: parseInt(m[1], 10), opp: parseInt(m[2], 10) };
}

function inferLocation(rm: RecentMatch): MatchLocation {
  const blob = `${rm.note ?? ""} ${rm.opponent ?? ""}`.toLowerCase();
  if (/\bfora\b|\baway\b|\bvisitante\b|\b@\b/.test(blob)) return "fora";
  if (/\bneutro\b|\bneutral\b/.test(blob)) return "neutro";
  return "casa";
}

function buildTransfer(
  career: Career,
  entry: TransferEntry,
  type: "compra" | "venda",
): TransferRecord {
  const isBuy = type === "compra";
  return {
    id: generateTransferId(),
    careerId: career.id,
    season: career.season,
    playerId: generatePlayerId(),
    playerName: entry.name?.trim() || "—",
    playerPhoto: "",
    playerPositionPtBr: "MID",
    playerAge: 25,
    fee: parseFee(entry.fee),
    salary: 0,
    contractYears: isBuy ? 4 : 0,
    role: "esporadico",
    type,
    fromClub: isBuy ? (entry.from?.trim() || undefined) : career.clubName,
    toClub: isBuy ? career.clubName : (entry.to?.trim() || undefined),
    transferredAt: Date.now(),
  };
}

function buildMatch(
  career: Career,
  seasonId: string,
  rm: RecentMatch,
): MatchRecord | null {
  const score = parseScore(rm.score);
  if (!score) return null;
  return {
    id: generateMatchId(),
    careerId: career.id,
    season: career.season,
    date: "",
    tournament: rm.competition?.trim() || "",
    stage: "",
    location: inferLocation(rm),
    opponent: rm.opponent?.trim() || "—",
    myScore: score.my,
    opponentScore: score.opp,
    starterIds: [],
    subIds: [],
    playerStats: {},
    matchStats: { myShots: 0, opponentShots: 0, possessionPct: 0 },
    observations: rm.note?.trim() || undefined,
    createdAt: Date.now(),
  };
}

export interface HydrationResult {
  transfersAdded: number;
  matchesAdded: number;
  rivalsSet: number;
  ran: boolean;
}

export async function hydrateInitialContext(
  career: Career,
  seasonId: string,
): Promise<HydrationResult> {
  const empty: HydrationResult = { transfersAdded: 0, matchesAdded: 0, rivalsSet: 0, ran: false };
  if (isInitialContextHydrated(career.id)) return empty;
  const ic = career.initialContext;
  if (!ic) return empty;

  const tIn = ic.transfersIn ?? [];
  const tOut = ic.transfersOut ?? [];
  const matches = ic.recentMatches ?? [];
  const rivals = ic.rivals ?? [];
  if (tIn.length === 0 && tOut.length === 0 && matches.length === 0 && rivals.length === 0) {
    markHydrated(career.id);
    return empty;
  }

  const result: HydrationResult = { ...empty, ran: true };

  for (const entry of tIn) {
    if (!entry?.name?.trim()) continue;
    addTransfer(seasonId, buildTransfer(career, entry, "compra"));
    result.transfersAdded++;
  }
  for (const entry of tOut) {
    if (!entry?.name?.trim()) continue;
    addTransfer(seasonId, buildTransfer(career, entry, "venda"));
    result.transfersAdded++;
  }

  for (const rm of matches) {
    const match = buildMatch(career, seasonId, rm);
    if (match) {
      addMatch(seasonId, match);
      result.matchesAdded++;
    }
  }

  if (rivals.length > 0) {
    const cleaned = rivals.map((r) => r.trim()).filter(Boolean).slice(0, MAX_RIVALS);
    if (cleaned.length > 0) {
      const ok = await setSeasonRivals(seasonId, cleaned);
      if (ok) result.rivalsSet = cleaned.length;
    }
  }

  markHydrated(career.id);
  return result;
}
