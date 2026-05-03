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
import { getSeasonRivals, setSeasonRivals, MAX_RIVALS } from "@/lib/rivalsStorage";
import {
  getSquad,
  fetchSquadFromBackend,
  PT_BR_TO_POSITION,
  type SquadPlayer,
  type PositionPtBr,
  type PositionGroup,
} from "@/lib/squadCache";
import {
  findBestPlayerMatch,
  findBestSearchHit,
  normalizeName,
  type SearchHit,
} from "@/lib/playerNameMatch";
import {
  addFormerPlayer,
  addHiddenPlayerId,
  addCustomPlayer,
  getCustomPlayers,
  saveCustomPlayers,
} from "@/lib/customPlayersStorage";

const HYDRATED_KEY_V1 = (careerId: string) => `fc-initial-hydrated-${careerId}`;
const HYDRATED_KEY_V2 = (careerId: string) => `fc-initial-hydrated-v2-${careerId}`;
const HYDRATED_KEY_V3 = (careerId: string) => `fc-initial-hydrated-v3-${careerId}`;
// One-time pass that re-runs name matching on already-hydrated transfers to
// replace AI nicknames (e.g. "Savinho") with the canonical player name from the
// squad / api-football catalog (e.g. "Sávio"). Independent of HYDRATED_KEY_V3
// because it must run for careers that were hydrated before alias support
// existed without re-creating their transfer records.
const CANONICALIZED_KEY = (careerId: string) => `fc-transfers-canonicalized-v1-${careerId}`;

export function isInitialContextHydrated(careerId: string): boolean {
  try {
    return localStorage.getItem(HYDRATED_KEY_V3(careerId)) === "1";
  } catch {
    return false;
  }
}

function isCanonicalized(careerId: string): boolean {
  try {
    return localStorage.getItem(CANONICALIZED_KEY(careerId)) === "1";
  } catch {
    return false;
  }
}

function markCanonicalized(careerId: string): void {
  try {
    localStorage.setItem(CANONICALIZED_KEY(careerId), "1");
  } catch {
    /* quota */
  }
}

// True if a previous (v1 or v2) hydration ever marked this career.
function isPreV3Hydrated(careerId: string): boolean {
  try {
    return (
      localStorage.getItem(HYDRATED_KEY_V2(careerId)) === "1"
      || localStorage.getItem(HYDRATED_KEY_V1(careerId)) === "1"
    );
  } catch {
    return false;
  }
}

function markHydrated(careerId: string): void {
  try {
    localStorage.setItem(HYDRATED_KEY_V3(careerId), "1");
    localStorage.setItem(HYDRATED_KEY_V2(careerId), "1");
    localStorage.setItem(HYDRATED_KEY_V1(careerId), "1");
    // Fresh hydration uses alias-aware matching, so canonical names are already
    // applied — skip the migration pass for this career.
    localStorage.setItem(CANONICALIZED_KEY(careerId), "1");
  } catch {
    /* quota */
  }
}

// Re-applies alias-aware matching to already-saved transfers, replacing AI
// nicknames in `playerName` with the canonical name from the squad / search
// catalog. Always fills an empty `playerPhoto` from the canonical match (a
// strict improvement). Updates `playerId` only when the current record is
// still a synthetic placeholder (no real player bound yet). User-edited fields
// (fee, salary, contract, etc.) are always preserved.
interface CanonicalizationResult {
  attempted: number;
  updates: number;
  /** True if every record we needed to resolve actually got a candidate (or
   *  there was nothing to resolve). False if any network/search call failed
   *  to return a result for a record we tried to canonicalize. */
  reliable: boolean;
}

// Like searchPlayer but distinguishes "no match found" from "request failed".
// Returns { hit } on a successful response (hit may be null for no match) or
// { error: true } on network/HTTP failure so the migration can defer marking.
async function searchPlayerForMigration(name: string): Promise<
  { hit: SearchHit | null; error: false } | { hit: null; error: true }
> {
  try {
    const res = await fetch(`/api/players/search?q=${encodeURIComponent(name)}`);
    if (!res.ok) return { hit: null, error: true };
    const data = (await res.json()) as { players?: SearchHit[] };
    return { hit: findBestSearchHit(name, data.players ?? []), error: false };
  } catch {
    return { hit: null, error: true };
  }
}

async function canonicalizeTransferNames(
  career: Career,
  seasonId: string,
): Promise<CanonicalizationResult> {
  const ic = career.initialContext;
  if (!ic) return { attempted: 0, updates: 0, reliable: true };
  const tIn = ic.transfersIn ?? [];
  const tOut = ic.transfersOut ?? [];
  if (tIn.length === 0 && tOut.length === 0) return { attempted: 0, updates: 0, reliable: true };

  const existing = getTransfers(seasonId);
  if (existing.length === 0) return { attempted: 0, updates: 0, reliable: true };

  // Load squad once. Track whether the load actually succeeded so we don't
  // mark vendas as "reliably canonicalized" when the squad never came through.
  let squadPlayers: SquadPlayer[] = [];
  let squadReliable = true;
  if (career.clubId && career.clubId > 0 && tOut.length > 0) {
    let loaded = false;
    try {
      const squad = await getSquad(career.clubId, career.clubName);
      squadPlayers = squad?.players ?? [];
      loaded = squadPlayers.length > 0;
    } catch {
      squadPlayers = [];
    }
    if (!loaded) {
      try {
        const fetched = await fetchSquadFromBackend(career.clubId);
        squadPlayers = fetched?.players ?? [];
        loaded = squadPlayers.length > 0;
      } catch {
        squadPlayers = [];
      }
    }
    squadReliable = loaded;
  }

  let updates = 0;
  let attempted = 0;
  let reliable = true;

  const updated: TransferRecord[] = await Promise.all(
    existing.map(async (t) => {
      const pool = t.type === "compra" ? tIn : tOut;
      const entry = pool.find((e) => {
        const n = e?.name?.trim();
        return n && fuzzyNameMatch(n, t.playerName);
      });
      if (!entry) return t;
      const aiName = entry.name.trim();
      attempted++;

      let canonical: { id: number; name: string; photo: string } | null = null;

      if (t.type === "venda") {
        if (!squadReliable) {
          reliable = false;
          return t;
        }
        const m = findBestPlayerMatch(aiName, squadPlayers);
        if (m) canonical = { id: m.player.id, name: m.player.name, photo: m.player.photo ?? "" };
      } else {
        const result = await searchPlayerForMigration(aiName);
        if (result.error) {
          reliable = false;
          return t;
        }
        if (result.hit) {
          canonical = { id: result.hit.id, name: result.hit.name, photo: result.hit.photo ?? "" };
        }
      }

      if (!canonical) return t;
      const sameName = normalizeName(canonical.name) === normalizeName(t.playerName);
      const sameId = canonical.id === t.playerId;
      if (sameName && sameId) return t;

      const looksSynthetic =
        t.playerPhoto === "" && t.playerAge === 25 && t.playerPositionPtBr === "MID";
      updates++;
      return {
        ...t,
        playerName: canonical.name,
        playerId: looksSynthetic ? canonical.id : t.playerId,
        playerPhoto: t.playerPhoto || canonical.photo,
      };
    }),
  );

  if (updates > 0) {
    try {
      await saveTransfersAsync(seasonId, updated);
    } catch {
      // Persistence failed — don't mark as canonicalized so we retry next time.
      return { attempted, updates: 0, reliable: false };
    }
  }
  return { attempted, updates, reliable };
}

function normalizeNumeric(raw: string): number {
  const hasDot = raw.includes(".");
  const hasComma = raw.includes(",");
  let cleaned = raw;
  if (hasDot && hasComma) {
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

function buildTransferGeneric(
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

function buildTransferFromPlayer(
  career: Career,
  entry: TransferEntry,
  type: "compra" | "venda",
  player: SquadPlayer,
): TransferRecord {
  const isBuy = type === "compra";
  return {
    id: generateTransferId(),
    careerId: career.id,
    season: career.season,
    playerId: player.id,
    playerName: player.name,
    playerPhoto: player.photo ?? "",
    playerPositionPtBr: player.positionPtBr,
    playerAge: player.age || 25,
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

function squadPlayerFromHit(hit: SearchHit): SquadPlayer {
  const VALID: PositionPtBr[] = ["GOL", "DEF", "MID", "ATA"];
  const ptBr: PositionPtBr = (VALID as string[]).includes(hit.position)
    ? (hit.position as PositionPtBr)
    : "MID";
  return {
    id: hit.id,
    name: hit.name,
    age: hit.age || 25,
    photo: hit.photo || "",
    positionPtBr: ptBr,
    position: (PT_BR_TO_POSITION[ptBr] ?? "Midfielder") as PositionGroup,
  };
}

async function searchPlayer(name: string): Promise<SearchHit | null> {
  try {
    const res = await fetch(`/api/players/search?q=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { players?: SearchHit[] };
    return findBestSearchHit(name, data.players ?? []);
  } catch {
    return null;
  }
}

function fuzzyNameMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  if (shorter.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
  const at = na.split(" ").filter(Boolean);
  const bt = nb.split(" ").filter(Boolean);
  const aLast = at[at.length - 1] ?? "";
  const bLast = bt[bt.length - 1] ?? "";
  return aLast.length >= 3 && aLast === bLast;
}

function isLegacyHydrationData(
  existing: TransferRecord[],
  tIn: TransferEntry[],
  tOut: TransferEntry[],
): boolean {
  const icNames = [...tIn, ...tOut]
    .map((e) => e?.name?.trim() ?? "")
    .filter(Boolean);
  if (icNames.length === 0 || existing.length === 0) return false;
  if (existing.length !== icNames.length) return false;
  // Each existing record must (a) look synthetic by ANY default marker and
  // (b) fuzzy-match an unconsumed entry in the initialContext name list
  // (one-to-one — duplicates can't all collapse onto the same IC entry).
  const remaining = [...icNames];
  for (const t of existing) {
    const looksSynthetic =
      t.playerPhoto === "" || t.playerAge === 25 || t.playerPositionPtBr === "MID";
    if (!looksSynthetic) return false;
    const idx = remaining.findIndex((n) => fuzzyNameMatch(t.playerName, n));
    if (idx === -1) return false;
    remaining.splice(idx, 1);
  }
  return true;
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
  vendasMatched: number;
  comprasMatched: number;
  ran: boolean;
}

export async function hydrateInitialContext(
  career: Career,
  seasonId: string,
): Promise<HydrationResult> {
  const empty: HydrationResult = {
    transfersAdded: 0,
    matchesAdded: 0,
    rivalsSet: 0,
    vendasMatched: 0,
    comprasMatched: 0,
    ran: false,
  };
  // One-time migration for careers hydrated before alias support: re-runs
  // matching to replace AI nicknames with canonical player names. Runs even
  // when the career is already hydrated.
  if (!isCanonicalized(career.id)) {
    try {
      const result = await canonicalizeTransferNames(career, seasonId);
      // Only mark when the pass was reliable. If a network/save failure
      // prevented us from resolving every record, leave the flag unset so a
      // future call retries.
      if (result.reliable) markCanonicalized(career.id);
    } catch {
      /* unexpected failure — leave flag unset to retry */
    }
  }

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

  const existingTransfers = getTransfers(seasonId);
  const existingMatches = getMatches(seasonId);
  const existingRivals = getSeasonRivals(seasonId);

  // Three cases qualify for transfer hydration:
  //   1. First-time hydration (no prior flag, no existing transfers).
  //   2. Pre-v3 marked career whose existing records still look like legacy
  //      synthetic hydration (re-enrich with real data).
  // Pre-v3 marked careers with NO existing transfers are skipped — the user
  // likely deleted them manually and we must not resurrect them.
  const preV3 = isPreV3Hydrated(career.id);
  const isFirstTime = !preV3 && existingTransfers.length === 0;
  const transfersWereLegacy = preV3 && isLegacyHydrationData(existingTransfers, tIn, tOut);
  const canHydrateTransfers = (isFirstTime || transfersWereLegacy)
    && (tIn.length > 0 || tOut.length > 0);
  const canHydrateMatches = existingMatches.length === 0 && recentMatches.length > 0;
  const canHydrateRivals = existingRivals.length === 0 && rivals.length > 0;

  // ── Transfers: try to bind to real squad (vendas) and real player search (compras) ──
  let newTransfers: TransferRecord[] = [];
  const vendasMatched: SquadPlayer[] = [];
  const comprasMatched: SquadPlayer[] = [];

  // When clubId is real (>0) AND we have vendas to bind, ensure the squad is
  // actually loaded — fetch from the backend if cache/DB are empty. If the
  // squad still can't be loaded, fall back per-player to generic records
  // rather than blocking the whole hydration batch.
  let squadPlayers: SquadPlayer[] = [];
  if (canHydrateTransfers && career.clubId && career.clubId > 0 && tOut.length > 0) {
    try {
      const squad = await getSquad(career.clubId, career.clubName);
      squadPlayers = squad?.players ?? [];
    } catch {
      squadPlayers = [];
    }
    if (squadPlayers.length === 0) {
      try {
        const fetched = await fetchSquadFromBackend(career.clubId);
        squadPlayers = fetched?.players ?? [];
      } catch {
        squadPlayers = [];
      }
    }
    if (squadPlayers.length === 0) {
      console.warn(
        `[hydrateInitialContext] empty squad for clubId=${career.clubId} (${career.clubName}); falling back to generic vendas records.`,
      );
    }
  }

  if (canHydrateTransfers) {
    for (const entry of tOut) {
      const name = entry?.name?.trim();
      if (!name) continue;
      const m = squadPlayers.length > 0 ? findBestPlayerMatch(name, squadPlayers) : null;
      if (m) {
        newTransfers.push(buildTransferFromPlayer(career, entry, "venda", m.player));
        vendasMatched.push(m.player);
      } else {
        newTransfers.push(buildTransferGeneric(career, entry, "venda"));
      }
    }

    // Compras: search backend for each name. Limited concurrency (3) keeps the wait
    // short for typical 3–10 incoming transfers without hammering the API.
    const incoming = tIn.filter((e): e is TransferEntry => !!e?.name?.trim());
    const hits: (SearchHit | null)[] = new Array(incoming.length).fill(null);
    const CONCURRENCY = 3;
    let cursor = 0;
    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= incoming.length) return;
        hits[i] = await searchPlayer(incoming[i].name.trim());
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, incoming.length) }, worker));
    for (let i = 0; i < incoming.length; i++) {
      const entry = incoming[i];
      const hit = hits[i];
      if (hit) {
        const real = squadPlayerFromHit(hit);
        newTransfers.push(buildTransferFromPlayer(career, entry, "compra", real));
        comprasMatched.push(real);
      } else {
        newTransfers.push(buildTransferGeneric(career, entry, "compra"));
      }
    }
  }

  // ── Matches ──
  const newMatches: MatchRecord[] = [];
  if (canHydrateMatches) {
    for (const rm of recentMatches) {
      const match = buildMatch(career, rm);
      if (match) newMatches.push(match);
    }
  }

  // ── Rivals ──
  const cleanedRivals = canHydrateRivals
    ? rivals.map((r) => r.trim()).filter(Boolean).slice(0, MAX_RIVALS)
    : [];

  if (!canHydrateTransfers && !canHydrateMatches && !canHydrateRivals) {
    markHydrated(career.id);
    return empty;
  }

  const writes: Promise<unknown>[] = [];

  if (canHydrateTransfers) {
    writes.push(saveTransfersAsync(seasonId, newTransfers));
  }

  if (newMatches.length > 0) {
    writes.push(saveMatches(seasonId, newMatches));
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

  const settled = await Promise.allSettled(writes);
  const allOk = settled.every((s) => s.status === "fulfilled");

  if (allOk) {
    // Apply squad-side effects: hide sold real players + add bought real players.
    // All addX helpers de-dup by id, but addCustomPlayer doesn't — guard manually.
    for (const p of vendasMatched) {
      addFormerPlayer(career.id, p);
      if (p.id > 0) addHiddenPlayerId(career.id, p.id);
    }
    if (comprasMatched.length > 0) {
      // Drop orphan custom players from prior v1/v2 hydration: must be fully
      // synthetic (empty photo AND age 25 AND MID) AND name matches a
      // transfersIn entry. Manual user edits with any real attribute survive.
      const tInNames = tIn.map((e) => e?.name?.trim() ?? "").filter(Boolean);
      const existingCustom = getCustomPlayers(career.id);
      const cleanedCustom = existingCustom.filter((p) => {
        const fullySynthetic =
          (!p.photo || p.photo === "")
          && p.age === 25
          && p.positionPtBr === "MID";
        const matchesIn = tInNames.some((n) => fuzzyNameMatch(p.name, n));
        return !(fullySynthetic && matchesIn);
      });
      if (cleanedCustom.length !== existingCustom.length) {
        saveCustomPlayers(career.id, cleanedCustom);
      }

      const existingIds = new Set(cleanedCustom.map((p) => p.id));
      const existingNames = new Set(cleanedCustom.map((p) => normalizeName(p.name)));
      for (const p of comprasMatched) {
        if (existingIds.has(p.id)) continue;
        if (existingNames.has(normalizeName(p.name))) continue;
        addCustomPlayer(career.id, p);
        existingIds.add(p.id);
        existingNames.add(normalizeName(p.name));
      }
    }
    markHydrated(career.id);
  }

  return {
    ran: true,
    transfersAdded: canHydrateTransfers ? newTransfers.length : 0,
    matchesAdded: newMatches.length,
    rivalsSet,
    vendasMatched: vendasMatched.length,
    comprasMatched: comprasMatched.length,
  };
}
