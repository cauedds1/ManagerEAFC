import { Router } from "express";
import OpenAI from "openai";
import { openai as defaultOpenai } from "@workspace/integrations-openai-ai-server";

const router = Router();

interface RecentPostSummary {
  title?: string;
  category: string;
  headline: string;
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
}

function getClient(userKey?: string): { client: OpenAI; usingUserKey: boolean } {
  if (userKey && userKey.trim().startsWith("sk-")) {
    return { client: new OpenAI({ apiKey: userKey.trim() }), usingUserKey: true };
  }
  return { client: defaultOpenai as unknown as OpenAI, usingUserKey: false };
}

router.post("/noticias/generate", async (req, res) => {
  const { description, clubName, season, source, category, playersContext, historicalContext, recentPostsContext } =
    req.body as GenerateNoticiaBody;

  if (!description || !description.trim()) {
    res.status(400).json({ error: "description é obrigatório" });
    return;
  }

  const userKey = (req.headers["x-openai-key"] as string | undefined) ?? "";
  const { client, usingUserKey } = getClient(userKey);

  const slug = clubName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const shortClub = clubName.split(" ").slice(0, 2).join(" ");

  const sourceOptions = {
    tnt: { name: "TNT Sports", handle: "@tntsports" },
    espn: { name: "ESPN Brasil", handle: "@espnbrasil" },
    fanpage: { name: `${shortClub} Oficial`, handle: `@${slug}oficial` },
  } as const;

  const chosenSource = (source as keyof typeof sourceOptions) ?? "fanpage";
  const sourceInfo = sourceOptions[chosenSource] ?? sourceOptions.fanpage;

  const categories = ["resultado", "lesao", "transferencia", "renovacao", "treino", "conquista", "geral"];
  const chosenCategory = category && categories.includes(category) ? category : null;

  const uniqueSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const playersSection = playersContext?.trim()
    ? `\n\nELENCO — CONTEXTO DE DESEMPENHO (use com moderação para enriquecer comentários — nem todo comentário precisa mencionar jogadores; prefira os mais marcantes como ídolos, artilheiros ou jogadores com incidentes recentes):\n${playersContext.trim()}`
    : "";

  const historicalSection = historicalContext?.trim()
    ? `\n\nHISTÓRICO DO CLUBE (use para dar profundidade narrativa quando relevante — ex: comemorações de recorde, comparações com temporadas anteriores, saudosismo de torcedores):\n${historicalContext.trim()}`
    : "";

  const recentPostsSection = recentPostsContext && recentPostsContext.length > 0
    ? `\n\nPOSTS RECENTES DO FEED (últimas notícias publicadas, do mais novo ao mais antigo):\n${recentPostsContext.map((p, i) => `${i + 1}. [${p.category}] ${p.title ? p.title + " — " : ""}${p.headline}`).join("\n")}\n\nUSO DOS POSTS RECENTES — REGRA IMPORTANTE: Em aproximadamente 1 a cada 4 gerações, crie conexões narrativas com eventos recentes acima — por exemplo: torcedores comparando dois jogadores anunciados, reações em cascata de notícias relacionadas, alguém que viu o post anterior, piadas internas sobre acontecimentos recentes. Mas NÃO faça isso na maioria das vezes — a maior parte dos posts deve ser independente e autossuficiente. Deixe a conexão surgir de forma orgânica e natural, nunca forçada.`
    : "";

  const systemPrompt = `Você é um especialista em criar posts de futebol para redes sociais brasileiras no estilo Instagram.
Cada post que você cria deve ser ÚNICO e DIFERENTE dos anteriores — varie o estilo, tom, escolha de emojis, estrutura da legenda e perfil dos comentaristas.
Use linguagem informal, autêntica, com gírias brasileiras do futebol. Seja criativo e específico.
O time é ${clubName}${season ? ` (temporada ${season})` : ""}.
O portal que publica é ${sourceInfo.name} (${sourceInfo.handle}).
Semente de unicidade: ${uniqueSeed} — use ela para garantir que este post seja diferente de qualquer outro.${playersSection}${historicalSection}${recentPostsSection}`;

  const userPrompt = `Crie um post de notícia com base nessa descrição: "${description.trim()}"

${chosenCategory ? `Categoria: ${chosenCategory}` : "Escolha a categoria mais adequada: resultado, lesao, transferencia, renovacao, treino, conquista, geral"}

REGRAS DE CRIATIVIDADE:
- Varie o formato da legenda: pode ser longa com storytelling, curta e impactante, com listas, ou com muitas quebras de linha
- Os comentários devem ter personalidades DISTINTAS e realistas: torcedor apaixonado, crítico, irônico, estrangeiro, saudosista, criança de 14 anos
- Emojis e hashtags devem ser contextuais, não aleatórios

REGRAS OBRIGATÓRIAS PARA COMENTARISTAS:
- displayName DEVE ser um nome de pessoa brasileira real e comum (ex: "Lucas Ferreira", "Ana Souza", "Pedro Mendes", "Carla Lima", "João Carlos", "Thiago Rocha")
- username DEVE ser derivado do nome da pessoa, curto e simples, como uma pessoa real usaria (ex: @lucasferreira, @anasouza22, @pedromendes_fc, @carlamlima, @joaocarlos17)
- NUNCA use nomes de fanpage, coletivos ou conceitos abstratos — ERRADO: @nossosbonsmomentos, @bolaplenitude, @amantesdacorneta2023, @londresloversonly, @critica_pura, @defensordofutebol

Responda APENAS com JSON puro (sem markdown, sem code block):
{
  "source": "${chosenSource}",
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

    const finalSource = (parsed.source as string) ?? chosenSource;
    const finalSourceInfo = sourceOptions[(finalSource as keyof typeof sourceOptions)] ?? sourceInfo;

    const post = {
      source: finalSource,
      sourceHandle: finalSourceInfo.handle,
      sourceName: finalSourceInfo.name,
      category: parsed.category ?? "geral",
      title: (parsed.title as string) || undefined,
      content: parsed.content as string,
      likes: Number(parsed.likes) || 1200,
      commentsCount: Number(parsed.commentsCount) || 50,
      sharesCount: Number(parsed.sharesCount) || 200,
      comments: (parsed.comments as unknown[]) ?? [],
    };

    res.json(post);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Erro ao gerar notícia com IA", details: msg });
  }
});

export default router;
