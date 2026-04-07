export interface LeagueInfo {
  id: number;
  name: string;
  displayName?: string;
  country: string;
  flag: string;
  type: "domestic" | "international";
  logo: string;
}

export function getLeagueLogoUrl(leagueId: number): string {
  return `https://media.api-sports.io/football/leagues/${leagueId}.png`;
}

function leaguelogo(id: number): string {
  return `https://media.api-sports.io/football/leagues/${id}.png`;
}

export const DOMESTIC_LEAGUES: LeagueInfo[] = [
  { id: 39,  name: "Premier League",      country: "Inglaterra",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", type: "domestic", logo: leaguelogo(39) },
  { id: 40,  name: "Championship",        country: "Inglaterra",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", type: "domestic", logo: leaguelogo(40) },
  { id: 41,  name: "League One",          country: "Inglaterra",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", type: "domestic", logo: leaguelogo(41) },
  { id: 42,  name: "League Two",          country: "Inglaterra",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", type: "domestic", logo: leaguelogo(42) },
  { id: 78,  name: "Bundesliga",          country: "Alemanha",       flag: "🇩🇪", type: "domestic", logo: leaguelogo(78) },
  { id: 79,  name: "2. Bundesliga",       country: "Alemanha",       flag: "🇩🇪", type: "domestic", logo: leaguelogo(79) },
  { id: 61,  name: "Ligue 1",             country: "França",         flag: "🇫🇷", type: "domestic", logo: leaguelogo(61) },
  { id: 135, name: "Serie A",             country: "Itália",         flag: "🇮🇹", type: "domestic", logo: leaguelogo(135) },
  { id: 140, name: "LaLiga",              country: "Espanha",        flag: "🇪🇸", type: "domestic", logo: leaguelogo(140) },
  { id: 88,  name: "Eredivisie",          country: "Holanda",        flag: "🇳🇱", type: "domestic", logo: leaguelogo(88) },
  { id: 94,  name: "Liga Portugal",       country: "Portugal",       flag: "🇵🇹", type: "domestic", logo: leaguelogo(94) },
  { id: 128, name: "Liga Profesional",    country: "Argentina",      flag: "🇦🇷", type: "domestic", logo: leaguelogo(128) },
  { id: 144, name: "Pro League",          displayName: "Belgian Pro League", country: "Bélgica", flag: "🇧🇪", type: "domestic", logo: leaguelogo(144) },
  { id: 169, name: "Super League",        displayName: "Chinese Super League", country: "China", flag: "🇨🇳", type: "domestic", logo: leaguelogo(169) },
  { id: 179, name: "Premiership",         displayName: "Scottish Premiership", country: "Escócia", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", type: "domestic", logo: leaguelogo(179) },
  { id: 188, name: "A-League",            country: "Austrália",      flag: "🇦🇺", type: "domestic", logo: leaguelogo(188) },
  { id: 207, name: "Super League",        displayName: "Super League Suica", country: "Suica", flag: "🇨🇭", type: "domestic", logo: leaguelogo(207) },
  { id: 218, name: "Bundesliga",          displayName: "Bundesliga Austria", country: "Austria", flag: "🇦🇹", type: "domestic", logo: leaguelogo(218) },
  { id: 253, name: "MLS",                 country: "EUA",            flag: "🇺🇸", type: "domestic", logo: leaguelogo(253) },
  { id: 283, name: "Liga 1",              displayName: "Liga 1 Romania", country: "Romania", flag: "🇷🇴", type: "domestic", logo: leaguelogo(283) },
  { id: 292, name: "K League 1",          country: "Coreia do Sul",  flag: "🇰🇷", type: "domestic", logo: leaguelogo(292) },
  { id: 307, name: "Saudi Pro League",    country: "Arabia Saudita", flag: "🇸🇦", type: "domestic", logo: leaguelogo(307) },
  { id: 357, name: "League of Ireland",   country: "Irlanda",        flag: "🇮🇪", type: "domestic", logo: leaguelogo(357) },
  { id: 106, name: "Ekstraklasa",         country: "Polonia",        flag: "🇵🇱", type: "domestic", logo: leaguelogo(106) },
  { id: 113, name: "Allsvenskan",         country: "Suecia",         flag: "🇸🇪", type: "domestic", logo: leaguelogo(113) },
  { id: 103, name: "Eliteserien",         country: "Noruega",        flag: "🇳🇴", type: "domestic", logo: leaguelogo(103) },
  { id: 119, name: "Superliga",           displayName: "Superliga Dinamarca", country: "Dinamarca", flag: "🇩🇰", type: "domestic", logo: leaguelogo(119) },
];

// International league IDs from API-Football (confirmed in pre-testing, season=2025):
//   id:2   = UEFA Champions League    → 82 teams (82 is team count, NOT the league ID)
//   id:3   = UEFA Europa League       → 77 teams
//   id:848 = UEFA Conference League   → 164 teams
//   id:13  = CONMEBOL Libertadores    → 47 teams
// ID 14 (CONMEBOL Sudamericana) is intentionally EXCLUDED — returns European U19 youth
// teams (bad data confirmed across season 2024 and 2025).
export const INTERNATIONAL_LEAGUES: LeagueInfo[] = [
  { id: 2,   name: "UEFA Champions League",    country: "Europa",         flag: "🏆", type: "international", logo: leaguelogo(2) },
  { id: 3,   name: "UEFA Europa League",       country: "Europa",         flag: "🥈", type: "international", logo: leaguelogo(3) },
  { id: 848, name: "UEFA Conference League",   country: "Europa",         flag: "🥉", type: "international", logo: leaguelogo(848) },
  { id: 13,  name: "CONMEBOL Libertadores",    country: "America do Sul", flag: "🌎", type: "international", logo: leaguelogo(13) },
];

export const ALL_LEAGUES: LeagueInfo[] = [...DOMESTIC_LEAGUES, ...INTERNATIONAL_LEAGUES];

export const LEAGUE_BY_ID: Map<number, LeagueInfo> = new Map(
  ALL_LEAGUES.map((l) => [l.id, l])
);

export const APIFOOTBALL_TO_FC26_NAME: Record<string, string> = {
  "Lazio":                       "Latium",
  "Atalanta":                    "Bergamo Calcio",
  "AC Milan":                    "Milano FC",
  "Inter":                       "Lombardia FC",
  "Paris Saint Germain":         "Paris SG",
  "Tottenham":                   "Spurs",
  "Tottenham Hotspur":           "Spurs",
  "Manchester United":           "Man Utd",
  "Newcastle United":            "Newcastle Utd",
  "West Ham United":             "West Ham Utd",
  "Olympique de Marseille":      "OM",
  "Borussia Mönchengladbach":    "Borussia M'gladbach",
  "Bayer Leverkusen":            "Leverkusen",
  "Los Angeles FC":              "LAFC",
  "Atletico Madrid":             "Atlético de Madrid",
  "Atlético de Madrid":          "Atlético de Madrid",
  "SL Benfica":                  "Benfica",
  "Wolves":                      "Wolves",
};
