export interface BracketMatch {
  id: string;
  homeTeam: string;
  homeScore: number | null;
  awayTeam: string;
  awayScore: number | null;
}

export interface BracketRound {
  id: string;
  name: string;
  matches: BracketMatch[];
}

export interface StandingsEntry {
  id: string;
  team: string;
  points: number;
}

export interface CompetitionResult {
  id: string;
  careerId: string;
  seasonId: string;
  seasonLabel: string;
  competitionName: string;
  type: "mata-mata" | "pontos-corridos";
  isChampion: boolean;
  bracket?: BracketRound[];
  standings?: StandingsEntry[];
  createdAt: number;
}

function storageKey(careerId: string): string {
  return `fc-cm-comp-results-${careerId}`;
}

export function getCompetitionResults(careerId: string): CompetitionResult[] {
  try {
    const raw = localStorage.getItem(storageKey(careerId));
    if (!raw) return [];
    return JSON.parse(raw) as CompetitionResult[];
  } catch {
    return [];
  }
}

export function addCompetitionResult(careerId: string, result: CompetitionResult): void {
  const list = getCompetitionResults(careerId);
  list.push(result);
  try {
    localStorage.setItem(storageKey(careerId), JSON.stringify(list));
  } catch {}
}

export function updateCompetitionResult(careerId: string, updated: CompetitionResult): void {
  const list = getCompetitionResults(careerId);
  const idx = list.findIndex((r) => r.id === updated.id);
  if (idx === -1) return;
  list[idx] = updated;
  try {
    localStorage.setItem(storageKey(careerId), JSON.stringify(list));
  } catch {}
}

export function deleteCompetitionResult(careerId: string, resultId: string): void {
  const list = getCompetitionResults(careerId).filter((r) => r.id !== resultId);
  try {
    localStorage.setItem(storageKey(careerId), JSON.stringify(list));
  } catch {}
}

export function generateResultId(): string {
  return `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateRoundId(): string {
  return `rnd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

export function generateMatchId(): string {
  return `bm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

export function generateStandingId(): string {
  return `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}
