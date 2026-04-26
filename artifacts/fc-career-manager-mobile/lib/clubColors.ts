export interface ClubColors {
  primary: string;
  secondary: string;
}

export const CLUB_INFO: Record<string, ClubColors> = {
  "Liverpool":           { primary: "#C8102E", secondary: "#00B2A9" },
  "Real Madrid":         { primary: "#FEBE10", secondary: "#00529F" },
  "Paris SG":            { primary: "#003370", secondary: "#DA291C" },
  "Manchester City":     { primary: "#6CABDD", secondary: "#1C2C5B" },
  "FC Barcelona":        { primary: "#A50044", secondary: "#004D98" },
  "FC Bayern München":   { primary: "#DC052D", secondary: "#0066B2" },
  "Arsenal":             { primary: "#EF0107", secondary: "#9C824A" },
  "Atlético de Madrid":  { primary: "#CB3524", secondary: "#272E61" },
  "Chelsea":             { primary: "#034694", secondary: "#DBA111" },
  "Borussia Dortmund":   { primary: "#FDE100", secondary: "#000000" },
  "SSC Napoli":          { primary: "#007AC2", secondary: "#FFFFFF" },
  "Man Utd":             { primary: "#DA291C", secondary: "#000000" },
  "Manchester Utd":      { primary: "#DA291C", secondary: "#000000" },
  "Manchester United":   { primary: "#DA291C", secondary: "#000000" },
  "Galatasaray":         { primary: "#CC0000", secondary: "#FFD700" },
  "AS Roma":             { primary: "#8B0000", secondary: "#FFD700" },
  "Newcastle Utd":       { primary: "#000000", secondary: "#FFFFFF" },
  "Athletic Club":       { primary: "#EE2523", secondary: "#FFFFFF" },
  "Fenerbahçe":          { primary: "#FFD700", secondary: "#003087" },
  "Aston Villa":         { primary: "#95BFE5", secondary: "#670E36" },
  "RB Leipzig":          { primary: "#DD0741", secondary: "#1B75BB" },
  "Fiorentina":          { primary: "#6B2FA0", secondary: "#FFFFFF" },
  "Al Nassr":            { primary: "#FFD700", secondary: "#004B9D" },
  "Leverkusen":          { primary: "#E32221", secondary: "#000000" },
  "Juventus":            { primary: "#000000", secondary: "#FFFFFF" },
  "Al Hilal":            { primary: "#003DA5", secondary: "#FFFFFF" },
  "Everton":             { primary: "#003399", secondary: "#FFFFFF" },
  "Marseille":           { primary: "#009AC7", secondary: "#FFFFFF" },
  "Olympique de Marseille": { primary: "#009AC7", secondary: "#FFFFFF" },
  "FC Porto":            { primary: "#003087", secondary: "#FFF200" },
  "Real Betis":          { primary: "#00A650", secondary: "#FFFFFF" },
  "Sporting CP":         { primary: "#006600", secondary: "#FFFFFF" },
  "Ajax":                { primary: "#D2122E", secondary: "#FFFFFF" },
  "Benfica":             { primary: "#CC0000", secondary: "#FFFFFF" },
  "SL Benfica":          { primary: "#CC0000", secondary: "#FFFFFF" },
  "Villarreal CF":       { primary: "#FFC900", secondary: "#004F9F" },
  "Real Sociedad":       { primary: "#003DA5", secondary: "#FFFFFF" },
  "Sevilla FC":          { primary: "#D40000", secondary: "#FFFFFF" },
  "Celtic":              { primary: "#16A10C", secondary: "#FFFFFF" },
  "Rangers":             { primary: "#003399", secondary: "#FFFFFF" },
  "Olympique Lyonnais":  { primary: "#CC0000", secondary: "#002A5E" },
  "AS Monaco":           { primary: "#E4001B", secondary: "#FFFFFF" },
  "LOSC Lille":          { primary: "#DD0100", secondary: "#FFFFFF" },
  "Eintracht Frankfurt": { primary: "#E1001A", secondary: "#000000" },
  "VfB Stuttgart":       { primary: "#E32219", secondary: "#FFFFFF" },
  "Wolfsburg":           { primary: "#65B32E", secondary: "#FFFFFF" },
  "Werder Bremen":       { primary: "#1D6B37", secondary: "#FFFFFF" },
  "Flamengo":            { primary: "#CC0000", secondary: "#000000" },
  "Palmeiras":           { primary: "#006B2B", secondary: "#FFFFFF" },
  "Corinthians":         { primary: "#000000", secondary: "#FFFFFF" },
  "Boca Juniors":        { primary: "#003087", secondary: "#FFF200" },
  "River Plate":         { primary: "#CC0000", secondary: "#FFFFFF" },
  "Fluminense":          { primary: "#3F1F5E", secondary: "#CC0000" },
  "São Paulo":           { primary: "#CC0000", secondary: "#000000" },
  "Grêmio":              { primary: "#005BAC", secondary: "#000000" },
  "Atlético Mineiro":    { primary: "#000000", secondary: "#FFFFFF" },
  "Cruzeiro":            { primary: "#003DA5", secondary: "#FFFFFF" },
  "Santos":              { primary: "#000000", secondary: "#FFFFFF" },
  "Inter Miami CF":      { primary: "#F7B5CD", secondary: "#000000" },
  "LAFC":                { primary: "#C39E6D", secondary: "#000000" },
};

export function getClubColors(clubName: string): ClubColors {
  if (CLUB_INFO[clubName]) return CLUB_INFO[clubName];
  const key = Object.keys(CLUB_INFO).find(
    (k) => k.toLowerCase() === clubName.toLowerCase()
  );
  if (key) return CLUB_INFO[key];
  return { primary: '#8B5CF6', secondary: '#6366F1' };
}
