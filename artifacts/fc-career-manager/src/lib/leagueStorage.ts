import { putSeasonData } from "@/lib/apiStorage";

export interface LeaguePosition {
  position: number;
  totalTeams: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

function leagueKey(seasonId: string): string {
  return `fc-career-manager-league-${seasonId}`;
}

export function getLeaguePosition(seasonId: string): LeaguePosition | null {
  try {
    const raw = localStorage.getItem(leagueKey(seasonId));
    if (!raw) return null;
    return JSON.parse(raw) as LeaguePosition;
  } catch {
    return null;
  }
}

export function setLeaguePosition(seasonId: string, pos: LeaguePosition): void {
  try {
    localStorage.setItem(leagueKey(seasonId), JSON.stringify(pos));
  } catch {}
  void putSeasonData(seasonId, "league_position", pos);
}
