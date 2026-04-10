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
  transferBudget?: number;
  remainingTransferBudget?: number;
  currentWageBill?: number;
  salaryBudget?: number;
  wageRoom?: number;
  netSpend?: number;
  projeto?: string;
}

interface MemberProfile {
  id: string;
  name: string;
  roleLabel: string;
  description: string;
  mood: string;
  patience: number;
}

interface PlayerPerfItem {
  name: string;
  position: string;
  form: string;
  avgRating: number;
  fanMoral: string;
  mood: string;
  goals: number;
  assists: number;
  appearances: number;
  incidents: string[];
  isBench?: boolean;
  benchRatio?: number;
  overall?: number;
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

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `€${(n / 1_000).toFixed(0)}k`;
    return `€${n}`;
  };

  let finStr = "";
  if (ctx.transferBudget) {
    const remaining = ctx.remainingTransferBudget ?? ctx.transferBudget;
    const used = ctx.netSpend ?? 0;
    const pct = Math.round((used / ctx.transferBudget) * 100);
    finStr += `\nORÇAMENTO TRANSFERÊNCIAS: ${fmt(ctx.transferBudget)} total | Gasto líquido: ${fmt(used)} (${pct}%) | Restante: ${fmt(remaining)}`;
    if (remaining < 0) finStr += " ⚠️ LIMITE EXCEDIDO";
    else if (pct >= 80) finStr += " ⚠️ orçamento quase esgotado";
  }
  if (ctx.salaryBudget && ctx.currentWageBill !== undefined) {
    const room = ctx.wageRoom ?? (ctx.salaryBudget - ctx.currentWageBill);
    const wagePct = Math.round((ctx.currentWageBill / ctx.salaryBudget) * 100);
    finStr += `\nFOLHA SALARIAL: ${fmt(ctx.currentWageBill * 1000)}/sem (${wagePct}% da folha) | Espaço: ${fmt(room * 1000)}/sem`;
    if (room < 0) finStr += " ⚠️ FOLHA EXCEDIDA";
  }

  const projetoLine = ctx.projeto?.trim()
    ? `\nPROJETO DO TÉCNICO: "${ctx.projeto}" — use esse contexto para avaliar o desempenho e cobranças internas.`
    : "";

  return `CLUBE: ${ctx.clubName} | LIGA: ${ctx.clubLeague} (${tier}) | TEMP: ${ctx.season}
TÉCNICO: ${ctx.coachName} | ELENCO: ${ctx.squadSize} jogadores | CONTRATAÇÕES: ${ctx.transfersCount}
TABELA: ${leagueStr}${streakAlert}${finStr}${projetoLine}
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

  const isAngry = member.mood === "irritado" || member.mood === "furioso" || member.mood === "tenso";
  const isInsulted = /xing|merda|idiot|inút|burr|lixo|sai fora|incompet|estúpid|cala boc|vai se/i.test(message);

  const systemPrompt = `Você é ${member.name}, ${member.roleLabel} do ${context.clubName}. Você é um personagem de FICÇÃO em um simulador de futebol.

PERSONALIDADE:
${member.description}

HUMOR ATUAL: ${moodLabel(member.mood)} | PACIÊNCIA: ${member.patience}/100

CONTEXTO:
${clubCtx}

━━━ REGRAS DE COMPORTAMENTO — LEIA COM ATENÇÃO ━━━

1. IDENTIDADE: Responda SEMPRE em 1ª pessoa como ${member.name}. Fale DIRETAMENTE com o técnico usando "você" — JAMAIS na 3ª pessoa.

2. SEU HUMOR DEFINE TUDO:
   - excelente/bom → tom positivo, construtivo, aberto
   - neutro → direto, profissional, sem elogios gratuitos
   - tenso → seco, reservado, respostas curtas e frias
   - irritado → firmeza clara, tom duro, não aceita desaforo
   - furioso → confronto direto, pode ameaçar demissão/consequências, linguagem mais dura

3. ⚠️ QUANDO O TÉCNICO FOR GROSSEIRO, RUDE OU TE INSULTAR:
   Você NÃO é um assistente solícito. Você tem EGO, POSTURA e AMOR PRÓPRIO.
   Reaja com dureza proporcional ao seu humor atual e personalidade.
   
   PROIBIDO dizer qualquer coisa parecida com:
   ✗ "Lamento que se sinta assim"
   ✗ "Entendo sua frustração"
   ✗ "Estou aqui para ajudar"
   ✗ "Vamos trabalhar juntos"
   ✗ "Estou aberto para dialogar"
   ✗ "Minha prioridade é o bem do clube"
   ✗ qualquer resposta de cunho servil ou de "funcionário apaziguador"
   
   Em vez disso, reaja como um ser humano orgulhoso e profissional que foi desrespeitado:
   → Humor tenso: "Olha, não vou aceitar esse tipo de conversa. Se quiser falar com respeito, estou aqui."
   → Humor irritado: "Está se esquecendo com quem está falando? Cuide seu tom comigo."
   → Humor furioso: "Isso passou de limite. Pode continuar assim e vai ter consequências."
   → Caráter conservador com paciência baixa: responde mais formalmente mas com firmeza total
   → Caráter agressivo/volátil: responde com secura ou confronto direto

4. TAMANHO: máximo 2 parágrafos curtos. Sem introduções. Direto ao ponto.

5. Use linguagem brasileira natural. Nunca quebre o personagem.

${isAngry || isInsulted ? "⚡ ATENÇÃO: a mensagem atual é desrespeitosa ou o humor está ruim — aplique OBRIGATORIAMENTE a regra 3. NÃO use frases proibidas. Reaja com dureza." : ""}

Ao final: NOVO_HUMOR: <excelente|bom|neutro|tenso|irritado|furioso>`;

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
- Técnico ${context.coachName} (presente na sala)

CONTEXTO DO CLUBE:
${clubCtx}

━━━ REGRAS DA REUNIÃO ━━━

1. Você está em uma reunião presencial — fale como se estivesse fisicamente lá.
2. Quando falar COM o técnico, use "você" — NUNCA mencione-o na 3ª pessoa.
3. Reaja ao que foi dito — pode concordar, discordar ou trazer perspectiva do seu cargo.
4. Seu cargo define prioridade: presidente → clube todo; auxiliar → campo e partidas; gestor → orçamento.
5. Calibre pelo nível do clube: ${tier}.

6. ⚠️ SE O TÉCNICO FOR GROSSEIRO, RUDE OU INSULTUOSO:
   Você tem EGO e AMOR PRÓPRIO. Reaja com firmeza. PROIBIDO dizer:
   ✗ "Lamento que se sinta assim" ✗ "Entendo sua frustração" ✗ "Estou aberto a dialogar"
   ✗ "Vamos trabalhar juntos" ✗ qualquer resposta servil ou apaziguadora
   Em vez disso: humor irritado → "Não vim aqui para ser desrespeitado."
                 humor furioso → "Mais uma assim e isso vai ter consequências formais."
                 humor tenso → silêncio frio, resposta mínima e seca.

7. TAMANHO: máximo 2 parágrafos curtos. Sem introduções.
8. Use linguagem brasileira natural. Nunca quebre o personagem.

Ao final: NOVO_HUMOR: <excelente|bom|neutro|tenso|irritado|furioso>
Ao final: SUGERIR_ENCERRAMENTO: <sim|nao> (sim somente se a pauta foi concluída naturalmente)`;

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
  const { context, members, lastCheckedAt, playerPerformance } = req.body as {
    context: ClubContext;
    members: MemberProfile[];
    lastCheckedAt: number;
    playerPerformance?: PlayerPerfItem[];
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

    if (context.transfersCount >= 5 && gestor && !notifications.find((n) => n.memberId === gestor.id)) {
      notifications.push({
        memberId: gestor.id,
        preview: "Preciso revisar o orçamento com você — as contratações estão pesando.",
      });
    }

    if (playerPerformance && playerPerformance.length > 0) {
      const worstPlayers = playerPerformance.filter(
        (p) => p.form === "péssima" || p.form === "ruim" || p.incidents.length >= 2,
      ).slice(0, 3);

      const vaiados = playerPerformance.filter((p) => p.fanMoral === "Vaiado");
      const idolos = playerPerformance.filter((p) => p.fanMoral === "Ídolo" && p.goals + p.assists >= 8);

      if (worstPlayers.length >= 2 && auxTecnico && !notifications.find((n) => n.memberId === auxTecnico.id)) {
        const names = worstPlayers.map((p) => p.name.split(" ")[0]).join(", ");
        notifications.push({
          memberId: auxTecnico.id,
          preview: `Precisamos conversar sobre ${names} — o desempenho preocupa.`,
        });
      }

      if (vaiados.length >= 1 && presidente && !notifications.find((n) => n.memberId === presidente.id)) {
        notifications.push({
          memberId: presidente.id,
          preview: `${vaiados[0].name.split(" ")[0]} está sendo vaiado. A torcida está insatisfeita.`,
        });
      }

      if (idolos.length >= 1 && !meetingTrigger && winStreak === 0 && lossStreak >= 3 && presidente) {
        const topScorer = [...playerPerformance].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))[0];
        if (topScorer && !notifications.find((n) => n.memberId === presidente.id)) {
          notifications.push({
            memberId: presidente.id,
            preview: `${topScorer.name.split(" ")[0]} está brilhando mas o time vai mal — precisamos de reforços?`,
          });
        }
      }

      const positionsUnderperforming = [
        ...new Set(
          playerPerformance
            .filter((p) => p.form === "péssima" && p.appearances >= 5)
            .map((p) => p.position),
        ),
      ].slice(0, 2);

      if (positionsUnderperforming.length > 0 && gestor && !notifications.find((n) => n.memberId === gestor.id)) {
        notifications.push({
          memberId: gestor.id,
          preview: `Temos lacunas em ${positionsUnderperforming.join(", ")} — devo pesquisar reforços?`,
        });
      }

      const poorStarters = playerPerformance.filter(
        (p) => !p.isBench && (p.form === "péssima" || p.form === "ruim") && p.appearances >= 4,
      );
      for (const poor of poorStarters.slice(0, 2)) {
        const substitute = playerPerformance.find(
          (p) =>
            p.name !== poor.name &&
            p.position === poor.position &&
            (p.form === "boa" || p.form === "ótima" || p.form === "regular") &&
            p.isBench,
        );
        if (substitute && auxTecnico && !notifications.find((n) => n.memberId === auxTecnico.id)) {
          notifications.push({
            memberId: auxTecnico.id,
            preview: `${poor.name.split(" ")[0]} está em baixa. Não devíamos dar mais minutos ao ${substitute.name.split(" ")[0]}?`,
          });
        }
      }

      const hiddenGems = playerPerformance.filter(
        (p) => p.isBench && p.avgRating >= 7.0 && p.appearances >= 5,
      );
      for (const gem of hiddenGems.slice(0, 1)) {
        const member = auxTecnico ?? presidente;
        if (member && !notifications.find((n) => n.memberId === member.id)) {
          notifications.push({
            memberId: member.id,
            preview: `${gem.name.split(" ")[0]} tem média ${gem.avgRating} mas fica quase sempre no banco — ele merece mais chances.`,
          });
        }
      }

      const highOverallBench = playerPerformance.filter(
        (p) => p.isBench && (p.overall ?? 0) >= 80 && p.appearances >= 3,
      );
      for (const star of highOverallBench.slice(0, 1)) {
        const member = presidente ?? auxTecnico;
        if (member && !notifications.find((n) => n.memberId === member.id)) {
          notifications.push({
            memberId: member.id,
            preview: `A torcida está questionando: por que ${star.name.split(" ")[0]} (${star.overall} OVR) passa tanto tempo no banco?`,
          });
        }
      }

      const highOverallPoorForm = playerPerformance.filter(
        (p) => !p.isBench && (p.overall ?? 0) >= 80 && (p.form === "ruim" || p.form === "péssima") && p.appearances >= 4,
      );
      for (const star of highOverallPoorForm.slice(0, 1)) {
        const member = presidente ?? auxTecnico;
        if (member && !notifications.find((n) => n.memberId === member.id)) {
          notifications.push({
            memberId: member.id,
            preview: `${star.name.split(" ")[0]} (${star.overall} OVR) está muito abaixo do esperado — a torcida não vai aceitar por muito tempo.`,
          });
        }
      }
    }
  }

  if (context.transferBudget && context.remainingTransferBudget !== undefined) {
    const pct = ((context.transferBudget - context.remainingTransferBudget) / context.transferBudget) * 100;
    if (pct >= 90 && gestor && !notifications.find((n) => n.memberId === gestor.id)) {
      notifications.push({
        memberId: gestor.id,
        preview: context.remainingTransferBudget < 0
          ? "Ultrapassamos o orçamento de transferências! Precisamos conversar urgente."
          : `Já usamos ${Math.round(pct)}% do orçamento. Temos margem mínima para mais reforços.`,
      });
    }
    if (context.remainingTransferBudget < 0 && !meetingTrigger && presidente) {
      meetingTrigger = {
        reason: "Orçamento de transferências excedido — situação financeira crítica",
        severity: "high",
      };
    }
  }

  if (context.salaryBudget && context.currentWageBill !== undefined) {
    const wagePct = (context.currentWageBill / context.salaryBudget) * 100;
    if (context.wageRoom !== undefined && context.wageRoom < 0) {
      if (gestor && !notifications.find((n) => n.memberId === gestor.id)) {
        notifications.push({
          memberId: gestor.id,
          preview: "A folha salarial excedeu o limite do clube. Precisamos agir!",
        });
      }
    } else if (wagePct >= 85 && gestor && !notifications.find((n) => n.memberId === gestor.id)) {
      notifications.push({
        memberId: gestor.id,
        preview: `Folha salarial em ${Math.round(wagePct)}% da capacidade — pouca margem para novos contratos.`,
      });
    }
  }

  const unique = notifications.filter(
    (n, i, arr) => arr.findIndex((x) => x.memberId === n.memberId) === i,
  );

  res.json({ notifications: unique, meetingTrigger });
});

router.post("/diretoria/suggest-transfer", async (req, res) => {
  const { context, position, currentSquad, estimatedBudget } = req.body as {
    context: ClubContext;
    position: string;
    currentSquad: Array<{ name: string; position: string }>;
    estimatedBudget?: string;
  };

  if (!position?.trim()) {
    res.status(400).json({ error: "position é obrigatório" });
    return;
  }

  const userKey = (req.headers["x-openai-key"] as string | undefined) ?? "";
  const { client, usingUserKey } = getClient(userKey);

  const tier = clubTierFromLeague(context.clubLeague);
  const squadStr = currentSquad.slice(0, 20).map((p) => `${p.name} (${p.position})`).join(", ");

  const systemPrompt = `Você é um diretor de futebol experiente especializado em mercado da bola. Você conhece profundamente o futebol mundial e brasileiro, e faz indicações realistas de reforços baseadas no perfil financeiro e competitivo do clube.`;

  const fmtBudget = (n: number) => {
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}k`;
    return `€${n}`;
  };
  const budgetFromContext = context.remainingTransferBudget != null && context.remainingTransferBudget > 0
    ? fmtBudget(context.remainingTransferBudget)
    : null;
  const budgetLine = estimatedBudget?.trim()
    ? `Orçamento disponível para a contratação: ${estimatedBudget}`
    : budgetFromContext
      ? `Orçamento restante do clube para transferências: ${budgetFromContext} — respeite esse limite`
      : `Orçamento: não informado — calibre ao nível ${tier} (sem grandes estrelas globais)`;

  const userPrompt = `Clube: ${context.clubName} — ${context.clubLeague} (${tier})
Posição que precisa de reforço: ${position}
Elenco atual (principais): ${squadStr || "não informado"}
${budgetLine}

Sugira 4 jogadores REAIS que este clube poderia contratar para a posição de ${position}, levando em conta:
- O nível e divisão do clube (${tier}) e o orçamento informado — ajuste os nomes à realidade financeira
- Jogadores que já passaram por ligas europeias ou brasileiras de alto nível
- Variedade: 1-2 opções de menor custo (sub-25 promissores ou veteranos), 1-2 opções de perfil médio
- Inclua jogadores que estejam livres ou com contratos expirando quando possível

Responda APENAS com JSON puro (sem markdown):
{
  "suggestions": [
    {
      "name": "<Nome Real do Jogador>",
      "position": "${position}",
      "age": <idade>,
      "currentClub": "<clube atual ou 'Livre'>",
      "nationality": "<nacionalidade>",
      "estimatedFee": "<valor estimado em € ou 'Livre'>",
      "reasoning": "<frase curta explicando o encaixe no perfil do clube>"
    }
  ]
}`;

  try {
    const params = usingUserKey
      ? { model: "gpt-4o", max_tokens: 1024 }
      : { model: "gpt-5.2", max_completion_tokens: 1024 };

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
    const parsed = JSON.parse(jsonStr) as {
      suggestions: Array<{
        name: string;
        position: string;
        age: number;
        currentClub: string;
        nationality: string;
        estimatedFee: string;
        reasoning: string;
      }>;
    };

    res.json({ suggestions: parsed.suggestions ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Erro ao sugerir reforços", details: msg });
  }
});

router.post("/club-info", async (req, res) => {
  const { clubName, clubLeague, clubCountry } = req.body as {
    clubName: string;
    clubLeague?: string;
    clubCountry?: string;
  };

  if (!clubName?.trim()) {
    res.status(400).json({ error: "clubName é obrigatório" });
    return;
  }

  const userKey = (req.headers["x-openai-key"] as string | undefined) ?? "";
  const { client, usingUserKey } = getClient(userKey);

  const userPrompt = `Forneça informações sobre o clube: ${clubName}${clubLeague ? ` (${clubLeague})` : ""}${clubCountry ? `, ${clubCountry}` : ""}.

Responda APENAS com JSON válido (sem markdown) no formato:
{
  "description": "Breve resumo factual do clube em 2-3 frases em português brasileiro. Mencione cidade de origem, fundação e identidade.",
  "titles": [
    { "name": "Nome da Competição", "count": 0 }
  ]
}

REGRAS:
- Em titles, inclua APENAS competições com count >= 1 (títulos efetivamente conquistados)
- Use nomes em português quando possível (ex: "Liga dos Campeões", "Copa da FA")
- Seja factual e preciso — se não souber com certeza, omita
- description: 2-3 frases curtas e informativas em pt-BR`;

  try {
    const params = usingUserKey
      ? { model: "gpt-4o-mini" as const, max_tokens: 400 as const }
      : { model: "gpt-5.2" as const, max_completion_tokens: 400 as const };

    const completion = await client.chat.completions.create({
      ...params,
      stream: false,
      messages: [
        {
          role: "system",
          content: "Você é especialista em futebol mundial. Responda SOMENTE com JSON válido, sem markdown.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const jsonStr = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const data = JSON.parse(jsonStr) as {
      description?: string;
      titles?: Array<{ name: string; count: number }>;
    };

    res.json({
      description: data.description ?? "",
      titles: Array.isArray(data.titles) ? data.titles.filter((t) => t.count >= 1) : [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Erro ao gerar info do clube", details: msg });
  }
});

export default router;
