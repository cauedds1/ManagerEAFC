import { Router } from "express";
import OpenAI from "openai";
import { openai as defaultOpenai } from "@workspace/integrations-openai-ai-server";

const router = Router();

interface RecentPostSummary {
  title?: string;
  category: string;
  headline: string;
}

interface CustomPortalPayload {
  id: string;
  name: string;
  description: string;
  tone: string;
}

interface ClubTitle {
  name: string;
  count: number;
}

interface GenerateNoticiaBody {
  description: string;
  clubName: string;
  season?: string;
  source?: string;
  category?: string;
  playersContext?: string;
  squadOvrContext?: string;
  teamFormContext?: string;
  historicalContext?: string;
  recentPostsContext?: RecentPostSummary[];
  customPortal?: CustomPortalPayload;
  clubLeague?: string;
  clubTitles?: ClubTitle[];
  clubDescription?: string;
  projeto?: string;
  isClassico?: boolean;
  rivalName?: string;
  fanMoodScore?: number;
  fanMoodLabel?: string;
  matchPlayerContext?: string;
  attachedMatchContext?: string;
}

function leagueTierLabel(league: string): string {
  const l = league.toLowerCase();
  if (l.includes("série b") || l.includes("serie b") || l.includes("segunda")) return "segunda divisão";
  if (l.includes("série c") || l.includes("serie c") || l.includes("terceira")) return "terceira divisão";
  if (l.includes("série d") || l.includes("serie d") || l.includes("quarta")) return "quarta divisão";
  return "primeira divisão";
}

function buildClubPrestigeSection(
  clubName: string,
  clubLeague?: string,
  clubTitles?: ClubTitle[],
  clubDescription?: string,
  projeto?: string,
): string {
  if (!clubLeague && !clubTitles?.length && !projeto && !clubDescription) return "";

  const league = clubLeague ?? "";
  const tier = league ? leagueTierLabel(league) : "";

  const totalTitles = (clubTitles ?? []).reduce((s, t) => s + t.count, 0);
  const hasSignificantTitles = (clubTitles ?? []).some((t) => t.count >= 3);
  const hasManyTitles = totalTitles >= 10;

  const titlesStr =
    clubTitles && clubTitles.length > 0
      ? clubTitles.map((t) => `${t.name} (${t.count}x)`).join(", ")
      : "(sem títulos expressivos registrados)";

  let expectation: string;
  if (hasManyTitles) {
    expectation =
      "Para este clube, ganhar títulos é OBRIGAÇÃO. Resultados medianos são tratados como fracasso — a torcida exige excelência e a imprensa cobra duramente. Qualquer posição abaixo do topo é motivo de crise.";
  } else if (hasSignificantTitles) {
    expectation =
      "Este clube tem história e tradição. Bons resultados são celebrados, mas a exigência é alta — terminar longe dos títulos gera frustração real nos torcedores.";
  } else {
    expectation =
      "Este é um clube de menor porte histórico. Cada conquista acima do esperado é motivo de GRANDE celebração — entrar no top 5, conquistar um título ou ir longe em copas são feitos históricos para a torcida.";
  }

  let section = `\n\nCONTEXTO DE PRESTÍGIO DO CLUBE — use para calibrar o tom da notícia. O peso de um resultado é completamente diferente dependendo do tamanho do clube:`;
  section += `\nClube: ${clubName}`;
  if (league) section += ` | Liga: ${league}${tier ? ` (${tier})` : ""}`;
  section += `\nTítulos históricos: ${titlesStr}`;
  if (clubDescription?.trim()) {
    section += `\nIdentidade: ${clubDescription.trim().slice(0, 200)}`;
  }
  if (projeto?.trim()) {
    section += `\nProjeto desta temporada: "${projeto.trim()}"`;
  }
  section += `\nExpectativa: ${expectation}`;
  section += `\nREGRA: Ao escrever legenda e comentários, ajuste o tom conforme o porte do clube. Watford no top 5 = conquista histórica. Barcelona no top 5 = vergonha. Calibre celebrações, cobranças e reações da torcida de acordo.`;

  return section;
}

const TONE_PROMPTS: Record<string, string> = {
  humoristico:  "Tom HUMORÍSTICO — use humor, memes, piadas, trocadilhos e emojis engraçados. Os comentários devem ser engraçados e bem-humorados, com zoações e memes. Pode xingar jogador com bom humor.",
  apaixonado:   "Tom APAIXONADO — escrita emocional, dramática, cheia de amor pelo clube. Defende os jogadores, mas cobra quando necessário. Comentários com muita paixão e sentimento.",
  critico:      "Tom CRÍTICO/CORNETEIRO — questiona decisões, cobra resultados, aponta falhas. Não poupa ninguém, nem a comissão técnica. Comentários exigentes e impacientes. Pode xingar jogador.",
  ironico:      "Tom IRÔNICO/SARCÁSTICO — usa sarcasmo e ironia na escrita. Faz insinuações inteligentes, sorri debochado de situações. Comentários afiados e espirituosos.",
  jornalistico: "Tom JORNALÍSTICO — reportagem elaborada com contexto histórico, números e análise. Escrita profissional mas acessível. Comentários mais analíticos e debatedores.",
  serio:        "Tom SÉRIO/OBJETIVO — cobertura factual e direta ao ponto. Sem exageros, sem drama. Comentários racionais e equilibrados.",
  agressivo:    "Tom AGRESSIVO/SEM FILTRO — escreve como um torcedor raivoso e sem censura. Quando o time vai mal: xinga jogador, técnico, diretoria sem cerimônia, usa palavrões naturalmente (porra, merda, filho da puta, etc.), grita no texto. Quando vai bem: euforia total, celebração explosiva, xingamento de alegria. O tom varia com a situação do time mas NUNCA é robótico ou polido — é humano, cru e autêntico. Comentários igualmente sem filtro.",
};

function getClient(userKey?: string): { client: OpenAI; usingUserKey: boolean } {
  if (userKey && userKey.trim().startsWith("sk-")) {
    return { client: new OpenAI({ apiKey: userKey.trim() }), usingUserKey: true };
  }
  return { client: defaultOpenai as unknown as OpenAI, usingUserKey: false };
}

function buildFanMoodSection(clubName: string, fanMoodLabel: string, fanMoodScore: number): string {
  let section = `\n\nHUMOR DA TORCIDA — CONTEXTO EMOCIONAL:`;
  section += `\nEstado atual da torcida do ${clubName}: ${fanMoodLabel} (${fanMoodScore}/100).`;
  if (fanMoodScore < 20) {
    section += `\nTORCIDA REVOLTADA: o ambiente é de pressão máxima. Mesmo em vitórias, os comentários cobram mais, exigem mais. Torcedores estão frustrados e qualquer deslize é amplificado. Tom geral: cobrança, decepção, ameaças de protesto.`;
  } else if (fanMoodScore < 40) {
    section += `\nTORCIDA INSATISFEITA: a paciência está diminuindo. Vitórias são comemoradas mas com ressalvas. Derrotas geram reclamações mais fortes do que o normal.`;
  } else if (fanMoodScore < 60) {
    section += `\nTORCIDA NEUTRA: humor equilibrado. Reage de forma proporcional ao resultado — celebra vitórias normalmente, critica derrotas sem exagero.`;
  } else if (fanMoodScore < 80) {
    section += `\nTORCIDA ANIMADA: o ambiente é positivo. Vitórias são comemoradas com entusiasmo. Pequenos erros são tolerados. Os comentários têm mais euforia natural.`;
  } else {
    section += `\nTORCIDA EUFÓRICA: o ambiente é de festa total. A torcida está nas nuvens. Os comentários transbordam orgulho, amor ao clube, sensação de que este time é especial.`;
  }
  return section;
}

function buildClassicoSection(clubName: string, rivalName: string, isLoss: boolean, isWin: boolean): string {
  const result = isWin ? "venceu" : isLoss ? "perdeu" : "empatou";
  let section = `\n\nCLÁSSICO ENTRE RIVAIS — CONTEXTO ESPECIAL:`;
  section += `\nEsta é uma rivalidade histórica: ${clubName} x ${rivalName}.`;
  section += `\nResultado: ${clubName} ${result} o clássico.`;
  section += `\nREGRAS OBRIGATÓRIAS PARA CLÁSSICO:`;
  section += `\n- Eleve MUITO o peso narrativo — clássicos são diferentes de partidas normais. Honor, orgulho, rivalidade histórica.`;
  section += `\n- ${isLoss ? `DERROTA no clássico: a dor é AMPLIFICADA. Inclua obrigatoriamente comentários de torcedores do ${rivalName} zoando, provocando, chamando de fraco, freguês. Podem usar termos como "frango", "vexame", "passa o pé", "freguês". Tom de humilhação legítima dos rivais.` : isWin ? `VITÓRIA no clássico: a celebração é ÉPICA. Tom de conquista histórica. Comentários de euforia máxima dos torcedores.` : `EMPATE no clássico: sabor amargo. Cada torcida acha que o rival "saiu vencedor moralmente". Polarização nos comentários.`}`;
  section += `\n- Comentários devem ter personas DISTINTAS: torcedores do ${clubName} (eufóricos ou arrasados), torcedores do ${rivalName} (provocadores ou lamentando), jornalistas neutros. Misture bem.`;
  section += `\n- Use linguagem de rivalidade: "clássico", "derby", "batalha histórica", "honra da cidade", etc.`;
  return section;
}

router.post("/noticias/generate", async (req, res) => {
  const {
    description, clubName, season, source, category,
    playersContext, squadOvrContext, teamFormContext, historicalContext, recentPostsContext, customPortal,
    clubLeague, clubTitles, clubDescription, projeto, isClassico, rivalName, fanMoodScore, fanMoodLabel,
    matchPlayerContext, attachedMatchContext,
  } = req.body as GenerateNoticiaBody;

  if (!description || !description.trim()) {
    res.status(400).json({ error: "description é obrigatório" });
    return;
  }

  const userKey = (req.headers["x-openai-key"] as string | undefined) ?? "";
  const { client, usingUserKey } = getClient(userKey);

  const slug = clubName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const shortClub = clubName.split(" ").slice(0, 2).join(" ");

  const standardSourceOptions = {
    tnt:     { name: "TNT Sports",        handle: "@tntsports" },
    espn:    { name: "ESPN Brasil",       handle: "@espnbrasil" },
    fanpage: { name: `${shortClub} Oficial`, handle: `@${slug}oficial` },
  } as const;

  const isCustomPortal = !!customPortal;
  const isGlobalPortal = !isCustomPortal && (source === "tnt" || source === "espn");

  const portalName   = isCustomPortal ? customPortal.name : (standardSourceOptions[(source as keyof typeof standardSourceOptions)] ?? standardSourceOptions.fanpage).name;
  const portalHandle = isCustomPortal
    ? `@${customPortal.name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "")}`
    : (standardSourceOptions[(source as keyof typeof standardSourceOptions)] ?? standardSourceOptions.fanpage).handle;

  const chosenSource   = isCustomPortal ? "custom" : ((source as keyof typeof standardSourceOptions) ?? "fanpage");
  const categories     = ["resultado", "lesao", "transferencia", "renovacao", "treino", "conquista", "geral"];
  const chosenCategory = category && categories.includes(category) ? category : null;
  const uniqueSeed     = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const playersSection = playersContext?.trim()
    ? `\n\nELENCO — CONTEXTO DE DESEMPENHO (use com moderação para enriquecer comentários — nem todo comentário precisa mencionar jogadores; prefira os mais marcantes como ídolos, artilheiros ou jogadores com incidentes recentes):\n${playersContext.trim()}`
    : "";

  const squadOvrSection = squadOvrContext?.trim()
    ? `\n\nCONTEXTO DE NÍVEL DO ELENCO — use para calibrar expectativas individuais:\n${squadOvrContext.trim()}\n\nREGRAS DE POSIÇÃO E NÍVEL DO ELENCO:\n- Goleiros e zagueiros NÃO são cobrados por falta de gols — isso é absolutamente normal para a posição.\n- Use o nível do elenco + o nome da liga para avaliar se o time tem qualidade para dominar partidas: elenco forte numa liga fraca → exigência alta; elenco médio na Premier League → exigência moderada.\n- Um jogador abaixo da média do elenco em boa forma é uma SURPRESA positiva — trate como revelação.\n- Calibre sempre: o mesmo nível de jogador tem peso diferente em elencos diferentes.\n- REGRA DE SAÍDA OBRIGATÓRIA: NUNCA mencione números de OVR, overall, ratings ou diferenças numéricas de atributos no texto gerado (título, legenda, comentários, replies). Use exclusivamente termos qualitativos como "estrela do elenco", "acima da média", "jogador de alto nível", "peça importante", "abaixo da média do elenco", "reforço de qualidade", etc.`
    : "";

  const teamFormSection = teamFormContext?.trim()
    ? `\n\nSEQUÊNCIA RECENTE DO TIME:\n${teamFormContext.trim()}\n\nCOMO USAR A SEQUÊNCIA:\n- Use seu conhecimento de futebol para avaliar a força de cada adversário pelo nome.\n- Se o time acabou de bater ou empatar com adversários considerados mais fortes, isso é contexto positivo — cobranças individuais devem ser moderadas ou ausentes.\n- Se o time enfrenta adversários acessíveis para o seu nível (elenco OVR x liga x adversário) e não está performando bem, aí cobranças individuais fazem sentido.\n- Uma sequência de vitórias sólidas, especialmente contra adversários difíceis, indica saúde coletiva — a narrativa deve refletir isso.\n- Não copie os dados brutos — interprete a sequência com olhar de jornalista esportivo que conhece futebol.`
    : "";

  const historicalSection = historicalContext?.trim()
    ? `\n\nHISTÓRICO DO CLUBE (use para dar profundidade narrativa quando relevante — ex: comemorações de recorde, comparações com temporadas anteriores, saudosismo de torcedores):\n${historicalContext.trim()}`
    : "";

  const attachedMatchSection = attachedMatchContext?.trim()
    ? `\n\n━━━ PARTIDA ANEXADA — BASE PRINCIPAL DA NOTÍCIA ━━━
${attachedMatchContext.trim()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUÇÕES CRÍTICAS PARA A PARTIDA ANEXADA:
- Esta partida é o TEMA CENTRAL da notícia — use TODOS os dados acima na construção do post e dos comentários.
- Mencione placares, artilheiros, minutos de gol, assistências e notas exatamente como estão — não invente nada.
- Jogadores com notas altas e gols devem aparecer como protagonistas do post.
- Jogadores com notas baixas podem gerar comentários de cobrança ou decepção.
- O MOTM (destaque) deve ser explicitamente celebrado no post e nos comentários.
- Cartões e expulsões geram drama — use-os para criar tensão narrativa.
- Lesões mencionadas aumentam a gravidade emocional da notícia.
- A descrição do usuário complementa — mas NÃO substitui — os dados factuais da partida.`
    : "";

  const matchPlayerSection = matchPlayerContext?.trim()
    ? `\n\nATUAÇÕES INDIVIDUAIS DA ÚLTIMA PARTIDA — CONTEXTO DE EXPECTATIVA:
${matchPlayerContext.trim()}

COMO USAR ESTE DADO NOS COMENTÁRIOS DA TORCIDA:
- Leia cada linha: o tag após "→" indica o que a torcida sente sobre aquele jogador NESTA partida.
- "DECEPÇÃO" ou "ABAIXO DO ESPERADO": inclua 1–2 comentários de torcedores cobrando, cornetando ou expressando decepção específica com esse jogador — use linguagem realista como "hoje não foi ele", "esse craque sumiu", "jogou horrível comparado com o que a gente vê sempre", "não rendeu hoje".
- "SURPRESA POSITIVA" ou "SURPRESA GRANDE": inclua 1–2 comentários de torcedores impressionados, que não esperavam tanto — "quem esperava que esse camarada ia mandar assim?", "meu Deus, que atuação desse menino", "não é sempre que vejo esse jogador brilhar assim".
- "dentro do esperado" ou "atuação de alto nível, consistente": comentários normais de reconhecimento — "jogou bem como sempre", "confiável".
- "atuação fraca, mas dentro do padrão": pode ignorar ou gerar comentário leve — "nem todo jogo tem que ser perfeito".
- MOTM ⭐: pelo menos um comentário explicitamente celebrando o destaque.
- Jogadores com gols/assistências: pelo menos um comentário mencionando a contribuição deles.
- REGRA: Não é necessário comentar sobre TODOS os jogadores — foque nos 2–4 mais notáveis pelo delta de expectativa, gols, MOTM ou expulsão. Os outros podem aparecer no texto do post sem aparecer nos comentários.
- NÃO invente ratings nem médias — use apenas os dados fornecidos acima.`
    : "";

  const recentPostsSection = recentPostsContext && recentPostsContext.length > 0
    ? `\n\nPOSTS RECENTES DO FEED (últimas notícias publicadas, do mais novo ao mais antigo):\n${recentPostsContext.map((p, i) => `${i + 1}. [${p.category}] ${p.title ? p.title + " — " : ""}${p.headline}`).join("\n")}\n\nUSO DOS POSTS RECENTES — REGRA IMPORTANTE: Em aproximadamente 1 a cada 4 gerações, crie conexões narrativas com eventos recentes acima. Mas NÃO faça isso na maioria das vezes — a maior parte dos posts deve ser independente e autossuficiente.`
    : "";

  const customPortalSection = isCustomPortal
    ? `\n\nPERFIL DO PORTAL:\nNome: ${customPortal.name}\nDescrição/identidade: ${customPortal.description}\n${TONE_PROMPTS[customPortal.tone] ?? TONE_PROMPTS.serio}\nAdapte TODO o conteúdo (título, legenda e comentários) ao tom e identidade deste portal. Seja fiel à personalidade descrita.`
    : "";

  const globalPortalSection = isGlobalPortal
    ? `\n\nREGRAS DO PORTAL GLOBAL — ${portalName} é um canal de mídia esportiva global e jornalística, NÃO uma fanpage de clube.
LEGENDA — TOM JORNALÍSTICO OBRIGATÓRIO:
- Escreva como repórter esportivo imparcial: relate factos, cite números, ofereça análise contextual
- PROIBIDO usar "nós", "precisamos", "vamos", "nossa equipe", ou qualquer linguagem que demonstre torcida pelo clube
- PROIBIDO expressões de apelo emocional de torcedor como "Rumo ao topo!", "Que orgulho!", "Acreditem!" dirigidas ao clube
- Permitido: elogiar desempenhos com linguagem neutra ("impressionante atuação", "números históricos"), contextualizar a importância da partida, destacar jogadores com dados
- O texto deve soar como ESPN ou TNT Sports reais: informativo, envolvente, mas sem parcialidade`
    : "";

  const prestigeSection = buildClubPrestigeSection(clubName, clubLeague, clubTitles, clubDescription, projeto);

  const isDescLoss = /derrota|perdeu|perde|goleada sofrida|eliminado/i.test(description);
  const isDescWin = /vitória|vitoria|venceu|vence|goleada aplicada|goleada!|classificou|classifica/i.test(description);
  const isDescPenalties = /pênaltis|penaltis|classificou nos pênaltis|eliminado nos pênaltis/i.test(description);
  const penaltySection = isDescPenalties
    ? `\n\nDISPUTA DE PÊNALTIS — INSTRUÇÕES ESPECIAIS DE NARRAÇÃO:
Esta notícia envolve uma disputa de pênaltis. A descrição pode mencionar herói (quem marcou o pênalti decisivo), goleiro herói (quem fez defesas cruciais) e quem perdeu cobranças.
REGRAS OBRIGATÓRIAS PARA PÊNALTIS:
- Narre a TENSÃO PSICOLÓGICA — cada cobrança é um duelo individual de nervos: a corrida para a bola, a respiração presa da torcida, o goleiro se jogando.
- Se a descrição mencionar um HERÓI (jogador que marcou o pênalti decisivo): coloque-o como protagonista absoluto da notícia. Descreva o momento do gol com detalhes dramáticos — a comemoração, a explosão das arquibancadas, a catarse coletiva.
- Se a descrição mencionar um GOLEIRO HERÓI (que fez defesas): ele deve ser celebrado como o grande nome da partida. Descreva a defesa decisiva com toda a dramaticidade.
- Se a descrição mencionar quem PERDEU cobrança(s): trate com sensibilidade — sem humilhação gratuita. A pressão de cobrar pênalti é enorme. Comentários de torcedores podem expressar tristeza ou decepção, mas evite crueldade.
- Crie comentários de torcedores que viveram cada cobrança: "cada pênalti era um infarto", "quando ele bateu e entrou eu gritei igual louco", "não acreditei quando o goleiro defendeu".
- Use linguagem que transmita o ritmo da disputa: "primeiro pênalti convertido", "segunda cobrança defendida", "decisivo".
- Em caso de ELIMINAÇÃO: a dor dos pênaltis é diferente — é uma crueldade do futebol, não uma derrota simples. Transmita esse sentimento único de impotência e tristeza.`
    : "";

  const classicoSection = isClassico && rivalName
    ? buildClassicoSection(clubName, rivalName, isDescLoss, isDescWin)
    : "";
  const fanMoodSection = (fanMoodScore !== undefined && fanMoodLabel)
    ? buildFanMoodSection(clubName, fanMoodLabel, fanMoodScore)
    : "";

  const systemPrompt = `Você é um especialista em criar posts de futebol para redes sociais brasileiras no estilo Instagram.
Cada post que você cria deve ser ÚNICO e DIFERENTE dos anteriores — varie o estilo, tom, escolha de emojis, estrutura da legenda e perfil dos comentaristas.
Use linguagem informal, autêntica, com gírias brasileiras do futebol. Seja criativo e específico.
O time é ${clubName}${season ? ` (temporada ${season})` : ""}.
O portal que publica é ${portalName} (${portalHandle}).
Semente de unicidade: ${uniqueSeed} — use ela para garantir que este post seja diferente de qualquer outro.
REGRA ABSOLUTA: NUNCA mencione números de OVR, overall, ratings ou diferenças numéricas de atributos em nenhuma parte do texto gerado (título, legenda, comentários, replies). Em vez disso, use apenas termos qualitativos naturais como "estrela do elenco", "acima da média", "jogador de alto nível", "craque do time", "peça importante", "abaixo da média do elenco", "reforço de qualidade", etc. Os dados numéricos existem apenas para a sua calibração interna — não os exponha no texto.${prestigeSection}${playersSection}${squadOvrSection}${teamFormSection}${historicalSection}${attachedMatchSection}${matchPlayerSection}${recentPostsSection}${fanMoodSection}${penaltySection}${classicoSection}${customPortalSection}${globalPortalSection}`;

  const commentPersonalitiesRule = isGlobalPortal
    ? `AUDIÊNCIA DOS COMENTÁRIOS — portal global com seguidores de TODO o mundo e de VÁRIOS clubes:
- Inclua obrigatoriamente comentários de DIFERENTES perfis: torcedores do ${clubName} (celebrando ou cobrando), torcedores de clubes RIVAIS (alfinetando, zoando, provocando), fãs neutros/analistas (comentando o aspecto tático ou estatístico), fãs internacionais (revelam no texto que acompanham de outro país, mas escrevem em português).
- A PROPORÇÃO varia com o contexto da notícia: derrota ou eliminação → mais rivais zombando e menos celebração; vitória expressiva sobre rival histórico → mistura de fãs eufóricos e rivais provocando; conquista de título → mistura épica; lesão de jogador → mais neutros/analistas e menos provocação.
- Personalidade "rival": torcedor de outro clube a alfinetar, zoar ou provocar de forma realista — como acontece nos comentários da TNT Sports ou ESPN reais. Pode ser debochado, irônico ou simplesmente provocador.
- Personalidade "internacional": escreve EM PORTUGUÊS, mas deixa claro no conteúdo que é de outro país ("Aqui de Portugal...", "Acompanho da Argentina...", "Sou de Moçambique e...").`
    : `Os comentários devem ter personalidades DISTINTAS e realistas: torcedor apaixonado, crítico, irônico, estrangeiro, saudosista, criança de 14 anos.`;

  const userPrompt = `Crie um post de notícia com base nessa descrição: "${description.trim()}"

${chosenCategory ? `Categoria: ${chosenCategory}` : "Escolha a categoria mais adequada: resultado, lesao, transferencia, renovacao, treino, conquista, geral"}

REGRAS DE CRIATIVIDADE:
- Varie o formato da legenda: pode ser longa com storytelling, curta e impactante, com listas, ou com muitas quebras de linha
- ${commentPersonalitiesRule}
- Emojis e hashtags devem ser contextuais, não aleatórios

REGRAS OBRIGATÓRIAS PARA COMENTARISTAS:
- TODOS os comentários e replies DEVEM estar escritos em português (pt-BR), sem excepção — incluindo perfis "internacional" e "rival"
- displayName DEVE ser um nome de pessoa real e comum (ex: "Lucas Ferreira", "Ana Souza", "Pedro Mendes", "Carla Lima", "João Carlos", "Thiago Rocha")
- username DEVE ser derivado do nome da pessoa, curto e simples, como uma pessoa real usaria (ex: @lucasferreira, @anasouza22, @pedromendes_fc, @carlamlima, @joaocarlos17)
- NUNCA use nomes de fanpage, coletivos ou conceitos abstratos — ERRADO: @nossosbonsmomentos, @bolaplenitude, @amantesdacorneta2023

Responda APENAS com JSON puro (sem markdown, sem code block):
{
  "source": "${chosenSource}",
  "sourceHandle": "${portalHandle}",
  "sourceName": "${portalName}",
  "category": "${chosenCategory ?? "<categoria>"}",
  "title": "<título em maiúsculas, máx 6 palavras, ou string vazia>",
  "content": "<legenda completa no estilo Instagram>",
  "likes": <500 a 80000>,
  "commentsCount": <20 a 800>,
  "sharesCount": <30 a 3000>,
  "comments": [
    {
      "username": "@<nome_da_pessoa_em_formato_handle>",
      "displayName": "<Nome Sobrenome de pessoa real>",
      "content": "<comentário único e com personalidade, SEMPRE em português>",
      "likes": <1 a 3000>,
      "personality": "${isGlobalPortal ? "do_clube|rival|neutro|internacional|zoeiro|saudosista" : "otimista|chato|corneteiro|zoeiro|saudosista|neutro|internacional"}",
      "replies": [
        {
          "username": "@<nome_da_pessoa_em_formato_handle>",
          "displayName": "<Nome Sobrenome de pessoa real>",
          "content": "<reply curto, SEMPRE em português>",
          "likes": <1 a 500>,
          "personality": "<personalidade>",
          "replies": []
        }
      ]
    }
  ]
}

Gere 6 a 9 comentários. Pelo menos 2 deles devem ter 1 reply cada.`;

  try {
    const completionParams = usingUserKey
      ? { model: "gpt-4o", max_tokens: 4096 }
      : { model: "gpt-5.2", max_completion_tokens: 4096 };

    const completion = await client.chat.completions.create({
      ...completionParams,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    } as Parameters<typeof client.chat.completions.create>[0]);

    const raw = (completion as OpenAI.Chat.Completions.ChatCompletion).choices[0]?.message?.content ?? "";

    let parsed: Record<string, unknown>;
    try {
      const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      res.status(500).json({ error: "Resposta inválida da IA", raw });
      return;
    }

    const post = {
      source:        (parsed.source as string) ?? chosenSource,
      sourceHandle:  (parsed.sourceHandle as string) ?? portalHandle,
      sourceName:    (parsed.sourceName as string) ?? portalName,
      category:      parsed.category ?? "geral",
      title:         (parsed.title as string) || undefined,
      content:       parsed.content as string,
      likes:         Number(parsed.likes) || 1200,
      commentsCount: Number(parsed.commentsCount) || 50,
      sharesCount:   Number(parsed.sharesCount) || 200,
      comments:      (parsed.comments as unknown[]) ?? [],
      ...(isCustomPortal ? { customPortalId: customPortal.id } : {}),
    };

    res.json(post);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Erro ao gerar notícia com IA", details: msg });
  }
});

interface GenerateWelcomeBody {
  coachName: string;
  coachAge?: number;
  coachNationality?: string;
  clubName: string;
  clubLeague?: string;
  clubDescription?: string;
  projeto?: string;
}

router.post("/noticias/generate-welcome", async (req, res) => {
  const { coachName, coachAge, coachNationality, clubName, clubLeague, clubDescription, projeto } =
    req.body as GenerateWelcomeBody;

  if (!coachName?.trim() || !clubName?.trim()) {
    res.status(400).json({ error: "coachName e clubName são obrigatórios" });
    return;
  }

  const userKey = (req.headers["x-openai-key"] as string | undefined) ?? "";
  const { client, usingUserKey } = getClient(userKey);

  const shortClub = clubName.split(" ").slice(0, 2).join(" ");
  const uniqueSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const coachDetails = [
    coachAge ? `${coachAge} anos` : null,
    coachNationality ? `nacionalidade: ${coachNationality}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const leagueInfo = clubLeague ? `\nLiga do clube: ${clubLeague}` : "";
  const clubInfo = clubDescription?.trim() ? `\nSobre o clube: ${clubDescription.trim().slice(0, 200)}` : "";
  const projectInfo = projeto?.trim() ? `\nProjeto da temporada: "${projeto.trim()}"` : "";

  const systemPrompt = `Você é um jornalista esportivo especializado em cobertura de futebol para portais brasileiros como ESPN Brasil e TNT Sports.
Você escreve posts no estilo de redes sociais (Instagram/Twitter) — legendas com impacto, emocionais, com emojis e hashtags.
O clube é ${clubName} (${shortClub}).${leagueInfo}${clubInfo}${projectInfo}
Semente de unicidade: ${uniqueSeed}`;

  const userPrompt = `Um novo técnico foi anunciado no ${clubName}: **${coachName}**${coachDetails ? ` (${coachDetails})` : ""}.

INSTRUÇÕES IMPORTANTES:
1. VERIFIQUE se "${coachName}" é um treinador famoso do futebol real (ex: José Mourinho, Pep Guardiola, Carlo Ancelotti, Zinedine Zidane, Jürgen Klopp, Luis Enrique, Jorge Jesus, Tite, Renato Gaúcho, etc.).
   - Se SIM: mencione explicitamente o histórico real dele — títulos conquistados, clubes anteriores, estilo de jogo característico, reputação, conquistas marcantes. A matéria deve ser muito mais rica com esse contexto.
   - Se NÃO (nome fictício ou desconhecido): escreva uma matéria de apresentação genérica mas coerente com os dados fornecidos (idade, nacionalidade).

2. Escreva como se fosse um post da ESPN Brasil ou TNT Sports anunciando a chegada do técnico ao ${clubName}.
3. Tom jornalístico mas com energia de rede social — use emojis, impacto, expectativa.
4. Gere comentários de torcedores variados: otimistas, céticos, zoeiros, saudosistas, fãs internacionais.

Responda APENAS com JSON puro (sem markdown, sem code block):
{
  "source": "espn",
  "sourceHandle": "@espnbrasil",
  "sourceName": "ESPN Brasil",
  "category": "geral",
  "title": "<título em maiúsculas, máx 6 palavras, ex: MOURINHO É O NOVO TÉCNICO>",
  "content": "<legenda completa no estilo Instagram/portal esportivo, 3-8 parágrafos, com emojis e hashtags>",
  "likes": <5000 a 120000>,
  "commentsCount": <200 a 3000>,
  "sharesCount": <500 a 10000>,
  "comments": [
    {
      "username": "@<nome_da_pessoa_handle_simples>",
      "displayName": "<Nome Sobrenome de pessoa brasileira real>",
      "content": "<comentário com personalidade>",
      "likes": <10 a 5000>,
      "personality": "<otimista|chato|corneteiro|zoeiro|saudosista|neutro|internacional>",
      "replies": [
        {
          "username": "@<handle>",
          "displayName": "<Nome Sobrenome>",
          "content": "<reply curto>",
          "likes": <1 a 500>,
          "personality": "<personalidade>",
          "replies": []
        }
      ]
    }
  ]
}

Gere 7 a 10 comentários. Pelo menos 3 devem ter replies. Se o técnico for famoso do mundo real, alguns comentários de fãs internacionais são esperados e realistas.`;

  try {
    const completionParams = usingUserKey
      ? { model: "gpt-4o", max_tokens: 4096 }
      : { model: "gpt-5.2", max_completion_tokens: 4096 };

    const completion = await client.chat.completions.create({
      ...completionParams,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    } as Parameters<typeof client.chat.completions.create>[0]);

    const raw = (completion as OpenAI.Chat.Completions.ChatCompletion).choices[0]?.message?.content ?? "";

    let parsed: Record<string, unknown>;
    try {
      const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      res.status(500).json({ error: "Resposta inválida da IA", raw });
      return;
    }

    const post = {
      source:        (parsed.source as string) ?? "espn",
      sourceHandle:  (parsed.sourceHandle as string) ?? "@espnbrasil",
      sourceName:    (parsed.sourceName as string) ?? "ESPN Brasil",
      category:      parsed.category ?? "geral",
      title:         (parsed.title as string) || undefined,
      content:       parsed.content as string,
      likes:         Number(parsed.likes) || 8000,
      commentsCount: Number(parsed.commentsCount) || 400,
      sharesCount:   Number(parsed.sharesCount) || 1200,
      comments:      (parsed.comments as unknown[]) ?? [],
    };

    res.json(post);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Erro ao gerar notícia de apresentação", details: msg });
  }
});

interface GenerateRumorBody {
  clubName: string;
  season?: string;
  clubLeague?: string;
  clubDescription?: string;
  projeto?: string;
  playersContext?: string;
  squadPositionNeeds?: string;
  customPortal?: CustomPortalPayload;
}

router.post("/noticias/generate-rumor", async (req, res) => {
  const {
    clubName, season, clubLeague, clubDescription, projeto,
    playersContext, squadPositionNeeds, customPortal,
  } = req.body as GenerateRumorBody;

  if (!clubName?.trim()) {
    res.status(400).json({ error: "clubName é obrigatório" });
    return;
  }

  const userKey = (req.headers["x-openai-key"] as string | undefined) ?? "";
  const { client, usingUserKey } = getClient(userKey);

  const shortClub = clubName.split(" ").slice(0, 2).join(" ");
  const uniqueSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const isCustomPortal = !!customPortal;
  const portalName = isCustomPortal
    ? customPortal.name
    : (Math.random() < 0.5 ? "TNT Sports" : "ESPN Brasil");
  const portalHandle = isCustomPortal
    ? `@${customPortal.name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "")}`
    : (portalName === "TNT Sports" ? "@tntsports" : "@espnbrasil");
  const chosenSource = isCustomPortal ? "custom" : (portalName === "TNT Sports" ? "tnt" : "espn");

  const customPortalSection = isCustomPortal
    ? `\n\nPERFIL DO PORTAL:\nNome: ${customPortal.name}\nDescrição/identidade: ${customPortal.description}\n${TONE_PROMPTS[customPortal.tone] ?? TONE_PROMPTS.serio}\nAdapte TODO o conteúdo ao tom e identidade deste portal.`
    : "";

  const leagueSection = clubLeague ? `\nLiga: ${clubLeague}` : "";
  const descSection = clubDescription?.trim() ? `\nSobre o clube: ${clubDescription.trim().slice(0, 200)}` : "";
  const projectSection = projeto?.trim() ? `\nProjeto da temporada: "${projeto.trim()}"` : "";
  const playersSection = playersContext?.trim()
    ? `\n\nELENCO ATUAL (contexto de desempenho dos jogadores — use para escolher quem vazar no rumor):\n${playersContext.trim()}`
    : "";
  const needsSection = squadPositionNeeds?.trim()
    ? `\n\nPOSIÇÕES COM LACUNA NO ELENCO (possíveis alvos de sondagem):\n${squadPositionNeeds.trim()}`
    : "";

  const systemPrompt = `Você é um jornalista especialista em mercado de transferências do futebol brasileiro e europeu.
Você escreve posts de RUMORES de transferência no estilo das redes sociais brasileiras — boato, especulação, bastidores.
Clube: ${clubName}${season ? ` (temporada ${season})` : ""}${leagueSection}${descSection}${projectSection}
Portal: ${portalName} (${portalHandle})
Semente de unicidade: ${uniqueSeed}${playersSection}${needsSection}${customPortalSection}`;

  const rumorTypes = [
    `Um clube estrangeiro está monitorando um dos jogadores em destaque do ${shortClub}`,
    `Um clube rival fez uma sondagem por um jogador do ${shortClub}`,
    `O ${shortClub} está sendo sondado sobre um atacante de outro clube para reforçar o elenco`,
    `Agente de um jogador confirmou interesse de clube europeu em atleta do ${shortClub}`,
    `${shortClub} monitora meio-campista cobiçado por outros clubes`,
  ];
  const chosenType = rumorTypes[Math.floor(Math.random() * rumorTypes.length)];

  const userPrompt = `Crie um post de RUMOR de mercado com o tema: "${chosenType}".

REGRAS OBRIGATÓRIAS:
- Tom de bastidores: "fontes próximas ao clube revelam", "segundo informações exclusivas", "a reportagem apurou", "de acordo com pessoas próximas à negociação"
- Use linguagem de rumor genuíno — não confirme nada, mas deixe no ar. Crie suspense.
- Se mencionar um jogador do elenco, escolha com base no desempenho (quem está em boa forma chama atenção)
- Pode inventar nomes de jogadores-alvo externos de forma coerente com o contexto da liga
- Categoria DEVE ser "transferencia"
- O post deve soar como uma reportagem real de mercado, não uma notícia confirmada
- Inclua comentários de torcedores: alguns animados, outros preocupados com saída de jogador titular, outros céticos com boatos

REGRAS DE COMENTARISTAS:
- TODOS os comentários em português (pt-BR)
- displayName = nome real de pessoa (ex: "Rafael Cunha", "Beatriz Moura")
- username = derivado do nome (@rafaelcunha, @biamoura22)

Responda APENAS com JSON puro (sem markdown, sem code block):
{
  "source": "${chosenSource}",
  "sourceHandle": "${portalHandle}",
  "sourceName": "${portalName}",
  "category": "transferencia",
  "title": "<título em maiúsculas, máx 6 palavras, ex: RUMOR: INTERESSE EUROPEU EM ASTRO>",
  "content": "<legenda no estilo Instagram com tom de rumor — 3-6 parágrafos, emojis, hashtags>",
  "likes": <800 a 50000>,
  "commentsCount": <30 a 600>,
  "sharesCount": <50 a 2000>,
  "comments": [
    {
      "username": "@<handle>",
      "displayName": "<Nome Sobrenome>",
      "content": "<comentário sobre o rumor>",
      "likes": <1 a 2000>,
      "personality": "<otimista|chato|corneteiro|zoeiro|saudosista|neutro>",
      "replies": []
    }
  ]
}

Gere 5 a 8 comentários.`;

  try {
    const completionParams = usingUserKey
      ? { model: "gpt-4o", max_tokens: 3072 }
      : { model: "gpt-5.2", max_completion_tokens: 3072 };

    const completion = await client.chat.completions.create({
      ...completionParams,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    } as Parameters<typeof client.chat.completions.create>[0]);

    const raw = (completion as OpenAI.Chat.Completions.ChatCompletion).choices[0]?.message?.content ?? "";

    let parsed: Record<string, unknown>;
    try {
      const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      res.status(500).json({ error: "Resposta inválida da IA", raw });
      return;
    }

    res.json({
      source: (parsed.source as string) ?? chosenSource,
      sourceHandle: (parsed.sourceHandle as string) ?? portalHandle,
      sourceName: (parsed.sourceName as string) ?? portalName,
      category: "transferencia",
      title: (parsed.title as string) || undefined,
      content: parsed.content as string,
      likes: Number(parsed.likes) || 3000,
      commentsCount: Number(parsed.commentsCount) || 80,
      sharesCount: Number(parsed.sharesCount) || 300,
      comments: (parsed.comments as unknown[]) ?? [],
      ...(isCustomPortal ? { customPortalId: customPortal.id } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Erro ao gerar rumor", details: msg });
  }
});

interface GenerateLeakBody {
  clubName: string;
  season?: string;
  clubLeague?: string;
  notificationPreview: string;
  memberName?: string;
  meetingReason?: string;
  customPortal: CustomPortalPayload;
}

router.post("/noticias/generate-leak", async (req, res) => {
  const {
    clubName, season, clubLeague,
    notificationPreview, memberName, meetingReason,
    customPortal,
  } = req.body as GenerateLeakBody;

  if (!clubName?.trim() || !notificationPreview?.trim() || !customPortal) {
    res.status(400).json({ error: "clubName, notificationPreview e customPortal são obrigatórios" });
    return;
  }

  const userKey = (req.headers["x-openai-key"] as string | undefined) ?? "";
  const { client, usingUserKey } = getClient(userKey);

  const uniqueSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const portalHandle = `@${customPortal.name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "")}`;
  const leagueSection = clubLeague ? ` (${clubLeague})` : "";
  const tonePrompt = TONE_PROMPTS[customPortal.tone] ?? TONE_PROMPTS.jornalistico;

  const memberSection = memberName ? `\nMembro da diretoria envolvido: ${memberName}` : "";
  const reasonSection = meetingReason ? `\nMotivo/contexto da reunião: ${meetingReason}` : "";

  const systemPrompt = `Você é um jornalista especialista em bastidores de futebol brasileiro. Você escreve posts no estilo de vazamentos internos — como se fosse uma fonte anônima dentro do clube revelando informações sigilosas.
Portal: ${customPortal.name} (${portalHandle})
${tonePrompt}
Clube: ${clubName}${leagueSection}${season ? ` — temporada ${season}` : ""}
Semente de unicidade: ${uniqueSeed}`;

  const userPrompt = `Uma reunião interna da diretoria do ${clubName} vazou para a imprensa.

Contexto do que aconteceu nos bastidores:
"${notificationPreview}"${memberSection}${reasonSection}

Crie um post com tom de VAZAMENTO, como se uma fonte anônima dentro do clube tivesse revelado o que aconteceu nos bastidores.

REGRAS OBRIGATÓRIAS:
- Use linguagem de fonte anônima: "segundo apurou a reportagem", "fontes internas revelaram", "de acordo com pessoas próximas à diretoria", "bastidores do ${clubName} estão agitados"
- NÃO revele o diálogo literal da reunião — dê a entender o que aconteceu sem citar falas diretas
- Pode mencionar tensão entre membros, clima interno, pressão por resultados, situação financeira — com base no contexto
- O tom deve ser de furo jornalístico, not boato de WhatsApp
- Categoria DEVE ser "geral"
- Inclua comentários de torcedores reagindo: curiosos, preocupados, irônicos

REGRAS DE COMENTARISTAS:
- TODOS em português (pt-BR)
- displayName = nome real de pessoa
- username = derivado do nome, simples

Responda APENAS com JSON puro (sem markdown, sem code block):
{
  "source": "custom",
  "sourceHandle": "${portalHandle}",
  "sourceName": "${customPortal.name}",
  "category": "geral",
  "title": "<título em maiúsculas, máx 6 palavras, ex: BASTIDORES AGITADOS NA DIRETORIA>",
  "content": "<legenda com tom de vazamento — 3-5 parágrafos, emojis contextuais, hashtags>",
  "likes": <500 a 30000>,
  "commentsCount": <20 a 400>,
  "sharesCount": <30 a 1500>,
  "comments": [
    {
      "username": "@<handle>",
      "displayName": "<Nome Sobrenome>",
      "content": "<comentário reagindo ao vazamento>",
      "likes": <1 a 1500>,
      "personality": "<otimista|chato|corneteiro|zoeiro|saudosista|neutro>",
      "replies": []
    }
  ]
}

Gere 5 a 7 comentários.`;

  try {
    const completionParams = usingUserKey
      ? { model: "gpt-4o", max_tokens: 3072 }
      : { model: "gpt-5.2", max_completion_tokens: 3072 };

    const completion = await client.chat.completions.create({
      ...completionParams,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    } as Parameters<typeof client.chat.completions.create>[0]);

    const raw = (completion as OpenAI.Chat.Completions.ChatCompletion).choices[0]?.message?.content ?? "";

    let parsed: Record<string, unknown>;
    try {
      const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      res.status(500).json({ error: "Resposta inválida da IA", raw });
      return;
    }

    res.json({
      source: "custom",
      sourceHandle: (parsed.sourceHandle as string) ?? portalHandle,
      sourceName: (parsed.sourceName as string) ?? customPortal.name,
      category: "geral",
      title: (parsed.title as string) || undefined,
      content: parsed.content as string,
      likes: Number(parsed.likes) || 2000,
      commentsCount: Number(parsed.commentsCount) || 60,
      sharesCount: Number(parsed.sharesCount) || 200,
      comments: (parsed.comments as unknown[]) ?? [],
      customPortalId: customPortal.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Erro ao gerar vazamento", details: msg });
  }
});

export default router;
