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

export type Confidence = "low" | "medium" | "high";

export interface Injury { name: string; weeks: number | null; note: string }
export interface OngoingCompetition { name: string; stage: string; nextOpponent: string }
export interface RivalContext { name: string; context: string }
export interface NarrativeArc { title: string; description: string; status: string }

export interface InitialContext {
  club: { name: string; league: string; country: string; confidence: Confidence };
  coach: { name: string; nationality: string; style: string; confidence: Confidence };
  season: { label: string; stage: string; matchday: number | null; confidence: Confidence };
  leaguePosition: {
    rank: number | null;
    points: number | null;
    form: string;
    recentForm: string[];
    goalDifference: number | null;
    gap: string;
    currentMatchday: number | null;
    confidence: Confidence;
  };
  preferredFormation?: string;
  injuries?: Injury[];
  trophiesWon?: string[];
  ongoingCompetitions?: OngoingCompetition[];
  rivalsContext?: RivalContext[];
  narrativeArcs?: NarrativeArc[];
  moods: { board: MoodBlock; fans: MoodBlock; dressingRoom: MoodBlock };
  finances: { summary: string; budget: string; confidence: Confidence };
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
  prediction: { endOfSeason: string; boardReaction: string; confidence: Confidence };
  inconsistencies: string[];
  deepeningQuestions: string[];
  squadSyncWarning: string;
  overallConfidence: Confidence;
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
