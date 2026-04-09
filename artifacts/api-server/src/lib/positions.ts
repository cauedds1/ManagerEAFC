// Maps English position codes (API-Football / msmc.cc) to pt-BR abbreviations
export function mapPosition(pos: string): string {
  const p = (pos ?? "").toUpperCase().trim();
  if (["GK", "GOALKEEPER", "GOL"].includes(p)) return "GOL";
  if (["LB", "RB", "LWB", "RWB", "WB", "LAT"].includes(p)) return "LAT";
  if (["CB", "SW", "CENTRE-BACK", "CENTREBACK", "DEFENDER", "ZAG"].includes(p)) return "ZAG";
  if (["CDM", "DM", "DMF", "VOL"].includes(p)) return "VOL";
  if (["LW", "LM", "PE"].includes(p)) return "PE";
  if (["RW", "RM", "PD"].includes(p)) return "PD";
  if (["CAM", "AM", "AMF", "MEI"].includes(p)) return "MEI";
  if (["CM", "MC", "MIDFIELDER"].includes(p)) return "MC";
  if (["CF", "SS", "SA"].includes(p)) return "SA";
  if (["ST", "FW", "WF", "CA"].includes(p)) return "CA";
  if (["ATTACKER", "FORWARD", "ATA"].includes(p)) return "ATA";
  return "MC";
}

/**
 * Maps API-Football team names to the exact team name used by msmc.cc (EA FC 26).
 * Only contains entries where the names differ. If a club is not in this map, its
 * API-Football name is used directly when querying msmc.cc.
 *
 * Verified against the msmc.cc API (game=fc26) on 2026-04-09.
 */
export const AF_TO_FC26: Record<string, string> = {
  // ── Premier League ────────────────────────────────────────────────────────
  "Tottenham":                   "Spurs",
  "Tottenham Hotspur":           "Spurs",
  "Manchester United":           "Manchester Utd",
  "Newcastle United":            "Newcastle",
  "Wolverhampton Wanderers":     "Wolves",
  "West Ham United":             "West Ham",
  "Brighton & Hove Albion":      "Brighton",
  "AFC Bournemouth":             "Bournemouth",
  "Nottingham Forest":           "Nottm Forest",
  "Sheffield United":            "Sheffield Utd",
  "Leeds United":                "Leeds Utd",

  // ── La Liga ───────────────────────────────────────────────────────────────
  "Atletico Madrid":             "Atlético de Madrid",
  "Atlético de Madrid":          "Atlético de Madrid",
  "Deportivo Alaves":            "Deportivo Alavés",
  "Celta de Vigo":               "Celta Vigo",
  "CD Leganes":                  "CD Leganés",

  // ── Bundesliga ────────────────────────────────────────────────────────────
  "Bayern München":              "Bayern",
  "Bayer Leverkusen":            "Leverkusen",
  "Eintracht Frankfurt":         "Frankfurt",
  "Borussia Mönchengladbach":    "Borussia M'gladbach",
  "TSG 1899 Hoffenheim":         "TSG Hoffenheim",
  "TSG Hoffenheim":              "TSG Hoffenheim",
  "1. FSV Mainz 05":             "1. FSV Mainz 05",
  "VfL Bochum 1848":             "VfL Bochum",
  "VfL Bochum":                  "VfL Bochum",
  "1. FC Heidenheim 1846":       "FC Heidenheim",
  "FC Heidenheim":               "FC Heidenheim",
  "Holstein Kiel":               "SV Holstein Kiel",
  "Union Berlin":                "1. FC Union Berlin",

  // ── 2. Bundesliga ─────────────────────────────────────────────────────────
  "FC Schalke 04":               "Schalke 04",
  "Hertha Berlin":               "Hertha BSC",
  "Fortuna Dusseldorf":          "Fortuna Düsseldorf",
  "Fortuna Düsseldorf":          "Fortuna Düsseldorf",
  "SpVgg Greuther Furth":        "SpVgg Greuther Fürth",
  "SG Dynamo Dresden":           "Dynamo Dresden",
  "1. FC Magdeburg":             "FC Magdeburg",
  "Preussen Munster":            "Preußen Münster",

  // ── Serie A ───────────────────────────────────────────────────────────────
  "AC Milan":                    "Milan",
  "Lazio":                       "Latium",       // still uses the old unlicensed name in EA FC 26
  "Atalanta":                    "Bergamo Calcio",
  // Note: "Inter" is a direct match in msmc.cc (55 results) — no entry needed.
  "US Salernitana 1919":         "US Salernitana",
  "Parma Calcio 1913":           "Parma Calcio 1913",
  "AC Monza":                    "AC Monza",

  // ── Ligue 1 ───────────────────────────────────────────────────────────────
  "Paris Saint-Germain":         "Paris SG",
  "Paris Saint Germain":         "Paris SG",
  "Olympique de Marseille":      "Marseille",
  "Olympique Lyonnais":          "Lyon",
  "OGC Nice":                    "Nice",
  "Stade Rennais FC":            "Stade Rennais",
  "RC Strasbourg Alsace":        "Strasbourg",
  "Montpellier HSC":             "Montpellier HSC",
  "FC Nantes":                   "FC Nantes",
  "Toulouse FC":                 "Toulouse FC",
  "AJ Auxerre":                  "AJ Auxerre",
  "Stade de Reims":              "Stade de Reims",
  "AS Saint-Étienne":            "AS Saint-Etienne",
  "Le Havre AC":                 "Le Havre AC",
  "Stade Brestois 29":           "Stade Brestois 29",
  "Angers SCO":                  "Angers SCO",

  // ── Eredivisie ────────────────────────────────────────────────────────────
  "PSV Eindhoven":               "PSV",
  "AZ Alkmaar":                  "AZ",

  // ── Primeira Liga ─────────────────────────────────────────────────────────
  "FC Porto":                    "Porto",
  "SL Benfica":                  "Benfica",
  "Vitoria de Guimaraes":        "Vitória SC",
  "Vitória SC":                  "Vitória SC",
  "Boavista FC":                 "Boavista FC",
  "Gil Vicente FC":              "Gil Vicente",
  "FC Famalicao":                "Famalicão",

  // ── Belgian Pro League ────────────────────────────────────────────────────
  "Standard Liege":              "Standard Liège",
  "Standard de Liege":           "Standard Liège",
  "Sint-Truidense VV":           "Sint-Truiden",
  "KAA Gent":                    "KAA Gent",

  // ── Scottish Premiership ──────────────────────────────────────────────────
  "Heart Of Midlothian":         "Heart of Midlothian",
  "Hibernian FC":                "Hibernian",
  "Motherwell FC":               "Motherwell",
  "Kilmarnock FC":               "Kilmarnock",
  "Livingston FC":               "Livingston",

  // ── Turkish Süper Lig ─────────────────────────────────────────────────────
  "Besiktas":                    "Beşiktaş",
  "Istanbul Basaksehir":         "İstanbul Başakşehir",

  // ── Saudi Pro League ─────────────────────────────────────────────────────
  "Al-Shabab":                   "Al Shabab",
  "Al-Fateh":                    "Al Fateh",
  "Al-Taawoun":                  "Al Taawoun",
  "Al-Raed":                     "Al Raed",
  "Al-Feiha":                    "Al Feiha",
  "Al-Ettifaq":                  "Al Ettifaq",
  "Al-Khaleej":                  "Al Khaleej",
  "Al-Wehda":                    "Al Wehda",
  "Al-Okhdood":                  "Al Okhdood",

  // ── Swiss Super League ────────────────────────────────────────────────────
  "Red Bull Salzburg":           "RB Salzburg",
  "FC Basel 1893":               "FC Basel",
  "FC Zurich":                   "FC Zürich",
  "Grasshopper Club Zurich":     "Grasshopper Club",

  // ── Austrian Bundesliga ───────────────────────────────────────────────────
  "SK Sturm Graz":               "SK Sturm Graz",
  "SK Rapid Wien":               "SK Rapid Wien",
  "FK Austria Wien":             "FK Austria Wien",
  "LASK Linz":                   "LASK",

  // ── Scandinavia ───────────────────────────────────────────────────────────
  "Malmo FF":                    "Malmö FF",
  "Djurgardens IF":              "Djurgårdens IF",
  "BK Hacken":                   "BK Häcken",
  "Bodo/Glimt":                  "Bodø/Glimt",
  "FK Bodo/Glimt":               "Bodø/Glimt",
  "FC Kobenhavn":                "FC København",
  "FC Copenhagen":               "FC København",
  "Brondby IF":                  "Brøndby IF",
  "FC Nordsjaelland":            "FC Nordsjælland",
  "FC Midtjylland":              "FC Midtjylland",

  // ── Polish Ekstraklasa ────────────────────────────────────────────────────
  "Lech Poznan":                 "Lech Poznań",
  "Rakow Czestochowa":           "Raków Częstochowa",
  "Jagiellonia Bialystok":       "Jagiellonia Białystok",
  "Pogon Szczecin":              "Pogoń Szczecin",

  // ── MLS ───────────────────────────────────────────────────────────────────
  "Los Angeles FC":              "LAFC",
  "DC United":                   "D.C. United",
  "Chicago Fire FC":             "Chicago Fire",
  "Houston Dynamo FC":           "Houston Dynamo",
  "Sporting Kansas City":        "Sporting KC",
  "Minnesota United FC":         "Minnesota United",
  "Vancouver Whitecaps FC":      "Vancouver Whitecaps",
  "Orlando City SC":             "Orlando City",
  "CF Montreal":                 "CF Montréal",

  // ── Argentine Liga Profesional ────────────────────────────────────────────
  "Club Atletico Independiente": "Independiente",
  "Estudiantes de La Plata":     "Estudiantes",
  "Club Atletico Lanus":         "Lanús",
  "Talleres Cordoba":            "Talleres Córdoba",
  "Velez Sarsfield":             "Vélez Sarsfield",
  "Rosario Central":             "Rosario Central",
  "Defensa Y Justicia":          "Defensa y Justicia",

  // ── Brasileirão ───────────────────────────────────────────────────────────
  "Vasco DA Gama":               "Vasco",
  "Botafogo FR":                 "Botafogo",
  "EC Bahia":                    "Bahia",
  "Fortaleza EC":                "Fortaleza",
  "Athletico Paranaense":        "Athletico-PR",
  "Cuiaba":                      "Cuiabá",
  "Red Bull Bragantino":         "Red Bull Bragantino",
  "Ceara SC":                    "Ceará SC",
  "Sport Recife":                "Sport Recife",
  "EC Vitoria":                  "Vitória",
  "Mirassol FC":                 "Mirassol",

  // ── Romanian Liga 1 ──────────────────────────────────────────────────────
  "Rapid Bucuresti":             "Rapid Bucuresti",
  "FC U Craiova":                "Universitatea Craiova",

  // ── Liga MX ───────────────────────────────────────────────────────────────
  "CF Monterrey":                "CF Monterrey",
  "Tigres UANL":                 "Tigres UANL",
  "Club Universidad Nacional":   "UNAM Pumas",
  "Santos Laguna":               "Santos Laguna",
  "Deportivo Toluca":            "Deportivo Toluca",
  "Club Leon":                   "Club León",
  "CF Pachuca":                  "CF Pachuca",
  "Mazatlan FC":                 "Mazatlán FC",

  // ── Championship (English 2nd tier) ──────────────────────────────────────
  "Queens Park Rangers":         "QPR",
  "West Bromwich":               "West Brom",
  "West Bromwich Albion":        "West Brom",
  "Portsmouth FC":               "Portsmouth",
  "Wrexham AFC":                 "Wrexham",
  "Barrow AFC":                  "Barrow",
};
