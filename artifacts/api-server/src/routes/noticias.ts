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
  historicalContext?: string;
  recentPostsContext?: RecentPostSummary[];
  customPortal?: CustomPortalPayload;
  clubLeague?: string;
  clubTitles?: ClubTitle[];
  clubDescription?: string;
  projeto?: string;
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
};

function getClient(userKey?: string): { client: OpenAI; usingUserKey: boolean } {
  if (userKey && userKey.trim().startsWith("sk-")) {
    return { client: new OpenAI({ apiKey: userKey.trim() }), usingUserKey: true };
  }
  return { client: defaultOpenai as unknown as OpenAI, usingUserKey: false };
}

router.post("/noticias/generate", async (req, res) => {
  const {
    description, clubName, season, source, category,
    playersContext, historicalContext, recentPostsContext, customPortal,
    clubLeague, clubTitles, clubDescription, projeto,
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

  const historicalSection = historicalContext?.trim()
    ? `\n\nHISTÓRICO DO CLUBE (use para dar profundidade narrativa quando relevante — ex: comemorações de recorde, comparações com temporadas anteriores, saudosismo de torcedores):\n${historicalContext.trim()}`
    : "";

  const recentPostsSection = recentPostsContext && recentPostsContext.length > 0
    ? `\n\nPOSTS RECENTES DO FEED (últimas notícias publicadas, do mais novo ao mais antigo):\n${recentPostsContext.map((p, i) => `${i + 1}. [${p.category}] ${p.title ? p.title + " — " : ""}${p.headline}`).join("\n")}\n\nUSO DOS POSTS RECENTES — REGRA IMPORTANTE: Em aproximadamente 1 a cada 4 gerações, crie conexões narrativas com eventos recentes acima. Mas NÃO faça isso na maioria das vezes — a maior parte dos posts deve ser independente e autossuficiente.`
    : "";

  const customPortalSection = isCustomPortal
    ? `\n\nPERFIL DO PORTAL:\nNome: ${customPortal.name}\nDescrição/identidade: ${customPortal.description}\n${TONE_PROMPTS[customPortal.tone] ?? TONE_PROMPTS.serio}\nAdapte TODO o conteúdo (título, legenda e comentários) ao tom e identidade deste portal. Seja fiel à personalidade descrita.`
    : "";

  const prestigeSection = buildClubPrestigeSection(clubName, clubLeague, clubTitles, clubDescription, projeto);

  const systemPrompt = `Você é um especialista em criar posts de futebol para redes sociais brasileiras no estilo Instagram.
Cada post que você cria deve ser ÚNICO e DIFERENTE dos anteriores — varie o estilo, tom, escolha de emojis, estrutura da legenda e perfil dos comentaristas.
Use linguagem informal, autêntica, com gírias brasileiras do futebol. Seja criativo e específico.
O time é ${clubName}${season ? ` (temporada ${season})` : ""}.
O portal que publica é ${portalName} (${portalHandle}).
Semente de unicidade: ${uniqueSeed} — use ela para garantir que este post seja diferente de qualquer outro.${prestigeSection}${playersSection}${historicalSection}${recentPostsSection}${customPortalSection}`;

  const userPrompt = `Crie um post de notícia com base nessa descrição: "${description.trim()}"

${chosenCategory ? `Categoria: ${chosenCategory}` : "Escolha a categoria mais adequada: resultado, lesao, transferencia, renovacao, treino, conquista, geral"}

REGRAS DE CRIATIVIDADE:
- Varie o formato da legenda: pode ser longa com storytelling, curta e impactante, com listas, ou com muitas quebras de linha
- Os comentários devem ter personalidades DISTINTAS e realistas: torcedor apaixonado, crítico, irônico, estrangeiro, saudosista, criança de 14 anos
- Emojis e hashtags devem ser contextuais, não aleatórios

REGRAS OBRIGATÓRIAS PARA COMENTARISTAS:
- displayName DEVE ser um nome de pessoa brasileira real e comum (ex: "Lucas Ferreira", "Ana Souza", "Pedro Mendes", "Carla Lima", "João Carlos", "Thiago Rocha")
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
      "displayName": "<Nome Sobrenome de pessoa brasileira real>",
      "content": "<comentário único e com personalidade>",
      "likes": <1 a 3000>,
      "personality": "<otimista|chato|corneteiro|zoeiro|saudosista|neutro|internacional>",
      "replies": [
        {
          "username": "@<nome_da_pessoa_em_formato_handle>",
          "displayName": "<Nome Sobrenome de pessoa brasileira real>",
          "content": "<reply curto>",
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

export default router;
