import { putSeasonData } from "@/lib/apiStorage";
import { sessionGet, sessionSet } from "@/lib/sessionStore";

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
  return sessionGet<LeaguePosition>(leagueKey(seasonId));
}

export function setLeaguePosition(seasonId: string, pos: LeaguePosition): void {
  sessionSet(leagueKey(seasonId), pos);
  void putSeasonData(seasonId, "league_position", pos);
}
