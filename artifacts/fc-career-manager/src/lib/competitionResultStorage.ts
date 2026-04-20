import { putCareerData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";

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
  return sessionGet<CompetitionResult[]>(storageKey(careerId)) ?? [];
}

function _save(careerId: string, list: CompetitionResult[]): void {
  sessionSet(storageKey(careerId), list);
  void putCareerData(careerId, "comp_results", list);
}

export function addCompetitionResult(careerId: string, result: CompetitionResult): void {
  _save(careerId, [...getCompetitionResults(careerId), result]);
}

export function updateCompetitionResult(careerId: string, updated: CompetitionResult): void {
  _save(careerId, getCompetitionResults(careerId).map((r) => r.id === updated.id ? updated : r));
}

export function deleteCompetitionResult(careerId: string, resultId: string): void {
  const list = getCompetitionResults(careerId).filter((r) => r.id !== resultId);
  _save(careerId, list);
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
