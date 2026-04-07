export interface LeagueInfo {
  id: number;
  name: string;
  displayName?: string;
  country: string;
  flag: string;
  type: "domestic" | "international";
}

export const DOMESTIC_LEAGUES: LeagueInfo[] = [
  { id: 39,  name: "Premier League",      country: "Inglaterra",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", type: "domestic" },
  { id: 40,  name: "Championship",        country: "Inglaterra",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", type: "domestic" },
  { id: 41,  name: "League One",          country: "Inglaterra",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", type: "domestic" },
  { id: 42,  name: "League Two",          country: "Inglaterra",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", type: "domestic" },
  { id: 78,  name: "Bundesliga",          country: "Alemanha",       flag: "🇩🇪", type: "domestic" },
  { id: 79,  name: "2. Bundesliga",       country: "Alemanha",       flag: "🇩🇪", type: "domestic" },
  { id: 61,  name: "Ligue 1",             country: "França",         flag: "🇫🇷", type: "domestic" },
  { id: 135, name: "Serie A",             country: "Itália",         flag: "🇮🇹", type: "domestic" },
  { id: 140, name: "LaLiga",              country: "Espanha",        flag: "🇪🇸", type: "domestic" },
  { id: 88,  name: "Eredivisie",          country: "Holanda",        flag: "🇳🇱", type: "domestic" },
  { id: 94,  name: "Liga Portugal",       country: "Portugal",       flag: "🇵🇹", type: "domestic" },
  { id: 128, name: "Liga Profesional",    country: "Argentina",      flag: "🇦🇷", type: "domestic" },
  { id: 144, name: "Pro League",          displayName: "Belgian Pro League", country: "Bélgica", flag: "🇧🇪", type: "domestic" },
  { id: 169, name: "Super League",        displayName: "Chinese Super League", country: "China", flag: "🇨🇳", type: "domestic" },
  { id: 179, name: "Premiership",         displayName: "Scottish Premiership", country: "Escócia", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", type: "domestic" },
  { id: 188, name: "A-League",            country: "Austrália",      flag: "🇦🇺", type: "domestic" },
  { id: 207, name: "Super League",        displayName: "Super League Suíça", country: "Suíça", flag: "🇨🇭", type: "domestic" },
  { id: 218, name: "Bundesliga",          displayName: "Bundesliga Áustria", country: "Áustria", flag: "🇦🇹", type: "domestic" },
  { id: 253, name: "MLS",                 country: "EUA",            flag: "🇺🇸", type: "domestic" },
  { id: 283, name: "Liga 1",              displayName: "Liga 1 Romênia", country: "Romênia", flag: "🇷🇴", type: "domestic" },
  { id: 292, name: "K League 1",          country: "Coreia do Sul",  flag: "🇰🇷", type: "domestic" },
  { id: 307, name: "Saudi Pro League",    country: "Arábia Saudita", flag: "🇸🇦", type: "domestic" },
  { id: 357, name: "League of Ireland",   country: "Irlanda",        flag: "🇮🇪", type: "domestic" },
  { id: 106, name: "Ekstraklasa",         country: "Polônia",        flag: "🇵🇱", type: "domestic" },
  { id: 113, name: "Allsvenskan",         country: "Suécia",         flag: "🇸🇪", type: "domestic" },
  { id: 103, name: "Eliteserien",         country: "Noruega",        flag: "🇳🇴", type: "domestic" },
  { id: 119, name: "Superliga",           displayName: "Superliga Dinamarca", country: "Dinamarca", flag: "🇩🇰", type: "domestic" },
];

export const INTERNATIONAL_LEAGUES: LeagueInfo[] = [
  { id: 2,   name: "UEFA Champions League",    country: "Europa",        flag: "🏆", type: "international" },
  { id: 3,   name: "UEFA Europa League",       country: "Europa",        flag: "🥈", type: "international" },
  { id: 848, name: "UEFA Conference League",   country: "Europa",        flag: "🥉", type: "international" },
  { id: 13,  name: "CONMEBOL Libertadores",    country: "América do Sul", flag: "🌎", type: "international" },
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
