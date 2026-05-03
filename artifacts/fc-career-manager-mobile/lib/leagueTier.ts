/**
 * Maps a league display name to a coarse tier (1 = top flight, 4 = lowest)
 * used by promotion / relegation detection.  Pure function, no I/O.
 * Ported verbatim from `artifacts/fc-career-manager/src/lib/autoNewsService.ts`.
 */
export function leagueTierLevel(league: string): number {
  const l = league.toLowerCase();
  if (
    l.includes('série d') || l.includes('serie d') ||
    l.includes('quarta') ||
    l.includes('league two') || l.includes('league 2') ||
    l.includes('4. liga') || l.includes('cuarta')
  ) return 4;
  if (
    l.includes('série c') || l.includes('serie c') ||
    l.includes('terceira') ||
    l.includes('league one') || l.includes('league 1') ||
    l.includes('3. liga') || l.includes('tercera')
  ) return 3;
  if (
    l.includes('série b') || l.includes('serie b') ||
    l.includes('segunda') || l.includes('2ª divisão') || l.includes('2a divisao') ||
    l.includes('championship') ||
    l.includes('2. bundesliga') || l.includes('2.bundesliga') ||
    l.includes('ligue 2') ||
    l.includes('segunda división') || l.includes('segunda division') ||
    l.includes('laliga 2') || l.includes('la liga 2') ||
    (!l.includes('eredivisie') && l.includes('eerste divisie')) ||
    l.includes('segunda liga') ||
    l.includes('promotion league') ||
    l.includes('super lig b') ||
    l.includes('tff 1')
  ) return 2;
  return 1;
}
