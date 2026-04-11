export interface TrophyEntry {
  label: string;
  photo: string | null;
  aliases: string[];
}

const BASE = import.meta.env.BASE_URL;
const t = (slug: string) => `${BASE}trophies/${slug}`;

export const TROPHY_ENTRIES: TrophyEntry[] = [
  {
    label: "UEFA Champions League",
    photo: t("champions-league.jpg"),
    aliases: ["champions league", "liga dos campeoes", "liga dos campeões", "ucl", "champions"],
  },
  {
    label: "UEFA Europa League",
    photo: t("europa-league.png"),
    aliases: ["europa league", "liga europa", "uel", "europa"],
  },
  {
    label: "UEFA Conference League",
    photo: t("conference-league.jpg"),
    aliases: ["conference league", "uecl", "liga conferencia", "conference"],
  },
  {
    label: "Premier League",
    photo: t("premier-league.jpg"),
    aliases: ["premier league", "epl", "premier", "england first division", "liga inglesa"],
  },
  {
    label: "FA Cup",
    photo: t("fa-cup.jpg"),
    aliases: ["fa cup", "copa fa", "copa da fa", "copa de inglaterra", "copa da inglaterra"],
  },
  {
    label: "Carabao Cup",
    photo: t("carabao-cup.jpg"),
    aliases: ["carabao cup", "efl cup", "league cup", "copa da liga inglesa", "copa da liga england"],
  },
  {
    label: "FA Community Shield",
    photo: t("community-shield.jpg"),
    aliases: ["community shield", "fa community shield", "charity shield"],
  },
  {
    label: "EFL Championship",
    photo: null,
    aliases: ["efl championship", "championship", "segunda divisao inglesa", "segunda divisão inglesa"],
  },
  {
    label: "EFL League One",
    photo: null,
    aliases: ["efl league one", "league one", "terceira divisao inglesa", "terceira divisão inglesa"],
  },
  {
    label: "EFL League Two",
    photo: null,
    aliases: ["efl league two", "league two", "quarta divisao inglesa", "quarta divisão inglesa"],
  },
  {
    label: "EFL Trophy",
    photo: null,
    aliases: ["efl trophy", "papa john", "papa john's trophy", "efl papa", "johnstone"],
  },
  {
    label: "La Liga",
    photo: null,
    aliases: ["la liga", "laliga", "liga espanhola", "primera division espanhola", "liga española", "spain first division"],
  },
  {
    label: "Copa del Rey",
    photo: t("copa-del-rey.png"),
    aliases: ["copa del rey", "copa do rei", "copa da espanha", "copa de espana", "copa de españa", "copa rey"],
  },
  {
    label: "Supercopa de España",
    photo: t("supercopa-espana.png"),
    aliases: ["supercopa de espana", "supercopa de españa", "supercopa espanha", "supercopa espanola", "supercopa española"],
  },
  {
    label: "La Liga 2",
    photo: null,
    aliases: ["la liga 2", "segunda division", "segunda división", "laliga 2", "segunda espanha"],
  },
  {
    label: "Bundesliga",
    photo: t("bundesliga.jpg"),
    aliases: ["bundesliga", "liga alema", "liga alemã", "meisterschale", "german bundesliga", "1. bundesliga"],
  },
  {
    label: "DFB-Pokal",
    photo: t("dfb-pokal.png"),
    aliases: ["dfb-pokal", "dfb pokal", "copa da alemanha", "copa de alemanha", "german cup", "copa alemanha"],
  },
  {
    label: "Serie A",
    photo: t("serie-a.png"),
    aliases: ["serie a", "serie a italia", "liga italiana", "calcio serie a", "campeonato italiano"],
  },
  {
    label: "Coppa Italia",
    photo: t("coppa-italia.jpg"),
    aliases: ["coppa italia", "copa da italia", "copa de italia", "copa italiana", "italian cup"],
  },
  {
    label: "Supercoppa Italiana",
    photo: t("supercoppa-italiana.png"),
    aliases: ["supercoppa italiana", "supercoppa", "supercopa italiana", "italian super cup"],
  },
  {
    label: "Ligue 1",
    photo: t("ligue-1.png"),
    aliases: ["ligue 1", "liga francesa", "french ligue 1", "campeonato frances", "campeonato francês"],
  },
  {
    label: "Coupe de France",
    photo: t("coupe-de-france.png"),
    aliases: ["coupe de france", "copa de franca", "copa da franca", "copa da france", "copa franca", "french cup"],
  },
  {
    label: "Eredivisie",
    photo: t("eredivisie.png"),
    aliases: ["eredivisie", "liga holandesa", "dutch eredivisie", "netherlands league"],
  },
  {
    label: "Taça de Portugal",
    photo: t("taca-de-portugal.png"),
    aliases: ["taca de portugal", "taça de portugal", "copa de portugal", "copa portugal", "portuguese cup"],
  },
  {
    label: "Liga Portugal",
    photo: t("liga-portugal.jpg"),
    aliases: ["liga portugal", "primeira liga", "liga nos", "liga portuguesa", "portuguese league", "primeira liga portuguesa"],
  },
  {
    label: "Copa Libertadores",
    photo: t("copa-libertadores.jpg"),
    aliases: ["copa libertadores", "libertadores", "conmebol libertadores", "champions south america"],
  },
  {
    label: "Copa Sudamericana",
    photo: null,
    aliases: ["copa sudamericana", "sudamericana", "sul-americana", "conmebol sudamericana"],
  },
  {
    label: "Brasileirao",
    photo: t("brasileirao.jpg"),
    aliases: ["brasileirao", "brasileirão", "campeonato brasileiro", "serie a brasil", "série a brasil", "brasileirao serie a"],
  },
  {
    label: "Copa do Brasil",
    photo: t("copa-do-brasil.jpg"),
    aliases: ["copa do brasil", "copa brasil", "brazil cup", "copa do brazil"],
  },
  {
    label: "Brasileirao Série B",
    photo: t("brasileirao-serie-b.png"),
    aliases: [
      "brasileirao serie b", "brasileirão série b", "serie b brasil", "série b brasil",
      "campeonato brasileiro serie b", "campeonato brasileiro série b",
      "serie b", "série b", "brazil serie b",
    ],
  },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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
  return findTrophyEntry(competitionName)?.photo ?? null;
}
