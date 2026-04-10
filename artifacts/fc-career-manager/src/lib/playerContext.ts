import type { SquadPlayer } from "@/lib/squadCache";
import { getAllPlayerStats } from "@/lib/playerStatsStorage";
import type { FanMoral, Mood } from "@/types/playerStats";

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
}

export function buildPlayerPerformanceContext(
  careerId: string,
  allPlayers: SquadPlayer[],
): PlayerContextItem[] {
  const allStats = getAllPlayerStats(careerId);
  const items: PlayerContextItem[] = [];

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

    const onlyNeutral = form === "regular" && incidents.length === 0 &&
      stats.fanMoral === "neutro" && stats.mood === "neutro" &&
      (stats.goals ?? 0) + (stats.assists ?? 0) < 3;
    if (onlyNeutral && totalApps < 5) continue;

    const starters = stats.matchesAsStarter ?? 0;
    const subs = stats.matchesAsSubstitute ?? 0;
    const benchRatio = totalApps > 0 ? subs / totalApps : 0;
    const isBench = subs > starters && totalApps >= 3;

    items.push({
      name: player.name,
      position: player.positionPtBr ?? player.position,
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
    const incStr = p.incidents.length > 0 ? ` | ${p.incidents.join(", ")}` : "";
    return `- ${p.name} (${p.position}): forma ${p.form} (avg ${p.avgRating}) | moral: ${p.fanMoral} | humor: ${p.mood} | ${p.goals}G ${p.assists}A${incStr}`;
  });
  return lines.join("\n");
}
