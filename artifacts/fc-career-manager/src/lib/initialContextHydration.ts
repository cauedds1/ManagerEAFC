import type { Career, RecentMatch, TransferEntry } from "@/types/career";
import type { TransferRecord } from "@/types/transfer";
import type { MatchRecord, MatchLocation } from "@/types/match";
import {
  getTransfers,
  saveTransfersAsync,
  generatePlayerId,
  generateTransferId,
} from "@/lib/transferStorage";
import { getMatches, saveMatches, generateMatchId } from "@/lib/matchStorage";
import { recordMatchInAgg } from "@/lib/careerAggregateStats";
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

function normalizeNumeric(raw: string): number {
  // Distinguish decimal vs thousands separators so both "1.5" (EN) and "1,5" (PT) → 1.5,
  // while "1.500" / "1,500" → 1500.
  const hasDot = raw.includes(".");
  const hasComma = raw.includes(",");
  let cleaned = raw;
  if (hasDot && hasComma) {
    // Whichever appears last is the decimal separator.
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      cleaned = raw.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = raw.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = raw.split(",");
    cleaned = parts.length === 2 && parts[1].length !== 3
      ? raw.replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (hasDot) {
    const parts = raw.split(".");
    cleaned = parts.length === 2 && parts[1].length !== 3
      ? raw
      : raw.replace(/\./g, "");
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseFee(raw?: string): number {
  if (!raw) return 0;
  const trimmed = raw.trim().replace(/€|\$|£/g, "").replace(/\s/g, "");
  if (!trimmed) return 0;
  const lower = trimmed.toLowerCase();
  const mMatch = lower.match(/^([\d.,]+)\s*m/);
  if (mMatch) return Math.round(normalizeNumeric(mMatch[1]) * 1_000_000);
  const kMatch = lower.match(/^([\d.,]+)\s*k/);
  if (kMatch) return Math.round(normalizeNumeric(kMatch[1]) * 1_000);
  return Math.round(normalizeNumeric(lower));
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

function normalizeScoreToResult(
  score: { my: number; opp: number },
  result?: string,
): { my: number; opp: number } {
  if (!result) return score;
  const r = result.trim().toLowerCase();
  const isWin = /^(w|v|vit|win|venc)/.test(r);
  const isLoss = /^(l|d(er|f)|loss|lost|perd)/.test(r);
  if (score.my === score.opp) return score;
  if (isWin && score.my < score.opp) return { my: score.opp, opp: score.my };
  if (isLoss && score.my > score.opp) return { my: score.opp, opp: score.my };
  return score;
}

function buildMatch(career: Career, rm: RecentMatch): MatchRecord | null {
  const parsed = parseScore(rm.score);
  if (!parsed) return null;
  const score = normalizeScoreToResult(parsed, rm.result);
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
  const recentMatches = ic.recentMatches ?? [];
  const rivals = ic.rivals ?? [];
  if (tIn.length === 0 && tOut.length === 0 && recentMatches.length === 0 && rivals.length === 0) {
    markHydrated(career.id);
    return empty;
  }

  const newTransfers: TransferRecord[] = [];
  for (const entry of tIn) {
    if (entry?.name?.trim()) newTransfers.push(buildTransfer(career, entry, "compra"));
  }
  for (const entry of tOut) {
    if (entry?.name?.trim()) newTransfers.push(buildTransfer(career, entry, "venda"));
  }

  const newMatches: MatchRecord[] = [];
  for (const rm of recentMatches) {
    const match = buildMatch(career, rm);
    if (match) newMatches.push(match);
  }

  const cleanedRivals = rivals
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, MAX_RIVALS);

  // Single batched write per category — avoids racing PUTs from multiple addTransfer/addMatch calls.
  // All writes awaited together so we only mark the hydration flag after the durable PUTs settle.
  const writes: Promise<unknown>[] = [];

  if (newTransfers.length > 0) {
    const finalTransfers = [...getTransfers(seasonId), ...newTransfers];
    writes.push(saveTransfersAsync(seasonId, finalTransfers));
  }

  if (newMatches.length > 0) {
    const finalMatches = [...getMatches(seasonId), ...newMatches];
    writes.push(saveMatches(seasonId, finalMatches));
    // Aggregates are local cache — safe to run synchronously after the persisted write is queued.
    for (const m of newMatches) {
      recordMatchInAgg(career.id, m.myScore, m.opponentScore);
    }
  }

  let rivalsSet = 0;
  if (cleanedRivals.length > 0) {
    writes.push(
      setSeasonRivals(seasonId, cleanedRivals).then((ok) => {
        if (ok) rivalsSet = cleanedRivals.length;
      }),
    );
  }

  // Wait for the durable writes (matches + rivals) to actually complete before marking hydrated,
  // so a reload before persistence finishes does NOT skip retry on the next launch.
  await Promise.allSettled(writes);

  markHydrated(career.id);

  return {
    ran: true,
    transfersAdded: newTransfers.length,
    matchesAdded: newMatches.length,
    rivalsSet,
  };
}
