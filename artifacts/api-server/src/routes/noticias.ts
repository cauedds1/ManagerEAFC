import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

interface GenerateNoticiaBody {
  description: string;
  clubName: string;
  season?: string;
  source?: string;
  category?: string;
}

router.post("/noticias/generate", async (req, res) => {
  const { description, clubName, season, source, category } =
    req.body as GenerateNoticiaBody;

  if (!description || !description.trim()) {
    res.status(400).json({ error: "description é obrigatório" });
    return;
  }

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

  const systemPrompt = `Você é um gerador de posts de notícias de futebol no estilo Instagram/redes sociais brasileiras. 
Gere um post realista no estilo de um portal esportivo brasileiro publicando no Instagram.
Use linguagem informal, emojis, hashtags e o estilo typical dos perfis esportivos brasileiros.
Seja autêntico e específico sobre o clube mencionado.
O time do usuário é ${clubName}${season ? ` na temporada ${season}` : ""}.
O portal que publica é ${sourceInfo.name} (${sourceInfo.handle}).`;

  const userPrompt = `Crie um post de notícia com base nessa descrição: "${description.trim()}"

${chosenCategory ? `Categoria da notícia: ${chosenCategory}` : "Escolha a categoria mais adequada entre: resultado, lesao, transferencia, renovacao, treino, conquista, geral"}

Responda APENAS com um JSON válido no seguinte formato (sem markdown, sem code block, apenas JSON puro):
{
  "source": "${chosenSource}",
  "category": "${chosenCategory ?? "<categoria_escolhida>"}",
  "title": "<título opcional em maiúsculas, máx 8 palavras, pode ser vazio string se não fizer sentido>",
  "content": "<legenda completa no estilo Instagram, com emojis, hashtags, várias linhas>",
  "likes": <número entre 500 e 50000>,
  "commentsCount": <número entre 20 e 500>,
  "sharesCount": <número entre 50 e 2000>,
  "comments": [
    {
      "username": "@<usuario_sem_espaço>",
      "displayName": "<nome do usuário>",
      "content": "<comentário>",
      "likes": <número entre 1 e 2000>,
      "personality": "<otimista|chato|corneteiro|zoeiro|saudosista|neutro|internacional>",
      "replies": []
    }
  ]
}

Gere entre 5 e 8 comentários com personalidades variadas de torcedores brasileiros. Alguns podem ter respostas (replies) dentro deles — máximo 2 replies por comentário.
Cada reply deve ter o mesmo formato de comentário mas com replies sendo um array vazio.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";

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
