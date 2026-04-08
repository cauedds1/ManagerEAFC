export interface LeaguePosition {
  position: number;
  totalTeams: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

function leagueKey(careerId: string): string {
  return `fc-career-manager-league-${careerId}`;
}

export function getLeaguePosition(careerId: string): LeaguePosition | null {
  try {
    const raw = localStorage.getItem(leagueKey(careerId));
    if (!raw) return null;
    return JSON.parse(raw) as LeaguePosition;
  } catch {
    return null;
  }
}

export function setLeaguePosition(careerId: string, pos: LeaguePosition): void {
  try {
    localStorage.setItem(leagueKey(careerId), JSON.stringify(pos));
  } catch {}
}
