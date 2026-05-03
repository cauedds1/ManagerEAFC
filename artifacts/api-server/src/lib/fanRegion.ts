export interface FanRegionProfile {
  country: string;
  nameExamples: string;
  handleExamples: string;
}

const PROFILES: Record<string, FanRegionProfile> = {
  brazil: {
    country: "Brasil",
    nameExamples: '"Lucas Ferreira", "Ana Souza", "Pedro Mendes", "Carla Lima", "João Carlos", "Thiago Rocha", "Rafael Nunes", "Mariana Alves"',
    handleExamples: "@lucasferreira, @anasouza22, @pedromendes_fc, @carlamlima, @joaocarlos17, @thiagorocha",
  },
  portugal: {
    country: "Portugal",
    nameExamples: '"Manuel Pereira", "Joana Ribeiro", "Tiago Almeida", "Rita Costa", "André Sousa", "Catarina Santos", "Bruno Marques"',
    handleExamples: "@manuelpereira, @joanaribeiro_, @tiagoalmeida10, @ritacosta_pt, @andresousa, @catarinasantos",
  },
  england: {
    country: "Inglaterra",
    nameExamples: '"James Wilson", "Sarah Mitchell", "Harry Thompson", "Emma Clarke", "Jack Robinson", "Olivia Hughes", "Tom Walker"',
    handleExamples: "@jameswilson, @sarahmitch_22, @harryt10, @emmaclarke, @jackrobinson_fc, @oliviahughes",
  },
  spain: {
    country: "Espanha",
    nameExamples: '"Carlos García", "María López", "Javier Martínez", "Lucía Fernández", "Sergio Ruiz", "Paula Sánchez", "Álvaro Romero"',
    handleExamples: "@carlosgarcia, @marialopez_, @javimartinez10, @luciafdz, @sergioruiz_es, @paulasanchez22",
  },
  italy: {
    country: "Itália",
    nameExamples: '"Marco Rossi", "Giulia Bianchi", "Luca Ferrari", "Sara Romano", "Matteo Conti", "Francesca Greco", "Alessandro Ricci"',
    handleExamples: "@marcorossi, @giuliabianchi, @lucaferrari10, @sararomano_, @matteoconti, @francescagreco",
  },
  germany: {
    country: "Alemanha",
    nameExamples: '"Lukas Müller", "Anna Schmidt", "Max Weber", "Lena Fischer", "Felix Becker", "Julia Wagner", "Jonas Hoffmann"',
    handleExamples: "@lukasmuller, @annaschmidt, @maxweber10, @lenafischer_, @felixbecker, @juliawagner",
  },
  france: {
    country: "França",
    nameExamples: '"Antoine Dubois", "Camille Laurent", "Lucas Martin", "Emma Bernard", "Hugo Moreau", "Léa Petit", "Maxime Roux"',
    handleExamples: "@antoinedubois, @camillelaurent, @lucasmartin10, @emmabernard_, @hugomoreau, @leapetit",
  },
  netherlands: {
    country: "Holanda",
    nameExamples: '"Daan de Vries", "Sanne van Dijk", "Lars Bakker", "Lotte Visser", "Jesse Jansen", "Eva de Boer", "Sem Smit"',
    handleExamples: "@daandevries, @sannevandijk, @larsbakker10, @lottevisser, @jessejansen, @evadeboer",
  },
  argentina: {
    country: "Argentina",
    nameExamples: '"Nicolás Gómez", "Sofía Fernández", "Matías Pérez", "Camila Rodríguez", "Lautaro Díaz", "Valentina Romero", "Tomás Álvarez"',
    handleExamples: "@nicogomez, @sofifdz, @matiasperez10, @camirodriguez, @lautaro_diaz, @valenromero",
  },
  usa: {
    country: "Estados Unidos",
    nameExamples: '"Michael Johnson", "Jessica Brown", "David Miller", "Ashley Davis", "Chris Anderson", "Megan Taylor", "Tyler Moore"',
    handleExamples: "@mikejohnson, @jessbrown22, @davemiller10, @ashleyd, @chrisanderson_fc, @megantaylor",
  },
  mexico: {
    country: "México",
    nameExamples: '"Diego Hernández", "Fernanda Torres", "Alejandro Ramírez", "Valeria Castro", "Emilio Vázquez", "Daniela Mendoza"',
    handleExamples: "@diegohernandez, @ferchatorres, @alejoramirez10, @valecastro, @emiliovz, @danimendoza",
  },
  belgium: {
    country: "Bélgica",
    nameExamples: '"Thomas Dupont", "Marie Vermeulen", "Lucas Janssens", "Eline Peeters", "Arthur Maes", "Charlotte Claes"',
    handleExamples: "@thomasdupont, @marievermeulen, @lucasjanssens, @elinepeeters_, @arthurmaes, @charlotteclaes",
  },
  scotland: {
    country: "Escócia",
    nameExamples: '"Callum Stewart", "Eilidh Campbell", "Ross MacDonald", "Niamh Murray", "Euan Robertson", "Iona Fraser"',
    handleExamples: "@callumstewart, @eilidhcampbell, @rossmacd10, @niamhmurray, @euanrobertson, @ionafraser",
  },
  turkey: {
    country: "Turquia",
    nameExamples: '"Mehmet Yılmaz", "Ayşe Demir", "Emre Kaya", "Zeynep Şahin", "Mustafa Çelik", "Elif Aydın", "Burak Öztürk"',
    handleExamples: "@mehmetyilmaz, @aysedemir, @emrekaya10, @zeynepsahin_, @mustafacelik, @elifaydin",
  },
  saudi: {
    country: "Arábia Saudita",
    nameExamples: '"Abdullah Al-Saud", "Fahad Al-Qahtani", "Khalid Al-Otaibi", "Sultan Al-Harbi", "Yousef Al-Ghamdi", "Saad Al-Dossari"',
    handleExamples: "@abdullahsaud, @fahadqahtani, @khalidotaibi10, @sultanharbi, @yousefghamdi, @saaddossari",
  },
  japan: {
    country: "Japão",
    nameExamples: '"Hiroshi Tanaka", "Yuki Suzuki", "Takeshi Sato", "Aya Watanabe", "Daiki Nakamura", "Mei Kobayashi", "Ren Yoshida"',
    handleExamples: "@hiroshitanaka, @yukisuzuki, @takeshisato10, @ayawatanabe_, @daikinakamura, @meikobayashi",
  },
  greece: {
    country: "Grécia",
    nameExamples: '"Giorgos Papadopoulos", "Eleni Nikolaou", "Dimitris Georgiou", "Maria Dimitriou", "Kostas Antoniou"',
    handleExamples: "@giorgospapa, @eleninikolaou, @dimitrisg10, @mariad_gr, @kostasantoniou",
  },
};

export function fanRegionFromLeague(clubLeague?: string | null): FanRegionProfile {
  const l = (clubLeague ?? "").toLowerCase();
  if (!l) return PROFILES.brazil;
  if (/(brasileir|brasil|brazil|s[eé]rie\s*[abcd]\b)/.test(l)) return PROFILES.brazil;
  if (/(primeira liga|liga portugal|portugue|portugal)/.test(l)) return PROFILES.portugal;
  if (/(premier league|championship|league one|league two|fa cup|england|english)/.test(l)) return PROFILES.england;
  if (/(la\s*liga|laliga|segunda divis|spain|espan|spanish)/.test(l)) return PROFILES.spain;
  if (/(serie\s*a\b|serie\s*b\b|coppa italia|italy|ital)/.test(l)) return PROFILES.italy;
  if (/(bundesliga|2\.\s*bundesliga|dfb|germany|deutsch)/.test(l)) return PROFILES.germany;
  if (/(ligue\s*1|ligue\s*2|france|french)/.test(l)) return PROFILES.france;
  if (/(eredivisie|keuken kampioen|netherlands|dutch|holland)/.test(l)) return PROFILES.netherlands;
  if (/(liga profesional|primera divisi[oó]n.*argent|argentin)/.test(l)) return PROFILES.argentina;
  if (/(\bmls\b|major league soccer|usl|usa|united states)/.test(l)) return PROFILES.usa;
  if (/(liga mx|liga bbva|mexico|mexican)/.test(l)) return PROFILES.mexico;
  if (/(jupiler|pro league|belgium|belgian)/.test(l)) return PROFILES.belgium;
  if (/(scottish|scotland|premiership)/.test(l)) return PROFILES.scotland;
  if (/(s[uü]per lig|turkey|turkish|t[uü]rkiye)/.test(l)) return PROFILES.turkey;
  if (/(saudi|roshn)/.test(l)) return PROFILES.saudi;
  if (/(j1|j2|j-league|japan|japanese)/.test(l)) return PROFILES.japan;
  if (/(super league.*greece|greek|hellen)/.test(l)) return PROFILES.greece;
  return PROFILES.brazil;
}

export function buildFanNamingRule(clubLeague?: string | null): string {
  const profile = fanRegionFromLeague(clubLeague);
  return `\n\nREGRA DE NOMES DOS TORCEDORES — ABSOLUTA:
Os torcedores comentando são da REGIÃO do clube (${profile.country}). Os nomes (displayName) e os @ (username) DEVEM refletir essa região, INDEPENDENTEMENTE do idioma do comentário.
- displayName DEVE ser nome típico de pessoa de ${profile.country}, ex: ${profile.nameExamples}.
- username DEVE ser handle derivado desse nome, no estilo: ${profile.handleExamples}.
- O CONTEÚDO do comentário continua no idioma exigido pelas outras regras (não traduza nem altere o idioma do texto), mas os NOMES não mudam por causa do idioma.
- Para o perfil "internacional" (quando aplicável), aí sim use nome de outro país, deixando claro no texto que está acompanhando de fora.`;
}
