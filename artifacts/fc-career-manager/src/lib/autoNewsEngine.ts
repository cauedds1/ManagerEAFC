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
  isClassico?: boolean;
  rivalName?: string;
}

interface EngineInput {
  newMatch: MatchRecord;
  allMatches: MatchRecord[];
  seasonPlayerStats: Record<number, PlayerSeasonStats>;
  allPlayers: SquadPlayer[];
  leaguePosition: LeaguePosition | null;
  clubName: string;
  season: string;
  rivals?: string[];
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
  let extraCtx = "";
  if (match.penaltyShootout) {
    const penLabel = match.hasExtraTime ? "Prorrogação + pênaltis" : "Disputa de pênaltis";
    extraCtx = ` [${penLabel}: ${clubName} ${match.penaltyShootout.myScore}×${match.penaltyShootout.opponentScore} ${match.opponent} nos pênaltis.]`;
  } else if (match.hasExtraTime) {
    extraCtx = " [Partida decidida após prorrogação (+30 min).]";
  }
  return (
    `${clubName} ${match.myScore}x${match.opponentScore} ${match.opponent}` +
    ` — ${match.tournament}${match.stage ? ` (${match.stage})` : ""}, temporada ${season}.` +
    minText +
    lineup +
    extraCtx
  );
}

function detectRival(opponentName: string, rivals?: string[]): string | null {
  if (!rivals || rivals.length === 0) return null;
  const q = opponentName.toLowerCase().trim();
  return rivals.find((r) => r.toLowerCase().trim() === q) ?? null;
}

export function detectMatchEvents(input: EngineInput): DetectedEvent[] {
  const { newMatch, allMatches, seasonPlayerStats, allPlayers, leaguePosition, clubName, season, rivals } = input;

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

  const hasPenalties = newMatch.penaltyShootout != null;

  const rivalMatch = detectRival(newMatch.opponent, rivals);
  const isClassico = rivalMatch != null;
  const classicoPrefix = isClassico
    ? `🔥 CLÁSSICO ENTRE RIVAIS — ${clubName} x ${newMatch.opponent}! Esta é uma das partidas mais esperadas da temporada, uma batalha de rivalidade histórica. `
    : "";

  function withClassico(ev: DetectedEvent): DetectedEvent {
    if (!isClassico) return ev;
    return {
      ...ev,
      isClassico: true,
      rivalName: rivalMatch!,
      aiDescription: classicoPrefix + ev.aiDescription,
      priority: Math.max(1, ev.priority - 1),
    };
  }

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

  /* ── Virada dramática (provada: 0 gols do time no 1º tempo + vitória) ── */
  const firstHalfTeamGoals = teamMins.filter((m) => m < 45);
  const secondHalfTeamGoals = teamMins.filter((m) => m >= 45);
  const teamScoredOnlyInSecondHalf = firstHalfTeamGoals.length === 0 && secondHalfTeamGoals.length > 0;
  if (isWin && newMatch.opponentScore > 0 && teamScoredOnlyInSecondHalf) {
    const comebackStartMinute = secondHalfTeamGoals[0];
    const equalizerMinute = newMatch.opponentScore <= secondHalfTeamGoals.length
      ? secondHalfTeamGoals[newMatch.opponentScore - 1]
      : null;
    const goAheadMinute = newMatch.opponentScore < secondHalfTeamGoals.length
      ? secondHalfTeamGoals[newMatch.opponentScore]
      : null;
    const minuteCtx = goAheadMinute != null
      ? `O ${clubName} começou a reagir aos ${comebackStartMinute}'${equalizerMinute != null && equalizerMinute !== comebackStartMinute ? `, empatou aos ${equalizerMinute}'` : ""} e tomou a frente aos ${goAheadMinute}'.`
      : `O ${clubName} virou no segundo tempo, iniciando a reação aos ${comebackStartMinute}'.`;
    events.push({
      key: `virada-${newMatch.id}`,
      type: "virada",
      title: `Virada dramática! ${clubName} ${newMatch.myScore}x${newMatch.opponentScore} ${newMatch.opponent}`,
      aiDescription: `O ${clubName} chegou ao intervalo perdendo e virou a partida! ${minuteCtx} ${summary} Descreva a euforia da torcida, a garra do time que não desistiu mesmo estando abaixo no placar no intervalo e os momentos-chave da reação histórica.`,
      source: "tnt",
      category: "resultado",
      priority: 1,
    });
  }

  /* ── Vitória sofrida (ganhou mas adversário marcou — sem afirmar quem abriu o placar) ── */
  if (isWin && newMatch.opponentScore > 0 && goalDiff <= 2 && !teamScoredOnlyInSecondHalf) {
    events.push({
      key: `vitoria-sofrida-${newMatch.id}`,
      type: "vitoria_sofrida",
      title: `${clubName} vence partida disputada: ${newMatch.myScore}x${newMatch.opponentScore}`,
      aiDescription: `O ${clubName} venceu o ${newMatch.opponent} em uma partida em que ambos os times marcaram (${newMatch.myScore}x${newMatch.opponentScore}). ${summary} Descreva a tensão do jogo, os melhores momentos do confronto equilibrado e celebre a vitória conquistada com garra.`,
      source: "tnt",
      category: "resultado",
      priority: 2,
    });
  }

  /* ── Disputa de pênaltis (classificação ou eliminação) ── */
  if (hasPenalties && newMatch.penaltyShootout) {
    const ps = newMatch.penaltyShootout;
    const penWin = ps.myScore > ps.opponentScore;
    const penLoss = ps.myScore < ps.opponentScore;
    const regularScore = `${newMatch.myScore}x${newMatch.opponentScore}`;
    const penScore = `${ps.myScore}×${ps.opponentScore}`;
    const afterStr = newMatch.hasExtraTime ? "prorrogação" : "90 minutos";

    const scoredKicks = ps.kicks.filter((k) => k.scored && k.playerId != null);
    const lastScoredKick = scoredKicks.at(-1);
    const heroName = lastScoredKick?.playerId != null ? playerName(allPlayers, lastScoredKick.playerId) : null;

    const missedKicks = ps.kicks.filter((k) => !k.scored && k.playerId != null);
    const missedNames = missedKicks.map((k) => playerName(allPlayers, k.playerId!));

    const gkPlayer = allPlayers.find(
      (p) => newMatch.starterIds.includes(p.id) && (p.position === "Goalkeeper" || p.positionPtBr === "GOL"),
    );
    const gkName = gkPlayer ? gkPlayer.name.split(" ").slice(0, 2).join(" ") : null;

    if (penWin) {
      let desc = `O ${clubName} se CLASSIFICOU nos pênaltis! A partida terminou ${regularScore} após ${afterStr} e foi decidida na disputa de pênaltis: ${clubName} ${penScore} ${newMatch.opponent}.`;
      if (heroName) desc += ` PÊNALTI DECISIVO: ${heroName} marcou o gol da classificação, mandando a torcida ao delírio.`;
      if ((ps.goalkeeperSaves ?? 0) > 0 && gkName) {
        if (ps.goalkeeperSaves === 1) {
          desc += ` GOLEIRO HERÓI: ${gkName} defendeu a cobrança decisiva do adversário, salvando o clube da eliminação.`;
        } else {
          desc += ` GOLEIRO HERÓI: ${gkName} foi extraordinário, defendendo ${ps.goalkeeperSaves} cobranças na disputa.`;
        }
      }
      if (missedNames.length > 0) {
        desc += ` Do lado do ${clubName}, ${missedNames.join(" e ")} ${missedNames.length === 1 ? "perdeu sua cobrança" : "perderam suas cobranças"}, mas o time avançou mesmo assim.`;
      }
      desc += ` ${summary} Descreva a tensão insuportável cobrada a cobrada, o momento do gol classificatório, a explosão da torcida e os principais destaques da partida.`;
      events.push(withClassico({
        key: `classificacao-penaltis-${newMatch.id}`,
        type: "classificacao_penaltis",
        title: `${clubName} se classifica nos pênaltis! ${regularScore} → (${penScore} pen.)`,
        aiDescription: desc,
        source: "tnt",
        category: "resultado",
        priority: 1,
      }));
    } else if (penLoss) {
      let desc = `O ${clubName} foi ELIMINADO nos pênaltis. A partida terminou ${regularScore} após ${afterStr} e a decisão foi para os pênaltis: ${clubName} ${penScore} ${newMatch.opponent}.`;
      if (heroName) {
        desc += ` ${heroName} chegou a converter sua cobrança, mas não foi suficiente para salvar o ${clubName}.`;
      }
      if (missedNames.length > 0) {
        desc += ` Cobrança(s) desperdiçada(s) pelo ${clubName}: ${missedNames.join(", ")}.`;
      }
      if ((ps.goalkeeperSaves ?? 0) > 0 && gkName) {
        desc += ` ${gkName} fez ${ps.goalkeeperSaves} defesa(s) na disputa, mas não foi suficiente para salvar o time.`;
      }
      desc += ` ${summary} Descreva a dor da eliminação nos pênaltis — a tensão das cobranças, o momento em que o adversário converteu o pênalti que deu a classificação, a tristeza da torcida e o que essa eliminação representa para o ${clubName}.`;
      events.push(withClassico({
        key: `eliminacao-penaltis-${newMatch.id}`,
        type: "eliminacao_penaltis",
        title: `${clubName} eliminado nos pênaltis — ${regularScore} (${penScore} pen.)`,
        aiDescription: desc,
        source: "espn",
        category: "resultado",
        priority: 1,
      }));
    }
  }

  /* ── Empate disputado (≥2 a ≥2) ou empate em branco (0x0) — suprimido quando há pênaltis ── */
  if (!hasPenalties && isDraw && newMatch.myScore >= 2) {
    events.push({
      key: `empate-disputado-${newMatch.id}`,
      type: "empate_disputado",
      title: `Empate emocionante: ${clubName} ${newMatch.myScore}x${newMatch.opponentScore} ${newMatch.opponent}`,
      aiDescription: `Partida cheia de gols que terminou empatada! ${newMatch.myScore}x${newMatch.opponentScore}. ${summary} Analise se o empate tem gosto de ponto conquistado ou vitória perdida, destaque os gols e descreva como a torcida viveu este jogo nervoso.`,
      source: "espn",
      category: "resultado",
      priority: 2,
    });
  } else if (!hasPenalties && isDraw && newMatch.myScore === 0) {
    events.push({
      key: `empate-branco-${newMatch.id}`,
      type: "empate_branco",
      title: `Empate sem gols: ${clubName} 0x0 ${newMatch.opponent}`,
      aiDescription: `Um 0 a 0 que pode ter sabor diferente dependendo do contexto. ${summary} Destaque as melhores defesas do goleiro, os ataques que não converteram e analise o que esse resultado significa na tabela do ${newMatch.tournament}.`,
      source: "fanpage",
      category: "resultado",
      priority: 3,
    });
  }

  /* ── Vitória suada (margem mínima com placar aberto ≥70' — gol nos acréscimos não se aplica) ── */
  if (isWin && goalDiff === 1 && newMatch.opponentScore > 0) {
    const lastTeamGoal = teamMins.length > 0 ? teamMins[teamMins.length - 1] : 0;
    const isLateWinner = lastTeamGoal >= 85;
    if (!isLateWinner) {
      events.push({
        key: `vitoria-suada-${newMatch.id}`,
        type: "vitoria_suada",
        title: `Vitória suada! ${clubName} ${newMatch.myScore}x${newMatch.opponentScore} ${newMatch.opponent}`,
        aiDescription: `O ${clubName} venceu por um gol de diferença em uma partida em que ambos os times marcaram. O adversário respondeu com gol e pressionou até o fim. ${summary} Descreva os momentos de pressão do ${newMatch.opponent} e como o time soube administrar a vantagem mínima.`,
        source: "espn",
        category: "resultado",
        priority: 3,
      });
    }
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

  /* ── Lesão explícita precoce (flag injured, antes do minuto 30) ── */
  const earlyInjuryPlayerIds = new Set<number>();
  for (const [playerIdStr, ps] of Object.entries(newMatch.playerStats)) {
    if (!ps.injured || ps.injuryMinute == null || ps.injuryMinute >= 30) continue;
    if (!newMatch.starterIds.includes(Number(playerIdStr))) continue;
    const playerId = Number(playerIdStr);
    earlyInjuryPlayerIds.add(playerId);
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

  /* ── Lesão implícita (titular substituído antes do minuto 30 sem flag de lesão) ── */
  for (const [playerIdStr, ps] of Object.entries(newMatch.playerStats)) {
    if (!ps.substituted || ps.substitutedAtMinute == null || ps.substitutedAtMinute >= 30) continue;
    if (!newMatch.starterIds.includes(Number(playerIdStr))) continue;
    const playerId = Number(playerIdStr);
    if (earlyInjuryPlayerIds.has(playerId)) continue;
    const pName = playerName(allPlayers, playerId);
    const inName = ps.substitutedInPlayerId != null ? playerName(allPlayers, ps.substitutedInPlayerId) : null;
    events.push({
      key: `lesao-implicita-${playerId}-${newMatch.id}`,
      type: "lesao_implicita",
      title: `${pName} sai de campo nos primeiros minutos — possível lesão`,
      aiDescription: `${pName} precisou deixar o campo aos ${ps.substitutedAtMinute}' do primeiro tempo${inName ? `, dando lugar a ${inName}` : ""}. ${summary} Saída tão precoce de um titular gera preocupação na comissão técnica do ${clubName}. Relate a cena, a reação dos companheiros e a incerteza sobre o estado físico do jogador.`,
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
    if (newEntrants.length >= 1 && newEntrants.length <= 6) {
      const names = newEntrants.map((id) => playerName(allPlayers, id));
      const changeDesc = newEntrants.length === 1
        ? `uma novidade no time titular: ${names[0]}`
        : `${newEntrants.length} novidades no time titular: ${names.join(", ")}`;
      events.push({
        key: `mudanca-escalacao-${newMatch.id}`,
        type: "mudanca_escalacao",
        title: `${clubName} altera escalação para enfrentar ${newMatch.opponent}`,
        aiDescription: `O ${clubName} entrou com ${changeDesc}. ${summary} O canal oficial do clube explica as mudanças táticas do treinador, os motivos das alterações (lesões, suspensões, opção tática) e o que esperar do time nesta formação.`,
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

  const finalEvents = isClassico
    ? events.map(withClassico)
    : events;

  return finalEvents.sort((a, b) => a.priority - b.priority);
}
