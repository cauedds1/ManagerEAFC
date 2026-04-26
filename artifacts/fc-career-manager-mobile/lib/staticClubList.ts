export interface StaticClub {
  id: number;
  name: string;
  logo: string;
  league: string;
}

const CDN = 'https://media.api-sports.io/football/teams';

export const STATIC_CLUBS: StaticClub[] = [
  { id: 541,  name: 'Real Madrid',              logo: `${CDN}/541.png`,   league: 'La Liga' },
  { id: 529,  name: 'Barcelona',                logo: `${CDN}/529.png`,   league: 'La Liga' },
  { id: 530,  name: 'Atlético de Madrid',       logo: `${CDN}/530.png`,   league: 'La Liga' },
  { id: 533,  name: 'Villarreal',               logo: `${CDN}/533.png`,   league: 'La Liga' },
  { id: 532,  name: 'Valencia',                 logo: `${CDN}/532.png`,   league: 'La Liga' },
  { id: 728,  name: 'Real Sociedad',            logo: `${CDN}/728.png`,   league: 'La Liga' },
  { id: 543,  name: 'Real Betis',               logo: `${CDN}/543.png`,   league: 'La Liga' },
  { id: 536,  name: 'Sevilla',                  logo: `${CDN}/536.png`,   league: 'La Liga' },
  { id: 727,  name: 'Osasuna',                  logo: `${CDN}/727.png`,   league: 'La Liga' },
  { id: 723,  name: 'Athletic Bilbao',          logo: `${CDN}/723.png`,   league: 'La Liga' },
  { id: 724,  name: 'Celta Vigo',               logo: `${CDN}/724.png`,   league: 'La Liga' },
  { id: 546,  name: 'Getafe',                   logo: `${CDN}/546.png`,   league: 'La Liga' },
  { id: 538,  name: 'Espanyol',                 logo: `${CDN}/538.png`,   league: 'La Liga' },
  { id: 547,  name: 'Girona',                   logo: `${CDN}/547.png`,   league: 'La Liga' },
  { id: 715,  name: 'Alavés',                   logo: `${CDN}/715.png`,   league: 'La Liga' },
  { id: 799,  name: 'Mallorca',                 logo: `${CDN}/799.png`,   league: 'La Liga' },
  { id: 798,  name: 'Las Palmas',               logo: `${CDN}/798.png`,   league: 'La Liga' },

  { id: 40,   name: 'Liverpool',                logo: `${CDN}/40.png`,    league: 'Premier League' },
  { id: 50,   name: 'Manchester City',          logo: `${CDN}/50.png`,    league: 'Premier League' },
  { id: 33,   name: 'Manchester United',        logo: `${CDN}/33.png`,    league: 'Premier League' },
  { id: 42,   name: 'Arsenal',                  logo: `${CDN}/42.png`,    league: 'Premier League' },
  { id: 49,   name: 'Chelsea',                  logo: `${CDN}/49.png`,    league: 'Premier League' },
  { id: 47,   name: 'Tottenham',                logo: `${CDN}/47.png`,    league: 'Premier League' },
  { id: 48,   name: 'West Ham',                 logo: `${CDN}/48.png`,    league: 'Premier League' },
  { id: 51,   name: 'Brighton',                 logo: `${CDN}/51.png`,    league: 'Premier League' },
  { id: 45,   name: 'Everton',                  logo: `${CDN}/45.png`,    league: 'Premier League' },
  { id: 66,   name: 'Aston Villa',              logo: `${CDN}/66.png`,    league: 'Premier League' },
  { id: 55,   name: 'Brentford',                logo: `${CDN}/55.png`,    league: 'Premier League' },
  { id: 65,   name: 'Nottingham Forest',        logo: `${CDN}/65.png`,    league: 'Premier League' },
  { id: 34,   name: 'Newcastle United',         logo: `${CDN}/34.png`,    league: 'Premier League' },
  { id: 46,   name: 'Leicester City',           logo: `${CDN}/46.png`,    league: 'Premier League' },
  { id: 52,   name: 'Crystal Palace',           logo: `${CDN}/52.png`,    league: 'Premier League' },
  { id: 44,   name: 'Wolverhampton',            logo: `${CDN}/44.png`,    league: 'Premier League' },
  { id: 35,   name: 'Bournemouth',              logo: `${CDN}/35.png`,    league: 'Premier League' },
  { id: 36,   name: 'Fulham',                   logo: `${CDN}/36.png`,    league: 'Premier League' },
  { id: 67,   name: 'Ipswich Town',             logo: `${CDN}/67.png`,    league: 'Premier League' },
  { id: 41,   name: 'Southampton',              logo: `${CDN}/41.png`,    league: 'Premier League' },

  { id: 157,  name: 'Bayern Munich',            logo: `${CDN}/157.png`,   league: 'Bundesliga' },
  { id: 165,  name: 'Borussia Dortmund',        logo: `${CDN}/165.png`,   league: 'Bundesliga' },
  { id: 168,  name: 'Bayer Leverkusen',         logo: `${CDN}/168.png`,   league: 'Bundesliga' },
  { id: 173,  name: 'RB Leipzig',               logo: `${CDN}/173.png`,   league: 'Bundesliga' },
  { id: 169,  name: 'Eintracht Frankfurt',      logo: `${CDN}/169.png`,   league: 'Bundesliga' },
  { id: 161,  name: 'VfB Stuttgart',            logo: `${CDN}/161.png`,   league: 'Bundesliga' },
  { id: 176,  name: 'Wolfsburg',                logo: `${CDN}/176.png`,   league: 'Bundesliga' },
  { id: 163,  name: 'Borussia Mönchengladbach', logo: `${CDN}/163.png`,   league: 'Bundesliga' },
  { id: 172,  name: 'Union Berlin',             logo: `${CDN}/172.png`,   league: 'Bundesliga' },
  { id: 162,  name: 'Werder Bremen',            logo: `${CDN}/162.png`,   league: 'Bundesliga' },
  { id: 167,  name: 'Hoffenheim',               logo: `${CDN}/167.png`,   league: 'Bundesliga' },
  { id: 170,  name: 'Mainz',                    logo: `${CDN}/170.png`,   league: 'Bundesliga' },
  { id: 171,  name: 'Augsburg',                 logo: `${CDN}/171.png`,   league: 'Bundesliga' },
  { id: 159,  name: 'Hertha Berlin',            logo: `${CDN}/159.png`,   league: 'Bundesliga' },
  { id: 174,  name: 'SC Freiburg',              logo: `${CDN}/174.png`,   league: 'Bundesliga' },
  { id: 164,  name: 'FC Köln',                  logo: `${CDN}/164.png`,   league: 'Bundesliga' },
  { id: 175,  name: 'FC Heidenheim',            logo: `${CDN}/175.png`,   league: 'Bundesliga' },

  { id: 489,  name: 'AC Milan',                 logo: `${CDN}/489.png`,   league: 'Serie A' },
  { id: 505,  name: 'Inter Milan',              logo: `${CDN}/505.png`,   league: 'Serie A' },
  { id: 492,  name: 'Napoli',                   logo: `${CDN}/492.png`,   league: 'Serie A' },
  { id: 496,  name: 'Juventus',                 logo: `${CDN}/496.png`,   league: 'Serie A' },
  { id: 487,  name: 'Roma',                     logo: `${CDN}/487.png`,   league: 'Serie A' },
  { id: 488,  name: 'Lazio',                    logo: `${CDN}/488.png`,   league: 'Serie A' },
  { id: 500,  name: 'Atalanta',                 logo: `${CDN}/500.png`,   league: 'Serie A' },
  { id: 502,  name: 'Fiorentina',               logo: `${CDN}/502.png`,   league: 'Serie A' },
  { id: 497,  name: 'Torino',                   logo: `${CDN}/497.png`,   league: 'Serie A' },
  { id: 504,  name: 'Bologna',                  logo: `${CDN}/504.png`,   league: 'Serie A' },
  { id: 494,  name: 'Udinese',                  logo: `${CDN}/494.png`,   league: 'Serie A' },
  { id: 495,  name: 'Cagliari',                 logo: `${CDN}/495.png`,   league: 'Serie A' },
  { id: 503,  name: 'Empoli',                   logo: `${CDN}/503.png`,   league: 'Serie A' },
  { id: 507,  name: 'Verona',                   logo: `${CDN}/507.png`,   league: 'Serie A' },
  { id: 499,  name: 'Monza',                    logo: `${CDN}/499.png`,   league: 'Serie A' },
  { id: 508,  name: 'Lecce',                    logo: `${CDN}/508.png`,   league: 'Serie A' },

  { id: 85,   name: 'Paris Saint-Germain',      logo: `${CDN}/85.png`,    league: 'Ligue 1' },
  { id: 80,   name: 'Lyon',                     logo: `${CDN}/80.png`,    league: 'Ligue 1' },
  { id: 81,   name: 'Marseille',                logo: `${CDN}/81.png`,    league: 'Ligue 1' },
  { id: 91,   name: 'Monaco',                   logo: `${CDN}/91.png`,    league: 'Ligue 1' },
  { id: 93,   name: 'Nice',                     logo: `${CDN}/93.png`,    league: 'Ligue 1' },
  { id: 95,   name: 'Rennes',                   logo: `${CDN}/95.png`,    league: 'Ligue 1' },
  { id: 96,   name: 'Lens',                     logo: `${CDN}/96.png`,    league: 'Ligue 1' },
  { id: 111,  name: 'Montpellier',              logo: `${CDN}/111.png`,   league: 'Ligue 1' },
  { id: 98,   name: 'Lille',                    logo: `${CDN}/98.png`,    league: 'Ligue 1' },
  { id: 106,  name: 'Nantes',                   logo: `${CDN}/106.png`,   league: 'Ligue 1' },
  { id: 84,   name: 'Toulouse',                 logo: `${CDN}/84.png`,    league: 'Ligue 1' },
  { id: 109,  name: 'Strasbourg',               logo: `${CDN}/109.png`,   league: 'Ligue 1' },
  { id: 103,  name: 'Reims',                    logo: `${CDN}/103.png`,   league: 'Ligue 1' },
  { id: 83,   name: 'Le Havre',                 logo: `${CDN}/83.png`,    league: 'Ligue 1' },

  { id: 212,  name: 'Porto',                    logo: `${CDN}/212.png`,   league: 'Liga Portugal' },
  { id: 211,  name: 'Benfica',                  logo: `${CDN}/211.png`,   league: 'Liga Portugal' },
  { id: 228,  name: 'Sporting CP',              logo: `${CDN}/228.png`,   league: 'Liga Portugal' },
  { id: 226,  name: 'Braga',                    logo: `${CDN}/226.png`,   league: 'Liga Portugal' },
  { id: 217,  name: 'Vitória de Guimarães',     logo: `${CDN}/217.png`,   league: 'Liga Portugal' },

  { id: 194,  name: 'Ajax',                     logo: `${CDN}/194.png`,   league: 'Eredivisie' },
  { id: 197,  name: 'PSV Eindhoven',            logo: `${CDN}/197.png`,   league: 'Eredivisie' },
  { id: 193,  name: 'Feyenoord',                logo: `${CDN}/193.png`,   league: 'Eredivisie' },
  { id: 198,  name: 'AZ Alkmaar',               logo: `${CDN}/198.png`,   league: 'Eredivisie' },
  { id: 201,  name: 'FC Utrecht',               logo: `${CDN}/201.png`,   league: 'Eredivisie' },
  { id: 195,  name: 'FC Twente',                logo: `${CDN}/195.png`,   league: 'Eredivisie' },

  { id: 246,  name: 'Celtic',                   logo: `${CDN}/246.png`,   league: 'Scottish Premiership' },
  { id: 247,  name: 'Rangers',                  logo: `${CDN}/247.png`,   league: 'Scottish Premiership' },

  { id: 645,  name: 'Galatasaray',              logo: `${CDN}/645.png`,   league: 'Süper Lig' },
  { id: 641,  name: 'Fenerbahçe',               logo: `${CDN}/641.png`,   league: 'Süper Lig' },
  { id: 642,  name: 'Beşiktaş',                 logo: `${CDN}/642.png`,   league: 'Süper Lig' },
  { id: 643,  name: 'Trabzonspor',              logo: `${CDN}/643.png`,   league: 'Süper Lig' },

  { id: 370,  name: 'Spartak Moscow',           logo: `${CDN}/370.png`,   league: 'Russian Premier League' },
  { id: 371,  name: 'CSKA Moscow',              logo: `${CDN}/371.png`,   league: 'Russian Premier League' },
  { id: 373,  name: 'Zenit St. Petersburg',     logo: `${CDN}/373.png`,   league: 'Russian Premier League' },
  { id: 374,  name: 'Lokomotiv Moscow',         logo: `${CDN}/374.png`,   league: 'Russian Premier League' },

  { id: 568,  name: 'Flamengo',                 logo: `${CDN}/568.png`,   league: 'Brasileirão' },
  { id: 119,  name: 'Palmeiras',                logo: `${CDN}/119.png`,   league: 'Brasileirão' },
  { id: 118,  name: 'São Paulo',                logo: `${CDN}/118.png`,   league: 'Brasileirão' },
  { id: 121,  name: 'Santos',                   logo: `${CDN}/121.png`,   league: 'Brasileirão' },
  { id: 116,  name: 'Corinthians',              logo: `${CDN}/116.png`,   league: 'Brasileirão' },
  { id: 130,  name: 'Grêmio',                   logo: `${CDN}/130.png`,   league: 'Brasileirão' },
  { id: 115,  name: 'Internacional',            logo: `${CDN}/115.png`,   league: 'Brasileirão' },
  { id: 124,  name: 'Athletico Paranaense',     logo: `${CDN}/124.png`,   league: 'Brasileirão' },
  { id: 126,  name: 'Cruzeiro',                 logo: `${CDN}/126.png`,   league: 'Brasileirão' },
  { id: 127,  name: 'Atlético Mineiro',         logo: `${CDN}/127.png`,   league: 'Brasileirão' },
  { id: 120,  name: 'Fluminense',               logo: `${CDN}/120.png`,   league: 'Brasileirão' },
  { id: 7323, name: 'Botafogo',                 logo: `${CDN}/7323.png`,  league: 'Brasileirão' },
  { id: 128,  name: 'Vasco da Gama',            logo: `${CDN}/128.png`,   league: 'Brasileirão' },
  { id: 139,  name: 'Fortaleza',                logo: `${CDN}/139.png`,   league: 'Brasileirão' },
  { id: 131,  name: 'Bahia',                    logo: `${CDN}/131.png`,   league: 'Brasileirão' },
  { id: 140,  name: 'Sport Recife',             logo: `${CDN}/140.png`,   league: 'Brasileirão' },
  { id: 144,  name: 'Ceará',                    logo: `${CDN}/144.png`,   league: 'Brasileirão' },
  { id: 147,  name: 'América-MG',               logo: `${CDN}/147.png`,   league: 'Brasileirão' },
  { id: 145,  name: 'Goiás',                    logo: `${CDN}/145.png`,   league: 'Brasileirão' },
  { id: 150,  name: 'Coritiba',                 logo: `${CDN}/150.png`,   league: 'Brasileirão' },
  { id: 146,  name: 'Cuiabá',                   logo: `${CDN}/146.png`,   league: 'Brasileirão' },
  { id: 158,  name: 'Red Bull Bragantino',      logo: `${CDN}/158.png`,   league: 'Brasileirão' },

  { id: 435,  name: 'Boca Juniors',             logo: `${CDN}/435.png`,   league: 'Liga Argentina' },
  { id: 436,  name: 'River Plate',              logo: `${CDN}/436.png`,   league: 'Liga Argentina' },
  { id: 433,  name: 'Racing Club',              logo: `${CDN}/433.png`,   league: 'Liga Argentina' },
  { id: 439,  name: 'Independiente',            logo: `${CDN}/439.png`,   league: 'Liga Argentina' },
  { id: 437,  name: 'San Lorenzo',              logo: `${CDN}/437.png`,   league: 'Liga Argentina' },
  { id: 442,  name: 'Vélez Sársfield',          logo: `${CDN}/442.png`,   league: 'Liga Argentina' },
  { id: 444,  name: 'Estudiantes LP',           logo: `${CDN}/444.png`,   league: 'Liga Argentina' },

  { id: 569,  name: 'Club América',             logo: `${CDN}/569.png`,   league: 'Liga MX' },
  { id: 570,  name: 'Cruz Azul',                logo: `${CDN}/570.png`,   league: 'Liga MX' },
  { id: 571,  name: 'Chivas Guadalajara',       logo: `${CDN}/571.png`,   league: 'Liga MX' },
  { id: 574,  name: 'Tigres UANL',              logo: `${CDN}/574.png`,   league: 'Liga MX' },
  { id: 573,  name: 'Rayados Monterrey',        logo: `${CDN}/573.png`,   league: 'Liga MX' },
  { id: 575,  name: 'Santos Laguna',            logo: `${CDN}/575.png`,   league: 'Liga MX' },

  { id: 1350, name: 'LA Galaxy',                logo: `${CDN}/1350.png`,  league: 'MLS' },
  { id: 1600, name: 'Inter Miami',              logo: `${CDN}/1600.png`,  league: 'MLS' },
  { id: 1356, name: 'New York City FC',         logo: `${CDN}/1356.png`,  league: 'MLS' },
  { id: 1359, name: 'Portland Timbers',         logo: `${CDN}/1359.png`,  league: 'MLS' },
  { id: 1352, name: 'Seattle Sounders',         logo: `${CDN}/1352.png`,  league: 'MLS' },

  { id: 308,  name: 'Vissel Kobe',              logo: `${CDN}/308.png`,   league: 'J-League' },
  { id: 309,  name: 'Kashima Antlers',          logo: `${CDN}/309.png`,   league: 'J-League' },
  { id: 310,  name: 'Urawa Reds',               logo: `${CDN}/310.png`,   league: 'J-League' },
  { id: 311,  name: 'Gamba Osaka',              logo: `${CDN}/311.png`,   league: 'J-League' },

  { id: 2932, name: 'Al Hilal',                 logo: `${CDN}/2932.png`,  league: 'Saudi Pro League' },
  { id: 2931, name: 'Al Nassr',                 logo: `${CDN}/2931.png`,  league: 'Saudi Pro League' },
  { id: 2936, name: 'Al Ahli',                  logo: `${CDN}/2936.png`,  league: 'Saudi Pro League' },
  { id: 2933, name: 'Al Ittihad',               logo: `${CDN}/2933.png`,  league: 'Saudi Pro League' },

  { id: 550,  name: 'Club Brugge',              logo: `${CDN}/550.png`,   league: 'Jupiler Pro League' },
  { id: 555,  name: 'Anderlecht',               logo: `${CDN}/555.png`,   league: 'Jupiler Pro League' },
  { id: 549,  name: 'Gent',                     logo: `${CDN}/549.png`,   league: 'Jupiler Pro League' },
  { id: 553,  name: 'Genk',                     logo: `${CDN}/553.png`,   league: 'Jupiler Pro League' },

  { id: 412,  name: 'Red Bull Salzburg',        logo: `${CDN}/412.png`,   league: 'Austrian Bundesliga' },
  { id: 410,  name: 'Sturm Graz',               logo: `${CDN}/410.png`,   league: 'Austrian Bundesliga' },

  { id: 460,  name: 'Olympiacos',               logo: `${CDN}/460.png`,   league: 'Super League Greece' },
  { id: 461,  name: 'Panathinaikos',            logo: `${CDN}/461.png`,   league: 'Super League Greece' },
  { id: 462,  name: 'AEK Athens',               logo: `${CDN}/462.png`,   league: 'Super League Greece' },
  { id: 463,  name: 'PAOK',                     logo: `${CDN}/463.png`,   league: 'Super League Greece' },

  { id: 481,  name: 'Slavia Prague',            logo: `${CDN}/481.png`,   league: 'Czech First League' },
  { id: 480,  name: 'Sparta Prague',            logo: `${CDN}/480.png`,   league: 'Czech First League' },

  { id: 680,  name: 'Dinamo Zagreb',            logo: `${CDN}/680.png`,   league: 'HNL Croatia' },
  { id: 681,  name: 'Hajduk Split',             logo: `${CDN}/681.png`,   league: 'HNL Croatia' },

  { id: 1101, name: 'FC Basel 1893',            logo: `${CDN}/1101.png`,  league: 'Swiss Super League' },
  { id: 1107, name: 'BSC Young Boys',           logo: `${CDN}/1107.png`,  league: 'Swiss Super League' },
  { id: 1102, name: 'FC Zürich',                logo: `${CDN}/1102.png`,  league: 'Swiss Super League' },

  { id: 626,  name: 'FCSB',                     logo: `${CDN}/626.png`,   league: 'Liga 1 Romania' },
  { id: 627,  name: 'CFR Cluj',                 logo: `${CDN}/627.png`,   league: 'Liga 1 Romania' },

  { id: 402,  name: 'Red Star Belgrade',        logo: `${CDN}/402.png`,   league: 'SuperLiga Serbia' },
  { id: 403,  name: 'Partizan',                 logo: `${CDN}/403.png`,   league: 'SuperLiga Serbia' },

  { id: 384,  name: 'FC Copenhagen',            logo: `${CDN}/384.png`,   league: 'Superligaen' },
  { id: 390,  name: 'Brøndby IF',               logo: `${CDN}/390.png`,   league: 'Superligaen' },
  { id: 388,  name: 'FC Midtjylland',           logo: `${CDN}/388.png`,   league: 'Superligaen' },

  { id: 357,  name: 'Rosenborg BK',             logo: `${CDN}/357.png`,   league: 'Eliteserien' },
  { id: 352,  name: 'FK Bodø/Glimt',            logo: `${CDN}/352.png`,   league: 'Eliteserien' },

  { id: 364,  name: 'Malmö FF',                 logo: `${CDN}/364.png`,   league: 'Allsvenskan' },
  { id: 362,  name: 'AIK',                      logo: `${CDN}/362.png`,   league: 'Allsvenskan' },

  { id: 385,  name: 'Shakhtar Donetsk',         logo: `${CDN}/385.png`,   league: 'Ukrainian Premier League' },
  { id: 386,  name: 'Dynamo Kyiv',              logo: `${CDN}/386.png`,   league: 'Ukrainian Premier League' },
];

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function searchStaticClubs(query: string): StaticClub[] {
  if (!query.trim()) return [];
  const q = normalize(query);
  return STATIC_CLUBS.filter(
    (c) => normalize(c.name).includes(q) || normalize(c.league).includes(q),
  ).slice(0, 8);
}
