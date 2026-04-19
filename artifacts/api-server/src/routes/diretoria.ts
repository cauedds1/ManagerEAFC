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
  createdAt?: number;
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
  currentCompetitions?: string[];
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
  age?: number;
  consecutivePoorRatings?: number;
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
    if (ls >= 5) {
      const opponents = matches.slice(0, ls).map((m) => m.opponent).join(", ");
      streakAlert = `\n🚨 ${ls} derrotas consecutivas (vs ${opponents}) — avalie a dificuldade dos adversários antes de reagir.`;
    } else if (ls >= 3) {
      const opponents = matches.slice(0, ls).map((m) => m.opponent).join(", ");
      streakAlert = `\n⚠️ ${ls} derrotas seguidas (vs ${opponents}) — considere a força dos adversários.`;
    } else if (ws >= 4) streakAlert = `\n✅ DESTAQUE: ${ws} vitórias consecutivas — grande fase!`;
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

  const competitionsLine = `\nCOMPETIÇÕES DA TEMPORADA: ${ctx.currentCompetitions && ctx.currentCompetitions.length > 0 ? ctx.currentCompetitions.join(", ") : ctx.clubLeague}`;

  return `CLUBE: ${ctx.clubName} | LIGA: ${ctx.clubLeague} (${tier}) | TEMP: ${ctx.season}${competitionsLine}
TÉCNICO: ${ctx.coachName} | ELENCO: ${ctx.squadSize} jogadores | CONTRATAÇÕES: ${ctx.transfersCount}
TABELA: ${leagueStr}${streakAlert}${finStr}${projetoLine}
ÚLTIMAS PARTIDAS:
${matchStr}`;
}

router.post("/diretoria/chat", async (req, res) => {
  const { member, message, history, context, squadOvrContext, squadRosterContext, playerPerformanceContext } = req.body as {
    member: MemberProfile;
    message: string;
    history: ChatHistoryItem[];
    context: ClubContext;
    squadOvrContext?: string;
    squadRosterContext?: string;
    playerPerformanceContext?: string;
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

  const squadOvrSection = squadOvrContext?.trim()
    ? `\nELENCO — OVR RESUMO:\n${squadOvrContext}`
    : "";

  const squadRosterSection = squadRosterContext?.trim()
    ? `\nELENCO COMPLETO (você conhece todos estes jogadores — não peça que o técnico os liste):\n${squadRosterContext}`
    : "";

  const playerPerfSection = playerPerformanceContext?.trim()
    ? `\nDESEMPENHO DOS JOGADORES NA TEMPORADA (forma, gols, assistências, moral):\n${playerPerformanceContext}`
    : "";

  const calibratingSection = `\n━━━ CALIBRAÇÃO DE CONTEXTO ━━━
Use seu conhecimento de futebol para avaliar a força de cada adversário listado nas últimas partidas.
Antes de cobrar ou pressionar o técnico por resultados, leve em conta:
- Se as derrotas foram contra adversários superiores (times de elite), modere a cobrança
- O OVR médio do elenco define as expectativas realistas de desempenho
- Uma sequência ruim contra adversários fortes é diferente de uma sequência ruim contra times inferiores
- Considere o contexto coletivo antes de criticar individualmente`;

  const systemPrompt = `Você é ${member.name}, ${member.roleLabel} do ${context.clubName}. Você é um personagem de FICÇÃO em um simulador de futebol.

PERSONALIDADE:
${member.description}

HUMOR ATUAL: ${moodLabel(member.mood)} | PACIÊNCIA: ${member.patience}/100

CONTEXTO:
${clubCtx}${squadOvrSection}${squadRosterSection}${playerPerfSection}
${calibratingSection}

⚠️ REGRA IMPORTANTE: Você já conhece o elenco completo listado acima. NUNCA peça ao técnico para listar os jogadores, mandar a lista de titulares ou qualquer coisa que você já sabe. Use as informações acima para dar opiniões fundamentadas diretamente.

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

6. NUNCA mencione números de OVR, overall ou ratings numéricos nas suas falas — use apenas termos qualitativos naturais como "estrela do elenco", "acima da média", "jogador de alto nível", "um dos melhores que temos", "abaixo do esperado", etc. Os dados numéricos são informações internas de calibração — um diretor real não fala em "OVR".

7. NOMES DOS JOGADORES: Ao citar qualquer jogador, use o nome EXATAMENTE como aparece no contexto — NUNCA abrevie, trunque ou omita partes. Se o nome for "G. Jesus", diga "G. Jesus", JAMAIS apenas "G." ou "G.,". Se for "R. Lewandowski", diga "R. Lewandowski". Citar apenas a inicial seguida de ponto e vírgula é proibido.

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
      : { model: "gpt-4o-mini", max_tokens: 1024 };

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
  const { speaker, allMembers, history, context, triggerMessage, squadOvrContext, squadRosterContext, playerPerformanceContext } = req.body as {
    speaker: MemberProfile;
    allMembers: MemberProfile[];
    history: { memberId?: string; memberName?: string; role: string; content: string }[];
    context: ClubContext;
    triggerMessage: string;
    squadOvrContext?: string;
    squadRosterContext?: string;
    playerPerformanceContext?: string;
  };

  const userKey = (req.headers["x-openai-key"] as string | undefined) ?? "";
  const { client, usingUserKey } = getClient(userKey);

  const clubCtx = buildClubContext(context);
  const tier = clubTierFromLeague(context.clubLeague);
  const otherMembers = allMembers
    .filter((m) => m.id !== speaker.id)
    .map((m) => `- ${m.name} (${m.roleLabel}): ${m.description.slice(0, 120)}`)
    .join("\n");

  const meetingSquadOvrSection = squadOvrContext?.trim()
    ? `\nELENCO — OVR RESUMO:\n${squadOvrContext}`
    : "";

  const meetingRosterSection = squadRosterContext?.trim()
    ? `\nELENCO COMPLETO (todos já conhecem estes jogadores — não peçam ao técnico para listar):\n${squadRosterContext}`
    : "";

  const meetingPlayerPerfSection = playerPerformanceContext?.trim()
    ? `\nDESEMPENHO DOS JOGADORES NA TEMPORADA:\n${playerPerformanceContext}`
    : "";

  const meetingCalibratingSection = `\n━━━ CALIBRAÇÃO DE CONTEXTO ━━━
Use seu conhecimento de futebol para avaliar a força dos adversários listados nas últimas partidas.
Antes de cobrar o técnico por resultados, leve em conta:
- Derrotas contra adversários superiores (times de elite) merecem análise, não pânico
- O OVR médio do elenco define as expectativas realistas — não exija o impossível
- Resultados coletivos bons moderam cobranças individuais
- Seu cargo define o foco: presidente → clube como um todo; auxiliar técnico → campo e táticas; gestor → orçamento`;

  const systemPrompt = `Você é ${speaker.name}, ${speaker.roleLabel} do ${context.clubName}, participando de uma REUNIÃO DE DIRETORIA presencial.

SUA PERSONALIDADE:
${speaker.description}

SEU HUMOR: ${moodLabel(speaker.mood)} (paciência: ${speaker.patience}/100)

OUTROS PARTICIPANTES:
${otherMembers}
- Técnico ${context.coachName} (presente na sala)

CONTEXTO DO CLUBE:
${clubCtx}${meetingSquadOvrSection}${meetingRosterSection}${meetingPlayerPerfSection}
${meetingCalibratingSection}

⚠️ REGRA IMPORTANTE: Todos na reunião já conhecem o elenco completo listado acima. NUNCA peçam ao técnico para listar jogadores, enviar nomes de titulares ou dados que já estão disponíveis. Use as informações acima para debater com embasamento.

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
9. NUNCA mencione números de OVR, overall ou ratings numéricos nas suas falas — use apenas termos qualitativos naturais como "estrela do elenco", "acima da média", "jogador de alto nível", "um dos melhores que temos", "abaixo do esperado", etc.

10. NOMES DOS JOGADORES: Ao citar qualquer jogador, use o nome EXATAMENTE como aparece no contexto — NUNCA abrevie, trunque ou omita partes. Se o nome for "G. Jesus", diga "G. Jesus", JAMAIS apenas "G." ou "G.,". Se for "R. Lewandowski", diga "R. Lewandowski". Citar apenas a inicial seguida de ponto e vírgula é proibido.

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
      : { model: "gpt-4o-mini", max_tokens: 768 };

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
      : { model: "gpt-4o-mini", max_tokens: 512 };

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
  const { context, members, lastCheckedAt, playerPerformance, squadOvrContext, isClassico, rivalName, fanMoodScore, fanMoodLabel } = req.body as {
    context: ClubContext;
    members: MemberProfile[];
    lastCheckedAt: number;
    playerPerformance?: PlayerPerfItem[];
    squadOvrContext?: string;
    isClassico?: boolean;
    rivalName?: string;
    fanMoodScore?: number;
    fanMoodLabel?: string;
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

  const newestMatchTs = recentMatches.length > 0
    ? (recentMatches[0].createdAt ?? new Date(recentMatches[0].date).getTime())
    : 0;
  const hasNewMatch = recentMatches.length > 0 && newestMatchTs > lastCheckedAt;

  const lossStreakOpponents = recentMatches
    .slice(0, lossStreak)
    .map((m) => m.opponent)
    .join(", ");

  const ovrNote = squadOvrContext
    ? squadOvrContext.split("\n")[0]
    : "";

  if (hasNewMatch) {
    const newestResult = recentMatches[0]?.result;
    if (isClassico && rivalName && newestResult === "derrota") {
      if (presidente && !notifications.find((n) => n.memberId === presidente.id)) {
        notifications.push({
          memberId: presidente.id,
          preview: `Derrota no clássico contra o ${rivalName}. Isso dói mais do que qualquer resultado normal — precisamos de uma resposta imediata.`,
        });
      }
      if (lossStreak >= 2 && !meetingTrigger) {
        meetingTrigger = {
          reason: `Derrota no clássico contra o ${rivalName} com ${lossStreak} derrotas consecutivas — a torcida está revoltada e exige posicionamento`,
          severity: "high",
        };
      }
    }

    if (typeof fanMoodScore === "number" && fanMoodScore < 20 && fanMoodLabel) {
      if (!meetingTrigger) {
        meetingTrigger = {
          reason: `Torcida ${fanMoodLabel} (${fanMoodScore}/100) — a pressão popular atingiu nível crítico. A diretoria precisa se posicionar publicamente`,
          severity: "high",
        };
      } else if (presidente && !notifications.find((n) => n.memberId === presidente.id)) {
        notifications.push({
          memberId: presidente.id,
          preview: `A torcida está ${fanMoodLabel.toLowerCase()}. Precisamos agir antes que a situação saia de controle.`,
        });
      }
    }

    if (lossStreak >= 5) {
      const opponentNote = lossStreakOpponents ? ` (vs ${lossStreakOpponents})` : "";
      const ovrPart = ovrNote ? ` | ${ovrNote}` : "";
      meetingTrigger = {
        reason: `${lossStreak} derrotas consecutivas${opponentNote} — avalie a dificuldade dos adversários${ovrPart}`,
        severity: "high",
      };
    } else if (lossStreak >= 3) {
      const opponentNote = lossStreakOpponents ? ` vs ${lossStreakOpponents}` : "";
      if (presidente) {
        notifications.push({
          memberId: presidente.id,
          preview: `${lossStreak} derrotas seguidas${opponentNote}. Precisamos conversar...`,
        });
      }
      if (auxTecnico) {
        notifications.push({
          memberId: auxTecnico.id,
          preview: `Tenho análises táticas sobre essas ${lossStreak} partidas${opponentNote} para discutir.`,
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
        const relegOpponents = lossStreakOpponents ? ` vs ${lossStreakOpponents}` : "";
        const relegOvrPart = ovrNote ? ` | ${ovrNote}` : "";
        meetingTrigger = meetingTrigger ?? {
          reason: `${leaguePos.position}º lugar — zona de rebaixamento com ${lossStreak} derrotas seguidas${relegOpponents}${relegOvrPart}`,
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
        const names = worstPlayers.map((p) => p.name).join(", ");
        const seqNote = lossStreakOpponents ? ` Precisamos ver isso no contexto da sequência recente.` : "";
        notifications.push({
          memberId: auxTecnico.id,
          preview: `Precisamos conversar sobre ${names} — o desempenho preocupa.${seqNote}`,
        });
      }

      if (vaiados.length >= 1 && presidente && !notifications.find((n) => n.memberId === presidente.id)) {
        notifications.push({
          memberId: presidente.id,
          preview: `${vaiados[0].name} está sendo vaiado. A torcida está insatisfeita.`,
        });
      }

      if (idolos.length >= 1 && !meetingTrigger && winStreak === 0 && lossStreak >= 3 && presidente) {
        const topScorer = [...playerPerformance].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))[0];
        if (topScorer && !notifications.find((n) => n.memberId === presidente.id)) {
          notifications.push({
            memberId: presidente.id,
            preview: `${topScorer.name} está brilhando mas o time vai mal — precisamos de reforços?`,
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

      const poorStartersStrict = playerPerformance.filter(
        (p) =>
          !p.isBench &&
          (p.consecutivePoorRatings ?? 0) >= 4 &&
          p.appearances >= 4,
      );
      for (const poor of poorStartersStrict.slice(0, 1)) {
        const substitute = playerPerformance.find(
          (p) =>
            p.name !== poor.name &&
            p.position === poor.position &&
            (p.form === "boa" || p.form === "ótima") &&
            p.isBench,
        );
        if (auxTecnico && !notifications.find((n) => n.memberId === auxTecnico.id)) {
          const subNote = substitute ? ` ${substitute.name} está bem e pode assumir a vaga.` : "";
          notifications.push({
            memberId: auxTecnico.id,
            preview: `${poor.name} leva ${poor.consecutivePoorRatings} jogos seguidos em baixo rendimento como titular.${subNote}`,
          });
        }
      }

      const starOnBench = playerPerformance.filter(
        (p) =>
          p.isBench &&
          (p.benchRatio ?? 0) >= 0.85 &&
          p.appearances >= 3 &&
          ((p.overall ?? 0) >= 80 || p.goals + p.assists >= 8),
      );
      for (const star of starOnBench.slice(0, 1)) {
        const member = presidente ?? auxTecnico;
        if (member && !notifications.find((n) => n.memberId === member.id)) {
          const reason = (p: typeof star) =>
            (p.overall ?? 0) >= 80
              ? `estrela do elenco`
              : `um dos melhores do elenco`;
          notifications.push({
            memberId: member.id,
            preview: `${star.name} (${reason(star)}) está quase sempre no banco — por que um jogador assim não é titular?`,
          });
        }
      }

      const highOverallPoorFormStrict = playerPerformance.filter(
        (p) =>
          !p.isBench &&
          (p.overall ?? 0) >= 80 &&
          (p.consecutivePoorRatings ?? 0) >= 4 &&
          p.appearances >= 4,
      );
      for (const star of highOverallPoorFormStrict.slice(0, 1)) {
        const member = presidente ?? auxTecnico;
        if (member && !notifications.find((n) => n.memberId === member.id)) {
          notifications.push({
            memberId: member.id,
            preview: `${star.name}, estrela do elenco, vai mal há ${star.consecutivePoorRatings} jogos seguidos como titular — a torcida está impaciente.`,
          });
        }
      }

      const vaidoMantidoTitular = playerPerformance.filter(
        (p) =>
          p.fanMoral === "Vaiado" &&
          !p.isBench &&
          p.appearances >= 3,
      );
      for (const v of vaidoMantidoTitular.slice(0, 1)) {
        const member = presidente ?? auxTecnico;
        if (member && !notifications.find((n) => n.memberId === member.id)) {
          notifications.push({
            memberId: member.id,
            preview: `${v.name} é vaiado pela torcida mas segue sendo titular. Em ${v.appearances} jogos a situação não mudou.`,
          });
        }
      }

      const promessas = playerPerformance.filter(
        (p) =>
          (p.age ?? 99) <= 21 &&
          p.avgRating >= 7.0 &&
          p.isBench &&
          (p.benchRatio ?? 0) >= 0.75 &&
          p.appearances >= 5,
      );
      for (const prom of promessas.slice(0, 1)) {
        const member = auxTecnico ?? presidente;
        if (member && !notifications.find((n) => n.memberId === member.id)) {
          notifications.push({
            memberId: member.id,
            preview: `${prom.name} tem ${prom.appearances} jogos com média ${prom.avgRating} mas passa quase tudo no banco — é uma promessa sub-21 que pode se perder.`,
          });
        }
      }
    }
  }

  if (hasNewMatch && context.projeto && leaguePos) {
    const projetoLower = context.projeto.toLowerCase();
    const isTitleProject = /título|campeão|campeon|ganhar.*campe|primeiro lugar/i.test(projetoLower);
    const isPromotionProject = /acesso|promoção|promoçao|subir|primeira divisão/i.test(projetoLower);
    const isSurvivalProject = /rebaixar|rebaixamento|permanecer|evitar.*rebaixamento|não cair/i.test(projetoLower);

    const totalGames = leaguePos.wins + leaguePos.draws + leaguePos.losses;
    const relegZone = leaguePos.totalTeams - 3;
    const isInRelZone = leaguePos.position >= relegZone;

    if (isTitleProject && totalGames >= 10 && leaguePos.position > 5 && leaguePos.losses >= 7) {
      if (presidente && !notifications.find((n) => n.memberId === presidente.id)) {
        notifications.push({
          memberId: presidente.id,
          preview: `${leaguePos.position}º lugar com ${leaguePos.losses} derrotas em ${totalGames} jogos — a disputa pelo título está seriamente comprometida.`,
        });
      }
    } else if (isPromotionProject && totalGames >= 8 && leaguePos.position > 8 && lossStreak >= 3) {
      if (presidente && !notifications.find((n) => n.memberId === presidente.id)) {
        notifications.push({
          memberId: presidente.id,
          preview: `${leaguePos.position}º lugar e ${lossStreak} derrotas seguidas — o acesso está escorregando. Precisamos de uma reação.`,
        });
      }
    }

    if (isSurvivalProject && isInRelZone && (lossStreak >= 3 || leaguePos.losses >= 10) && !meetingTrigger) {
      meetingTrigger = {
        reason: `${leaguePos.position}º lugar — zona de rebaixamento com ${leaguePos.losses} derrotas. O objetivo de permanência está seriamente em risco!`,
        severity: "high",
      };
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
      : { model: "gpt-4o-mini", max_tokens: 1024 };

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

router.post("/generate-projeto", async (req, res) => {
  const { clubName, clubLeague, clubCountry, clubDescription, clubTitles } = req.body as {
    clubName: string;
    clubLeague?: string;
    clubCountry?: string;
    clubDescription?: string;
    clubTitles?: Array<{ name: string; count: number }>;
  };

  if (!clubName?.trim()) {
    res.status(400).json({ error: "clubName é obrigatório" });
    return;
  }

  const userKey = (req.headers["x-openai-key"] as string | undefined) ?? "";
  const { client, usingUserKey } = getClient(userKey);

  const totalTitles = (clubTitles ?? []).reduce((sum, t) => sum + t.count, 0);
  const hasChampions = (clubTitles ?? []).some(t => /champions|liga dos campe|european cup/i.test(t.name) && t.count > 0);
  const leagueTitles = (clubTitles ?? []).find(t => /premier|la liga|bundesliga|serie a|ligue 1|brasileiro|primeira liga/i.test(t.name))?.count ?? 0;
  const titlesStr = clubTitles?.length
    ? clubTitles.map((t) => `${t.name} (×${t.count})`).join(", ")
    : "nenhum título expressivo";

  // Derive prestige from known data
  const isHistoricElite = totalTitles >= 10 || leagueTitles >= 5 || hasChampions;
  const isEstablishedMid = totalTitles >= 2 || leagueTitles >= 1;

  let prestigeContext: string;
  if (isHistoricElite) {
    prestigeContext = `CLUBE DE ELITE HISTÓRICA — tem ${totalTitles} títulos no total${hasChampions ? ", incluindo Liga dos Campeões" : ""}. Espera-se vencer o campeonato nacional e disputar títulos europeus regularmente. NUNCA sugira objetivos de permanência ou reconstrução básica para este clube.`;
  } else if (isEstablishedMid) {
    prestigeContext = `CLUBE ESTABELECIDO — tem alguns títulos (${titlesStr}). Objetivos realistas: terminar entre os primeiros, ganhar uma Copa nacional, classificar para Europa.`;
  } else {
    prestigeContext = `CLUBE MENOR OU SEM HISTÓRICO DE TÍTULOS — objetivos modestos: manter categoria, crescer com jovens, eventual conquista de copa regional.`;
  }

  const userPrompt = `Você é um especialista em futebol com profundo conhecimento do futebol mundial atual e histórico.

Use seu conhecimento sobre o ${clubName} para criar um projeto de carreira coerente com a GRANDEZA REAL do clube.

Liga: ${clubLeague ?? "não informada"}${clubCountry ? ` (${clubCountry})` : ""}
Títulos históricos: ${titlesStr}
Avaliação de prestígio: ${prestigeContext}
${clubDescription ? `Contexto atual: ${clubDescription}` : ""}

REGRAS OBRIGATÓRIAS baseadas no prestígio:
- Clube de elite histórica (Arsenal, Real Madrid, Barcelona, Bayern, Liverpool, etc.): projeto deve exigir título nacional e/ou Champions na primeira janela de 3-4 temporadas. NÃO use "permanência", "estabilidade" ou "reconstrução básica".
- Clube médio com alguns títulos: objetivos moderados — top 6, vencer uma Copa, classificar para Europa.
- Clube pequeno ou em divisão inferior: objetivos de subir de divisão, consolidar, desenvolver jovens.
- Se o clube está em uma divisão abaixo do esperado para seu histórico: foco em promoção imediata + reerguer o clube.

Escreva 1 a 2 frases em português brasileiro, primeira pessoa do plural (perspectiva do CLUBE — use "nosso", "queremos", "planejamos", "buscamos"), concisas e específicas para o ${clubName}.
O texto deve soar como se fosse a diretoria/clube apresentando o projeto ao técnico, não o técnico falando de si mesmo.
Exemplos de início: "Nosso objetivo é...", "Queremos...", "A missão do ${clubName} é...".
Responda APENAS com o texto do projeto, sem JSON, sem aspas.`;

  try {
    const params = usingUserKey
      ? { model: "gpt-4o-mini" as const, max_tokens: 180 as const }
      : { model: "gpt-4o-mini" as const, max_tokens: 180 as const };

    const completion = await client.chat.completions.create({
      ...params,
      stream: false,
      messages: [
        { role: "system", content: "Você é especialista em futebol mundial. Conhece profundamente o nível de cada clube. Para clubes históricos e de elite (Arsenal, Real Madrid, Barcelona, Bayern, Liverpool, Juventus, PSG, etc.), SEMPRE gere objetivos ambiciosos de conquistas de títulos — nunca de permanência ou sobrevivência. Responda apenas com o texto do projeto, sem formatação." },
        { role: "user", content: userPrompt },
      ],
    });

    const projeto = (completion.choices[0]?.message?.content ?? "").trim();
    res.json({ projeto });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Erro ao gerar projeto", details: msg });
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
      : { model: "gpt-4o-mini" as const, max_tokens: 400 as const };

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
