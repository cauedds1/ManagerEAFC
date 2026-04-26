import { getApiUrl } from './api';

export interface TrophyEntry {
  label: string;
  slug: string | null;
  aliases: string[];
}

export const TROPHY_ENTRIES: TrophyEntry[] = [
  { label: "UEFA Champions League", slug: "champions-league.png", aliases: ["champions league", "liga dos campeoes", "liga dos campeões", "ucl", "champions"] },
  { label: "UEFA Europa League", slug: "europa-league.png", aliases: ["europa league", "liga europa", "uel", "europa"] },
  { label: "UEFA Conference League", slug: "conference-league.png", aliases: ["conference league", "uecl", "liga conferencia", "conference"] },
  { label: "Premier League", slug: "premier-league.png", aliases: ["premier league", "epl", "premier", "england first division", "liga inglesa"] },
  { label: "FA Cup", slug: "fa-cup.png", aliases: ["fa cup", "copa fa", "copa da fa", "copa de inglaterra", "copa da inglaterra"] },
  { label: "Carabao Cup", slug: "carabao-cup.png", aliases: ["carabao cup", "efl cup", "league cup", "copa da liga inglesa"] },
  { label: "FA Community Shield", slug: "community-shield.png", aliases: ["community shield", "fa community shield", "charity shield"] },
  { label: "EFL Championship", slug: "efl-championship.png", aliases: ["efl championship", "championship", "segunda divisao inglesa", "segunda divisão inglesa"] },
  { label: "EFL League One", slug: "efl-league-one.png", aliases: ["efl league one", "league one"] },
  { label: "EFL League Two", slug: "efl-league-two.png", aliases: ["efl league two", "league two"] },
  { label: "EFL Trophy", slug: "efl-trophy.png", aliases: ["efl trophy", "papa john", "papa john's trophy"] },
  { label: "Scottish Premiership", slug: "scottish-premiership.png", aliases: ["scottish premiership", "scottish premier league", "liga escocesa"] },
  { label: "Scottish Cup", slug: "scottish-cup.png", aliases: ["scottish cup", "copa escocesa", "copa da escocia"] },
  { label: "Scottish League Cup", slug: "scottish-league-cup.png", aliases: ["scottish league cup", "copa da liga escocesa", "viaplay cup"] },
  { label: "La Liga", slug: "la-liga.png", aliases: ["la liga", "laliga", "liga espanhola", "primera division espanhola"] },
  { label: "Copa del Rey", slug: "copa-del-rey.png", aliases: ["copa del rey", "copa do rei", "copa da espanha", "copa de espana"] },
  { label: "Supercopa de España", slug: "supercopa-espana.png", aliases: ["supercopa de espana", "supercopa de españa", "supercopa espanha"] },
  { label: "La Liga 2", slug: "la-liga-2.png", aliases: ["la liga 2", "segunda division", "segunda división"] },
  { label: "Bundesliga", slug: "bundesliga.png", aliases: ["bundesliga", "liga alema", "liga alemã", "1. bundesliga"] },
  { label: "DFB-Pokal", slug: "dfb-pokal.png", aliases: ["dfb-pokal", "dfb pokal", "copa da alemanha", "german cup"] },
  { label: "Serie A", slug: "serie-a.png", aliases: ["serie a", "serie a italia", "liga italiana", "campeonato italiano"] },
  { label: "Coppa Italia", slug: "coppa-italia.png", aliases: ["coppa italia", "copa da italia", "copa italiana", "italian cup"] },
  { label: "Supercoppa Italiana", slug: "supercoppa-italiana.png", aliases: ["supercoppa italiana", "supercoppa", "supercopa italiana"] },
  { label: "Ligue 1", slug: "ligue-1.png", aliases: ["ligue 1", "liga francesa", "french ligue 1", "campeonato frances"] },
  { label: "Coupe de France", slug: "coupe-de-france.png", aliases: ["coupe de france", "copa de franca", "copa da franca", "french cup"] },
  { label: "Eredivisie", slug: "eredivisie.png", aliases: ["eredivisie", "liga holandesa", "dutch eredivisie"] },
  { label: "Liga Portugal", slug: "liga-portugal.png", aliases: ["liga portugal", "primeira liga", "liga nos", "liga portuguesa"] },
  { label: "Taça de Portugal", slug: "taca-de-portugal.png", aliases: ["taca de portugal", "taça de portugal", "copa de portugal"] },
  { label: "Saudi Pro League", slug: "saudi-pro-league.png", aliases: ["saudi pro league", "liga saudita", "roshn saudi league"] },
  { label: "Saudi Super Cup", slug: "saudi-super-cup.png", aliases: ["saudi super cup", "supercopa saudita"] },
  { label: "Copa Libertadores", slug: "copa-libertadores.png", aliases: ["copa libertadores", "libertadores", "conmebol libertadores"] },
  { label: "Copa Sudamericana", slug: "copa-sudamericana.png", aliases: ["copa sudamericana", "sudamericana", "sul-americana"] },
  { label: "Brasileirao", slug: "brasileirao.png", aliases: ["brasileirao", "brasileirão", "campeonato brasileiro", "serie a brasil"] },
  { label: "Copa do Brasil", slug: "copa-do-brasil.png", aliases: ["copa do brasil", "copa brasil", "brazil cup"] },
  { label: "Brasileirao Série B", slug: "brasileirao-serie-b.png", aliases: ["brasileirao serie b", "brasileirão série b", "serie b brasil"] },
  { label: "Liga Argentina", slug: "liga-argentina.png", aliases: ["liga argentina", "liga profesional", "campeonato argentino"] },
  { label: "Copa Argentina", slug: "copa-argentina.png", aliases: ["copa argentina", "copa da argentina"] },
  { label: "Liga MX", slug: "liga-mx.png", aliases: ["liga mx", "liga mexicana", "campeonato mexicano"] },
  { label: "MLS Cup", slug: "mls-cup.png", aliases: ["mls cup", "mls", "major league soccer"] },
  { label: "Turkish Süper Lig", slug: "turkish-super-lig.png", aliases: ["turkish super lig", "süper lig", "super lig", "liga turca"] },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function findTrophyEntry(competitionName: string): TrophyEntry | null {
  const norm = normalize(competitionName);
  for (const entry of TROPHY_ENTRIES) {
    if (normalize(entry.label) === norm) return entry;
  }
  for (const entry of TROPHY_ENTRIES) {
    for (const alias of entry.aliases) {
      if (normalize(alias) === norm) return entry;
    }
  }
  for (const entry of TROPHY_ENTRIES) {
    const normLabel = normalize(entry.label);
    if (norm.includes(normLabel) || normLabel.includes(norm)) return entry;
  }
  for (const entry of TROPHY_ENTRIES) {
    for (const alias of entry.aliases) {
      const normAlias = normalize(alias);
      if (norm.includes(normAlias) || normAlias.includes(norm)) return entry;
    }
  }
  return null;
}

export function findTrophyPhoto(competitionName: string): string | null {
  const entry = findTrophyEntry(competitionName);
  if (!entry || !entry.slug) return null;
  return `${getApiUrl()}/trophies/${entry.slug}`;
}

export function searchTrophyEntries(query: string): TrophyEntry[] {
  if (!query.trim()) return TROPHY_ENTRIES.slice(0, 10);
  const norm = normalize(query);
  return TROPHY_ENTRIES.filter((e) => {
    if (normalize(e.label).includes(norm)) return true;
    return e.aliases.some((a) => normalize(a).includes(norm));
  }).slice(0, 8);
}
