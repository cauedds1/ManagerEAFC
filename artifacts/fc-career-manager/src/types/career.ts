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

export interface MoodBlock {
  value: number;
  label: string;
  reason: string;
}

export interface KeyPlayer {
  name: string;
  role: string;
  note: string;
}

export interface TransferEntry {
  name: string;
  from?: string;
  to?: string;
  fee?: string;
  note?: string;
}

export interface RecentMatch {
  opponent: string;
  competition: string;
  result: string;
  score: string;
  note: string;
}

export interface Mission {
  title: string;
  description: string;
  deadline: string;
}

export interface InitialContext {
  club: { name: string; league: string; country: string; confidence: string };
  coach: { name: string; nationality: string; style: string; confidence: string };
  season: { label: string; stage: string; matchday: number | null; confidence: string };
  leaguePosition: { rank: number | null; points: number | null; form: string; gap: string; confidence: string };
  moods: { board: MoodBlock; fans: MoodBlock; dressingRoom: MoodBlock };
  finances: { summary: string; budget: string; confidence: string };
  keyPlayers: KeyPlayer[];
  transfersIn: TransferEntry[];
  transfersOut: TransferEntry[];
  rivals: string[];
  recentMatches: RecentMatch[];
  storyArc: string;
  narrativeSummary: string;
  projeto: string;
  competitions: string[];
  missions: Mission[];
  boardLetter: string;
  prediction: { endOfSeason: string; boardReaction: string; confidence: string };
  inconsistencies: string[];
  deepeningQuestions: string[];
  squadSyncWarning: string;
  overallConfidence: string;
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
  currentSeasonId?: string;
  isCustomClub?: boolean;
  backstory?: string;
  initialBoardMood?: number;
  initialFanMood?: number;
  initialContext?: InitialContext;
  createdAt: number;
  updatedAt: number;
}

export interface Season {
  id: string;
  careerId: string;
  label: string;
  competitions?: string[];
  rivals?: string[];
  rivalsLocked?: boolean;
  isActive: boolean;
  finalized?: boolean;
  createdAt: number;
}
