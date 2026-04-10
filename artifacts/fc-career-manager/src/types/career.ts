export interface CoachProfile {
  name: string;
  nationality: string;
  nationalityFlag: string;
  age: number;
  photo?: string;
}

export interface ClubTitle {
  name: string;
  count: number;
}

export interface Career {
  id: string;
  coach: CoachProfile;
  clubId: number;
  clubName: string;
  clubLogo: string;
  clubLeague: string;
  clubCountry?: string;
  clubStadium?: string;
  clubFounded?: number;
  clubPrimary?: string;
  clubSecondary?: string;
  clubDescription?: string;
  clubTitles?: ClubTitle[];
  season: string;
  projeto?: string;
  competitions?: string[];
  createdAt: number;
  updatedAt: number;
}
