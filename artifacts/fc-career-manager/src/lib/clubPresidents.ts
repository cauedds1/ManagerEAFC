import type { PersonalityStyle } from "@/types/diretoria";

export interface ClubPresidentData {
  name: string;
  personality: PersonalityStyle;
  patience: number;
  description: string;
}

export const CLUB_PRESIDENTS: Record<number, ClubPresidentData> = {
  541: { name: "Florentino Pérez", personality: "exigente", patience: 55, description: "Presidente galáctico do Real Madrid, sempre obcecado com títulos e grandes contratações. Exige excelência absoluta do técnico e não aceita mediocridade. Reage mal a sequências negativas, mas respeita treinadores que mantêm a identidade vencedora do clube. É um negociador implacável e tem enorme influência no futebol mundial." },
  529: { name: "Joan Laporta", personality: "emocional", patience: 50, description: "Presidente apaixonado do FC Barcelona, vive intensamente cada resultado do clube. Discursa sobre identidade, Cruyffismo e futebol de ataque em todas as ocasiões. Pode ser impulsivo e mudar de posição rapidamente dependendo dos resultados. Valoriza treinadores que entendem o DNA do Barça, mas cobra resultados no Camp Nou." },
  530: { name: "Enrique Cerezo", personality: "diplomatico", patience: 65, description: "Presidente experiente do Atlético de Madrid, prefere a estabilidade à espetacularidade. Gere conflitos internos com habilidade e raramente entra em confronto direto com o técnico. Tem paciência razoável para projetos de longo prazo, mas espera que o clube seja sempre competitivo. Valoriza lealdade e comprometimento acima de tudo." },
  489: { name: "Paolo Scaroni", personality: "analitico", patience: 60, description: "Presidente do AC Milan com perfil empresarial e racional. Toma decisões baseadas em dados financeiros e de desempenho. Reage com frieza a resultados ruins, mas exige explicações claras do corpo técnico. Valoriza a recuperação histórica do clube e não tolera gestão amadora." },
  505: { name: "Giuseppe Marotta", personality: "analitico", patience: 70, description: "CEO e presidente-executivo da Inter de Milão, referência em gestão esportiva italiana. Metódico, criterioso e sempre bem-informado sobre mercado de transferências. Dá suporte ao técnico desde que os números justifiquem as escolhas. Tem visão estratégica de longo prazo e raramente entra em pânico em momentos difíceis." },
  496: { name: "Gianluca Ferrero", personality: "conservador", patience: 65, description: "Presidente da Juventus num momento de reconstrução do clube. Adota postura cautelosa e prioriza a sustentabilidade financeira após anos de instabilidade. Apoia o projeto técnico enquanto vê evolução, mas é sensível à pressão da torcida fanática bianconera. Valoriza a tradição e os títulos históricos do clube." },
  492: { name: "Aurelio De Laurentiis", personality: "emocional", patience: 40, description: "Presidente temperamental do SSC Napoli, produtor cinematográfico de coração apaixonado. Envolve-se diretamente em decisões técnicas e não hesita em expressar insatisfação publicamente. Sequências negativas o deixam furioso e pode agir de forma impulsiva. No entanto, quando as coisas vão bem, é extremamente generoso e entusiasmado." },
  497: { name: "Dan Friedkin", personality: "conservador", patience: 70, description: "Presidente da AS Roma, investidor americano que assumiu o clube com ambições europeias. Gere o clube de forma discreta, preferindo não expor sua visão publicamente. Tem paciência com projetos de longo prazo, mas espera profissionalismo e dedicação. Entende a importância cultural do futebol romano e respeita a tradição do clube." },
  487: { name: "Claudio Lotito", personality: "exigente", patience: 45, description: "Presidente da SS Lazio, político e empresário com estilo de liderança autoritário. Controla o clube com mão-de-ferro e não hesita em confrontar técnicos ou jogadores quando os resultados desagradam. É detalhista e exige relatórios constantes sobre a situação do elenco. Extremamente exigente, mas leal aos que entregam resultados." },
  157: { name: "Herbert Hainer", personality: "diplomatico", patience: 65, description: "Presidente do Bayern de Munique, ex-CEO da Adidas com perfil corporativo e polido. Mantém a estrutura vencedora do clube funcionando com profissionalismo. Evita conflitos públicos e prefere resolver questões internamente. Tem expectativas altíssimas dada a história do clube, mas dá suporte ao projeto técnico enquanto os resultados se mantêm competitivos." },
  165: { name: "Hans-Joachim Watzke", personality: "emocional", patience: 55, description: "CEO do Borussia Dortmund, voz da identidade amarelo-preta. Apaixonado pelo clube e pela conexão com a torcida do Muro Amarelo. Envolve-se emocionalmente nos resultados e cobra o mesmo nível de comprometimento do corpo técnico. Valoriza o futebol de ataque e as estrelas reveladas pela academia do BVB." },
  168: { name: "Fernando Carro", personality: "exigente", patience: 50, description: "CEO do Bayer Leverkusen numa era de ambições renovadas. Meticuloso e altamente exigente com a performance coletiva. Após o título histórico da Bundesliga, as expectativas no clube subiram muito. Não aceita regressão e pressiona o técnico para manter padrões elevados. Analisa cada detalhe das atuações do elenco." },
  85: { name: "Nasser Al-Khelaïfi", personality: "agressivo", patience: 35, description: "Presidente do Paris Saint-Germain e figura do Qatar Sports Investments. Movimenta o futebol mundial com seu poder financeiro e ambição desmedida. Não aceita nada menos que a Liga dos Campeões e pressiona o técnico constantemente. Pode ser impulsivo e mudar a diretriz do clube abruptamente quando as expectativas não são atendidas. Altamente influente no cenário político do futebol europeu." },
  40: { name: "Tom Werner", personality: "conservador", patience: 60, description: "Chairman do Liverpool FC, americano que representa a FSG na Inglaterra. Toma decisões com base em análise de dados e sustentabilidade financeira. Não costuma fazer movimentos impulsivos no mercado, preferindo o desenvolvimento de talentos. Dá suporte ao projeto técnico no longo prazo, mas espera consistência nos resultados da Premier League." },
  42: { name: "Stan Kroenke", personality: "analitico", patience: 75, description: "Proprietário e presidente do Arsenal, empresário americano do ramo esportivo. Mantém distância da gestão diária e delega decisões esportivas à diretoria especializada. Tem paciência considerável para projetos de longo prazo e investe progressivamente na modernização do clube. Valoriza estabilidade financeira e crescimento sustentável." },
  49: { name: "Todd Boehly", personality: "agressivo", patience: 40, description: "Co-proprietário e co-presidente executivo do Chelsea. Empresário americano que chegou com investimentos massivos e ambições imediatas. Envolveu-se diretamente em contratações e pode ser impulsivo nas decisões. Espera resultados rápidos em troca dos investimentos realizados e não tem paciência prolongada com sequências negativas." },
  47: { name: "Daniel Levy", personality: "analitico", patience: 55, description: "Chairman do Tottenham Hotspur, negociador habilidoso e profundamente detalhista. Controla finanças com rigor e raramente aceita pagar além do considerado justo. Tem expectativas altas, mas tende a apoiar o técnico por um período razoável. Valoriza desenvolvimento de elenco e eficiência financeira no mercado de transferências." },
  33: { name: "Jim Ratcliffe", personality: "exigente", patience: 45, description: "Co-proprietário do Manchester United com mandato para recuperar o clube de uma crise longa. Perfil de empresário de alta performance, acostumado com eficiência e resultados. Exige que o clube volte a ser referência mundial no menor tempo possível. Não tem paciência para desculpas e cobra comprometimento total do técnico e do elenco." },
  34: { name: "Yasir Al-Rumayyan", personality: "diplomatico", patience: 70, description: "Presidente do Newcastle United, representante do PIF saudita. Toma decisões estratégicas de forma deliberada e mantém perfil discreto. Entende que o projeto de reconstrução do clube é de longo prazo e dá suporte ao corpo técnico enquanto vê progresso. Tem ambições enormes para o clube, mas age com paciência de investidor estratégico." },
  50: { name: "Khaldoon Al Mubarak", personality: "exigente", patience: 45, description: "Presidente do Manchester City, representante dos investidores de Abu Dhabi. Articulado e ambicioso, exige que o clube mantenha os mais altos padrões mundiais. Tem foco absoluto em títulos e não aceita regressão. Dá suporte ao técnico enquanto os resultados confirmam o projeto vencedor, mas espera dominância constante." },
  536: { name: "José María del Nido Carrasco", personality: "emocional", patience: 50, description: "Presidente do Sevilla FC, filho de um dos maiores presidentes da história do clube. Apaixonado pelo clube e pela sua tradição europeia. Envolve-se emocionalmente nos resultados e pode ser impulsivo em momentos de crise. Valoriza a identidade sevilhana e o futebol de alta intensidade que caracterizou os anos dourados do clube na Europa." },
  532: { name: "Layhoon Chan", personality: "conservador", patience: 65, description: "Presidente do Valencia CF, representante dos interesses de Peter Lim no clube. Gere com cautela financeira e prefere evitar confrontos públicos. Tem paciência com projetos graduais, mas enfrenta pressão constante da torcida local. Valoriza estabilidade e busca recuperar a relevância histórica do clube na La Liga." },
  127: { name: "Rodrigo Dunshee", personality: "exigente", patience: 50, description: "Presidente do Clube de Regatas do Flamengo, advogado e dirigente de longa data. Representa as ambições nacionais e internacionais do maior clube do Brasil. Exige títulos e não aceita mediocridade, dada a dimensão histórica e financeira do Flamengo. Valoriza o futebol ofensivo e cobra postura vencedora em todos os jogos." },
  121: { name: "Leila Pereira", personality: "agressivo", patience: 40, description: "Presidente da SE Palmeiras, empresária dona da Crefisa. Investiu massivamente no clube e cobra resultados proporcionais aos recursos aplicados. É direta, impulsiva e não hesita em manifestar insatisfação publicamente. Tem expectativas altíssimas e pode ser implacável com técnicos que não entregam títulos." },
  131: { name: "Augusto Melo", personality: "diplomatico", patience: 60, description: "Presidente do Sport Club Corinthians Paulista, político experiente no ambiente clube. Navega entre diferentes grupos de torcidas e interesses. Tenta equilibrar as demandas esportivas com as limitações financeiras do clube. Tem paciência moderada e valoriza a lealdade dos jogadores com a camisa alvinegra." },
  137: { name: "Julio Casares", personality: "conservador", patience: 65, description: "Presidente do São Paulo Futebol Clube, médico e dirigente respeitado. Administra o clube com foco na recuperação financeira e esportiva após anos difíceis. Dá suporte ao projeto técnico enquanto vê evolução, mas cobra competitividade. Valoriza a história tricolor e busca devolver o São Paulo ao topo do futebol brasileiro." },
  136: { name: "Marcelo Teixeira", personality: "emocional", patience: 55, description: "Presidente do Santos FC, personagem histórico do clube praiano. Apaixonado pelo futebol de ataque e pela tradição santista. Cobra que o Santos jogue bonito e seja competitivo, mesmo em momentos de reconstrução. Reage mal a derrotas dentro da Vila Belmiro e pode ser vocal na sua insatisfação com a imprensa." },
  118: { name: "Alberto Guerra", personality: "analitico", patience: 60, description: "Presidente do Grêmio Foot-Ball Porto Alegrense, dirigente focado na reestruturação do clube. Analisa o desempenho com dados e tem postura racional. Dá suporte técnico enquanto vê processo evolutivo, mas cobra competitividade na Série A. Valoriza as categorias de base e a identidade defensiva que marcou o clube historicamente." },
  119: { name: "Alessandro Barcellos", personality: "diplomatico", patience: 65, description: "Presidente do Sport Club Internacional, ex-goleiro e dirigente carismático. Transita bem entre torcida, jogadores e imprensa. Tem paciência com projetos de desenvolvimento e valoriza o equilíbrio dentro do grupo. Cobra comprometimento com a camisa vermelha e quer ver o Inter brigando por títulos nacionais." },
  110: { name: "Sérgio Coelho", personality: "exigente", patience: 50, description: "Presidente do Clube Atlético Mineiro, dirigente ambicioso que conduziu o clube à Copa Libertadores. Não se contenta com resultados mediocres e exige que o Galo seja protagonista em todas as competições. Tem paciência limitada com sequências negativas e pode ser vocal na sua cobrança ao corpo técnico. Valorizou muito os títulos recentes." },
  104: { name: "Pedro Lourenço", personality: "agressivo", patience: 45, description: "Presidente do Cruzeiro Esporte Clube, empresário que assumiu o clube na SAF e investiu pesado na reabilitação. Tem perfil empreendedor e não hesita em tomar decisões rápidas. Espera retorno imediato do investimento em forma de títulos e projeção nacional. Cobra alta performance e pode ser impulsivo quando os resultados frustram." },
  114: { name: "John Textor", personality: "agressivo", patience: 45, description: "Presidente do Botafogo de Futebol e Regatas, empresário americano dono do Eagle Football Group. Movimenta o clube com recursos internacionais e ambições de escala global. Não hesita em confrontar a mídia e dirigentes rivais. Espera resultados expressivos dos investimentos realizados e pode ser impulsivo em momentos de pressão." },
  130: { name: "Mário Bittencourt", personality: "diplomatico", patience: 60, description: "Presidente do Fluminense Football Club, advogado e dirigente articulado. Administra bem as relações políticas no futebol brasileiro. Tem paciência com projetos de longo prazo e valoriza a identidade do Fluminense. Cobra competitividade mas entende os ciclos do futebol. Valoriza muito o Maracanã e a tradição carioca do clube." },
  1: { name: "Vicente Moreno", personality: "conservador", patience: 65, description: "Presidente de clube com perfil conservador e gestão criteriosa. Prefere estabilidade e crescimento gradual ao risco. Dá suporte ao técnico enquanto vê progressão, mas cobra competitividade consistente." },
};

const PERSONALITY_DESCRIPTIONS: Record<string, Record<string, string>> = {
  conservador: {
    pt: "Presidente conservador e criterioso, prefere estabilidade ao risco. Dá suporte ao técnico enquanto vê progressão e cobra resultados consistentes.",
    en: "Conservative and careful president who prefers stability over risk. Supports the manager while seeing progress and demands consistent results.",
  },
  agressivo: {
    pt: "Presidente exigente e impaciente, espera resultados imediatos dos investimentos. Pode ser impulsivo em momentos de crise e pressiona o técnico constantemente.",
    en: "Demanding and impatient president who expects immediate results from investments. Can be impulsive in crisis moments and constantly pressures the manager.",
  },
  analitico: {
    pt: "Presidente analítico que toma decisões baseadas em dados. Avalia o desempenho com critério e dá suporte ao projeto enquanto os números justificam as escolhas.",
    en: "Analytical president who makes data-driven decisions. Evaluates performance carefully and supports the project while the numbers justify the choices.",
  },
  emocional: {
    pt: "Presidente apaixonado que vive intensamente cada resultado. Pode ser impulsivo quando as coisas não vão bem, mas é extremamente generoso nos momentos de vitória.",
    en: "Passionate president who lives every result intensely. Can be impulsive when things are not going well but is extremely generous in moments of victory.",
  },
  diplomatico: {
    pt: "Presidente diplomático que navega bem entre torcida, jogadores e imprensa. Tem paciência com projetos de longo prazo e valoriza o comprometimento da equipe.",
    en: "Diplomatic president who navigates well between fans, players and press. Patient with long-term projects and values team commitment.",
  },
  exigente: {
    pt: "Presidente altamente exigente que não aceita mediocridade. Cobra alta performance em todas as competições e tem expectativas proporcionais ao potencial do clube.",
    en: "Highly demanding president who does not accept mediocrity. Demands high performance in all competitions and has expectations proportional to the club's potential.",
  },
};

const PATIENCE_BY_PERSONALITY: Record<string, number> = {
  conservador: 70,
  diplomatico: 68,
  analitico: 65,
  emocional: 52,
  exigente: 48,
  agressivo: 42,
};

const COUNTRY_NAMES: Record<string, string[]> = {
  Brazil: ["Carlos Eduardo Menezes", "Roberto Alves", "Fábio Rodrigues", "Marcelo Santos", "André Carvalho", "Paulo Henrique Costa", "Luiz Fernando Souza"],
  England: ["Richard Thompson", "Michael Davies", "James Harrison", "Robert Clarke", "Andrew Wilson", "David Holloway", "Peter Ashworth"],
  Spain: ["Alejandro García", "Carlos Martínez", "Miguel Ángel López", "Francisco Romero", "Javier Sánchez", "Antonio Fernández", "Rafael Moreno"],
  Italy: ["Luca Colombo", "Marco Rossi", "Giorgio Ferrari", "Alessandro Bruno", "Francesco Ricci", "Roberto Conti", "Stefano Palermo"],
  Germany: ["Klaus Werner", "Jürgen Hoffmann", "Hans Schäfer", "Stefan Bauer", "Michael Koch", "Thomas Richter", "Andreas Schulz"],
  France: ["Jean-Pierre Moreau", "Philippe Lambert", "Michel Dupont", "François Martin", "Bernard Leroy", "Thierry Simon", "Alain Petit"],
  Portugal: ["João Ferreira", "Rui Pinto", "Pedro Sousa", "Nuno Almeida", "Miguel Costa", "Luís Rodrigues", "António Silva"],
  Netherlands: ["Jan van der Berg", "Pieter Visser", "Willem de Groot", "Hendrik Bakker", "Johan Smit", "Dirk Muller", "Koen Jansen"],
  Argentina: ["Diego Rodríguez", "Martín González", "Pablo Álvarez", "Gustavo Pérez", "Hernán López", "Alejandro Silva", "Nicolás Castro"],
  Mexico: ["Alejandro Torres", "Carlos Morales", "Roberto Gutiérrez", "Miguel Flores", "Juan Manuel Reyes", "Rodrigo Vargas", "Luis Medina"],
  default: ["James Miller", "Carlos Oliveira", "Marco Ricci", "Pierre Dupont", "Heinrich Müller", "Alejandro Ruiz", "Ahmad Al-Hassan"],
};

function getRandomItem<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export function getClubPresident(clubId: number): ClubPresidentData | null {
  return CLUB_PRESIDENTS[clubId] ?? null;
}

export function buildFallbackPresident(
  clubId: number,
  clubCountry?: string,
  personality?: string,
): ClubPresidentData {
  const pers = (personality ?? "diplomatico") as PersonalityStyle;
  const patience = PATIENCE_BY_PERSONALITY[pers] ?? 60;
  const countryNames = COUNTRY_NAMES[clubCountry ?? ""] ?? COUNTRY_NAMES.default;
  const name = getRandomItem(countryNames, clubId);
  const descMap = PERSONALITY_DESCRIPTIONS[pers] ?? PERSONALITY_DESCRIPTIONS.diplomatico;
  const description = descMap.pt;
  return { name, personality: pers, patience, description };
}
