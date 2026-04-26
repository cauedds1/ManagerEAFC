import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const TOKEN_KEY = 'fc_auth_token';

export function getApiUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) return apiUrl;
  return 'http://localhost:8080';
}

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function deleteToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const base = getApiUrl();
  const url = `${base}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errorMsg = body.error ?? errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

export interface User {
  id: number;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'ultra';
}

export interface Coach {
  name: string;
  photo?: string;
  nationality?: string;
}

export interface Career {
  id: string;
  coach: Coach;
  clubId: number;
  clubName: string;
  clubLogo?: string;
  clubLeague?: string;
  clubCountry?: string;
  clubStadium?: string;
  clubFounded?: number;
  clubPrimary?: string;
  clubSecondary?: string;
  clubDescription?: string;
  season: string;
  projeto?: string;
  currentSeasonId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Season {
  id: string;
  careerId: string;
  label: string;
  isActive: boolean;
  finalized: boolean;
  createdAt: number;
}

export interface Club {
  id: number;
  name: string;
  logo: string;
  league: string;
  leagueId: number;
  country?: string;
}

export interface CreateCareerBody {
  coach: Coach;
  clubId: number;
  clubName: string;
  clubLogo?: string;
  clubLeague?: string;
  clubCountry?: string;
  clubPrimary?: string;
  clubSecondary?: string;
  season?: string;
}

export type MatchLocation = 'casa' | 'fora' | 'neutro';
export type MatchResult = 'vitoria' | 'empate' | 'derrota';

export interface GoalEntry {
  id: string;
  minute: number;
  assistPlayerId?: number;
  goalType?: string;
}

export interface OpponentGoalEntry {
  id: string;
  minute: number;
  playerName?: string;
}

export interface PlayerMatchStats {
  startedOnBench: boolean;
  rating: number;
  goals: GoalEntry[];
  ownGoal: boolean;
  injured: boolean;
  substituted: boolean;
  yellowCard?: boolean;
  redCard?: boolean;
}

export interface MatchStats {
  myShots: number;
  opponentShots: number;
  possessionPct: number;
  penaltyGoals?: number;
}

export interface MatchRecord {
  id: string;
  careerId: string;
  season: string;
  date: string;
  tournament: string;
  stage: string;
  location: MatchLocation;
  opponent: string;
  myScore: number;
  opponentScore: number;
  starterIds: number[];
  subIds: number[];
  playerStats: Record<string, PlayerMatchStats>;
  matchStats: MatchStats;
  motmPlayerId?: number;
  motmPlayerName?: string;
  opponentGoals?: OpponentGoalEntry[];
  tablePositionBefore?: number;
  opponentLogoUrl?: string;
  observations?: string;
  createdAt: number;
}

export interface SquadPlayer {
  id: number;
  name: string;
  age: number;
  position: string;
  positionPtBr: string;
  photo: string;
  number?: number;
}

export interface PlayerSeasonStats {
  playerId: number;
  goals: number;
  assists: number;
  avgRating: number;
  appearances: number;
  yellowCards: number;
  redCards: number;
}

export interface NewsItem {
  id: string;
  headline: string;
  body: string;
  type?: string;
  createdAt: number;
  matchId?: string;
  imageUrl?: string;
  source?: string;
}

export interface InjuryRecord {
  playerId: number;
  playerName: string;
  injuryType: string;
  matchesOut: number;
  matchesServed?: number;
  createdAt?: number;
  playerPosition?: string;
  position?: string;
  returnDate?: string;
  expectedReturn?: string;
}

export interface LeaguePosition {
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface Finances {
  budget: number;
  wage: number;
  transferBudget?: number;
}

export type TransferType = 'in' | 'out' | 'loan_in' | 'loan_out';

export interface Transfer {
  id: string;
  playerId: number;
  playerName: string;
  club: string;
  fee: number;
  salary?: number;
  contractYears?: number;
  type: TransferType;
  season: string;
  date: string;
  pending?: boolean;
  loanStatus?: 'active' | 'recalled' | 'ended';
}

export interface DiretoraaMember {
  id: string;
  name: string;
  role?: string;
  roleLabel?: string;
  description?: string;
  mood?: string;
  patience?: number;
  satisfaction?: number;
  avatarColor?: string;
  goals?: string;
  personality?: string;
}

export interface DiretoraaMeeting {
  id: string;
  memberId: string;
  date: string;
  topic: string;
  outcome: string;
  createdAt: number;
}

export interface Diretoria {
  members?: DiretoraaMember[];
  meetings?: DiretoraaMeeting[];
  notifications?: { id: string; message: string; read: boolean; createdAt: number }[];
}

export interface ScheduledMatch {
  id: string;
  date: string;
  opponent: string;
  location: MatchLocation;
  tournament: string;
  stage: string;
  opponentLogoUrl?: string;
}

export interface SeasonGameData {
  matches?: MatchRecord[];
  scheduled_matches?: ScheduledMatch[];
  player_stats?: PlayerSeasonStats[];
  news?: NewsItem[];
  injuries?: InjuryRecord[];
  league_position?: LeaguePosition;
  finances?: Finances;
  transfers?: Transfer[];
  fan_mood?: number;
  rivals?: string[];
  rivalsLocked?: boolean;
  transferWindow?: { open: boolean; openCount: number };
  momentos?: MomentoMeta[];
}

export interface MomentoMeta {
  id: string;
  title: string;
  description: string;
  gameDate: string;
  playerIds?: number[];
  createdAt: string;
  photoUrl?: string;
}

export interface Trophy {
  id: string;
  name: string;
  season?: string;
  type?: string;
  tournament?: string;
  photoUrl?: string;
}

export interface CareerGameData {
  lineup?: number[];
  benchOrder?: number[];
  formation?: string;
  trophies?: Trophy[];
  customPlayers?: SquadPlayer[];
  diretoria_members?: DiretoraaMember[];
  diretoria_meetings?: DiretoraaMeeting[];
  diretoria_notifications?: { id: string; message: string; read: boolean; createdAt: number }[];
  comp_results?: unknown[];
  formerPlayers?: SquadPlayer[];
  rivals?: string[];
}

export interface PlayerSearchResult {
  id: number;
  name: string;
  photo: string;
  age: number;
  position: string;
}

export function getMatchResult(myScore: number, opponentScore: number): MatchResult {
  if (myScore > opponentScore) return 'vitoria';
  if (myScore < opponentScore) return 'derrota';
  return 'empate';
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    register: (email: string, password: string, name: string) =>
      request<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),

    me: () =>
      request<{ user: User }>('/api/auth/me'),
  },

  careers: {
    list: () =>
      request<Career[]>('/api/careers'),

    create: (body: CreateCareerBody) =>
      request<{ id: string }>('/api/careers', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    update: (id: string, body: Partial<CreateCareerBody>) =>
      request<{ ok: boolean }>(`/api/careers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),

    delete: (id: string) =>
      request<{ ok: boolean }>(`/api/careers/${id}`, {
        method: 'DELETE',
      }),

    seasons: (careerId: string) =>
      request<Season[]>(`/api/careers/${careerId}/seasons`),

    createSeason: (careerId: string, label: string, isActive?: boolean) =>
      request<{ id: string }>(`/api/careers/${careerId}/seasons`, {
        method: 'POST',
        body: JSON.stringify({ label, isActive }),
      }),

    finalizeSeason: (seasonId: string) =>
      request<{ ok: boolean }>(`/api/seasons/${seasonId}/finalize`, {
        method: 'PATCH',
      }),
  },

  clubs: {
    list: () =>
      request<{ clubs: Club[]; cachedAt: number }>('/api/clubs'),
  },

  seasonData: {
    get: (seasonId: string) =>
      request<{ data: SeasonGameData }>(`/api/data/season/${seasonId}`),

    set: (seasonId: string, key: keyof SeasonGameData, value: unknown) =>
      request<{ ok: boolean }>(`/api/data/season/${seasonId}/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
  },

  careerData: {
    get: (careerId: string) =>
      request<{ data: CareerGameData }>(`/api/data/career/${careerId}`),

    set: (careerId: string, key: keyof CareerGameData, value: unknown) =>
      request<{ ok: boolean }>(`/api/data/career/${careerId}/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
  },

  squad: {
    get: (clubId: number) =>
      request<{ players: SquadPlayer[]; cachedAt: number }>(`/api/squad/${clubId}`),
  },

  players: {
    search: (q: string) =>
      request<{ players: PlayerSearchResult[] }>(`/api/players/search?q=${encodeURIComponent(q)}`),
  },

  noticias: {
    generate: (seasonId: string, matchId?: string) =>
      request<{ noticia: NewsItem }>('/api/noticias/generate', {
        method: 'POST',
        body: JSON.stringify({ seasonId, matchId }),
      }),
  },

  matches: {
    list: (seasonId: string) =>
      api.seasonData.get(seasonId).then((res) => res.data?.matches ?? []),

    save: (seasonId: string, matches: MatchRecord[]) =>
      api.seasonData.set(seasonId, 'matches', matches),
  },

  transfers: {
    list: (seasonId: string) =>
      api.seasonData.get(seasonId).then((res) => res.data?.transfers ?? []),

    save: (seasonId: string, transfers: Transfer[]) =>
      api.seasonData.set(seasonId, 'transfers', transfers),
  },

  injuries: {
    list: (seasonId: string) =>
      api.seasonData.get(seasonId).then((res) => res.data?.injuries ?? []),

    save: (seasonId: string, injuries: InjuryRecord[]) =>
      api.seasonData.set(seasonId, 'injuries', injuries),
  },

  finances: {
    get: (seasonId: string) =>
      api.seasonData.get(seasonId).then((res) => res.data?.finances ?? null),

    save: (seasonId: string, finances: Finances) =>
      api.seasonData.set(seasonId, 'finances', finances),
  },

  diretoria: {
    get: (careerId: string) =>
      api.careerData.get(careerId).then((res) => ({
        members: res.data?.diretoria_members,
        meetings: res.data?.diretoria_meetings,
        notifications: res.data?.diretoria_notifications,
      })),

    saveMembers: (careerId: string, members: DiretoraaMember[]) =>
      api.careerData.set(careerId, 'diretoria_members', members),

    saveMeetings: (careerId: string, meetings: DiretoraaMeeting[]) =>
      api.careerData.set(careerId, 'diretoria_meetings', meetings),

    generateMember: (payload: {
      roleLabel: string;
      personalityStyle: string;
      clubName: string;
      clubLeague?: string;
      clubCountry?: string;
      extraTraits?: string;
    }) =>
      request<{ name: string; description: string; patience: number }>(
        '/api/diretoria/generate-member',
        { method: 'POST', body: JSON.stringify({ ...payload, lang: 'pt' }) }
      ),

    sendTurn: (payload: {
      speaker: { id: string; name: string; roleLabel: string; description: string; mood: string; patience: number };
      allMembers: Array<{ id: string; name: string; roleLabel: string; description: string; mood: string; patience: number }>;
      history: Array<{ role: string; content: string; memberName?: string }>;
      context: {
        clubName: string; clubLeague: string; season: string; coachName: string;
        squadSize: number; transfersCount: number; recentMatches: unknown[]; leaguePosition: null;
        projeto?: string;
      };
      triggerMessage: string;
    }) =>
      request<{ reply: string; newMood: string; suggestClose: boolean; speakerMemberId: string }>(
        '/api/diretoria/turn', { method: 'POST', body: JSON.stringify(payload) }
      ),
  },

  users: {
    savePushToken: (token: string) =>
      request<{ ok: boolean }>('/api/users/push-token', {
        method: 'POST',
        body: JSON.stringify({ token, platform: Platform.OS }),
      }),
  },

  portals: {
    list: (careerId: string) =>
      request<CustomPortal[]>(`/api/careers/${encodeURIComponent(careerId)}/portals`),

    create: (careerId: string, data: { name: string; description: string; tone: PortalTone; photo?: string }) =>
      request<CustomPortal>(`/api/careers/${encodeURIComponent(careerId)}/portals`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (careerId: string, portalId: string, data: Partial<{ name: string; description: string; tone: PortalTone; photo: string | null }>) =>
      request<{ ok: boolean }>(`/api/careers/${encodeURIComponent(careerId)}/portals/${encodeURIComponent(portalId)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (careerId: string, portalId: string) =>
      request<{ ok: boolean }>(`/api/careers/${encodeURIComponent(careerId)}/portals/${encodeURIComponent(portalId)}`, {
        method: 'DELETE',
      }),
  },
};

export type PortalTone =
  | 'humoristico' | 'serio' | 'jornalistico' | 'apaixonado'
  | 'critico' | 'ironico' | 'agressivo';

export interface CustomPortal {
  id: string;
  careerId: string;
  name: string;
  description: string;
  tone: PortalTone;
  photo?: string;
  createdAt: number;
}

export const PORTAL_TONES: { id: PortalTone; emoji: string; label: string }[] = [
  { id: 'humoristico',  emoji: '😂', label: 'Humorístico' },
  { id: 'apaixonado',   emoji: '❤️', label: 'Apaixonado' },
  { id: 'critico',      emoji: '🔥', label: 'Crítico' },
  { id: 'ironico',      emoji: '😏', label: 'Irônico' },
  { id: 'jornalistico', emoji: '📰', label: 'Jornalístico' },
  { id: 'serio',        emoji: '🎯', label: 'Sério' },
  { id: 'agressivo',    emoji: '💢', label: 'Agressivo' },
];
