import { putSeasonData } from '@/lib/apiStorage';
import { sessionGet, sessionSet } from '@/lib/sessionStore';

export interface SeasonSummaryLeague {
  position: number;
  totalTeams: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor?: number;
  goalsAgainst?: number;
}

export interface SeasonSummary {
  seasonId: string;
  seasonLabel: string;
  league?: SeasonSummaryLeague;
  finalizedAt: number;
}

function summaryKey(seasonId: string): string {
  return `fc-season-summary-${seasonId}`;
}

export function getSeasonSummary(seasonId: string): SeasonSummary | null {
  return sessionGet<SeasonSummary>(summaryKey(seasonId));
}

export function setSeasonSummary(seasonId: string, summary: SeasonSummary): void {
  sessionSet(summaryKey(seasonId), summary);
  void putSeasonData(seasonId, 'season_summary', summary);
}
