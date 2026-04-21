export type Lang = "pt" | "en";

// ─────────────────────────────────────────────────────────────────────────────
// Landing Page — flat strings
// ─────────────────────────────────────────────────────────────────────────────
export const LP: Record<Lang, Record<string, string>> = {
  pt: {
    // navbar
    navFeatures: "Funcionalidades",
    navAI: "IA",
    navClub: "Clube",
    navHowItWorks: "Como funciona",
    navCta: "Entrar no jogo",
    soundOn: "Silenciar estádio",
    soundOff: "Som do estádio",
    // hero
    heroLine1: "Você lembra do título",
    heroLine2: "A gente também.",
    heroDesc: "Registre partidas, acompanhe estatísticas, leia notícias geradas por IA e gerencie seu clube com a imersão que o modo carreira merece.",
    heroCta: "Iniciar Carreira",
    heroCoachesLabel: "técnicos",
    heroCoachesSub: "jogando neste momento",
    // hero mockup
    heroMockupSeason: "La Liga · 2026/27",
    heroMockupAnimated: "● Animada",
    heroMockupTabPainel: "Painel",
    heroMockupTabPartidas: "Partidas",
    heroMockupTabClube: "Clube",
    heroMockupTabNoticias: "Notícias",
    heroMockupTabDiretoria: "Diretoria",
    heroMockupStatPartidas: "Partidas",
    heroMockupStatPos: "Pos",
    heroMockupStatElenco: "Elenco",
    heroMockupStatPontos: "Pontos",
    heroMockupLastMatches: "ÚLTIMAS PARTIDAS",
    // hero reels mockup
    heroReelsLabel: "SEUS MOMENTOS, IMORTALIZADOS",
    heroReelsSub: "Registre, reviva e compartilhe cada golaço da sua carreira",
    // painel mockup
    mockupPainelStatPartidas: "Partidas",
    mockupPainelStatVitorias: "Vitórias",
    mockupPainelStatGols: "Gols",
    mockupPainelForma: "FORMA RECENTE",
    mockupPainelTabPainel: "Painel",
    mockupPainelTabPartidas: "Partidas",
    mockupPainelTabElenco: "Elenco",
    mockupResultW: "V",
    mockupResultD: "E",
    mockupResultL: "D",
    // match mockup
    mockupMatchLabel: "REGISTRAR PARTIDA",
    mockupMatchNewspaper: "A GAZETA DO TÉCNICO",
    mockupMatchBig: "GOLEADA HISTÓRICA — TORCIDA VAI AO DELÍRIO NO CAMP NOU",
    mockupMatchWin: "VITÓRIA SUADA: BARCELONA SEGURA A PRESSÃO E LEVA OS 3 PONTOS",
    mockupMatchDraw: "EMPATE FRUSTRANTE: BARCELONA NÃO CONVERTE E DIVIDE OS PONTOS",
    mockupMatchLoss: "DERROTA AMARGA — BARCELONA PRECISA REAGIR",
    mockupMatchBigLoss: "DERROTA PESADA — TÉCNICO TEM MUITO A ANALISAR",
    // squad mockup
    mockupElencoLabel: "ELENCO · 33 JOGADORES",
    mockupElencoAdd: "+ Adicionar",
    // transfers mockup
    mockupTransfLabel: "JANELA DE TRANSFERÊNCIAS",
    mockupTransfFrom: "de",
    mockupTransfTo: "para",
    mockupTransfBalance: "Saldo da janela",
    // finances mockup
    mockupFinLabel: "GESTÃO FINANCEIRA",
    mockupFinBudget: "Orçamento total",
    mockupFinSalary: "Folha salarial",
    mockupFinRevenue: "Receita (bilheteria)",
    mockupFinMarket: "Valor de mercado",
    // trophies mockup
    mockupTrophiesLabel: "ARMÁRIO DE TROFÉUS · 3 CONQUISTAS",
    mockupTrophiesSeason: "Temporada",
    // ai mockup
    mockupAILive: "ao vivo",
    mockupAIHeadline: "LEWANDOWSKI MARCA HAT-TRICK E BARCELONA GOLEIA POR 4–0",
    mockupAIBody: "Em noite histórica no Camp Nou, o atacante polaco atingiu a marca de 30 gols na temporada. Torcida canta seu nome até depois do apito final.",
    // diretoria mockup
    mockupDirLabel: "REUNIÃO — JOAN LAPORTA",
    mockupDirQuote: "\"Impressionante. Cinco vitórias seguidas e o melhor ataque da liga. A diretoria está muito satisfeita com o seu trabalho, mister.\"",
    mockupDirConfidence: "Confiança da diretoria",
    // features section
    featuresLabel: "Funcionalidades",
    featuresTitle: "Tudo que um técnico de verdade precisa",
    // club/theme section
    customizationLabel: "Personalização",
    customizationTitle: "O app se transforma com o seu clube",
    clubInputPlaceholder: "Ou digite outro clube...",
    clubNotFound: "Clube não encontrado. Em breve!",
    // AI section
    aiLabel: "Inteligência Artificial",
    aiTitle: "A imprensa que sua carreira merece",
    aiPoint1: "Notícias automáticas baseadas em eventos reais da sua carreira",
    aiPoint2: "Reuniões com a diretoria que cobram metas e comentam o desempenho",
    aiPoint3: "Tom que muda conforme você vence ou perde — épico, dramático, irônico",
    aiPoint4: "Hat-tricks viram manchetes. Viradas se tornam lendas.",
    aiGenLabel: "Gere a sua notícia agora",
    aiGenClubPlaceholder: "Seu clube (ex: Grêmio)",
    aiGenResultPlaceholder: "Resultado (3-1)",
    aiGenBtn: "Gerar notícia →",
    aiNewsMastheadTitle: "A GAZETA DO TÉCNICO",
    aiNewsLive: "ao vivo",
    aiNewsCardGenerated: "Gerado agora",
    // how it works
    howLabel: "Como funciona",
    howTitle: "Quatro passos para começar",
    // pricing
    pricingLabel: "Planos",
    pricingTitle: "Escolha o seu nível de obsessão",
    pricingFreeForever: "Grátis para sempre",
    pricingFreeForWho: "Para quem quer começar",
    pricingFreeBtn: "Começar grátis",
    pricingProForWho: "Para quem leva a sério",
    pricingProBadge: "Mais popular",
    pricingProBtn: "Assinar Pro",
    pricingPerMonth: "por mês",
    pricingUltraForWho: "Para os obcecados",
    pricingUltraBtn: "Assinar Ultra",
    freeFeat1: "1 carreira ativa",
    freeFeat2: "3 gerações de IA por dia",
    freeFeat3: "Partidas ilimitadas",
    freeFeat4: "Sem diretoria",
    proFeat1: "Até 5 carreiras ativas",
    proFeat2: "20 gerações de IA por dia",
    proFeat3: "Diretoria com até 2 membros",
    proFeat4: "Notícias geradas em segundos",
    ultraFeat1: "Boatos no vestiário",
    ultraFeat2: "Até 3 portais de notícias personalizados",
    ultraFeat3: "Carreiras ilimitadas",
    ultraFeat4: "Diretoria ilimitada",
    ultraFeat5: "IA com notícias mais detalhadas e dramáticas",
    ultraFeat6: "Notícias automáticas",
    // testimonials
    testimonialsLabel: "Depoimentos",
    testimonialsTitle: "O que os técnicos dizem",
    // faq
    faqLabel: "FAQ",
    faqTitle: "Perguntas frequentes",
    // cta final
    ctaLabel: "Comece agora",
    ctaLine1: "A próxima conquista",
    ctaLine2: "merece ser registrada.",
    ctaBtn: "Iniciar Carreira — É grátis",
    // footer
    footerTerms: "Termos",
    footerPrivacy: "Privacidade",
    footerSupport: "Suporte",
    footerRights: "Todos os direitos reservados.",
  },
  en: {
    // navbar
    navFeatures: "Features",
    navAI: "AI",
    navClub: "Club",
    navHowItWorks: "How it works",
    navCta: "Get started",
    soundOn: "Mute stadium",
    soundOff: "Stadium sound",
    // hero
    heroLine1: "You remember the title.",
    heroLine2: "So do we.",
    heroDesc: "Track matches, follow stats, read AI-generated news and manage your club with the immersion that career mode truly deserves.",
    heroCta: "Start Career",
    heroCoachesLabel: "managers",
    heroCoachesSub: "playing right now",
    // hero mockup
    heroMockupSeason: "La Liga · 2026/27",
    heroMockupAnimated: "● Live",
    heroMockupTabPainel: "Dashboard",
    heroMockupTabPartidas: "Matches",
    heroMockupTabClube: "Club",
    heroMockupTabNoticias: "News",
    heroMockupTabDiretoria: "Board",
    heroMockupStatPartidas: "Matches",
    heroMockupStatPos: "Pos",
    heroMockupStatElenco: "Squad",
    heroMockupStatPontos: "Points",
    heroMockupLastMatches: "LATEST MATCHES",
    // hero reels mockup
    heroReelsLabel: "YOUR MOMENTS, IMMORTALIZED",
    heroReelsSub: "Record, relive and share every goal of your career",
    // painel mockup
    mockupPainelStatPartidas: "Matches",
    mockupPainelStatVitorias: "Wins",
    mockupPainelStatGols: "Goals",
    mockupPainelForma: "RECENT FORM",
    mockupPainelTabPainel: "Dashboard",
    mockupPainelTabPartidas: "Matches",
    mockupPainelTabElenco: "Squad",
    mockupResultW: "W",
    mockupResultD: "D",
    mockupResultL: "L",
    // match mockup
    mockupMatchLabel: "LOG MATCH",
    mockupMatchNewspaper: "THE MANAGER'S GAZETTE",
    mockupMatchBig: "HISTORIC THRASHING — FANS GO WILD AT CAMP NOU",
    mockupMatchWin: "HARD-FOUGHT WIN: BARCELONA HOLDS FIRM AND TAKES ALL 3 POINTS",
    mockupMatchDraw: "FRUSTRATING DRAW: BARCELONA FAILS TO CONVERT AND SHARES THE SPOILS",
    mockupMatchLoss: "BITTER DEFEAT — BARCELONA NEEDS TO REACT",
    mockupMatchBigLoss: "HEAVY DEFEAT — MANAGER HAS A LOT TO ANALYSE",
    // squad mockup
    mockupElencoLabel: "SQUAD · 33 PLAYERS",
    mockupElencoAdd: "+ Add",
    // transfers mockup
    mockupTransfLabel: "TRANSFER WINDOW",
    mockupTransfFrom: "from",
    mockupTransfTo: "to",
    mockupTransfBalance: "Window balance",
    // finances mockup
    mockupFinLabel: "FINANCIAL MANAGEMENT",
    mockupFinBudget: "Total budget",
    mockupFinSalary: "Wage bill",
    mockupFinRevenue: "Revenue (tickets)",
    mockupFinMarket: "Market value",
    // trophies mockup
    mockupTrophiesLabel: "TROPHY CABINET · 3 TROPHIES",
    mockupTrophiesSeason: "Season",
    // ai mockup
    mockupAILive: "live",
    mockupAIHeadline: "LEWANDOWSKI HAT-TRICK AS BARCELONA ROUT RIVALS 4–0",
    mockupAIBody: "In a historic night at Camp Nou, the Polish striker reached 30 goals for the season. Fans chanted his name long after the final whistle.",
    // diretoria mockup
    mockupDirLabel: "MEETING — JOAN LAPORTA",
    mockupDirQuote: "\"Impressive. Five wins in a row and the best attack in the league. The board is very pleased with your work, gaffer.\"",
    mockupDirConfidence: "Board confidence",
    // features section
    featuresLabel: "Features",
    featuresTitle: "Everything a real manager needs",
    // club/theme section
    customizationLabel: "Customization",
    customizationTitle: "The app transforms with your club",
    clubInputPlaceholder: "Or type another club...",
    clubNotFound: "Club not found. Coming soon!",
    // AI section
    aiLabel: "Artificial Intelligence",
    aiTitle: "The press coverage your career deserves",
    aiPoint1: "Automatic news based on real events in your career",
    aiPoint2: "Board meetings that demand targets and review your performance",
    aiPoint3: "Tone that shifts as you win or lose — epic, dramatic, ironic",
    aiPoint4: "Hat-tricks become headlines. Comebacks become legends.",
    aiGenLabel: "Generate your news now",
    aiGenClubPlaceholder: "Your club (e.g. Arsenal)",
    aiGenResultPlaceholder: "Score (3-1)",
    aiGenBtn: "Generate news →",
    aiNewsMastheadTitle: "THE MANAGER'S GAZETTE",
    aiNewsLive: "live",
    aiNewsCardGenerated: "Generated now",
    // how it works
    howLabel: "How it works",
    howTitle: "Four steps to get started",
    // pricing
    pricingLabel: "Plans",
    pricingTitle: "Choose your level of obsession",
    pricingFreeForever: "Free forever",
    pricingFreeForWho: "For those who want to start",
    pricingFreeBtn: "Start for free",
    pricingProForWho: "For those who take it seriously",
    pricingProBadge: "Most popular",
    pricingProBtn: "Subscribe Pro",
    pricingPerMonth: "per month",
    pricingUltraForWho: "For the obsessed",
    pricingUltraBtn: "Subscribe Ultra",
    freeFeat1: "1 active career",
    freeFeat2: "3 AI generations per day",
    freeFeat3: "Unlimited matches",
    freeFeat4: "No board",
    proFeat1: "Up to 5 active careers",
    proFeat2: "20 AI generations per day",
    proFeat3: "Board with up to 2 members",
    proFeat4: "News generated in seconds",
    ultraFeat1: "Locker room rumours",
    ultraFeat2: "Up to 3 custom news portals",
    ultraFeat3: "Unlimited careers",
    ultraFeat4: "Unlimited board",
    ultraFeat5: "AI with more dramatic & detailed news",
    ultraFeat6: "Automatic news",
    // testimonials
    testimonialsLabel: "Testimonials",
    testimonialsTitle: "What managers say",
    // faq
    faqLabel: "FAQ",
    faqTitle: "Frequently asked questions",
    // cta final
    ctaLabel: "Start now",
    ctaLine1: "Your next trophy",
    ctaLine2: "deserves to be remembered.",
    ctaBtn: "Start Career — It's free",
    // footer
    footerTerms: "Terms",
    footerPrivacy: "Privacy",
    footerSupport: "Support",
    footerRights: "All rights reserved.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Landing — AI typing texts
// ─────────────────────────────────────────────────────────────────────────────
export function getAiTexts(lang: Lang) {
  if (lang === "en") return [
    { headline: "EPIC COMEBACK: MANAGER TURNS DEFEAT INTO TRIUMPH IN STOPPAGE TIME", body: "In a game that seemed lost, Barcelona produced one of the greatest comebacks of the season. Trailing until the 88th minute, two quick goals rewrote history and sent the crowd into delirium." },
    { headline: "YAMAL'S HISTORIC HAT-TRICK CEMENTS TOP SPOT IN LA LIGA", body: "The young star lit up the night with three goals of exceptional quality. The individual display pushed Barcelona clear at the top and reignited debate about the best moment of the player's career." },
    { headline: "LAPORTA EXPRESSES CONFIDENCE AFTER 9-MATCH UNBEATEN RUN", body: "This week's board meeting was filled with praise for the tactical work. The president signalled investment for the winter window. Fans are buzzing about the best football of the season." },
  ];
  return [
    { headline: "VIRADA ÉPICA: TÉCNICO TRANSFORMA DERROTA EM TRIUNFO NOS ACRÉSCIMOS", body: "Em um jogo que parecia perdido, o Barcelona protagonizou uma das maiores viradas da temporada. Atrás no placar até os 88 minutos, dois gols em sequência reescreveram a história e enviaram a torcida ao delírio." },
    { headline: "HAT-TRICK HISTÓRICO DE YAMAL CONSOLIDA POSIÇÃO NA LIDERANÇA DA LA LIGA", body: "O jovem astro voltou a brilhar com três gols de qualidade técnica excepcional. A atuação individual elevou o Barcelona ao primeiro lugar com folga e acendeu o debate sobre o melhor momento da carreira do atleta." },
    { headline: "LAPORTA REFORÇA CONFIANÇA APÓS SEQUÊNCIA DE 9 JOGOS INVICTO", body: "A reunião desta semana com o conselho foi marcada por elogios ao trabalho tático. O presidente sinalizou recursos para a janela de inverno. A torcida vibra com o melhor futebol da temporada." },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing — news generator templates
// ─────────────────────────────────────────────────────────────────────────────
export function getHeadlineTemplates(lang: Lang): Array<(c: string, s: string) => string> {
  if (lang === "en") return [
    (c, s) => `${c.toUpperCase()} DOMINATES WITH ${s} AND SHOOTS TO THE TOP OF THE TABLE`,
    (c, s) => `HISTORIC COMEBACK: ${c.toUpperCase()} FINDS ${s} IN STOPPAGE TIME`,
    (c, s) => `${c.toUpperCase()} CONFIRMS EXCEPTIONAL FORM WITH ${s}`,
    (c, s) => `TACTICAL MASTERCLASS: ${c.toUpperCase()} EXECUTES PERFECT PLAN — ${s}`,
    (c, s) => `${c.toUpperCase()} GOES TOP WITH ${s} — A SEASON FOR THE HISTORY BOOKS`,
  ];
  return [
    (c, s) => `${c.toUpperCase()} DOMINA COM ${s} E DISPARA NA LIDERANÇA DA TABELA`,
    (c, s) => `VIRADA HISTÓRICA: ${c.toUpperCase()} BUSCA ${s} NOS ACRÉSCIMOS`,
    (c, s) => `${c.toUpperCase()} CONFIRMA FASE EXCEPCIONAL COM RESULTADO DE ${s}`,
    (c, s) => `MAESTRO TÉCNICO: ${c.toUpperCase()} EXECUTA PLANO PERFEITO — ${s}`,
    (c, s) => `${c.toUpperCase()} SOBE AO TOPO COM PLACAR DE ${s} — TEMPORADA HISTÓRICA`,
  ];
}

export function getBodyTemplates(lang: Lang): Array<(c: string) => string> {
  if (lang === "en") return [
    c => `In a performance that will live long in the memory, ${c} showed tactical maturity and technical quality above the rest. The manager was given a standing ovation, with the specialist press already talking about the title.`,
    c => `Yesterday's match made clear how much the team has evolved. ${c} pressed from the first minute and built the result with intelligence. In the corridors, talk of a title win is now open.`,
    c => `The numbers are impressive: ${c} has one of the most solid defences in the competition. The board is satisfied, and the manager's contract renewal is no longer a secret. The fans dare to dream. And rightly so.`,
    c => `More than the scoreline, what caught the eye was the style. ${c} played top-level football, combining intensity with technical refinement. Opponents will struggle to stop this well-oiled machine.`,
  ];
  return [
    c => `Em uma atuação que ficará na memória da torcida, o ${c} demonstrou maturidade tática e qualidade técnica acima da média. O técnico foi ovacionado ao deixar o campo, com a imprensa especializada já falando em título.`,
    c => `A partida de ontem deixou clara a evolução do trabalho do treinador. O ${c} pressionou desde o primeiro minuto e construiu o resultado com inteligência. Nos corredores, já se fala abertamente em conquista.`,
    c => `Os números impressionam: o ${c} mantém uma das defesas mais sólidas da competição. A diretoria está satisfeita, e a renovação de contrato do técnico não é mais segredo. A torcida sonha. E com razão.`,
    c => `Mais do que o placar, o que chamou atenção foi a forma. O ${c} exibiu futebol de alto nível, combinando intensidade com refinamento técnico. Os adversários terão trabalho para parar essa máquina azeitada.`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing — STEPS
// ─────────────────────────────────────────────────────────────────────────────
export function getSteps(lang: Lang) {
  if (lang === "en") return [
    { title: "Pick your club. Set up your system.", desc: "Define your tactical board, season goals and squad profile before the first whistle." },
    { title: "Log. Analyse. Evolve.", desc: "Every win, draw and defeat becomes data. Formation, shots, possession — the history FM gives you, here with your real stats." },
    { title: "Window open. Who stays, who goes?", desc: "Control the budget, negotiate transfers and keep the squad at the level your ambition demands." },
    { title: "The story only you can write.", desc: "AI generates the press coverage of your achievement. Share it. Save it. Remember every detail in 10 years." },
  ];
  return [
    { title: "Escolha seu clube. Configure seu sistema.", desc: "Defina a prancheta, os objetivos da temporada e o perfil do seu elenco antes do primeiro apito." },
    { title: "Registre. Analise. Evolua.", desc: "Cada vitória, derrota e empate vira dado. Formação, finalizações, posse — o histórico que o FM te dá, aqui com seus dados reais." },
    { title: "Janela aberta. Quem fica, quem vai?", desc: "Controle o orçamento, negocie transferências e mantenha o elenco no nível que sua ambição exige." },
    { title: "A notícia que só você pode escrever.", desc: "A IA gera a cobertura jornalística da sua conquista. Compartilhe. Salve. Lembre-se de cada detalhe daqui a 10 anos." },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing — FAQ
// ─────────────────────────────────────────────────────────────────────────────
export function getFaqItems(lang: Lang) {
  if (lang === "en") return [
    { q: "Is it free forever?", a: "Yes. The Free plan never expires and requires no credit card. You can log careers, matches and view stats without paying anything. Paid plans unlock advanced features like unlimited AI and multiple simultaneous careers." },
    { q: "Does it need to connect to the original game?", a: "No. FC Career Manager is completely independent. You enter data manually — exactly as you would in a notebook, but on a platform built for it. It works with any football simulator." },
    { q: "How does the AI news work?", a: "Our AI analyses your career data — results, goals, transfers, form — and creates contextual press coverage. Hat-tricks become headlines. Defeats carry the right dramatic tone. Titles turn into historic editorials." },
    { q: "Can I use it on mobile?", a: "Yes. The platform is fully responsive. It works in any modern browser, whether on your phone after a match or on your computer for deeper analysis." },
    { q: "What is the difference between Pro and Ultra?", a: "Pro adds unlimited careers, daily AI news without a daily cap and advanced reports. Ultra includes everything in Pro plus predictive analytics, data export, exportable full history and priority support." },
  ];
  return [
    { q: "É gratuito para sempre?", a: "Sim. O plano Grátis não tem expiração nem cartão de crédito. Você registra carreiras, partidas e consulta estatísticas sem pagar nada. Os planos pagos desbloqueiam funcionalidades avançadas como IA ilimitada e múltiplas carreiras simultâneas." },
    { q: "Precisa conectar com o jogo original?", a: "Não. O FC Career Manager é totalmente independente. Você insere os dados manualmente — exatamente como faria num caderno, só que com uma plataforma feita para isso. Funciona com qualquer simulador de futebol." },
    { q: "Como funciona a IA para as notícias?", a: "Nossa IA analisa os dados da sua carreira — resultados, gols, transferências, forma — e cria cobertura jornalística contextual. Hat-tricks viram manchetes. Derrotas têm o tom certo de drama. Títulos se tornam editoriais históricos." },
    { q: "Posso usar em dispositivos móveis?", a: "Sim. A plataforma é totalmente responsiva. Funciona em qualquer navegador moderno, seja no celular após a partida ou no computador para análises mais detalhadas." },
    { q: "O que diferencia Pro de Ultra?", a: "Pro adiciona carreiras ilimitadas, IA de notícias sem limite diário e relatórios avançados. Ultra inclui tudo do Pro mais análises preditivas, exportação de dados, histórico completo exportável e suporte prioritário." },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing — Testimonials
// ─────────────────────────────────────────────────────────────────────────────
export function getTestimonials(lang: Lang) {
  if (lang === "en") return [
    { initials: "CF", color: "#7c5cfc", name: "CareerFC", handle: "@careerfc", text: "Finally an app that takes career mode seriously. The AI-generated news is surreal — it reads like a real newspaper." },
    { initials: "TV", color: "#3d9cf5", name: "VirtualManager", handle: "@virtual_manager", text: "I'm in season 6 with Grêmio and I have a record of every transfer. This completely changed my experience of the game." },
    { initials: "MC", color: "#00e5a0", name: "CareerMode BR", handle: "@careermode_br", text: "The theme changes with your club. When I joined Barcelona it turned blue and garnet automatically. An incredible, immersive detail." },
  ];
  return [
    { initials: "CF", color: "#7c5cfc", name: "CarreiraFC", handle: "@carreira_fc", text: "Finalmente um app que trata o modo carreira com seriedade. As notícias geradas por IA são surreais — parece um jornal de verdade." },
    { initials: "TV", color: "#3d9cf5", name: "TécnicoVirtual", handle: "@tecnico_virtual", text: "Estou na temporada 6 com o Grêmio e tenho histórico de cada transferência. Isso mudou completamente minha experiência no jogo." },
    { initials: "MC", color: "#00e5a0", name: "ModoCarreira BR", handle: "@modocarreira_br", text: "O tema muda de acordo com o clube. Quando fui pro Barcelona, ficou azul e grená automaticamente. Detalhe incrível e imersivo." },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing — Features explorer
// ─────────────────────────────────────────────────────────────────────────────
export function getFeaturesExplorer(lang: Lang) {
  if (lang === "en") return [
    { id: "painel",      title: "Tactical Dashboard",   label: "Overview",      colorType: "tactical"  as const, accentColor: "#7c5cfc", desc: "Intelligence on every aspect of your career in one place. Form, stats, upcoming matches and club alerts." },
    { id: "partidas",    title: "Log Matches",          label: "Matches",       colorType: "tactical"  as const, accentColor: "#7c5cfc", desc: "Scoreline, formation, goals, cards and highlights. Every match becomes a permanent memory. Click the scores above to test it." },
    { id: "elenco",      title: "Squad Management",     label: "Squad",         colorType: "tactical"  as const, accentColor: "#7c5cfc", desc: "33 players with position, OVR, age and market value. Progress tracked season by season." },
    { id: "transferencias", title: "Transfers",         label: "Market",        colorType: "financial" as const, accentColor: "#3d9cf5", desc: "Log incoming and outgoing deals, negotiate fees and keep the complete history of every window. Your transfer ledger." },
    { id: "financeiro",  title: "Financial Management", label: "Finances",      colorType: "financial" as const, accentColor: "#3d9cf5", desc: "Budget, wage bill, revenues and squad market value. Run the club like a true sporting director." },
    { id: "trofeus",     title: "Trophy Cabinet",       label: "Trophies",      colorType: "trophies"  as const, accentColor: "#f59e0b", desc: "Every title earns its permanent place in the cabinet. Date, competition, highlights — the history you built." },
    { id: "noticias",    title: "AI News",              label: "Press",         colorType: "ai"        as const, accentColor: "#00e5a0", desc: "The Manager's Gazette covers every match with real journalistic quality. Hat-tricks become headlines. Titles become historic editorials." },
    { id: "diretoria",   title: "Board",                label: "Board",         colorType: "tactical"  as const, accentColor: "#7c5cfc", desc: "Meetings with the chairman, season targets and contract negotiations. The behind-the-scenes side of your career." },
  ];
  return [
    { id: "painel",      title: "Painel Tático",        label: "Visão Geral",   colorType: "tactical"  as const, accentColor: "#7c5cfc", desc: "Inteligência sobre cada aspecto da sua carreira em um único lugar. Forma, estatísticas, próximas partidas e alertas do clube." },
    { id: "partidas",    title: "Registrar Partidas",   label: "Partidas",      colorType: "tactical"  as const, accentColor: "#7c5cfc", desc: "Placar, formação, gols, cartões e destaques. Cada partida vira memória permanente. Clique nos números do placar acima para testar." },
    { id: "elenco",      title: "Gestão de Elenco",     label: "Elenco",        colorType: "tactical"  as const, accentColor: "#7c5cfc", desc: "33 jogadores com posição, OVR, idade e valor de mercado. Evolução acompanhada temporada por temporada." },
    { id: "transferencias", title: "Transferências",   label: "Mercado",        colorType: "financial" as const, accentColor: "#3d9cf5", desc: "Registre entradas e saídas, negocie valores e mantenha o histórico completo de cada janela. O seu livro-caixa do mercado." },
    { id: "financeiro",  title: "Gestão Financeira",    label: "Finanças",      colorType: "financial" as const, accentColor: "#3d9cf5", desc: "Orçamento, folha salarial, receitas e valor de mercado do elenco. Dirija o clube como um verdadeiro diretor esportivo." },
    { id: "trofeus",     title: "Armário de Troféus",   label: "Conquistas",    colorType: "trophies"  as const, accentColor: "#f59e0b", desc: "Cada título conquista sua vaga permanente no armário. Data, competição, destaques — a história que você construiu." },
    { id: "noticias",    title: "Notícias por IA",      label: "Imprensa",      colorType: "ai"        as const, accentColor: "#00e5a0", desc: "A Gazeta do Técnico cobre cada partida com qualidade jornalística real. Hat-tricks viram manchetes. Títulos se tornam editoriais históricos." },
    { id: "diretoria",   title: "Diretoria",            label: "Diretoria",     colorType: "tactical"  as const, accentColor: "#7c5cfc", desc: "Reuniões com o presidente, metas de temporada e negociações de contrato. O lado de bastidores da sua carreira." },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Page — flat strings
// ─────────────────────────────────────────────────────────────────────────────
export const AUTH: Record<Lang, Record<string, string>> = {
  pt: {
    back: "Voltar",
    // login
    loginTitle: "Sua carreira continua aqui.",
    loginSub: "Entre na sua conta para retomar onde parou",
    labelEmail: "E-mail",
    labelPassword: "Senha",
    labelName: "Nome",
    placeholderEmail: "seu@email.com",
    placeholderPassword: "Sua senha",
    placeholderName: "Seu nome",
    placeholderPasswordNew: "Mínimo 6 caracteres",
    loginBtn: "Entrar no jogo",
    loading: "Aguarde...",
    loginNewHere: "Novo por aqui?",
    loginCreateAccount: "Criar conta",
    // signup plan step
    planSelectTitle: "Escolha o nível da sua carreira.",
    planSelectSub: "Você pode mudar ou cancelar quando quiser",
    planContinueBtn: "Continuar com o plano",
    planHasAccount: "Já tem conta?",
    planLogin: "Entrar",
    planBadge: "Plano",
    planBadgeMonth: "mês",
    // signup form step
    signupTitle: "Comece sua história no futebol.",
    signupSubFree: "De graça, sem cartão de crédito",
    signupSubPaid: "Preencha seus dados para continuar",
    signupBtnFree: "Criar conta",
    signupBtnPaid: "Criar conta e pagar",
    signupHasAccount: "Já tem conta?",
    signupLogin: "Entrar",
    // redirecting
    redirectingTitle: "Redirecionando para o pagamento...",
    redirectingSub: "Você será levado ao Stripe para concluir a assinatura.",
    // plan detail panel
    notIncludedLabel: "Não incluído neste plano",
    // news card
    generatedNowLabel: "Gerado agora",
    // error messages
    errEmailPassword: "Preencha e-mail e senha.",
    errName: "Informe seu nome.",
    errPasswordLen: "Senha deve ter no mínimo 6 caracteres.",
    errConnect: "Não foi possível conectar ao servidor.",
    errInvalidResponse: "Resposta inválida do servidor.",
    errPlans: "Não foi possível obter os planos disponíveis.",
    errPlanNotFound: "Plano selecionado não encontrado.",
    errPayment: "Erro ao iniciar pagamento.",
    errPaymentUrl: "URL de pagamento inválida.",
    errGeneric: "Ocorreu um erro. Tente novamente.",
    // plan periods (used by getPlanCards)
    periodFree: "para sempre",
    periodMonth: "por mês",
  },
  en: {
    back: "Back",
    // login
    loginTitle: "Your career continues here.",
    loginSub: "Sign in to your account and pick up where you left off",
    labelEmail: "Email",
    labelPassword: "Password",
    labelName: "Name",
    placeholderEmail: "your@email.com",
    placeholderPassword: "Your password",
    placeholderName: "Your name",
    placeholderPasswordNew: "Minimum 6 characters",
    loginBtn: "Enter the game",
    loading: "Please wait...",
    loginNewHere: "New here?",
    loginCreateAccount: "Create account",
    // signup plan step
    planSelectTitle: "Choose your career level.",
    planSelectSub: "You can change or cancel at any time",
    planContinueBtn: "Continue with",
    planHasAccount: "Already have an account?",
    planLogin: "Sign in",
    planBadge: "Plan",
    planBadgeMonth: "mo",
    // signup form step
    signupTitle: "Start your football story.",
    signupSubFree: "Free, no credit card required",
    signupSubPaid: "Fill in your details to continue",
    signupBtnFree: "Create account",
    signupBtnPaid: "Create account & pay",
    signupHasAccount: "Already have an account?",
    signupLogin: "Sign in",
    // redirecting
    redirectingTitle: "Redirecting to payment...",
    redirectingSub: "You will be taken to Stripe to complete your subscription.",
    // plan detail panel
    notIncludedLabel: "Not included in this plan",
    // news card
    generatedNowLabel: "Generated now",
    // error messages
    errEmailPassword: "Please fill in your email and password.",
    errName: "Please enter your name.",
    errPasswordLen: "Password must be at least 6 characters.",
    errConnect: "Could not connect to the server.",
    errInvalidResponse: "Invalid server response.",
    errPlans: "Could not retrieve available plans.",
    errPlanNotFound: "Selected plan not found.",
    errPayment: "Could not start payment.",
    errPaymentUrl: "Invalid payment URL.",
    errGeneric: "An error occurred. Please try again.",
    // plan periods
    periodFree: "free forever",
    periodMonth: "per month",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Auth — Plan cards
// ─────────────────────────────────────────────────────────────────────────────
export function getPlanCards(lang: Lang) {
  const t = AUTH[lang];
  return [
    {
      plan: "free" as const,
      label: "Free",
      price: "R$ 0",
      period: t.periodFree,
      accentRgb: "255,255,255",
      accentColor: "rgba(255,255,255,0.6)",
      features: lang === "en"
        ? ["1 active career", "3 AI generations per day", "Unlimited matches", "No board"]
        : ["1 carreira ativa", "3 gerações de IA por dia", "Partidas ilimitadas", "Sem diretoria"],
    },
    {
      plan: "pro" as const,
      label: "Pro",
      price: "R$ 14,90",
      period: t.periodMonth,
      accentRgb: "124,92,252",
      accentColor: "#7c5cfc",
      features: lang === "en"
        ? ["Up to 5 active careers", "20 AI generations per day", "Board with up to 2 members", "News generated in seconds"]
        : ["Até 5 carreiras ativas", "20 gerações de IA por dia", "Diretoria com até 2 membros", "Notícias geradas em segundos"],
    },
    {
      plan: "ultra" as const,
      label: "Ultra",
      price: "R$ 39,90",
      period: t.periodMonth,
      accentRgb: "245,158,11",
      accentColor: "#f59e0b",
      features: lang === "en"
        ? ["Unlimited careers & board", "Unlimited AI generations", "Locker room rumours", "Up to 3 custom news portals", "AI with dramatic & detailed news", "Automatic news"]
        : ["Carreiras e diretoria ilimitadas", "Gerações de IA ilimitadas", "Boatos no vestiário", "Até 3 portais de notícias personalizados", "IA com notícias mais detalhadas e dramáticas", "Notícias automáticas"],
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth — Plan detail data
// ─────────────────────────────────────────────────────────────────────────────
type Plan = "free" | "pro" | "ultra";
export function getPlanDetailData(lang: Lang): Record<Plan, {
  tagline: string;
  features: string[];
  missing: Array<{ label: string; nextPlan: string }>;
  upsell: { plan: string; color: string; rgb: string; price: string; msg: string } | null;
}> {
  if (lang === "en") return {
    free: {
      tagline: "Good for trying out the system",
      features: ["1 active career", "3 AI generations per day", "Unlimited matches", "Basic stats"],
      missing: [
        { label: "Club board", nextPlan: "Pro" },
        { label: "AI-generated news", nextPlan: "Pro" },
        { label: "Multiple careers", nextPlan: "Pro" },
        { label: "Locker room rumours", nextPlan: "Ultra" },
      ],
      upsell: { plan: "Pro", color: "#7c5cfc", rgb: "124,92,252", price: "R$ 14.90/mo", msg: "Unlock the full potential of your career" },
    },
    pro: {
      tagline: "For the manager who takes it seriously",
      features: ["Up to 5 active careers", "20 AI generations per day", "Board with up to 2 members", "News generated in seconds"],
      missing: [
        { label: "Locker room rumours", nextPlan: "Ultra" },
        { label: "3 custom news portals", nextPlan: "Ultra" },
        { label: "Unlimited careers", nextPlan: "Ultra" },
        { label: "AI with dramatic news", nextPlan: "Ultra" },
        { label: "Automatic news", nextPlan: "Ultra" },
      ],
      upsell: { plan: "Ultra", color: "#f59e0b", rgb: "245,158,11", price: "R$ 39.90/mo", msg: "Live the full career mode experience" },
    },
    ultra: {
      tagline: "The ultimate career mode experience",
      features: ["Unlimited careers & board", "Unlimited AI generations", "Locker room rumours", "3 custom news portals", "AI with dramatic & detailed news", "Automatic news"],
      missing: [],
      upsell: null,
    },
  };
  return {
    free: {
      tagline: "Bom para testar o sistema",
      features: ["1 carreira ativa", "3 gerações de IA por dia", "Partidas ilimitadas", "Estatísticas básicas"],
      missing: [
        { label: "Diretoria do clube", nextPlan: "Pro" },
        { label: "Notícias geradas por IA", nextPlan: "Pro" },
        { label: "Múltiplas carreiras", nextPlan: "Pro" },
        { label: "Boatos no vestiário", nextPlan: "Ultra" },
      ],
      upsell: { plan: "Pro", color: "#7c5cfc", rgb: "124,92,252", price: "R$ 14,90/mês", msg: "Desbloqueie o potencial completo da sua carreira" },
    },
    pro: {
      tagline: "Para o treinador que leva a sério",
      features: ["Até 5 carreiras ativas", "20 gerações de IA por dia", "Diretoria com até 2 membros", "Notícias geradas em segundos"],
      missing: [
        { label: "Boatos no vestiário", nextPlan: "Ultra" },
        { label: "3 portais de notícias personalizados", nextPlan: "Ultra" },
        { label: "Carreiras ilimitadas", nextPlan: "Ultra" },
        { label: "IA com notícias dramáticas", nextPlan: "Ultra" },
        { label: "Notícias automáticas", nextPlan: "Ultra" },
      ],
      upsell: { plan: "Ultra", color: "#f59e0b", rgb: "245,158,11", price: "R$ 39,90/mês", msg: "Viva a experiência total do modo carreira" },
    },
    ultra: {
      tagline: "A experiência definitiva do modo carreira",
      features: ["Carreiras e diretoria ilimitadas", "Gerações de IA ilimitadas", "Boatos no vestiário", "3 portais de notícias personalizados", "IA com notícias dramáticas e detalhadas", "Notícias automáticas"],
      missing: [],
      upsell: null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth — Plan welcome
// ─────────────────────────────────────────────────────────────────────────────
export function getPlanWelcome(lang: Lang): Record<Plan, {
  headline: string; sub: string; accentColor: string; accentRgb: string;
  features: Array<{ emoji: string; text: string }>; footer: string;
}> {
  if (lang === "en") return {
    free: {
      headline: "Welcome to FC Career Manager!",
      sub: "Your journey starts now — free, no card required.",
      accentColor: "rgba(200,200,220,0.85)", accentRgb: "200,200,220",
      features: [
        { emoji: "⚽", text: "1 active career to manage" },
        { emoji: "🤖", text: "3 AI generations per day" },
        { emoji: "📊", text: "Unlimited matches & stats" },
        { emoji: "🆓", text: "No cost, no credit card" },
      ],
      footer: "You can upgrade at any time.",
    },
    pro: {
      headline: "Great choice! Welcome to Pro.",
      sub: "Professional features to take your career seriously.",
      accentColor: "#7c5cfc", accentRgb: "124,92,252",
      features: [
        { emoji: "🏆", text: "Up to 5 simultaneous active careers" },
        { emoji: "🤖", text: "20 AI generations per day" },
        { emoji: "👔", text: "Board with up to 2 members" },
        { emoji: "📰", text: "News generated in seconds by AI" },
      ],
      footer: "Thank you for supporting FC Career Manager!",
    },
    ultra: {
      headline: "You chose the best. Ultra plan!",
      sub: "The ultimate career mode experience — no limits.",
      accentColor: "#f59e0b", accentRgb: "245,158,11",
      features: [
        { emoji: "♾️", text: "Unlimited careers & board" },
        { emoji: "🤖", text: "Unlimited AI generations" },
        { emoji: "🗞️", text: "Up to 3 custom news portals" },
        { emoji: "🔥", text: "AI with dramatic & detailed news" },
        { emoji: "💬", text: "Exclusive locker room rumours" },
        { emoji: "⚡", text: "Real-time automatic news" },
      ],
      footer: "Thank you for choosing the full experience!",
    },
  };
  return {
    free: {
      headline: "Bem-vindo ao FC Career Manager!",
      sub: "Sua jornada começa agora — de graça e sem cartão.",
      accentColor: "rgba(200,200,220,0.85)", accentRgb: "200,200,220",
      features: [
        { emoji: "⚽", text: "1 carreira ativa para comandar" },
        { emoji: "🤖", text: "3 gerações de IA por dia" },
        { emoji: "📊", text: "Partidas e estatísticas ilimitadas" },
        { emoji: "🆓", text: "Sem custo, sem cartão de crédito" },
      ],
      footer: "Você pode fazer upgrade a qualquer momento.",
    },
    pro: {
      headline: "Excelente escolha! Bem-vindo ao Pro.",
      sub: "Recursos profissionais para levar sua carreira a sério.",
      accentColor: "#7c5cfc", accentRgb: "124,92,252",
      features: [
        { emoji: "🏆", text: "Até 5 carreiras ativas simultâneas" },
        { emoji: "🤖", text: "20 gerações de IA por dia" },
        { emoji: "👔", text: "Diretoria com até 2 membros" },
        { emoji: "📰", text: "Notícias geradas em segundos por IA" },
      ],
      footer: "Obrigado por apoiar o FC Career Manager!",
    },
    ultra: {
      headline: "Você escolheu o melhor. Plano Ultra!",
      sub: "A experiência definitiva do modo carreira — sem limites.",
      accentColor: "#f59e0b", accentRgb: "245,158,11",
      features: [
        { emoji: "♾️", text: "Carreiras e diretoria ilimitadas" },
        { emoji: "🤖", text: "Gerações de IA ilimitadas" },
        { emoji: "🗞️", text: "Até 3 portais de notícias personalizados" },
        { emoji: "🔥", text: "IA com notícias dramáticas e detalhadas" },
        { emoji: "💬", text: "Boatos exclusivos no vestiário" },
        { emoji: "⚡", text: "Notícias automáticas em tempo real" },
      ],
      footer: "Obrigado por escolher a experiência completa!",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth — AI News stories
// ─────────────────────────────────────────────────────────────────────────────
export function getNewsStories(lang: Lang) {
  if (lang === "en") return [
    { category: "La Liga", categoryColor: "#7c5cfc", categoryBg: "rgba(124,92,252,0.1)", categoryBorder: "rgba(124,92,252,0.25)", date: "Apr 2026", headlineParts: ["Barcelona comeback in ", "stoppage time", " maintains sole lead"], highlightColor: "#f59e0b", lead: "In a tense Camp Nou clash, manager Martínez trusted the 4-3-3 to overcome Atlético de Madrid. Two goals in the final five minutes sealed the historic comeback.", timeAgo: "2 min ago" },
    { category: "Premier League", categoryColor: "#38bdf8", categoryBg: "rgba(56,189,248,0.1)", categoryBorder: "rgba(56,189,248,0.25)", date: "Apr 2026", headlineParts: ["City announces ", "record signing", " of South American midfielder"], highlightColor: "#38bdf8", lead: "Manchester City completed the signing of midfielder Diego Ferreira for £85m, making him the most expensive player in the club's history. He signs a five-year deal.", timeAgo: "7 min ago" },
    { category: "Serie A", categoryColor: "#f43f5e", categoryBg: "rgba(244,63,94,0.1)", categoryBorder: "rgba(244,63,94,0.25)", date: "Apr 2026", headlineParts: ["Flamengo ", "thrashes rival", " and reclaims top spot"], highlightColor: "#f43f5e", lead: "With a show from Gabigol and two goals from young Pedro Santos, the Rubro-Negro put four past Vasco in the derby and reclaimed top spot in the Brasileirão by three points.", timeAgo: "15 min ago" },
    { category: "Champions League", categoryColor: "#f59e0b", categoryBg: "rgba(245,158,11,0.1)", categoryBorder: "rgba(245,158,11,0.25)", date: "Apr 2026", headlineParts: ["Manager reveals ", "secret tactic", " that knocked out Real Madrid"], highlightColor: "#f59e0b", lead: "In an exclusive interview after the semi-final, the manager detailed how high pressing and zonal marking confused the Merengue midfield throughout the 90 minutes.", timeAgo: "23 min ago" },
    { category: "Dressing Room", categoryColor: "#a78bfa", categoryBg: "rgba(167,139,250,0.1)", categoryBorder: "rgba(167,139,250,0.25)", date: "Apr 2026", headlineParts: ["Striker ", "requests transfer", " after falling out with coaching staff"], highlightColor: "#a78bfa", lead: "Sources reveal the starting centre-forward submitted a formal transfer request to the club president. Relations with the manager reportedly soured after being substituted in the final.", timeAgo: "31 min ago" },
    { category: "Bundesliga", categoryColor: "#34d399", categoryBg: "rgba(52,211,153,0.1)", categoryBorder: "rgba(52,211,153,0.25)", date: "Apr 2026", headlineParts: ["Bayern sack manager ", "on eve", " of European decider"], highlightColor: "#34d399", lead: "Bayern Munich's board confirmed the sacking of Thomas Brauer after a three-match winless run. Assistant Schneider will take charge on an interim basis until the end of the season.", timeAgo: "44 min ago" },
  ];
  return [
    { category: "La Liga", categoryColor: "#7c5cfc", categoryBg: "rgba(124,92,252,0.1)", categoryBorder: "rgba(124,92,252,0.25)", date: "Abr 2026", headlineParts: ["Barcelona vira nos ", "acréscimos", " e mantém liderança isolada"], highlightColor: "#f59e0b", lead: "Em jogo tenso no Camp Nou, o técnico Martínez apostou no sistema 4-3-3 para superar o Atlético de Madrid. Dois gols nos últimos cinco minutos garantiram a virada histórica.", timeAgo: "há 2 min" },
    { category: "Premier League", categoryColor: "#38bdf8", categoryBg: "rgba(56,189,248,0.1)", categoryBorder: "rgba(56,189,248,0.25)", date: "Abr 2026", headlineParts: ["City anuncia ", "contratação recorde", " de meia sul-americano"], highlightColor: "#38bdf8", lead: "O Manchester City fechou a contratação do meia Diego Ferreira por £85 milhões, tornando-o o jogador mais caro da história do clube. O jogador assina contrato de cinco anos.", timeAgo: "há 7 min" },
    { category: "Série A", categoryColor: "#f43f5e", categoryBg: "rgba(244,63,94,0.1)", categoryBorder: "rgba(244,63,94,0.25)", date: "Abr 2026", headlineParts: ["Flamengo ", "goleia rival", " e retoma topo da tabela"], highlightColor: "#f43f5e", lead: "Com show de Gabigol e dois gols do jovem Pedro Santos, o Rubro-Negro aplicou 4 a 0 no Vasco no clássico e reassumiu a liderança do Brasileirão com folga de três pontos.", timeAgo: "há 15 min" },
    { category: "Champions League", categoryColor: "#f59e0b", categoryBg: "rgba(245,158,11,0.1)", categoryBorder: "rgba(245,158,11,0.25)", date: "Abr 2026", headlineParts: ["Técnico revela ", "tática secreta", " que desbancou o Real Madrid"], highlightColor: "#f59e0b", lead: "Em entrevista exclusiva após a semifinal, o treinador detalhou como o pressing alto e a marcação por zona confundiram o meio-campo merengue durante os 90 minutos.", timeAgo: "há 23 min" },
    { category: "Vestiário", categoryColor: "#a78bfa", categoryBg: "rgba(167,139,250,0.1)", categoryBorder: "rgba(167,139,250,0.25)", date: "Abr 2026", headlineParts: ["Atacante ", "pede transferência", " após briga com comissão técnica"], highlightColor: "#a78bfa", lead: "Fontes internas revelam que o centroavante titular entregou um pedido formal de saída ao presidente do clube. A relação com o treinador teria se deteriorado após ser substituído na final.", timeAgo: "há 31 min" },
    { category: "Bundesliga", categoryColor: "#34d399", categoryBg: "rgba(52,211,153,0.1)", categoryBorder: "rgba(52,211,153,0.25)", date: "Abr 2026", headlineParts: ["Bayern demite técnico ", "às vésperas", " da decisão europeia"], highlightColor: "#34d399", lead: "A diretoria do Bayern de Munique confirmou a demissão de Thomas Brauer após sequência de três jogos sem vencer. O auxiliar Schneider assumirá interinamente até o fim da temporada.", timeAgo: "há 44 min" },
  ];
}
