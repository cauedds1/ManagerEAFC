import type { SquadPlayer } from "@/lib/squadCache";
import { expandAliases } from "@/lib/playerAliases";

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalizeName(s).split(" ").filter(Boolean);
}

function score(query: string, candidate: string): number {
  const q = normalizeName(query);
  const c = normalizeName(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  // Containment shortcut: only when the shorter side is meaningful (≥ 4 chars)
  // to avoid "Ed" matching "Ederson" with a high score.
  const shorter = q.length <= c.length ? q : c;
  if (shorter.length >= 4 && (c.includes(q) || q.includes(c))) return 0.9;

  const qt = tokens(query);
  const ct = tokens(candidate);
  if (qt.length === 0 || ct.length === 0) return 0;

  const qLast = qt[qt.length - 1];
  const cLast = ct[ct.length - 1];

  let s = 0;
  if (qLast === cLast && qLast.length >= 3) {
    s = 0.75;
    const qFirst = qt[0]?.[0] ?? "";
    const cFirst = ct[0]?.[0] ?? "";
    if (qFirst && cFirst && qFirst === cFirst) s += 0.1;
    const cSet = new Set(ct);
    const overlap = qt.filter((t) => cSet.has(t)).length / qt.length;
    s += overlap * 0.1;
  }
  return s;
}

// Alias-aware score: when the query has known nicknames (e.g. "Savinho" → "Sávio"),
// take the best score across all variants so candidates spelled with the canonical
// name still match.
function aliasAwareScore(query: string, candidate: string): number {
  const variants = expandAliases(query);
  if (variants.length <= 1) return score(query, candidate);
  let best = score(query, candidate);
  for (const v of variants) {
    if (v === query) continue;
    const s = score(v, candidate);
    if (s > best) best = s;
  }
  return best;
}

export interface SearchHit {
  id: number;
  name: string;
  photo: string;
  age: number;
  position: string;
  teamId: number;
}

interface MatchOpts {
  minScore?: number;
  minMargin?: number;
}

export function findBestPlayerMatch(
  name: string,
  pool: SquadPlayer[],
  opts: MatchOpts = {},
): { player: SquadPlayer; score: number } | null {
  const minScore = opts.minScore ?? 0.75;
  const minMargin = opts.minMargin ?? 0.15;
  if (!name?.trim() || pool.length === 0) return null;
  const scored = pool
    .map((p) => ({ player: p, score: aliasAwareScore(name, p.name) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < minScore) return null;
  const second = scored[1]?.score ?? 0;
  if (second >= minScore && best.score - second < minMargin) return null;
  return best;
}

export function findBestSearchHit(
  name: string,
  hits: SearchHit[],
  opts: MatchOpts = {},
): SearchHit | null {
  const minScore = opts.minScore ?? 0.75;
  const minMargin = opts.minMargin ?? 0.15;
  if (!name?.trim() || hits.length === 0) return null;
  const scored = hits
    .map((h) => ({ hit: h, score: aliasAwareScore(name, h.name) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < minScore) return null;
  const second = scored[1]?.score ?? 0;
  if (second >= minScore && best.score - second < minMargin) return null;
  return best.hit;
}
