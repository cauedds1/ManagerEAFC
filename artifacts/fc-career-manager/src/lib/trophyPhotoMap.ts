export interface TrophyEntry {
  label: string;
  photo: string | null;
  aliases: string[];
}

const BASE = import.meta.env.BASE_URL;
const t = (slug: string) => `${BASE}trophies/${slug}`;

export const TROPHY_ENTRIES: TrophyEntry[] = [
  // ── UEFA ────────────────────────────────────────────────────────────────
  {
    label: "UEFA Champions League",
    photo: t("champions-league.png"),
    aliases: ["champions league", "liga dos campeoes", "liga dos campeões", "ucl", "champions"],
  },
  {
    label: "UEFA Europa League",
    photo: t("europa-league.png"),
    aliases: ["europa league", "liga europa", "uel", "europa"],
  },
  {
    label: "UEFA Conference League",
    photo: t("conference-league.png"),
    aliases: ["conference league", "uecl", "liga conferencia", "conference"],
  },

  // ── England ─────────────────────────────────────────────────────────────
  {
    label: "Premier League",
    photo: t("premier-league.png"),
    aliases: ["premier league", "epl", "premier", "england first division", "liga inglesa"],
  },
  {
    label: "FA Cup",
    photo: t("fa-cup.png"),
    aliases: ["fa cup", "copa fa", "copa da fa", "copa de inglaterra", "copa da inglaterra"],
  },
  {
    label: "Carabao Cup",
    photo: t("carabao-cup.png"),
    aliases: ["carabao cup", "efl cup", "league cup", "copa da liga inglesa", "copa da liga england"],
  },
  {
    label: "FA Community Shield",
    photo: t("community-shield.png"),
    aliases: ["community shield", "fa community shield", "charity shield"],
  },
  {
    label: "EFL Championship",
    photo: t("efl-championship.png"),
    aliases: ["efl championship", "championship", "segunda divisao inglesa", "segunda divisão inglesa"],
  },
  {
    label: "EFL League One",
    photo: t("efl-league-one.png"),
    aliases: ["efl league one", "league one", "terceira divisao inglesa", "terceira divisão inglesa"],
  },
  {
    label: "EFL League Two",
    photo: t("efl-league-two.png"),
    aliases: ["efl league two", "league two", "quarta divisao inglesa", "quarta divisão inglesa"],
  },
  {
    label: "EFL Trophy",
    photo: t("efl-trophy.png"),
    aliases: ["efl trophy", "papa john", "papa john's trophy", "efl papa", "johnstone"],
  },

  // ── Scotland ────────────────────────────────────────────────────────────
  {
    label: "Scottish Premiership",
    photo: t("scottish-premiership.png"),
    aliases: ["scottish premiership", "premiership escocia", "premiership escócia", "scottish premier league", "spfl premiership", "liga escocesa"],
  },
  {
    label: "Scottish Cup",
    photo: t("scottish-cup.png"),
    aliases: ["scottish cup", "copa escocesa", "copa da escocia", "copa da escócia", "scottish fa cup"],
  },
  {
    label: "Scottish League Cup",
    photo: t("scottish-league-cup.png"),
    aliases: ["scottish league cup", "copa da liga escocesa", "viaplay cup", "league cup escocia"],
  },

  // ── Spain ───────────────────────────────────────────────────────────────
  {
    label: "La Liga",
    photo: t("la-liga.png"),
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
    photo: t("la-liga-2.png"),
    aliases: ["la liga 2", "segunda division", "segunda división", "laliga 2", "segunda espanha"],
  },

  // ── Germany ─────────────────────────────────────────────────────────────
  {
    label: "Bundesliga",
    photo: t("bundesliga.png"),
    aliases: ["bundesliga", "liga alema", "liga alemã", "meisterschale", "german bundesliga", "1. bundesliga"],
  },
  {
    label: "DFB-Pokal",
    photo: t("dfb-pokal.png"),
    aliases: ["dfb-pokal", "dfb pokal", "copa da alemanha", "copa de alemanha", "german cup", "copa alemanha"],
  },

  // ── Italy ───────────────────────────────────────────────────────────────
  {
    label: "Serie A",
    photo: t("serie-a.png"),
    aliases: ["serie a", "serie a italia", "liga italiana", "calcio serie a", "campeonato italiano"],
  },
  {
    label: "Coppa Italia",
    photo: t("coppa-italia.png"),
    aliases: ["coppa italia", "copa da italia", "copa de italia", "copa italiana", "italian cup"],
  },
  {
    label: "Supercoppa Italiana",
    photo: t("supercoppa-italiana.png"),
    aliases: ["supercoppa italiana", "supercoppa", "supercopa italiana", "italian super cup"],
  },

  // ── France ──────────────────────────────────────────────────────────────
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

  // ── Netherlands ─────────────────────────────────────────────────────────
  {
    label: "Eredivisie",
    photo: t("eredivisie.png"),
    aliases: ["eredivisie", "liga holandesa", "dutch eredivisie", "netherlands league"],
  },

  // ── Portugal ────────────────────────────────────────────────────────────
  {
    label: "Liga Portugal",
    photo: t("liga-portugal.png"),
    aliases: ["liga portugal", "primeira liga", "liga nos", "liga portuguesa", "portuguese league", "primeira liga portuguesa"],
  },
  {
    label: "Taça de Portugal",
    photo: t("taca-de-portugal.png"),
    aliases: ["taca de portugal", "taça de portugal", "copa de portugal", "copa portugal", "portuguese cup"],
  },

  // ── Saudi Arabia ────────────────────────────────────────────────────────
  {
    label: "Saudi Pro League",
    photo: t("saudi-pro-league.png"),
    aliases: ["saudi pro league", "saudi professional league", "liga saudita", "liga da arabia saudita", "roshn saudi league"],
  },
  {
    label: "Saudi Super Cup",
    photo: t("saudi-super-cup.png"),
    aliases: ["saudi super cup", "supercopa saudita", "king cup saudi", "copa do rei arabia"],
  },

  // ── South America ───────────────────────────────────────────────────────
  {
    label: "Copa Libertadores",
    photo: t("copa-libertadores.png"),
    aliases: ["copa libertadores", "libertadores", "conmebol libertadores", "champions south america"],
  },
  {
    label: "Copa Sudamericana",
    photo: t("copa-sudamericana.png"),
    aliases: ["copa sudamericana", "sudamericana", "sul-americana", "conmebol sudamericana"],
  },
  {
    label: "Brasileirao",
    photo: t("brasileirao.png"),
    aliases: ["brasileirao", "brasileirão", "campeonato brasileiro", "serie a brasil", "série a brasil", "brasileirao serie a"],
  },
  {
    label: "Copa do Brasil",
    photo: t("copa-do-brasil.png"),
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

  // ── Argentina ───────────────────────────────────────────────────────────
  {
    label: "Liga Argentina",
    photo: t("liga-argentina.png"),
    aliases: ["liga argentina", "liga profesional", "liga profesional argentina", "campeonato argentino", "primera division argentina"],
  },
  {
    label: "Copa Argentina",
    photo: t("copa-argentina.png"),
    aliases: ["copa argentina", "copa da argentina", "argentine cup"],
  },

  // ── Mexico ──────────────────────────────────────────────────────────────
  {
    label: "Liga MX",
    photo: t("liga-mx.png"),
    aliases: ["liga mx", "liga mexicana", "campeonato mexicano", "primera division mexico", "primera division méxico"],
  },

  // ── USA ─────────────────────────────────────────────────────────────────
  {
    label: "MLS Cup",
    photo: t("mls-cup.png"),
    aliases: ["mls cup", "mls", "major league soccer", "copa mls", "us soccer"],
  },

  // ── Turkey ──────────────────────────────────────────────────────────────
  {
    label: "Turkish Süper Lig",
    photo: t("turkish-super-lig.png"),
    aliases: ["turkish super lig", "süper lig", "super lig", "liga turca", "turk ligi"],
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
