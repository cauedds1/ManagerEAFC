export interface LeagueInfo {
  id: number;
  name: string;
  displayName?: string;
  country: string;
  flag: string;
  type: "domestic" | "international";
  logo: string;
}

const _leagueLogoOverrides = new Map<number, string>();

/**
 * Returns the logo URL for a given league.
 * Uses R2 URL when available (populated by prefetchLeagueLogos), falls back to api-sports.io.
 */
export function getLeagueLogoUrl(leagueId: number): string {
  return _leagueLogoOverrides.get(leagueId) ?? `https://media.api-sports.io/football/leagues/${leagueId}.png`;
}

/**
 * Fetches league logo URLs from the backend (prefers R2 when configured) and caches them.
 * Also updates the `logo` field in ALL_LEAGUES in-place so components that reference the
 * static arrays will pick up R2 URLs on their next render.
 * Safe to call multiple times — subsequent calls are no-ops if already loaded.
 * Fire-and-forget from app startup; display never blocks on this.
 */
export async function prefetchLeagueLogos(apiBase = "/api"): Promise<void> {
  if (_leagueLogoOverrides.size > 0) return;
  try {
    const res = await fetch(`${apiBase}/league-logos`);
    if (!res.ok) return;
    const map = (await res.json()) as Record<string, string>;
    for (const [idStr, url] of Object.entries(map)) {
      const id = Number(idStr);
      if (id && url) _leagueLogoOverrides.set(id, url);
    }
    for (const league of ALL_LEAGUES) {
      const override = _leagueLogoOverrides.get(league.id);
      if (override) league.logo = override;
    }
  } catch {
    // Silently ignore — app works fine with api-sports.io fallback URLs
  }
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
  { id: 141, name: "LaLiga 2",            country: "Espanha",        flag: "🇪🇸", type: "domestic", logo: leaguelogo(141) },
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
  // ── Serie A ───────────────────────────────────────────────────────────────
  "Lazio":                       "Latium",          // ainda usa nome genérico no EA FC 26
  "Atalanta":                    "Bergamo Calcio",
  "AC Milan":                    "Milan",            // licença real no EA FC 26
  // "Inter" é match direto em msmc.cc (sem mapeamento necessário)
  // ── Ligue 1 ───────────────────────────────────────────────────────────────
  "Paris Saint Germain":         "Paris SG",
  "Paris Saint-Germain":         "Paris SG",
  "Olympique de Marseille":      "Marseille",
  "Olympique Lyonnais":          "Lyon",
  "OGC Nice":                    "Nice",
  "Stade Rennais FC":            "Stade Rennais",
  "RC Strasbourg Alsace":        "Strasbourg",
  "AS Saint-Étienne":            "AS Saint-Etienne",
  // ── Premier League ────────────────────────────────────────────────────────
  "Tottenham":                   "Spurs",
  "Tottenham Hotspur":           "Spurs",
  "Manchester United":           "Manchester Utd",
  "Newcastle United":            "Newcastle",
  "West Ham United":             "West Ham",
  "West Ham":                    "West Ham",
  "Wolverhampton Wanderers":     "Wolves",
  "Wolves":                      "Wolves",
  "AFC Bournemouth":             "Bournemouth",
  "Brighton & Hove Albion":      "Brighton",
  "Nottingham Forest":           "Nottm Forest",
  "Sheffield United":            "Sheffield Utd",
  "Leeds United":                "Leeds Utd",
  "Leicester":                   "Leicester City",
  // ── Bundesliga ────────────────────────────────────────────────────────────
  "Bayern München":              "Bayern",
  "Bayer Leverkusen":            "Leverkusen",
  "Eintracht Frankfurt":         "Frankfurt",
  "Borussia Mönchengladbach":    "Borussia M'gladbach",
  "Union Berlin":                "1. FC Union Berlin",
  "SC Freiburg":                 "SC Freiburg",
  "FC Augsburg":                 "FC Augsburg",
  // ── La Liga ───────────────────────────────────────────────────────────────
  "Atletico Madrid":             "Atlético de Madrid",
  "Atlético de Madrid":          "Atlético de Madrid",
  // ── Eredivisie ────────────────────────────────────────────────────────────
  "PSV Eindhoven":               "PSV",
  "AZ Alkmaar":                  "AZ",
  // ── Primeira Liga ─────────────────────────────────────────────────────────
  "SL Benfica":                  "Benfica",
  "Los Angeles FC":              "LAFC",
  "Vasco DA Gama":               "Vasco",
  "Botafogo FR":                 "Botafogo",
  "Cruzeiro":                    "Cruzeiro",
  "EC Bahia":                    "Bahia",
  "Fortaleza EC":                "Fortaleza",
  "Celta de Vigo":               "Celta Vigo",
  "Derby County":                "Derby County",
  "Derby":                       "Derby County",
  "Stoke City":                  "Stoke City",
  "Coventry City":               "Coventry City",
  "Blackburn Rovers":            "Blackburn Rovers",
  "Swansea City":                "Swansea City",
  "Bristol City":                "Bristol City",
  "Queens Park Rangers":         "QPR",
  "West Bromwich":               "West Brom",
  "West Bromwich Albion":        "West Brom",
  "Hull City":                   "Hull City",
  "Preston North End":           "Preston North End",
  "Plymouth Argyle":             "Plymouth Argyle",
  "Cardiff City":                "Cardiff City",
  "Sheffield Wednesday":         "Sheffield Wednesday",
  "Portsmouth FC":               "Portsmouth",
  "Oxford United":               "Oxford United",
  "Birmingham City":             "Birmingham City",
  "Wigan Athletic":              "Wigan Athletic",
  "Bolton Wanderers":            "Bolton Wanderers",
  "Charlton Athletic":           "Charlton Athletic",
  "Peterborough United":         "Peterborough United",
  "Cambridge United":            "Cambridge United",
  "Huddersfield Town":           "Huddersfield Town",
  "Rotherham United":            "Rotherham United",
  "Wycombe Wanderers":           "Wycombe Wanderers",
  "Exeter City":                 "Exeter City",
  "Northampton Town":            "Northampton Town",
  "Shrewsbury Town":             "Shrewsbury Town",
  "Fleetwood Town":              "Fleetwood Town",
  "Burton Albion":               "Burton Albion",
  "Mansfield Town":              "Mansfield Town",
  "Stockport County":            "Stockport County",
  "Doncaster Rovers":            "Doncaster Rovers",
  "Crewe Alexandra":             "Crewe Alexandra",
  "Crawley Town":                "Crawley Town",
  "Newport County":              "Newport County",
  "Tranmere Rovers":             "Tranmere Rovers",
  "Harrogate Town":              "Harrogate Town",
  "Accrington Stanley":          "Accrington Stanley",
  "Colchester United":           "Colchester United",
  "Barrow AFC":                  "Barrow",
  "Sutton United":               "Sutton United",
  "Wrexham AFC":                 "Wrexham",

  // 2. Bundesliga
  "Hamburger SV":                "Hamburger SV",
  "FC Schalke 04":               "Schalke 04",
  "Hertha Berlin":               "Hertha BSC",
  "1. FC Nürnberg":              "1. FC Nürnberg",
  "Fortuna Dusseldorf":          "Fortuna Düsseldorf",
  "Fortuna Düsseldorf":          "Fortuna Düsseldorf",
  "SC Paderborn 07":             "SC Paderborn 07",
  "1. FC Kaiserslautern":        "1. FC Kaiserslautern",
  "Karlsruher SC":               "Karlsruher SC",
  "SV Darmstadt 98":             "SV Darmstadt 98",
  "SpVgg Greuther Furth":        "SpVgg Greuther Fürth",
  "Dynamo Dresden":              "Dynamo Dresden",
  "SG Dynamo Dresden":           "Dynamo Dresden",
  "1. FC Magdeburg":             "FC Magdeburg",
  "Eintracht Braunschweig":      "Eintracht Braunschweig",
  "SV Elversberg":               "SV Elversberg",
  "SSV Ulm 1846":                "SSV Ulm 1846",
  "Preussen Munster":            "Preußen Münster",
  "Jahn Regensburg":             "Jahn Regensburg",

  // Ligue 1
  "Stade de Reims":              "Stade de Reims",
  "Montpellier HSC":             "Montpellier HSC",
  "FC Nantes":                   "FC Nantes",
  "Toulouse FC":                 "Toulouse FC",
  "AJ Auxerre":                  "AJ Auxerre",
  "Angers SCO":                  "Angers SCO",
  "Le Havre AC":                 "Le Havre AC",
  "Stade Brestois 29":           "Stade Brestois 29",

  // Serie A
  "Hellas Verona":               "Hellas Verona",
  "US Lecce":                    "US Lecce",
  "Venezia FC":                  "Venezia FC",
  "Como 1907":                   "Como 1907",
  "AC Monza":                    "AC Monza",
  "US Salernitana 1919":         "US Salernitana",
  "Parma Calcio 1913":           "Parma Calcio 1913",

  // LaLiga
  "Deportivo Alaves":            "Deportivo Alavés",
  "CA Osasuna":                  "CA Osasuna",
  "Getafe CF":                   "Getafe CF",
  "Rayo Vallecano":              "Rayo Vallecano",
  "UD Las Palmas":               "UD Las Palmas",
  "Cadiz CF":                    "Cádiz CF",
  "Real Valladolid":             "Real Valladolid",
  "RCD Espanyol":                "RCD Espanyol",
  "CD Leganes":                  "CD Leganés",

  // Eredivisie
  "FC Twente":                   "FC Twente",
  "FC Utrecht":                  "FC Utrecht",
  "SC Heerenveen":               "SC Heerenveen",
  "FC Groningen":                "FC Groningen",
  "Sparta Rotterdam":            "Sparta Rotterdam",
  "NEC Nijmegen":                "NEC Nijmegen",
  "Go Ahead Eagles":             "Go Ahead Eagles",
  "Heracles Almelo":             "Heracles Almelo",
  "RKC Waalwijk":                "RKC Waalwijk",
  "Fortuna Sittard":             "Fortuna Sittard",
  "PEC Zwolle":                  "PEC Zwolle",
  "Almere City FC":              "Almere City FC",
  "NAC Breda":                   "NAC Breda",

  // Liga Portugal
  "Vitoria de Guimaraes":        "Vitória SC",
  "Vitória SC":                  "Vitória SC",
  "Boavista FC":                 "Boavista FC",
  "Gil Vicente FC":              "Gil Vicente",
  "Moreirense FC":               "Moreirense",
  "FC Famalicao":                "Famalicão",
  "Rio Ave FC":                  "Rio Ave FC",
  "Casa Pia AC":                 "Casa Pia AC",
  "Estoril Praia":               "Estoril Praia",
  "FC Arouca":                   "FC Arouca",
  "CD Nacional":                 "CD Nacional",
  "Estrela Amadora":             "Estrela Amadora",
  "FC Vizela":                   "FC Vizela",
  "Santa Clara":                 "Santa Clara",

  // Belgian Pro League
  "KRC Genk":                    "KRC Genk",
  "Standard Liege":              "Standard Liège",
  "Standard de Liege":           "Standard Liège",
  "KAA Gent":                    "KAA Gent",
  "Royal Antwerp FC":            "Royal Antwerp FC",
  "Union Saint-Gilloise":        "Union Saint-Gilloise",
  "Cercle Brugge":               "Cercle Brugge",
  "KV Mechelen":                 "KV Mechelen",
  "OH Leuven":                   "OH Leuven",
  "Sporting Charleroi":          "Sporting Charleroi",
  "Sint-Truidense VV":           "Sint-Truiden",
  "KV Kortrijk":                 "KV Kortrijk",

  // Scottish Premiership
  "Heart Of Midlothian":         "Heart of Midlothian",
  "Hibernian FC":                "Hibernian",
  "Dundee United":               "Dundee United",
  "Dundee FC":                   "Dundee FC",
  "Motherwell FC":               "Motherwell",
  "St Mirren":                   "St Mirren",
  "Kilmarnock FC":               "Kilmarnock",
  "Ross County":                 "Ross County",
  "St Johnstone":                "St Johnstone",
  "Livingston FC":               "Livingston",

  // Turkish Süper Lig
  "Besiktas":                    "Beşiktaş",
  "Istanbul Basaksehir":         "İstanbul Başakşehir",
  "Adana Demirspor":             "Adana Demirspor",

  // Saudi Pro League
  "Al-Shabab":                   "Al Shabab",
  "Al-Fateh":                    "Al Fateh",
  "Al-Taawoun":                  "Al Taawoun",
  "Al-Raed":                     "Al Raed",
  "Al-Feiha":                    "Al Feiha",
  "Al-Ettifaq":                  "Al Ettifaq",
  "Al-Khaleej":                  "Al Khaleej",
  "Al-Wehda":                    "Al Wehda",
  "Al-Okhdood":                  "Al Okhdood",

  // Argentine
  "Racing Club":                 "Racing Club",
  "Club Atletico Independiente": "Independiente",
  "San Lorenzo":                 "San Lorenzo",
  "Velez Sarsfield":             "Vélez Sarsfield",
  "Rosario Central":             "Rosario Central",
  "Newell's Old Boys":           "Newell's Old Boys",
  "Estudiantes de La Plata":     "Estudiantes",
  "Club Atletico Lanus":         "Lanús",
  "Talleres Cordoba":            "Talleres Córdoba",
  "Defensa Y Justicia":          "Defensa y Justicia",
  "Argentinos Juniors":          "Argentinos Juniors",
  "Godoy Cruz":                  "Godoy Cruz",

  // Swiss Super League
  "BSC Young Boys":              "BSC Young Boys",
  "FC Basel 1893":               "FC Basel",
  "FC Zurich":                   "FC Zürich",
  "Grasshopper Club Zurich":     "Grasshopper Club",
  "FC Lugano":                   "FC Lugano",
  "FC Luzern":                   "FC Luzern",
  "Servette FC":                 "Servette FC",
  "FC St. Gallen":               "FC St. Gallen",
  "FC Sion":                     "FC Sion",
  "FC Winterthur":               "FC Winterthur",

  // Austrian Bundesliga
  "Red Bull Salzburg":           "RB Salzburg",
  "SK Sturm Graz":               "SK Sturm Graz",
  "SK Rapid Wien":               "SK Rapid Wien",
  "FK Austria Wien":             "FK Austria Wien",
  "LASK Linz":                   "LASK",
  "Wolfsberger AC":              "Wolfsberger AC",
  "TSV Hartberg":                "TSV Hartberg",
  "SCR Altach":                  "SCR Altach",
  "WSG Tirol":                   "WSG Tirol",
  "SV Ried":                     "SV Ried",
  "Blau-Weiß Linz":             "Blau-Weiß Linz",
  "Grazer AK 1902":              "Grazer AK",

  // Scandinavia
  "Malmo FF":                    "Malmö FF",
  "Djurgardens IF":              "Djurgårdens IF",
  "IF Elfsborg":                 "IF Elfsborg",
  "Hammarby IF":                 "Hammarby IF",
  "BK Hacken":                   "BK Häcken",
  "Bodo/Glimt":                  "Bodø/Glimt",
  "FK Bodo/Glimt":               "Bodø/Glimt",
  "Molde FK":                    "Molde FK",
  "Viking FK":                   "Viking FK",
  "FC Kobenhavn":                "FC København",
  "FC Copenhagen":               "FC København",
  "FC Midtjylland":              "FC Midtjylland",
  "Brondby IF":                  "Brøndby IF",
  "FC Nordsjaelland":            "FC Nordsjælland",

  // Polish Ekstraklasa
  "Legia Warszawa":              "Legia Warszawa",
  "Lech Poznan":                 "Lech Poznań",
  "Rakow Czestochowa":           "Raków Częstochowa",
  "Jagiellonia Bialystok":       "Jagiellonia Białystok",
  "Pogon Szczecin":              "Pogoń Szczecin",

  // MLS
  "New York Red Bulls":          "New York Red Bulls",
  "Columbus Crew":               "Columbus Crew",
  "Toronto FC":                  "Toronto FC",
  "CF Montreal":                 "CF Montréal",
  "Philadelphia Union":          "Philadelphia Union",
  "DC United":                   "D.C. United",
  "Chicago Fire FC":             "Chicago Fire",
  "Nashville SC":                "Nashville SC",
  "Charlotte FC":                "Charlotte FC",
  "Austin FC":                   "Austin FC",
  "Houston Dynamo FC":           "Houston Dynamo",
  "FC Dallas":                   "FC Dallas",
  "Colorado Rapids":             "Colorado Rapids",
  "Real Salt Lake":              "Real Salt Lake",
  "Sporting Kansas City":        "Sporting KC",
  "Minnesota United FC":         "Minnesota United",
  "San Jose Earthquakes":        "San Jose Earthquakes",
  "Vancouver Whitecaps FC":      "Vancouver Whitecaps",
  "Orlando City SC":             "Orlando City",
  "St. Louis City SC":           "St. Louis City SC",
  "FC Cincinnati":               "FC Cincinnati",

  // Brasileirão
  "Athletico Paranaense":        "Athletico-PR",
  "Cuiaba":                      "Cuiabá",
  "Red Bull Bragantino":         "Red Bull Bragantino",
  "Ceara SC":                    "Ceará SC",
  "Sport Recife":                "Sport Recife",
  "EC Vitoria":                  "Vitória",
  "Mirassol FC":                 "Mirassol",

  // Romanian Liga 1
  "FCSB":                        "FCSB",
  "CFR Cluj":                    "CFR Cluj",
  "Rapid Bucuresti":             "Rapid Bucuresti",
  "FC U Craiova":                "Universitatea Craiova",

  // Liga MX
  "CF Monterrey":                "CF Monterrey",
  "Tigres UANL":                 "Tigres UANL",
  "Club Universidad Nacional":   "UNAM Pumas",
  "Santos Laguna":               "Santos Laguna",
  "Deportivo Toluca":            "Deportivo Toluca",
  "Club Leon":                   "Club León",
  "CF Pachuca":                  "CF Pachuca",
  "Puebla FC":                   "Puebla FC",
  "Mazatlan FC":                 "Mazatlán FC",

  // Bundesliga (remaining)
  "1. FSV Mainz 05":             "1. FSV Mainz 05",
  "TSG 1899 Hoffenheim":         "TSG Hoffenheim",
  "TSG Hoffenheim":              "TSG Hoffenheim",
  "1. FC Heidenheim 1846":       "FC Heidenheim",
  "FC Heidenheim":               "FC Heidenheim",
  "VfL Bochum 1848":             "VfL Bochum",
  "VfL Bochum":                  "VfL Bochum",
  "Holstein Kiel":               "SV Holstein Kiel",
};
