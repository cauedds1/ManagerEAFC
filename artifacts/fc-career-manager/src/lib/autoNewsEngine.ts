import type { MatchRecord } from "@/types/match";
import type { PlayerSeasonStats } from "@/types/playerStats";
import type { NewsSource, NewsCategory } from "@/types/noticias";
import type { LeaguePosition } from "@/lib/leagueStorage";
import type { SquadPlayer } from "@/lib/squadCache";

export interface DetectedEvent {
  key: string;
  type: string;
  title: string;
  aiDescription: string;
  source: NewsSource;
  category: NewsCategory;
  priority: number;
}

interface EngineInput {
  newMatch: MatchRecord;
  allMatches: MatchRecord[];
  seasonPlayerStats: Record<number, PlayerSeasonStats>;
  allPlayers: SquadPlayer[];
  leaguePosition: LeaguePosition | null;
  clubName: string;
  season: string;
}

function playerName(allPlayers: SquadPlayer[], id: number): string {
  const p = allPlayers.find((pl) => pl.id === id);
  if (!p) return `Jogador #${id}`;
  return p.name.split(" ").slice(0, 2).join(" ");
}

function sortedByDate(matches: MatchRecord[]): MatchRecord[] {
  return [...matches].sort((a, b) => a.createdAt - b.createdAt);
}

function trailingStreak(sorted: MatchRecord[], check: (m: MatchRecord) => boolean): number {
  let count = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (check(sorted[i])) count++;
    else break;
  }
  return count;
}

function teamGoalMinutesSorted(match: MatchRecord): number[] {
  const minutes: number[] = [];
  for (const ps of Object.values(match.playerStats)) {
    for (const g of ps.goals) minutes.push(g.minute);
  }
  return minutes.sort((a, b) => a - b);
}

function buildLineupContext(match: MatchRecord, allPlayers: SquadPlayer[]): string {
  const starters = match.starterIds.map((id) => playerName(allPlayers, id));
  const subs = match.subIds.map((id) => playerName(allPlayers, id));

  const substitutions: string[] = [];
  for (const [idStr, ps] of Object.entries(match.playerStats)) {
    if (ps.substituted && ps.substitutedAtMinute != null && ps.substitutedInPlayerId != null) {
      const outName = playerName(allPlayers, Number(idStr));
      const inName = playerName(allPlayers, ps.substitutedInPlayerId);
      substitutions.push(`${outName} → ${inName} (${ps.substitutedAtMinute}')`);
    }
  }

  let ctx = `Titulares: ${starters.join(", ") || "N/A"}.`;
  if (subs.length > 0) ctx += ` Reservas convocados: ${subs.join(", ")}.`;
  if (substitutions.length > 0) ctx += ` Substituições: ${substitutions.join("; ")}.`;
  return ctx;
}

function matchSummary(match: MatchRecord, clubName: string, season: string, allPlayers: SquadPlayer[]): string {
  const mins = teamGoalMinutesSorted(match);
  const minText = mins.length > 0 ? ` Gols do ${clubName} aos: ${mins.join("', ")}'. ` : " ";
  const lineup = buildLineupContext(match, allPlayers);
  return (
    `${clubName} ${match.myScore}x${match.opponentScore} ${match.opponent}` +
    ` — ${match.tournament}${match.stage ? ` (${match.stage})` : ""}, temporada ${season}.` +
    minText +
    lineup
  );
}

export function detectMatchEvents(input: EngineInput): DetectedEvent[] {
  const { newMatch, allMatches, seasonPlayerStats, allPlayers, leaguePosition, clubName, season } = input;

  const events: DetectedEvent[] = [];
  const sorted = sortedByDate(allMatches);
  const isWin = newMatch.myScore > newMatch.opponentScore;
  const isLoss = newMatch.myScore < newMatch.opponentScore;
  const isDraw = newMatch.myScore === newMatch.opponentScore;
  const isCleanSheet = newMatch.opponentScore === 0;
  const goalDiff = newMatch.myScore - newMatch.opponentScore;
  const totalGoals = newMatch.myScore + newMatch.opponentScore;
  const teamMins = teamGoalMinutesSorted(newMatch);
  const summary = matchSummary(newMatch, clubName, season, allPlayers);

  /* ── Jogo maluco (≥5 gols totais) ── */
  if (totalGoals >= 5) {
    events.push({
      key: `jogo-maluco-${newMatch.id}`,
      type: "jogo_maluco",
      title: `Jogo maluco! ${clubName} ${newMatch.myScore}x${newMatch.opponentScore} ${newMatch.opponent}`,
      aiDescription: `Partida com muitos gols! Total de ${totalGoals} gols — uma das partidas mais intensas da temporada. ${summary} Descreva a intensidade, os melhores momentos ofensivos e como a torcida viveu cada lance desta goleada de emoções.`,
      source: "espn",
      category: "resultado",
      priority: 1,
    });
  }

  /* ── Vitória com adversário no placar (antiga "virada") ── */
  if (isWin && newMatch.opponentScore > 0) {
    events.push({
      key: `vitoria-adversario-marcou-${newMatch.id}`,
      type: "vitoria_sofrida",
      title: `${clubName} vence mesmo com adversário na frente: ${newMatch.myScore}x${newMatch.opponentScore}`,
      aiDescription: `O ${clubName} conquistou os três pontos apesar do ${newMatch.opponent} ter marcado. ${summary} O adversário abriu o placar, mas o time reagiu com garra. Descreva a tensão do jogo, a reação da equipe após sofrer o gol e a alegria da virada/conquista da vitória.`,
      source: "tnt",
      category: "resultado",
      priority: 2,
    });
  }

  /* ── Vitória suada (margem mínima, 1 gol de diferença, sem sofrer gol não conta) ── */
  if (isWin && goalDiff === 1 && newMatch.opponentScore > 0) {
    events.push({
      key: `vitoria-suada-${newMatch.id}`,
      type: "vitoria_suada",
      title: `Vitória suada! ${clubName} ${newMatch.myScore}x${newMatch.opponentScore} ${newMatch.opponent}`,
      aiDescription: `O ${clubName} venceu por apenas um gol de diferença com o ${newMatch.opponent} tendo marcado — jogo tenso até o fim! ${summary} Descreva a dificuldade, os momentos de pressão do adversário e como o time segurou o resultado nos minutos finais.`,
      source: "espn",
      category: "resultado",
      priority: 2,
    });
  }

  /* ── Empate com gosto de derrota (empate com o adversário tendo marcado mais ou igual) ── */
  if (isDraw && newMatch.myScore > 0) {
    events.push({
      key: `empate-${newMatch.id}`,
      type: "empate",
      title: `Empate: ${clubName} ${newMatch.myScore}x${newMatch.opponentScore} ${newMatch.opponent}`,
      aiDescription: `O ${clubName} empatou com o ${newMatch.opponent} — resultado misto. ${summary} Analise se o empate é um ponto conquistado ou dois perdidos, como a torcida reagiu e o que isso significa para a campanha na competição.`,
      source: "fanpage",
      category: "resultado",
      priority: 3,
    });
  }

  /* ── Gol nos acréscimos (apenas em partidas disputadas) ── */
  const lateGoals = teamMins.filter((m) => m >= 85);
  if (lateGoals.length > 0 && goalDiff <= 1 && (isWin || isDraw)) {
    events.push({
      key: `gol-acrescimos-${newMatch.id}`,
      type: "gol_acrescimos",
      title: `Gol nos acréscimos! ${clubName} ${newMatch.myScore}x${newMatch.opponentScore}`,
      aiDescription: `Gol decisivo nos acréscimos, aos ${Math.max(...lateGoals)}'! ${summary} O resultado estava em aberto e o time encontrou o gol crucial no finalzinho. Descreva a loucura da comemoração, a tensão que antecedeu o momento e como a torcida foi ao delírio.`,
      source: "espn",
      category: "resultado",
      priority: 1,
    });
  }

  /* ── Goleada aplicada (≥4 de diferença) ── */
  if (goalDiff >= 4) {
    events.push({
      key: `goleada-aplicada-${newMatch.id}`,
      type: "goleada_aplicada",
      title: `Goleada! ${clubName} ${newMatch.myScore}x${newMatch.opponentScore} ${newMatch.opponent}`,
      aiDescription: `O ${clubName} aplicou uma goleada histórica! ${summary} Descreva o domínio absoluto da partida${teamMins.length > 0 ? `, com gols aos ${teamMins.join("', ")}'` : ""}. Quando o jogo foi decidido e qual o clima de festa na arquibancada?`,
      source: "tnt",
      category: "resultado",
      priority: 1,
    });
  }

  /* ── Goleada sofrida (≥4 de diferença) ── */
  if (goalDiff <= -4) {
    events.push({
      key: `goleada-sofrida-${newMatch.id}`,
      type: "goleada_sofrida",
      title: `Derrota pesada: ${clubName} ${newMatch.myScore}x${newMatch.opponentScore} ${newMatch.opponent}`,
      aiDescription: `O ${clubName} sofreu uma derrota pesada. ${summary} O que deu errado? Quando o jogo foi perdido? Seja crítico mas analítico. Mostre a frustração da torcida e as explicações que o clube deve aos seus torcedores.`,
      source: "espn",
      category: "resultado",
      priority: 2,
    });
  }

  /* ── Hat-trick ── */
  for (const [playerIdStr, ps] of Object.entries(newMatch.playerStats)) {
    if (ps.goals.length < 3) continue;
    const playerId = Number(playerIdStr);
    const pName = playerName(allPlayers, playerId);
    events.push({
      key: `hat-trick-${playerId}-${newMatch.id}`,
      type: "hat_trick",
      title: `Hat-trick de ${pName}! ${clubName} ${newMatch.myScore}x${newMatch.opponentScore}`,
      aiDescription: `${pName} fez um HAT-TRICK! Marcou ${ps.goals.length} gols. Gols aos: ${ps.goals.map((g) => g.minute + "'").join(", ")}. ${summary} Celebre este feito histórico, a reação da torcida e analise o desempenho extraordinário do jogador nesta partida.`,
      source: "espn",
      category: "resultado",
      priority: 1,
    });
  }

  /* ── Jogador marcando em N jogos consecutivos ── */
  const scoringPlayerIds = Object.entries(newMatch.playerStats)
    .filter(([, ps]) => ps.goals.length > 0)
    .map(([id]) => Number(id));

  for (const playerId of scoringPlayerIds) {
    let streak = 1;
    for (let i = sorted.length - 2; i >= 0; i--) {
      const ps = sorted[i].playerStats[playerId];
      if (ps && ps.goals.length > 0) streak++;
      else break;
    }
    if (streak !== 3 && streak !== 5) continue;
    const pName = playerName(allPlayers, playerId);
    const seasonGoals = seasonPlayerStats[playerId]?.goals ?? 0;
    events.push({
      key: `gol-streak-${playerId}-${streak}-${newMatch.id}`,
      type: "gol_streak",
      title: `${pName} marca pelo ${streak}º jogo consecutivo!`,
      aiDescription: `${pName} está em chamas! Marcou pelo ${streak}º jogo seguido, somando ${seasonGoals} gols na temporada. ${summary} Destaque a fase incrível do jogador, como isso impacta nos resultados do ${clubName} e a euforia da torcida.`,
      source: "tnt",
      category: "resultado",
      priority: 2,
    });
  }

  /* ── Marco de gols na temporada (5º, 10º, 15º…) ── */
  const goalMilestones = [5, 10, 15, 20, 25, 30];
  for (const [playerIdStr, ps] of Object.entries(newMatch.playerStats)) {
    if (ps.goals.length === 0) continue;
    const playerId = Number(playerIdStr);
    const totalNow = seasonPlayerStats[playerId]?.goals ?? 0;
    const totalBefore = totalNow - ps.goals.length;
    const pName = playerName(allPlayers, playerId);
    for (const milestone of goalMilestones) {
      if (totalBefore < milestone && totalNow >= milestone) {
        events.push({
          key: `marco-gols-${playerId}-${milestone}`,
          type: "marco_gols",
          title: `${pName} chega a ${milestone} gols na temporada!`,
          aiDescription: `${pName} atingiu ${milestone} gols nesta temporada! ${summary} Celebre o feito do artilheiro, analise o impacto dele na campanha do ${clubName} e compare com os maiores artilheiros históricos do clube.`,
          source: "espn",
          category: "resultado",
          priority: 2,
        });
        break;
      }
    }
  }

  /* ── Marco de assistências na temporada (5, 10, 15, 20) ── */
  const assistMilestones = [5, 10, 15, 20];
  const matchAssistCounts: Record<number, number> = {};
  for (const ps of Object.values(newMatch.playerStats)) {
    for (const g of ps.goals) {
      if (g.assistPlayerId != null) {
        matchAssistCounts[g.assistPlayerId] = (matchAssistCounts[g.assistPlayerId] ?? 0) + 1;
      }
    }
  }
  for (const [playerIdStr, assistsThisMatch] of Object.entries(matchAssistCounts)) {
    const playerId = Number(playerIdStr);
    const totalNow = seasonPlayerStats[playerId]?.assists ?? 0;
    const totalBefore = totalNow - assistsThisMatch;
    const pName = playerName(allPlayers, playerId);
    for (const milestone of assistMilestones) {
      if (totalBefore < milestone && totalNow >= milestone) {
        events.push({
          key: `marco-assists-${playerId}-${milestone}`,
          type: "marco_assists",
          title: `${pName} alcança ${milestone} assistências na temporada!`,
          aiDescription: `${pName} atingiu ${milestone} assistências nesta temporada! ${summary} Celebre o craque que distribui o jogo no ${clubName}, analise sua visão de jogo e o papel fundamental que desempenha para os artilheiros do time.`,
          source: "tnt",
          category: "resultado",
          priority: 2,
        });
        break;
      }
    }
  }

  /* ── Artilheiro em seca (líder sem marcar por 3+ jogos) ── */
  const statsArr = Object.values(seasonPlayerStats).sort((a, b) => b.goals - a.goals);
  const topScorer = statsArr[0];
  if (topScorer && topScorer.goals >= 5) {
    const didScoreNow = (newMatch.playerStats[topScorer.playerId]?.goals.length ?? 0) > 0;
    if (!didScoreNow) {
      let drought = 0;
      for (let i = sorted.length - 1; i >= 0; i--) {
        const ps = sorted[i].playerStats[topScorer.playerId];
        if (!ps || ps.goals.length === 0) drought++;
        else break;
      }
      if (drought >= 3) {
        const pName = playerName(allPlayers, topScorer.playerId);
        events.push({
          key: `seca-artilheiro-${topScorer.playerId}-${drought}`,
          type: "seca_artilheiro",
          title: `${pName} (${topScorer.goals} gols) está ${drought} jogos sem marcar`,
          aiDescription: `${pName}, artilheiro com ${topScorer.goals} gols, está há ${drought} jogos sem marcar. ${summary} Reflita sobre a seca do atacante, a pressão da torcida e o que o ${clubName} precisa fazer para desbloqueá-lo novamente.`,
          source: "espn",
          category: "geral",
          priority: 3,
        });
      }
    }
  }

  /* ── Sequência de vitórias (3, 5, 10) ── */
  if (isWin) {
    const ws = trailingStreak(sorted, (m) => m.myScore > m.opponentScore);
    if (ws === 3 || ws === 5 || ws === 10) {
      events.push({
        key: `win-streak-${ws}-${newMatch.id}`,
        type: "win_streak",
        title: `${ws}ª vitória consecutiva do ${clubName}!`,
        aiDescription: `O ${clubName} conquistou a ${ws}ª vitória seguida! ${summary} Celebre a grande fase, analise os destaques desta sequência impressionante e o impacto na tabela. ${ws >= 5 ? "Esta é uma das melhores sequências da temporada!" : ""}`,
        source: "tnt",
        category: "resultado",
        priority: ws >= 5 ? 1 : 2,
      });
    }
  }

  /* ── Invicta longa (5, 10, 15) ── */
  if (!isLoss) {
    const us = trailingStreak(sorted, (m) => m.myScore >= m.opponentScore);
    if (us === 5 || us === 10 || us === 15) {
      events.push({
        key: `unbeaten-${us}-${newMatch.id}`,
        type: "invicta",
        title: `${us} jogos sem perder! ${clubName} em grande fase`,
        aiDescription: `O ${clubName} está há ${us} partidas sem derrota! ${summary} Destaque a consistência defensiva e ofensiva, os jogadores fundamentais nesta sequência e o que ela representa na briga pelo título.`,
        source: "espn",
        category: "resultado",
        priority: us >= 10 ? 1 : 2,
      });
    }
  }

  /* ── Sequência de clean sheets (3, 5) ── */
  if (isCleanSheet) {
    const cs = trailingStreak(sorted, (m) => m.opponentScore === 0);
    if (cs === 3 || cs === 5) {
      events.push({
        key: `clean-sheet-${cs}-${newMatch.id}`,
        type: "clean_sheet_streak",
        title: `${cs}º jogo sem sofrer gol! Defesa do ${clubName} impressiona`,
        aiDescription: `O ${clubName} está ${cs} jogos SEM SOFRER GOL! ${summary} Elogie a solidez defensiva, destaque o goleiro e a linha defensiva que protagonizam esta sequência memorável.`,
        source: "fanpage",
        category: "resultado",
        priority: 2,
      });
    }
  }

  /* ── Três derrotas consecutivas ── */
  if (isLoss) {
    const ls = trailingStreak(sorted, (m) => m.myScore < m.opponentScore);
    if (ls === 3) {
      events.push({
        key: `loss-streak-3-${newMatch.id}`,
        type: "tres_derrotas",
        title: `Crise? ${clubName} perde pela 3ª vez seguida`,
        aiDescription: `O ${clubName} acumula 3 derrotas seguidas! ${summary} Analise o que está dando errado, mostre a pressão sobre o treinador e a cobrança da torcida por respostas urgentes.`,
        source: "espn",
        category: "resultado",
        priority: 2,
      });
    }
  }

  /* ── Fim de sequência invicta longa ── */
  if (isLoss) {
    const prevSorted = sorted.slice(0, -1);
    const prevUnbeaten = trailingStreak(prevSorted, (m) => m.myScore >= m.opponentScore);
    if (prevUnbeaten >= 5) {
      events.push({
        key: `fim-invicta-${prevUnbeaten}-${newMatch.id}`,
        type: "fim_invicta",
        title: `Sequência invicta de ${prevUnbeaten} jogos chega ao fim`,
        aiDescription: `A invicta de ${prevUnbeaten} jogos do ${clubName} acabou. ${summary} Descreva a decepção da torcida, o que causou a derrota e como o time vai se recuperar. Reconheça a grandeza da sequência que foi interrompida.`,
        source: "tnt",
        category: "resultado",
        priority: 1,
      });
    }
  }

  /* ── Cartão vermelho ── */
  for (const [playerIdStr, ps] of Object.entries(newMatch.playerStats)) {
    if (!ps.redCard) continue;
    const playerId = Number(playerIdStr);
    const pName = playerName(allPlayers, playerId);
    events.push({
      key: `cartao-vermelho-${playerId}-${newMatch.id}`,
      type: "cartao_vermelho",
      title: `${pName} expulso contra o ${newMatch.opponent}`,
      aiDescription: `${pName} foi expulso na partida! ${summary} Relate o impacto da expulsão no jogo — o time precisou jogar com um a menos, como isso influenciou o resultado e quais as consequências para os próximos jogos do ${clubName}.`,
      source: "fanpage",
      category: "geral",
      priority: 2,
    });
  }

  /* ── Lesão precoce (antes do minuto 30) ── */
  for (const [playerIdStr, ps] of Object.entries(newMatch.playerStats)) {
    if (!ps.injured || ps.injuryMinute == null || ps.injuryMinute >= 30) continue;
    if (!newMatch.starterIds.includes(Number(playerIdStr))) continue;
    const playerId = Number(playerIdStr);
    const pName = playerName(allPlayers, playerId);
    events.push({
      key: `lesao-precoce-${playerId}-${newMatch.id}`,
      type: "lesao",
      title: `${pName} se lesiona logo no início — preocupação no ${clubName}`,
      aiDescription: `${pName} se lesionou aos ${ps.injuryMinute}' do primeiro tempo! ${summary} Relate a preocupação da comissão técnica, o impacto imediato no jogo com o time forçado a reorganizar a tática e as dúvidas sobre quanto tempo o jogador ficará fora.`,
      source: "fanpage",
      category: "lesao",
      priority: 2,
    });
  }

  /* ── Mudança de escalação ── */
  const prevMatch = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  if (prevMatch) {
    const prevStarters = new Set(prevMatch.starterIds);
    const newEntrants = newMatch.starterIds.filter((id) => !prevStarters.has(id));
    if (newEntrants.length >= 2 && newEntrants.length <= 5) {
      const names = newEntrants.map((id) => playerName(allPlayers, id));
      events.push({
        key: `mudanca-escalacao-${newMatch.id}`,
        type: "mudanca_escalacao",
        title: `${clubName} muda escalação para enfrentar ${newMatch.opponent}`,
        aiDescription: `O ${clubName} entrou com ${newEntrants.length} novidades no time titular: ${names.join(", ")}. ${summary} O canal oficial do clube explica as mudanças táticas do treinador, os motivos das alterações (lesões, suspensões, opção tática) e as expectativas para a partida.`,
        source: "fanpage",
        category: "geral",
        priority: 3,
      });
    }
  }

  /* ── Jogador retornando após 2+ partidas fora ── */
  if (prevMatch && sorted.length >= 3) {
    for (const playerId of newMatch.starterIds) {
      let absent = 0;
      for (let i = sorted.length - 2; i >= Math.max(0, sorted.length - 4); i--) {
        const m = sorted[i];
        if (!m.starterIds.includes(playerId) && !m.subIds.includes(playerId)) absent++;
        else break;
      }
      if (absent >= 2) {
        const pName = playerName(allPlayers, playerId);
        events.push({
          key: `retorno-${playerId}-${newMatch.id}`,
          type: "retorno",
          title: `${pName} volta ao time titular após ${absent} jogos fora`,
          aiDescription: `${pName} está de volta ao time titular após ${absent} partidas de ausência! ${summary} O canal oficial anuncia o retorno, analisa o impacto que o jogador terá no esquema do time e como o elenco recebeu o reforço.`,
          source: "fanpage",
          category: "geral",
          priority: 3,
        });
        break;
      }
    }
  }

  /* ── Assumiu a liderança ── */
  const posBefore = newMatch.tablePositionBefore;
  const posAfter = leaguePosition?.position;
  if (posBefore && posBefore > 1 && posAfter === 1) {
    events.push({
      key: `lideranca-${newMatch.id}`,
      type: "lideranca",
      title: `${clubName} assume a LIDERANÇA do campeonato!`,
      aiDescription: `O ${clubName} chegou ao 1º lugar! ${summary} Passou de ${posBefore}º para líder. Celebre o feito, analise a consistência da equipe ao longo da temporada e projete o que falta para conquistar o título.`,
      source: "espn",
      category: "resultado",
      priority: 1,
    });
  }

  /* ── Entrou no G4 ── */
  if (posBefore && posBefore > 4 && posAfter && posAfter <= 4) {
    events.push({
      key: `g4-${newMatch.id}`,
      type: "g4",
      title: `${clubName} entra no G-4 e briga por classificação!`,
      aiDescription: `O ${clubName} entrou na zona de classificação! ${summary} Saiu de ${posBefore}º para ${posAfter}º. Analise a importância desta conquista e o que falta para garantir a vaga.`,
      source: "tnt",
      category: "resultado",
      priority: 2,
    });
  }

  /* ── Zona de rebaixamento ── */
  if (leaguePosition) {
    const total = leaguePosition.totalTeams || 20;
    const relZone = total - 3;
    if (posBefore && posBefore < relZone && posAfter && posAfter >= relZone) {
      events.push({
        key: `z4-${newMatch.id}`,
        type: "z4",
        title: `ALERTA: ${clubName} cai para a zona de rebaixamento`,
        aiDescription: `O ${clubName} caiu para a zona de rebaixamento! ${summary} Passou de ${posBefore}º para ${posAfter}º. Descreva o clima de preocupação, os críticos que cobram mudanças e o que o clube precisa fazer urgentemente para sair desta situação.`,
        source: "espn",
        category: "resultado",
        priority: 1,
      });
    }
  }

  /* ── Marco de gols do time na temporada (50, 100) ── */
  const seasonTotal = allMatches.reduce((sum, m) => sum + m.myScore, 0);
  const seasonBefore = seasonTotal - newMatch.myScore;
  for (const ms of [50, 100]) {
    if (seasonBefore < ms && seasonTotal >= ms) {
      events.push({
        key: `time-${ms}gols-temporada`,
        type: "marco_time_gols",
        title: `${clubName} chega a ${ms} gols na temporada!`,
        aiDescription: `O ${clubName} atingiu ${ms} gols nesta temporada! ${summary} Celebre o poder ofensivo da equipe, destaque os principais artilheiros e o que este marco coletivo representa para a campanha.`,
        source: "fanpage",
        category: "conquista",
        priority: 2,
      });
    }
  }

  return events.sort((a, b) => a.priority - b.priority);
}
