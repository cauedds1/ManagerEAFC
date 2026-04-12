import type { SquadPlayer } from "@/lib/squadCache";
import { getAllPlayerStats, getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import type { FanMoral, Mood, PlayerOverride } from "@/types/playerStats";

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
  age?: number;
  consecutivePoorRatings?: number;
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

    if (overall != null && squadAvg != null) {
      ovrRelative = relativeOvrLabel(overall, squadAvg);
      const isBelowAvg = ovrRelative === "abaixo da média do elenco";

      if (!isDefender(pos) && isBelowAvg && totalApps >= 5 && (form === "ótima" || form === "boa")) {
        incidents.push("revelação/surpresa da temporada");
      } else if (isDefender(pos) && isBelowAvg && totalApps >= 5 && form === "ótima") {
        incidents.push("revelação da zaga/goleiro");
      }
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
      age: player.age,
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
      ? ` | OVR ${p.overall}${p.ovrRelative ? ` (${p.ovrRelative})` : ""}`
      : "";
    const incStr = p.incidents.length > 0 ? ` | ${p.incidents.join(", ")}` : "";
    return `- ${p.name} (${p.position}): forma ${p.form} (avg ${p.avgRating})${ovrStr} | moral: ${p.fanMoral} | humor: ${p.mood} | ${p.goals}G ${p.assists}A${incStr}`;
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
