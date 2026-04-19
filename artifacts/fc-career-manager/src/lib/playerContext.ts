import type { SquadPlayer } from "@/lib/squadCache";
import { getAllPlayerStats, getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import type { FanMoral, Mood, PlayerOverride, PlayerSeasonStats } from "@/types/playerStats";
import type { MatchRecord } from "@/types/match";

function avgRatings(ratings: number[]): number {
  if (ratings.length === 0) return 6.5;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}

function formLabel(avg: number, count: number): string {
  if (count < 2) return "poucos jogos";
  if (avg >= 7.8) return "ótima";
  if (avg >= 7.0) return "boa";
  if (avg >= 6.0) return "regular";
  if (avg >= 5.0) return "ruim";
  return "péssima";
}

function moodPtBr(m: Mood): string {
  const map: Record<Mood, string> = {
    excelente: "excelente",
    bom: "bem",
    neutro: "neutro",
    insatisfeito: "insatisfeito",
    irritado: "irritado",
  };
  return map[m] ?? "neutro";
}

function fanMoralPtBr(fm: FanMoral): string {
  const map: Record<FanMoral, string> = {
    idolo: "Ídolo",
    querido: "Querido",
    neutro: "Neutro",
    contestado: "Contestado",
    vaiado: "Vaiado",
  };
  return map[fm] ?? "Neutro";
}

function calcSquadAvgOvr(
  allPlayers: SquadPlayer[],
  allOverrides: Record<number, PlayerOverride>,
): number | null {
  const ovrs = allPlayers
    .map((p) => allOverrides[p.id]?.overall)
    .filter((o): o is number => o != null && o > 0);
  if (ovrs.length === 0) return null;
  return Math.round(ovrs.reduce((a, b) => a + b, 0) / ovrs.length);
}

function relativeOvrLabel(ovr: number, squadAvg: number): string {
  const diff = ovr - squadAvg;
  if (diff >= 7) return "estrela do elenco";
  if (diff >= 3) return "acima da média do elenco";
  if (diff >= -2) return "na média do elenco";
  return "abaixo da média do elenco";
}

function isDefender(pos: string): boolean {
  return pos === "DEF" || pos === "GOL" || pos === "Defensor" || pos === "Goleiro";
}

export interface PlayerContextItem {
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
  isBench: boolean;
  benchRatio: number;
  overall?: number;
  ovrRelative?: string;
  ovrTrend?: string;
  age?: number;
  number?: number;
  consecutivePoorRatings?: number;
}

export function playerDisplayName(p: { name: string; position?: string; number?: number }): string {
  const isAbbreviated = /^[A-Z]\.?$/.test(p.name.trim()) || p.name.trim().length <= 2;
  if (!isAbbreviated) return p.name;
  const parts: string[] = [];
  if (p.number) parts.push(`nº${p.number}`);
  if (p.position) parts.push(p.position);
  return parts.length > 0 ? `${p.name} (${parts.join(", ")})` : p.name;
}

export function buildPlayerPerformanceContext(
  seasonId: string,
  allPlayers: SquadPlayer[],
  careerId?: string,
): PlayerContextItem[] {
  const allStats = getAllPlayerStats(seasonId);
  const allOverrides = getAllPlayerOverrides(careerId ?? seasonId);
  const items: PlayerContextItem[] = [];

  const squadAvg = calcSquadAvgOvr(allPlayers, allOverrides);

  for (const player of allPlayers) {
    const stats = allStats[player.id];
    if (!stats) continue;
    const totalApps = (stats.matchesAsStarter ?? 0) + (stats.matchesAsSubstitute ?? 0);
    if (totalApps === 0) continue;

    const recent = (stats.recentRatings ?? []).slice(-8);
    const ratingAvg = avgRatings(recent);
    const form = formLabel(ratingAvg, recent.length);

    const incidents: string[] = [];
    if ((stats.totalOwnGoals ?? 0) > 0) incidents.push(`${stats.totalOwnGoals} gol(s) contra`);
    if ((stats.totalMissedPenalties ?? 0) > 0) incidents.push(`${stats.totalMissedPenalties} pênalti(s) perdido(s)`);
    if ((stats.yellowCards ?? 0) >= 3) incidents.push(`${stats.yellowCards} cartões amarelos`);
    if ((stats.redCards ?? 0) > 0) incidents.push(`${stats.redCards} expulsão(ões)`);
    if (stats.fanMoral === "vaiado") incidents.push("vaiado pela torcida");
    else if (stats.fanMoral === "idolo") incidents.push("ídolo da torcida");
    if (stats.mood === "irritado") incidents.push("humor irritado");

    const override = allOverrides[player.id];
    const overall = override?.overall;
    const pos = player.positionPtBr ?? player.position ?? "";

    let ovrRelative: string | undefined;
    let ovrTrend: string | undefined;

    if (overall != null && squadAvg != null) {
      ovrRelative = relativeOvrLabel(overall, squadAvg);
      const isBelowAvg = ovrRelative === "abaixo da média do elenco";

      if (!isDefender(pos) && isBelowAvg && totalApps >= 5 && (form === "ótima" || form === "boa")) {
        incidents.push("revelação/surpresa da temporada");
      } else if (isDefender(pos) && isBelowAvg && totalApps >= 5 && form === "ótima") {
        incidents.push("revelação da zaga/goleiro");
      }
    }

    if (overall != null && override?.ovrHistory && override.ovrHistory.length > 0) {
      const prevOvr = override.ovrHistory[override.ovrHistory.length - 1].ovr;
      const delta = overall - prevOvr;
      if (delta > 0) ovrTrend = `em ascensão (+${delta})`;
      else if (delta < 0) ovrTrend = `em queda (${delta})`;
    }

    const onlyNeutral = form === "regular" && incidents.length === 0 &&
      stats.fanMoral === "neutro" && stats.mood === "neutro" &&
      (stats.goals ?? 0) + (stats.assists ?? 0) < 3;
    if (onlyNeutral && totalApps < 5) continue;

    const starters = stats.matchesAsStarter ?? 0;
    const subs = stats.matchesAsSubstitute ?? 0;
    const benchRatio = totalApps > 0 ? subs / totalApps : 0;
    const isBench = subs > starters && totalApps >= 3;

    const allRatings = stats.recentRatings ?? [];
    let consecutivePoorRatings = 0;
    for (let i = allRatings.length - 1; i >= 0; i--) {
      if (allRatings[i] < 6.5) consecutivePoorRatings++;
      else break;
    }

    items.push({
      name: player.name,
      position: pos,
      form,
      avgRating: Math.round(ratingAvg * 10) / 10,
      fanMoral: fanMoralPtBr(stats.fanMoral ?? "neutro"),
      mood: moodPtBr(stats.mood ?? "neutro"),
      goals: stats.goals ?? 0,
      assists: stats.assists ?? 0,
      appearances: totalApps,
      incidents,
      isBench,
      benchRatio: Math.round(benchRatio * 100) / 100,
      overall,
      ovrRelative,
      ovrTrend,
      age: player.age,
      number: player.number,
      consecutivePoorRatings: consecutivePoorRatings > 0 ? consecutivePoorRatings : undefined,
    });
  }

  items.sort((a, b) => {
    const scoreA = a.incidents.length + (a.fanMoral !== "Neutro" ? 2 : 0) + (a.goals + a.assists) * 0.1;
    const scoreB = b.incidents.length + (b.fanMoral !== "Neutro" ? 2 : 0) + (b.goals + b.assists) * 0.1;
    return scoreB - scoreA;
  });

  return items.slice(0, 15);
}

export function buildPlayerContextString(items: PlayerContextItem[]): string {
  if (items.length === 0) return "";
  const lines = items.map((p) => {
    const ovrStr = p.overall != null
      ? ` | OVR ${p.overall}${p.ovrRelative ? ` (${p.ovrRelative})` : ""}${p.ovrTrend ? `, ${p.ovrTrend}` : ""}`
      : "";
    const incStr = p.incidents.length > 0 ? ` | ${p.incidents.join(", ")}` : "";
    const displayName = playerDisplayName(p);
    return `- ${displayName} (${p.position}): forma ${p.form} (avg ${p.avgRating})${ovrStr} | moral: ${p.fanMoral} | humor: ${p.mood} | ${p.goals}G ${p.assists}A${incStr}`;
  });
  return lines.join("\n");
}

export function buildSquadOvrContext(
  allPlayers: SquadPlayer[],
  overrides: Record<number, PlayerOverride>,
): string {
  const squadAvg = calcSquadAvgOvr(allPlayers, overrides);
  if (squadAvg == null) return "";

  const withOvr = allPlayers
    .map((p) => ({ player: p, ovr: overrides[p.id]?.overall ?? 0 }))
    .filter((x) => x.ovr > 0)
    .sort((a, b) => b.ovr - a.ovr);

  if (withOvr.length === 0) return "";

  const top3 = withOvr.slice(0, 3).map(({ player, ovr }) => {
    const rel = relativeOvrLabel(ovr, squadAvg);
    const pos = player.positionPtBr ?? player.position;
    return `  • ${player.name} (${pos}) OVR ${ovr} — ${rel}`;
  });

  const lines = [
    `Média de OVR do elenco: ${squadAvg}`,
    `Total de jogadores com OVR definido: ${withOvr.length}`,
    `Destaques do elenco por OVR:`,
    ...top3,
  ];

  return lines.join("\n");
}

function recentAvgRating(stats: PlayerSeasonStats | undefined, last = 5): number | null {
  if (!stats?.recentRatings?.length) return null;
  const slice = stats.recentRatings.slice(-last);
  return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10;
}

export function buildStartingXIContext(
  allMatches: MatchRecord[],
  currentMatch: MatchRecord,
  allPlayers: SquadPlayer[],
  seasonStats: Record<number, PlayerSeasonStats>,
  allOverrides: Record<number, PlayerOverride>,
): string {
  const sorted = [...allMatches].sort((a, b) => a.createdAt - b.createdAt);
  const prevMatches = sorted.filter((m) => m.id !== currentMatch.id).slice(-7);

  if (prevMatches.length < 3) return "";

  const squadAvg = calcSquadAvgOvr(allPlayers, allOverrides);
  const total = prevMatches.length;
  const threshold = Math.ceil(total * 0.5);

  const startCount: Record<number, number> = {};
  for (const m of prevMatches) {
    for (const id of m.starterIds) {
      startCount[id] = (startCount[id] ?? 0) + 1;
    }
  }

  const regularStarters = allPlayers
    .filter((p) => (startCount[p.id] ?? 0) >= threshold)
    .sort((a, b) => (startCount[b.id] ?? 0) - (startCount[a.id] ?? 0));

  if (regularStarters.length < 5) return "";

  const currentStarterSet = new Set(currentMatch.starterIds);
  const currentSubSet = new Set(currentMatch.subIds);

  const lines: string[] = [];

  lines.push(`TIME TITULAR HABITUAL (baseado nas últimas ${total} partidas):`);
  for (const p of regularStarters.slice(0, 14)) {
    const stats = seasonStats[p.id];
    const ovr = allOverrides[p.id]?.overall;
    const ovrLabel = ovr != null && squadAvg != null ? ` | OVR: ${relativeOvrLabel(ovr, squadAvg)}` : "";
    const avgR = recentAvgRating(stats);
    const ratingStr = avgR != null ? ` | nota média ${avgR}` : "";
    const goalsAssists = stats ? ` | ${stats.goals ?? 0}G ${stats.assists ?? 0}A` : "";
    const pos = p.positionPtBr ?? p.position ?? "";
    const starts = startCount[p.id] ?? 0;
    lines.push(`  • ${p.name} (${pos}) — titular em ${starts}/${total}${ovrLabel}${ratingStr}${goalsAssists}`);
  }

  const droppedEntirely: SquadPlayer[] = [];
  const droppedToBench: SquadPlayer[] = [];
  const newStarters: SquadPlayer[] = [];

  for (const p of regularStarters) {
    const inStarters = currentStarterSet.has(p.id);
    const inSubs = currentSubSet.has(p.id);
    if (!inStarters && !inSubs) droppedEntirely.push(p);
    else if (!inStarters && inSubs) droppedToBench.push(p);
  }

  for (const id of currentMatch.starterIds) {
    const p = allPlayers.find((pl) => pl.id === id);
    if (p && (startCount[p.id] ?? 0) < threshold) newStarters.push(p);
  }

  const hasChanges = droppedEntirely.length > 0 || droppedToBench.length > 0 || newStarters.length > 0;

  if (hasChanges) {
    lines.push("\nMUDANÇAS NA ESCALAÇÃO DESTA PARTIDA:");

    for (const p of droppedEntirely) {
      const stats = seasonStats[p.id];
      const ovr = allOverrides[p.id]?.overall;
      const ovrLabel = ovr != null && squadAvg != null ? ` | OVR: ${relativeOvrLabel(ovr, squadAvg)}` : "";
      const avgR = recentAvgRating(stats);
      const ratingStr = avgR != null ? ` | nota média recente: ${avgR}` : "";
      const goalsAssists = stats ? ` | ${stats.goals ?? 0}G ${stats.assists ?? 0}A na temporada` : "";
      const pos = p.positionPtBr ?? p.position ?? "";
      lines.push(`  ⛔ ${p.name} (${pos}) — era titular habitual (${startCount[p.id] ?? 0}/${total}) mas NÃO FOI RELACIONADO para esta partida${ovrLabel}${ratingStr}${goalsAssists}`);
    }

    for (const p of droppedToBench) {
      const stats = seasonStats[p.id];
      const ovr = allOverrides[p.id]?.overall;
      const ovrLabel = ovr != null && squadAvg != null ? ` | OVR: ${relativeOvrLabel(ovr, squadAvg)}` : "";
      const avgR = recentAvgRating(stats);
      const ratingStr = avgR != null ? ` | nota média recente: ${avgR}` : "";
      const goalsAssists = stats ? ` | ${stats.goals ?? 0}G ${stats.assists ?? 0}A na temporada` : "";
      const pos = p.positionPtBr ?? p.position ?? "";
      lines.push(`  ⬇️ ${p.name} (${pos}) — era titular habitual (${startCount[p.id] ?? 0}/${total}) mas vai ao BANCO nesta partida${ovrLabel}${ratingStr}${goalsAssists}`);
    }

    for (const p of newStarters) {
      const stats = seasonStats[p.id];
      const ovr = allOverrides[p.id]?.overall;
      const ovrLabel = ovr != null && squadAvg != null ? ` | OVR: ${relativeOvrLabel(ovr, squadAvg)}` : "";
      const prevStarts = startCount[p.id] ?? 0;
      const prevStr = prevStarts === 0 ? "nunca tinha sido titular nas últimas partidas" : `titular apenas ${prevStarts}/${total} vezes anteriores`;
      const pos = p.positionPtBr ?? p.position ?? "";
      const goalsAssists = stats ? ` | ${stats.goals ?? 0}G ${stats.assists ?? 0}A` : "";
      lines.push(`  ⬆️ ${p.name} (${pos}) — ${prevStr}, entra como TITULAR nesta partida${ovrLabel}${goalsAssists}`);
    }
  }

  lines.push("\nCOMO USAR ESTE CONTEXTO:");
  lines.push("  - Os jogadores listados em TITULARES HABITUAIS são conhecidos como o esqueleto do time — a mídia e a torcida sabem quem são eles e têm expectativas sobre suas atuações.");
  lines.push("  - Quando um TITULAR HABITUAL vai ao banco ou não é relacionado, isso é notícia — a reação depende da qualidade do jogador: estrela rebaixada ao banco gera polêmica e cobrança; jogador em má fase rebaixado gera apoio à decisão do técnico.");
  lines.push("  - Quando um jogador que raramente titular começa: a torcida fica curiosa e animada se for promessa, ou preocupada se for uma surpresa sem justificativa.");
  lines.push("  - Use este contexto para criar comentários e reações naturais da torcida/mídia — não copie os dados brutos, interprete-os com linguagem de torcedor e jornalista esportivo.");

  return lines.join("\n");
}
