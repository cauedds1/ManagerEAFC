export interface TrophyEntry {
  label: string;
  photo: string | null;
  aliases: string[];
}

export const TROPHY_ENTRIES: TrophyEntry[] = [
  {
    label: "UEFA Champions League",
    photo: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Trofeo_UEFA_Champions_League.jpg",
    aliases: ["champions league", "liga dos campeoes", "liga dos campeões", "ucl", "champions"],
  },
  {
    label: "UEFA Europa League",
    photo: "https://upload.wikimedia.org/wikipedia/commons/6/69/PD-Shape_Europa_League_Trophy.svg",
    aliases: ["europa league", "liga europa", "uel", "europa"],
  },
  {
    label: "UEFA Conference League",
    photo: "https://upload.wikimedia.org/wikipedia/commons/f/f5/UEFA_Europa_Conference_League_Trophy_West_Ham.jpg",
    aliases: ["conference league", "uecl", "liga conferencia", "conference"],
  },
  {
    label: "Premier League",
    photo: "https://upload.wikimedia.org/wikipedia/commons/8/81/Premier_League_Trophy_at_Manchester%27s_National_Football_Museum_%28Ank_Kumar%29_02.jpg",
    aliases: ["premier league", "epl", "premier", "england first division", "liga inglesa"],
  },
  {
    label: "FA Cup",
    photo: "https://upload.wikimedia.org/wikipedia/commons/c/c7/FA_Cup.jpg",
    aliases: ["fa cup", "copa fa", "copa da fa", "copa de inglaterra", "copa da inglaterra"],
  },
  {
    label: "Carabao Cup",
    photo: "https://upload.wikimedia.org/wikipedia/commons/8/81/EFL_Cup_trophy_displyed_in_Liverpool_FC_museum.jpg",
    aliases: ["carabao cup", "efl cup", "league cup", "copa da liga inglesa", "copa da liga england"],
  },
  {
    label: "FA Community Shield",
    photo: "https://upload.wikimedia.org/wikipedia/commons/b/bb/FA_Community_Shield.JPG",
    aliases: ["community shield", "fa community shield", "charity shield"],
  },
  {
    label: "EFL Championship",
    photo: "https://upload.wikimedia.org/wikipedia/commons/e/ee/Sheffieldwednesday2023trophy.jpg",
    aliases: ["efl championship", "championship", "segunda divisao inglesa", "segunda divisão inglesa"],
  },
  {
    label: "EFL League One",
    photo: "https://upload.wikimedia.org/wikipedia/commons/e/ee/Sheffieldwednesday2023trophy.jpg",
    aliases: ["efl league one", "league one", "terceira divisao inglesa", "terceira divisão inglesa"],
  },
  {
    label: "EFL League Two",
    photo: "https://upload.wikimedia.org/wikipedia/commons/e/ee/Sheffieldwednesday2023trophy.jpg",
    aliases: ["efl league two", "league two", "quarta divisao inglesa", "quarta divisão inglesa"],
  },
  {
    label: "EFL Trophy",
    photo: "https://upload.wikimedia.org/wikipedia/commons/8/85/EFL_Trophy_Final_2017_-_1.jpg",
    aliases: ["efl trophy", "papa john", "papa john's trophy", "efl papa", "johnstone"],
  },
  {
    label: "La Liga",
    photo: "https://upload.wikimedia.org/wikipedia/commons/9/9e/Frankfurter_Buchmesse_2015_-_Meisterschale.JPG",
    aliases: ["la liga", "laliga", "liga espanhola", "primera division espanhola", "liga española", "spain first division"],
  },
  {
    label: "Copa del Rey",
    photo: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Copa_del_Rey_Trophy.png",
    aliases: ["copa del rey", "copa do rei", "copa da espanha", "copa de espana", "copa de españa", "copa rey"],
  },
  {
    label: "Supercopa de España",
    photo: "https://upload.wikimedia.org/wikipedia/commons/4/44/Supercopa_de_Espa%C3%B1a.png",
    aliases: ["supercopa de espana", "supercopa de españa", "supercopa espanha", "supercopa espanola", "supercopa española"],
  },
  {
    label: "La Liga 2",
    photo: null,
    aliases: ["la liga 2", "segunda division", "segunda división", "laliga 2", "segunda espanha"],
  },
  {
    label: "Bundesliga",
    photo: "https://upload.wikimedia.org/wikipedia/commons/9/9e/Frankfurter_Buchmesse_2015_-_Meisterschale.JPG",
    aliases: ["bundesliga", "liga alema", "liga alemã", "meisterschale", "german bundesliga", "1. bundesliga"],
  },
  {
    label: "DFB-Pokal",
    photo: "https://upload.wikimedia.org/wikipedia/commons/d/d8/DFB_Pokal_Trophy.png",
    aliases: ["dfb-pokal", "dfb pokal", "copa da alemanha", "copa de alemanha", "german cup", "copa alemanha"],
  },
  {
    label: "Serie A",
    photo: "https://upload.wikimedia.org/wikipedia/commons/9/99/Scudetto.svg",
    aliases: ["serie a", "serie a italia", "liga italiana", "calcio serie a", "campeonato italiano"],
  },
  {
    label: "Coppa Italia",
    photo: "https://upload.wikimedia.org/wikipedia/commons/7/70/Coppa_Italia.jpg",
    aliases: ["coppa italia", "copa da italia", "copa de italia", "copa italiana", "italian cup"],
  },
  {
    label: "Supercoppa Italiana",
    photo: "https://upload.wikimedia.org/wikipedia/commons/1/11/Supercoppa_Italiana_10.svg",
    aliases: ["supercoppa italiana", "supercoppa", "supercopa italiana", "italian super cup"],
  },
  {
    label: "Ligue 1",
    photo: "https://upload.wikimedia.org/wikipedia/commons/0/0c/Ligue_1_Trophy_2024.png",
    aliases: ["ligue 1", "liga francesa", "french ligue 1", "campeonato frances", "campeonato francês"],
  },
  {
    label: "Coupe de France",
    photo: "https://upload.wikimedia.org/wikipedia/commons/1/1f/Coupe_de_France_trophy.png",
    aliases: ["coupe de france", "copa de franca", "copa da franca", "copa da france", "copa franca", "french cup"],
  },
  {
    label: "Eredivisie",
    photo: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Eredivisie_Trophy.png",
    aliases: ["eredivisie", "liga holandesa", "dutch eredivisie", "netherlands league"],
  },
  {
    label: "Taça de Portugal",
    photo: "https://upload.wikimedia.org/wikipedia/commons/4/4d/Ta%C3%A7a_de_Portugal_Trophy.svg",
    aliases: ["taca de portugal", "taça de portugal", "copa de portugal", "copa portugal", "portuguese cup"],
  },
  {
    label: "Liga Portugal",
    photo: "https://upload.wikimedia.org/wikipedia/commons/4/4d/Ta%C3%A7a_de_Portugal_Trophy.svg",
    aliases: ["liga portugal", "primeira liga", "liga nos", "liga portuguesa", "portuguese league", "primeira liga portuguesa"],
  },
  {
    label: "Copa Libertadores",
    photo: "https://upload.wikimedia.org/wikipedia/commons/7/73/Final_de_la_Copa_CONMEBOL_Libertadores_en_el_Estadio_Centenario_-_20211127dicimouyap1119.jpg",
    aliases: ["copa libertadores", "libertadores", "conmebol libertadores", "champions south america"],
  },
  {
    label: "Copa Sudamericana",
    photo: "https://upload.wikimedia.org/wikipedia/commons/7/73/Final_de_la_Copa_CONMEBOL_Libertadores_en_el_Estadio_Centenario_-_20211127dicimouyap1119.jpg",
    aliases: ["copa sudamericana", "sudamericana", "sul-americana", "conmebol sudamericana"],
  },
  {
    label: "Brasileirao",
    photo: "https://upload.wikimedia.org/wikipedia/commons/f/f5/Trof%C3%A9u_Campeonato_Brasileiro_2024.jpg",
    aliases: ["brasileirao", "brasileirão", "campeonato brasileiro", "serie a brasil", "série a brasil", "brasileirao serie a"],
  },
  {
    label: "Copa do Brasil",
    photo: "https://upload.wikimedia.org/wikipedia/commons/4/45/Copa_do_Brasil_Sport.jpg",
    aliases: ["copa do brasil", "copa brasil", "brazil cup", "copa do brazil"],
  },
  {
    label: "Brasileirao Série B",
    photo: "https://upload.wikimedia.org/wikipedia/commons/f/f5/Trof%C3%A9u_Campeonato_Brasileiro_2024.jpg",
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
      if (alias === norm) return entry;
    }
  }

  for (const entry of TROPHY_ENTRIES) {
    if (norm.includes(normalize(entry.label)) || normalize(entry.label).includes(norm)) return entry;
  }

  for (const entry of TROPHY_ENTRIES) {
    for (const alias of entry.aliases) {
      if (norm.includes(alias) || alias.includes(norm)) return entry;
    }
  }

  return null;
}

export function findTrophyPhoto(competitionName: string): string | null {
  return findTrophyEntry(competitionName)?.photo ?? null;
}
