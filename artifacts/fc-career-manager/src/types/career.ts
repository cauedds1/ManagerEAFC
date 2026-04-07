export interface CoachProfile {
  name: string;
  nationality: string;
  nationalityFlag: string;
  age: number;
  photo?: string;
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
  season: string;
  createdAt: number;
  updatedAt: number;
}
