export interface Club {
  name: string;
  league: string;
  sofifaId?: string;
  apiFootballId?: number;
  logo?: string;
}

export interface ClubEntry {
  id: number;
  name: string;
  logo: string;
  league: string;
  leagueId: number;
  country?: string;
}

export interface Player {
  id: string;
  name: string;
  team: string;
  league: string;
  card?: string;
  position?: string;
  ovr?: string;
  age?: string;
  nation?: string;
}

export interface SelectedClub {
  club: Club;
  selectedAt: number;
  season: string;
}
