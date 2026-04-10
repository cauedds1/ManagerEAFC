import { Router } from "express";
import OpenAI from "openai";
import { openai as defaultOpenai } from "@workspace/integrations-openai-ai-server";

const router = Router();

function getClient(userKey?: string): { client: OpenAI; usingUserKey: boolean } {
  if (userKey && userKey.trim().startsWith("sk-")) {
    return { client: new OpenAI({ apiKey: userKey.trim() }), usingUserKey: true };
  }
  return { client: defaultOpenai as unknown as OpenAI, usingUserKey: false };
}

interface MatchCtx {
  opponent: string;
  myScore: number;
  opponentScore: number;
  result: "vitoria" | "empate" | "derrota";
  tournament: string;
  date: string;
}

interface LeagueCtx {
  position: number;
  totalTeams: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

interface ClubContext {
  clubName: string;
  clubLeague: string;
  season: string;
  coachName: string;
  squadSize: number;
  transfersCount: number;
  recentMatches: MatchCtx[];
  leaguePosition: LeagueCtx | null;
}

interface MemberProfile {
  id: string;
  name: string;
  roleLabel: string;
  description: string;
  mood: string;
  patience: number;
}

interface ChatHistoryItem {
  role: "user" | "character";
  content: string;
}

function clubTierFromLeague(league: string): string {
  const l = league.toLowerCase();
  if (l.includes("série b") || l.includes("serie b") || l.includes("2ª") || l.includes("segunda")) return "segunda divisão";
  if (l.includes("série c") || l.includes("serie c") || l.includes("3ª") || l.includes("terceira")) return "terceira divisão";
  if (l.includes("série d") || l.includes("serie d") || l.includes("4ª") || l.includes("quarta")) return "quarta divisão";
  return "primeira divisão";
}

function moodLabel(mood: string): string {
  const map: Record<string, string> = {
    excelente: "excelente — você está muito satisfeito, confiante e animado com os resultados",
    bom: "bom — você está satisfeito e positivo com a situação atual",
    neutro: "neutro — você está calmo e profissional, sem grandes emoções no momento",
    tenso: "tenso — você está preocupado e sentindo pressão, vigilante",
    irritado: "irritado — você está visivelmente incomodado e exigente, mostrando sinais claros de insatisfação",
    furioso: "furioso — você está com raiva, pressionando fortemente, próximo do seu limite de paciência",
  };
  return map[mood] ?? "neutro — você está calmo e profissional";
}

function buildClubContext(ctx: ClubContext): string {
  const tier = clubTierFromLeague(ctx.clubLeague);
  const matches = ctx.recentMatches.slice(0, 8);

  const matchStr = matches.length > 0
    ? matches.map((m) => {
        const r = m.result === "vitoria" ? "V" : m.result === "derrota" ? "D" : "E";
        return `  ${r} ${m.myScore}x${m.opponentScore} vs ${m.opponent} [${m.tournament}] (${m.date})`;
      }).join("\n")
    : "  Sem partidas registradas ainda";

  const leagueStr = ctx.leaguePosition
    ? `${ctx.leaguePosition.position}º de ${ctx.leaguePosition.totalTeams} — ${ctx.leaguePosition.points} pts (${ctx.leaguePosition.wins}V ${ctx.leaguePosition.draws}E ${ctx.leaguePosition.losses}D)`
    : "posição não informada";

  let streakAlert = "";
  if (matches.length >= 2) {
    let ls = 0, ws = 0;
    for (const m of matches) { if (m.result === "derrota") ls++; else break; }
    for (const m of matches) { if (m.result === "vitoria") ws++; else break; }
    if (ls >= 5) streakAlert = `\n🚨 ALERTA CRÍTICO: ${ls} derrotas consecutivas — situação grave!`;
    else if (ls >= 3) streakAlert = `\n⚠️ ALERTA: ${ls} derrotas seguidas — pressão crescente.`;
    else if (ws >= 4) streakAlert = `\n✅ DESTAQUE: ${ws} vitórias consecutivas — grande fase!`;
  }

  return `CLUBE: ${ctx.clubName} | LIGA: ${ctx.clubLeague} (${tier}) | TEMP: ${ctx.season}
TÉCNICO: ${ctx.coachName} | ELENCO: ${ctx.squadSize} jogadores | CONTRATAÇÕES: ${ctx.transfersCount}
TABELA: ${leagueStr}${streakAlert}
ÚLTIMAS PARTIDAS:
${matchStr}`;
}

router.post("/diretoria/chat", async (req, res) => {
  const { member, message, history, context } = req.body as {
    member: MemberProfile;
    message: string;
    history: ChatHistoryItem[];
    context: ClubContext;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: "message é obrigatório" });
    return;
  }

  const userKey = (req.headers["x-openai-key"] as string | undefined) ?? "";
  const { client, usingUserKey } = getClient(userKey);

  const clubCtx = buildClubContext(context);
  const tier = clubTierFromLeague(context.clubLeague);

  const systemPrompt = `Você é ${member.name}, ${member.roleLabel} do ${context.clubName}.

PERSONALIDADE E COMPORTAMENTO:
${member.description}

HUMOR ATUAL: ${moodLabel(member.mood)} (paciência: ${member.patience}/100)

CONTEXTO DO CLUBE:
${clubCtx}

COMO AGIR:
- Responda SEMPRE em primeira pessoa como ${member.name}
- Mantenha total consistência com sua personalidade
- Seu humor influencia diretamente o tom: se furioso, seja duro e imperativo; se excelente, seja generoso e elogioso
- Calibre suas expectativas ao nível real do clube: ${tier} tem objetivos e pressões muito diferentes de uma grande
- Você tem opinião própria e pode discordar firmemente do técnico/usuário
- Nunca saia do personagem nem quebre a quarta parede
- Use linguagem brasileira natural, sem excessos formais — pode usar expressões regionais sutilmente
- Respostas curtas a médias (2-4 parágrafos)
- IMPORTANTE: ao final de sua resposta, inclua exatamente: NOVO_HUMOR: <excelente|bom|neutro|tenso|irritado|furioso>`;

  const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-14).map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  try {
    const params = usingUserKey
      ? { model: "gpt-4o", max_tokens: 1024 }
      : { model: "gpt-5.2", max_completion_tokens: 1024 };

    const completion = await client.chat.completions.create({
      ...params,
      stream: false,
      messages: msgs,
    } as Parameters<typeof client.chat.completions.create>[0]);

    const raw =
      (completion as OpenAI.Chat.Completions.ChatCompletion).choices[0]?.message?.content ?? "";

    const moodMatch = raw.match(/NOVO_HUMOR:\s*(excelente|bom|neutro|tenso|irritado|furioso)/i);
    const newMood = moodMatch ? moodMatch[1].toLowerCase() : member.mood;
    const reply = raw
      .replace(/NOVO_HUMOR:\s*(excelente|bom|neutro|tenso|irritado|furioso)/gi, "")
      .trim();

    res.json({ reply, newMood });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Erro ao processar chat", details: msg });
  }
});

router.post("/diretoria/meeting", async (req, res) => {
  const { speaker, allMembers, history, context, triggerMessage } = req.body as {
    speaker: MemberProfile;
    allMembers: MemberProfile[];
    history: { memberId?: string; memberName?: string; role: string; content: string }[];
    context: ClubContext;
    triggerMessage: string;
  };

  const userKey = (req.headers["x-openai-key"] as string | undefined) ?? "";
  const { client, usingUserKey } = getClient(userKey);

  const clubCtx = buildClubContext(context);
  const tier = clubTierFromLeague(context.clubLeague);
  const otherMembers = allMembers
    .filter((m) => m.id !== speaker.id)
    .map((m) => `- ${m.name} (${m.roleLabel}): ${m.description.slice(0, 120)}`)
    .join("\n");

  const systemPrompt = `Você é ${speaker.name}, ${speaker.roleLabel} do ${context.clubName}, participando de uma REUNIÃO DE DIRETORIA presencial.

SUA PERSONALIDADE:
${speaker.description}

SEU HUMOR: ${moodLabel(speaker.mood)} (paciência: ${speaker.patience}/100)

OUTROS PARTICIPANTES:
${otherMembers}
- Técnico ${context.coachName} (o usuário)

CONTEXTO DO CLUBE:
${clubCtx}

REGRAS DA REUNIÃO:
- Você está em uma reunião ao vivo com toda a diretoria e o técnico — responda como se estivesse fisicamente lá
- Reaja ao que foi dito anteriormente — pode concordar, discordar fortemente, ou adicionar perspectiva do seu cargo
- Seu cargo define sua prioridade: presidente pensa no clube todo, auxiliar técnico foca no campo e nas partidas, gestor financeiro foca em orçamento e contratações
- Calibre suas expectativas pelo nível real do clube: ${tier}
- Seja direto como em uma reunião de verdade — sem florear
- Resposta curta e objetiva (1-3 parágrafos)
- Ao final: NOVO_HUMOR: <excelente|bom|neutro|tenso|irritado|furioso>
- Ao final: SUGERIR_ENCERRAMENTO: <sim|nao> (sim somente se a pauta foi concluída de forma natural)`;

  const histStr = history
    .slice(-20)
    .map((m) => {
      const who = m.role === "user" ? `Técnico ${context.coachName}` : (m.memberName ?? "Membro");
      return `${who}: ${m.content}`;
    })
    .join("\n\n");

  const userPrompt = `PAUTA DA REUNIÃO:
${triggerMessage}

HISTÓRICO:
${histStr || "(início da reunião — você pode abrir com seu posicionamento)"}

Agora é sua vez de falar, ${speaker.name}.`;

  try {
    const params = usingUserKey
      ? { model: "gpt-4o", max_tokens: 768 }
      : { model: "gpt-5.2", max_completion_tokens: 768 };

    const completion = await client.chat.completions.create({
      ...params,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    } as Parameters<typeof client.chat.completions.create>[0]);

    const raw =
      (completion as OpenAI.Chat.Completions.ChatCompletion).choices[0]?.message?.content ?? "";

    const moodMatch = raw.match(/NOVO_HUMOR:\s*(excelente|bom|neutro|tenso|irritado|furioso)/i);
    const newMood = moodMatch ? moodMatch[1].toLowerCase() : speaker.mood;
    const suggestClose = /SUGERIR_ENCERRAMENTO:\s*sim/i.test(raw);
    const reply = raw
      .replace(/NOVO_HUMOR:\s*(excelente|bom|neutro|tenso|irritado|furioso)/gi, "")
      .replace(/SUGERIR_ENCERRAMENTO:\s*(sim|nao)/gi, "")
      .trim();

    res.json({ reply, newMood, suggestClose, speakerMemberId: speaker.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Erro ao processar turno da reunião", details: msg });
  }
});

router.post("/diretoria/generate-member", async (req, res) => {
  const { roleLabel, personalityStyle, clubName, clubLeague, extraTraits } = req.body as {
    roleLabel: string;
    personalityStyle: string;
    clubName: string;
    clubLeague: string;
    extraTraits?: string;
  };

  const userKey = (req.headers["x-openai-key"] as string | undefined) ?? "";
  const { client, usingUserKey } = getClient(userKey);

  const tier = clubTierFromLeague(clubLeague);

  const systemPrompt = `Você é um criador de personagens para simuladores de futebol brasileiro. Crie personagens realistas, complexos e coerentes com o contexto do clube.`;

  const userPrompt = `Crie um personagem de diretoria de clube de futebol brasileiro:

CARGO: ${roleLabel}
ESTILO DE PERSONALIDADE: ${personalityStyle}
CLUBE: ${clubName} — ${clubLeague} (${tier})
${extraTraits ? `TRAÇOS EXTRAS: ${extraTraits}` : ""}

REGRAS:
- Nome brasileiro real e comum (não inventar sobrenomes estrangeiros)
- A descrição deve ter 3-5 frases: como age, o que prioriza, como reage a resultados ruins/bons, nível de paciência, peculiaridades
- Paciência coerente com o estilo (conservador/diplomático = mais paciente; agressivo/exigente = menos)
- O personagem deve ser ÚNICO e ter nuances — evite clichês simples

Responda APENAS com JSON puro (sem markdown):
{
  "name": "<Nome Completo Brasileiro>",
  "description": "<descrição em 3-5 frases>",
  "patience": <0 a 100>
}`;

  try {
    const params = usingUserKey
      ? { model: "gpt-4o", max_tokens: 512 }
      : { model: "gpt-5.2", max_completion_tokens: 512 };

    const completion = await client.chat.completions.create({
      ...params,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    } as Parameters<typeof client.chat.completions.create>[0]);

    const raw =
      (completion as OpenAI.Chat.Completions.ChatCompletion).choices[0]?.message?.content ?? "";
    const jsonStr = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(jsonStr) as { name: string; description: string; patience: number };

    res.json({
      name: parsed.name,
      description: parsed.description,
      patience: Math.min(100, Math.max(0, Number(parsed.patience) || 50)),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Erro ao gerar personagem", details: msg });
  }
});

router.post("/diretoria/check-triggers", async (req, res) => {
  const { context, members, lastCheckedAt } = req.body as {
    context: ClubContext;
    members: MemberProfile[];
    lastCheckedAt: number;
  };

  const recentMatches = context.recentMatches.slice(0, 8);
  const notifications: { memberId: string; preview: string }[] = [];
  let meetingTrigger: { reason: string; severity: "low" | "medium" | "high" } | null = null;

  let lossStreak = 0, winStreak = 0;
  for (const m of recentMatches) {
    if (m.result === "derrota") lossStreak++;
    else break;
  }
  for (const m of recentMatches) {
    if (m.result === "vitoria") winStreak++;
    else break;
  }

  const winCount = recentMatches.filter((m) => m.result === "vitoria").length;
  const leaguePos = context.leaguePosition;

  const presidente = members.find(
    (m) =>
      m.roleLabel.toLowerCase().includes("presidente") ||
      m.id.includes("presidente"),
  );
  const auxTecnico = members.find(
    (m) =>
      m.roleLabel.toLowerCase().includes("auxiliar") ||
      m.roleLabel.toLowerCase().includes("tecnico") ||
      m.roleLabel.toLowerCase().includes("técnico"),
  );
  const gestor = members.find(
    (m) =>
      m.roleLabel.toLowerCase().includes("gestor") ||
      m.roleLabel.toLowerCase().includes("financeiro"),
  );

  const hasNewMatch =
    recentMatches.length > 0 &&
    new Date(recentMatches[0].date).getTime() > lastCheckedAt;

  if (hasNewMatch) {
    if (lossStreak >= 5) {
      meetingTrigger = {
        reason: `${lossStreak} derrotas consecutivas — crise instalada no clube`,
        severity: "high",
      };
    } else if (lossStreak >= 3) {
      if (presidente) {
        notifications.push({
          memberId: presidente.id,
          preview: `${lossStreak} derrotas seguidas. Precisamos conversar com urgência...`,
        });
      }
      if (auxTecnico) {
        notifications.push({
          memberId: auxTecnico.id,
          preview: "Tenho algumas análises táticas importantes para discutir com você.",
        });
      }
    }

    if (winStreak >= 4 && presidente) {
      notifications.push({
        memberId: presidente.id,
        preview: `${winStreak} vitórias consecutivas! Que sequência incrível!`,
      });
    }

    if (leaguePos) {
      const relegZone = leaguePos.totalTeams - 3;
      if (leaguePos.position >= relegZone && lossStreak >= 2) {
        meetingTrigger = meetingTrigger ?? {
          reason: `${leaguePos.position}º lugar — zona de rebaixamento com ${lossStreak} derrotas seguidas`,
          severity: "high",
        };
      } else if (leaguePos.position <= 4 && winCount >= 3 && presidente) {
        notifications.push({
          memberId: presidente.id,
          preview: `${leaguePos.position}º lugar! Estamos na briga pelo acesso/título!`,
        });
      }
    }

    if (context.transfersCount >= 5 && gestor) {
      notifications.push({
        memberId: gestor.id,
        preview: "Preciso revisar o orçamento com você — as contratações estão pesando.",
      });
    }
  }

  const unique = notifications.filter(
    (n, i, arr) => arr.findIndex((x) => x.memberId === n.memberId) === i,
  );

  res.json({ notifications: unique, meetingTrigger });
});

export default router;
