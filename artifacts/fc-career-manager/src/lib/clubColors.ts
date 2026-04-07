export interface ClubColors {
  primary: string;
  secondary: string;
}

export interface ClubInfo extends ClubColors {
  league: string;
  sofifaId?: string;
}

export const CLUB_INFO: Record<string, ClubInfo> = {
  "Liverpool":        { primary: "#C8102E", secondary: "#00B2A9", league: "Premier League", sofifaId: "9" },
  "Real Madrid":      { primary: "#FEBE10", secondary: "#00529F", league: "LALIGA EA SPORTS", sofifaId: "243" },
  "Paris SG":         { primary: "#003370", secondary: "#DA291C", league: "Ligue 1 McDonald's", sofifaId: "73" },
  "Manchester City":  { primary: "#6CABDD", secondary: "#1C2C5B", league: "Premier League", sofifaId: "10" },
  "FC Barcelona":     { primary: "#A50044", secondary: "#004D98", league: "LALIGA EA SPORTS", sofifaId: "241" },
  "FC Bayern München":{ primary: "#DC052D", secondary: "#0066B2", league: "Bundesliga", sofifaId: "21" },
  "Arsenal":          { primary: "#EF0107", secondary: "#9C824A", league: "Premier League", sofifaId: "1" },
  "Atlético de Madrid":{ primary: "#CB3524", secondary: "#272E61", league: "LALIGA EA SPORTS", sofifaId: "240" },
  "Chelsea":          { primary: "#034694", secondary: "#DBA111", league: "Premier League", sofifaId: "5" },
  "Borussia Dortmund":{ primary: "#FDE100", secondary: "#000000", league: "Bundesliga", sofifaId: "22" },
  "SSC Napoli":       { primary: "#007AC2", secondary: "#FFFFFF", league: "Serie A Enilive", sofifaId: "48" },
  "Man Utd":          { primary: "#DA291C", secondary: "#000000", league: "Premier League", sofifaId: "11" },
  "Galatasaray":      { primary: "#CC0000", secondary: "#FFD700", league: "Trendyol Süper Lig", sofifaId: "174" },
  "AS Roma":          { primary: "#8B0000", secondary: "#FFD700", league: "Serie A Enilive", sofifaId: "42" },
  "Newcastle Utd":    { primary: "#000000", secondary: "#FFFFFF", league: "Premier League", sofifaId: "23" },
  "Athletic Club":    { primary: "#EE2523", secondary: "#FFFFFF", league: "LALIGA EA SPORTS", sofifaId: "237" },
  "Fenerbahçe":       { primary: "#FFD700", secondary: "#003087", league: "Trendyol Süper Lig", sofifaId: "178" },
  "Aston Villa":      { primary: "#95BFE5", secondary: "#670E36", league: "Premier League", sofifaId: "2" },
  "Al Ittihad":       { primary: "#000000", secondary: "#FFD700", league: "ROSHN Saudi League", sofifaId: "74" },
  "RB Leipzig":       { primary: "#DD0741", secondary: "#1B75BB", league: "Bundesliga", sofifaId: "114153" },
  "Fiorentina":       { primary: "#6B2FA0", secondary: "#FFFFFF", league: "Serie A Enilive", sofifaId: "68" },
  "Al Nassr":         { primary: "#FFD700", secondary: "#004B9D", league: "ROSHN Saudi League", sofifaId: "1772" },
  "Leverkusen":       { primary: "#E32221", secondary: "#000000", league: "Bundesliga", sofifaId: "25" },
  "Juventus":         { primary: "#000000", secondary: "#FFFFFF", league: "Serie A Enilive", sofifaId: "45" },
  "Al Hilal":         { primary: "#003DA5", secondary: "#FFFFFF", league: "ROSHN Saudi League", sofifaId: "1797" },
  "Everton":          { primary: "#003399", secondary: "#FFFFFF", league: "Premier League", sofifaId: "7" },
  "OM":               { primary: "#009AC7", secondary: "#FFFFFF", league: "Ligue 1 McDonald's", sofifaId: "76" },
  "Latium":           { primary: "#87CEEB", secondary: "#FFFFFF", league: "Serie A Enilive", sofifaId: "47" },
  "Spurs":            { primary: "#132257", secondary: "#FFFFFF", league: "Premier League", sofifaId: "6" },
  "FC Porto":         { primary: "#003087", secondary: "#FFF200", league: "Liga Portugal", sofifaId: "229" },
  "Bergamo Calcio":   { primary: "#1C60A2", secondary: "#000000", league: "Serie A Enilive", sofifaId: "2687" },
  "Real Betis":       { primary: "#00A650", secondary: "#FFFFFF", league: "LALIGA EA SPORTS", sofifaId: "244" },
  "Al Ahli":          { primary: "#CC0000", secondary: "#FFFFFF", league: "ROSHN Saudi League", sofifaId: "112636" },
  "Sporting CP":      { primary: "#006600", secondary: "#FFFFFF", league: "Liga Portugal", sofifaId: "228" },
  "Sunderland":       { primary: "#CC0000", secondary: "#000000", league: "EFL Championship", sofifaId: "394" },
  "LAFC":             { primary: "#C39E6D", secondary: "#000000", league: "MLS", sofifaId: "112609" },
  "Inter Miami CF":   { primary: "#F7B5CD", secondary: "#000000", league: "MLS", sofifaId: "112625" },
  "Lombarida FC":     { primary: "#010E80", secondary: "#000000", league: "Serie A Enilive" },
  "Lombardia FC":     { primary: "#010E80", secondary: "#000000", league: "Serie A Enilive" },
  "Milano FC":        { primary: "#FB090B", secondary: "#000000", league: "Serie A Enilive" },
  "Ajax":             { primary: "#D2122E", secondary: "#FFFFFF", league: "Eredivisie", sofifaId: "139" },
  "Benfica":          { primary: "#CC0000", secondary: "#FFFFFF", league: "Liga Portugal", sofifaId: "1792" },
  "SL Benfica":       { primary: "#CC0000", secondary: "#FFFFFF", league: "Liga Portugal", sofifaId: "1792" },
  "Villarreal CF":    { primary: "#FFC900", secondary: "#004F9F", league: "LALIGA EA SPORTS", sofifaId: "449" },
  "Real Sociedad":    { primary: "#003DA5", secondary: "#FFFFFF", league: "LALIGA EA SPORTS", sofifaId: "1049" },
  "Sevilla FC":       { primary: "#D40000", secondary: "#FFFFFF", league: "LALIGA EA SPORTS", sofifaId: "481" },
  "Valencia CF":      { primary: "#F47920", secondary: "#000000", league: "LALIGA EA SPORTS", sofifaId: "1049" },
  "Celtic":           { primary: "#16A10C", secondary: "#FFFFFF", league: "Scottish Prem", sofifaId: "2566" },
  "Rangers":          { primary: "#003399", secondary: "#FFFFFF", league: "Scottish Prem", sofifaId: "543" },
  "Club Brugge":      { primary: "#003893", secondary: "#000000", league: "1A Pro League", sofifaId: "2282" },
  "Anderlecht":       { primary: "#6B2D8B", secondary: "#FFFFFF", league: "1A Pro League", sofifaId: "244" },
  "Olympique Lyonnais":{ primary: "#CC0000", secondary: "#002A5E", league: "Ligue 1 McDonald's", sofifaId: "80" },
  "AS Monaco":        { primary: "#E4001B", secondary: "#FFFFFF", league: "Ligue 1 McDonald's", sofifaId: "53" },
  "LOSC Lille":       { primary: "#DD0100", secondary: "#FFFFFF", league: "Ligue 1 McDonald's", sofifaId: "141" },
  "Eintracht Frankfurt":{ primary: "#E1001A", secondary: "#000000", league: "Bundesliga", sofifaId: "26" },
  "VfB Stuttgart":    { primary: "#E32219", secondary: "#FFFFFF", league: "Bundesliga", sofifaId: "32" },
  "Wolfsburg":        { primary: "#65B32E", secondary: "#FFFFFF", league: "Bundesliga", sofifaId: "27" },
  "Borussia M'gladbach":{ primary: "#000000", secondary: "#FFFFFF", league: "Bundesliga", sofifaId: "29" },
  "Werder Bremen":    { primary: "#1D6B37", secondary: "#FFFFFF", league: "Bundesliga", sofifaId: "31" },
  "Flamengo":         { primary: "#CC0000", secondary: "#000000", league: "Libertadores" },
  "Palmeiras":        { primary: "#006B2B", secondary: "#FFFFFF", league: "Libertadores" },
  "Corinthians":      { primary: "#000000", secondary: "#FFFFFF", league: "Libertadores" },
  "Boca Juniors":     { primary: "#003087", secondary: "#FFF200", league: "Libertadores" },
  "River Plate":      { primary: "#CC0000", secondary: "#FFFFFF", league: "Libertadores" },
  "Fluminense":       { primary: "#3F1F5E", secondary: "#CC0000", league: "Libertadores" },
  "Internacional":    { primary: "#C4001A", secondary: "#FFFFFF", league: "Libertadores" },
  "Grêmio":           { primary: "#009EE3", secondary: "#000000", league: "Libertadores" },
  "São Paulo":        { primary: "#CC0000", secondary: "#FFFFFF", league: "Libertadores" },
  "Atlético Mineiro": { primary: "#000000", secondary: "#FFFFFF", league: "Libertadores" },
  "Santos":           { primary: "#000000", secondary: "#FFFFFF", league: "Libertadores" },
  "Peñarol":          { primary: "#FFC900", secondary: "#000000", league: "Sudamericana" },
  "Nacional":         { primary: "#CC0000", secondary: "#FFFFFF", league: "Sudamericana" },
  "Club América":     { primary: "#FFD700", secondary: "#001a00", league: "Liga MX" },
  "Chivas":           { primary: "#CC0000", secondary: "#003DA5", league: "Liga MX" },
  "Cruz Azul":        { primary: "#1C60A2", secondary: "#FFFFFF", league: "Liga MX" },
  "LA Galaxy":        { primary: "#003087", secondary: "#FFD700", league: "MLS", sofifaId: "1068" },
  "Seattle Sounders": { primary: "#5D9B3F", secondary: "#003DA5", league: "MLS" },
  "Portland Timbers": { primary: "#004812", secondary: "#EBE72B", league: "MLS" },
  "Atlanta United":   { primary: "#80000A", secondary: "#FFFFFF", league: "MLS" },
  "New York City FC": { primary: "#6CABDD", secondary: "#003DA5", league: "MLS" },
  "West Ham Utd":     { primary: "#7A263A", secondary: "#1BB1E7", league: "Premier League", sofifaId: "37" },
  "Leicester City":   { primary: "#003090", secondary: "#FDBE11", league: "EFL Championship", sofifaId: "13" },
  "Wolves":           { primary: "#FDB913", secondary: "#231F20", league: "Premier League", sofifaId: "38" },
  "Brighton":         { primary: "#005DAA", secondary: "#FFFFFF", league: "Premier League", sofifaId: "405" },
  "Fulham":           { primary: "#CC0000", secondary: "#FFFFFF", league: "Premier League", sofifaId: "50" },
  "Brentford":        { primary: "#CC0000", secondary: "#FFFFFF", league: "Premier League", sofifaId: "101" },
  "Crystal Palace":   { primary: "#1B458F", secondary: "#A7A5A6", league: "Premier League", sofifaId: "8" },
  "Middlesbrough":    { primary: "#CC0000", secondary: "#FFFFFF", league: "EFL Championship", sofifaId: "76" },
  "Leeds Utd":        { primary: "#FFFFFF", secondary: "#FFCD00", league: "EFL Championship", sofifaId: "110" },
};

export const DEFAULT_FALLBACK_COLORS: ClubColors = {
  primary: "#1a1a2e",
  secondary: "#16213e",
};

export function getClubInfo(clubName: string): ClubInfo | null {
  if (!clubName) return null;
  if (CLUB_INFO[clubName]) return CLUB_INFO[clubName];

  const lower = clubName.toLowerCase();
  for (const [key, info] of Object.entries(CLUB_INFO)) {
    if (key.toLowerCase() === lower) return info;
  }
  for (const [key, info] of Object.entries(CLUB_INFO)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return info;
    }
  }
  return null;
}

export function getClubColors(clubName: string): ClubColors | null {
  const info = getClubInfo(clubName);
  if (!info) return null;
  return { primary: info.primary, secondary: info.secondary };
}

export function getSofifaTeamUrl(sofifaId: string): string {
  return `https://cdn.sofifa.net/teams/${sofifaId}/light_60.png`;
}
