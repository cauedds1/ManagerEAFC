import { useMemo } from "react";
import { getMatches } from "@/lib/matchStorage";
import { getMatchResult } from "@/types/match";
import type { MatchRecord } from "@/types/match";

interface Props {
  careerId: string;
  seasonId: string;
  season?: string;
}

interface ClubStats {
  total: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  possession: number[];
  shotsFor: number[];
  shotsAgainst: number[];
  yellowCards: number;
  redCards: number;
  home: { total: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number };
  away: { total: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number };
  recentForm: ("V" | "E" | "D")[];
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function fmt1(n: number): string {
  return n.toFixed(1);
}

function computeStats(matches: MatchRecord[]): ClubStats {
  const stats: ClubStats = {
    total: 0, wins: 0, draws: 0, losses: 0,
    goalsFor: 0, goalsAgainst: 0,
    possession: [], shotsFor: [], shotsAgainst: [],
    yellowCards: 0, redCards: 0,
    home: { total: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
    away: { total: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
    recentForm: [],
  };

  for (const m of matches) {
    const result = getMatchResult(m.myScore, m.opponentScore);
    stats.total++;
    if (result === "vitoria") stats.wins++;
    else if (result === "empate") stats.draws++;
    else stats.losses++;

    stats.goalsFor += m.myScore;
    stats.goalsAgainst += m.opponentScore;

    if (m.matchStats) {
      if (m.matchStats.possessionPct > 0) stats.possession.push(m.matchStats.possessionPct);
      if (m.matchStats.myShots > 0 || m.matchStats.opponentShots > 0) {
        stats.shotsFor.push(m.matchStats.myShots);
        stats.shotsAgainst.push(m.matchStats.opponentShots);
      }
    }

    for (const ps of Object.values(m.playerStats)) {
      if (ps.yellowCard) stats.yellowCards++;
      if (ps.redCard) stats.redCards++;
    }

    if (m.location === "casa") {
      stats.home.total++;
      if (result === "vitoria") stats.home.wins++;
      else if (result === "empate") stats.home.draws++;
      else stats.home.losses++;
      stats.home.goalsFor += m.myScore;
      stats.home.goalsAgainst += m.opponentScore;
    } else if (m.location === "fora") {
      stats.away.total++;
      if (result === "vitoria") stats.away.wins++;
      else if (result === "empate") stats.away.draws++;
      else stats.away.losses++;
      stats.away.goalsFor += m.myScore;
      stats.away.goalsAgainst += m.opponentScore;
    }
  }

  stats.recentForm = [...matches]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10)
    .map((m) => {
      const r = getMatchResult(m.myScore, m.opponentScore);
      return r === "vitoria" ? "V" : r === "empate" ? "E" : "D";
    });

  return stats;
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon?: string;
  wide?: boolean;
}

function StatCard({ label, value, sub, accent, icon, wide }: StatCardProps) {
  return (
    <div
      className={`flex flex-col gap-1.5 px-4 py-4 rounded-2xl ${wide ? "col-span-2" : ""}`}
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-sm">{icon}</span>}
        <span className="text-white/35 text-[11px] font-semibold tracking-wide uppercase">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span
          className="text-3xl font-black tabular-nums leading-none"
          style={{ color: accent ?? "rgba(255,255,255,0.85)" }}
        >
          {value}
        </span>
        {sub && <span className="text-white/30 text-xs mb-0.5">{sub}</span>}
      </div>
    </div>
  );
}

interface WDLBarProps {
  wins: number;
  draws: number;
  losses: number;
  label: string;
}

function WDLBar({ wins, draws, losses, label }: WDLBarProps) {
  const total = wins + draws + losses;
  if (total === 0) return null;
  const wPct = (wins / total) * 100;
  const dPct = (draws / total) * 100;
  const lPct = (losses / total) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-white/40 text-xs font-semibold">{label}</span>
        <span className="text-white/25 text-xs">{total} jogos</span>
      </div>
      <div className="flex rounded-full overflow-hidden h-2.5 gap-0.5">
        {wins > 0 && (
          <div
            className="h-full rounded-l-full transition-all duration-500"
            style={{ width: `${wPct}%`, background: "#34d399" }}
            title={`${wins} vitórias`}
          />
        )}
        {draws > 0 && (
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${dPct}%`, background: "#94a3b8" }}
            title={`${draws} empates`}
          />
        )}
        {losses > 0 && (
          <div
            className="h-full rounded-r-full transition-all duration-500"
            style={{ width: `${lPct}%`, background: "#f87171" }}
            title={`${losses} derrotas`}
          />
        )}
      </div>
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#34d399" }} />
          <span className="text-white/50 text-xs tabular-nums">{wins}V</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#94a3b8" }} />
          <span className="text-white/50 text-xs tabular-nums">{draws}E</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#f87171" }} />
          <span className="text-white/50 text-xs tabular-nums">{losses}D</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-white/20 text-[10px]">aproveit.</span>
          <span className="text-white/50 text-xs font-semibold tabular-nums">
            {total > 0 ? Math.round((wins / total) * 100) : 0}%
          </span>
        </div>
      </div>
    </div>
  );
}

const FORM_STYLE: Record<"V" | "E" | "D", { bg: string; color: string }> = {
  V: { bg: "rgba(16,185,129,0.18)",  color: "#34d399" },
  E: { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
  D: { bg: "rgba(239,68,68,0.18)",   color: "#f87171" },
};

export function ClubStatsView({ careerId, seasonId, season }: Props) {
  const matches = useMemo(() => {
    const all = getMatches(seasonId);
    return season ? all.filter((m) => m.season === season) : all;
  }, [seasonId, season]);

  const stats = useMemo(() => computeStats(matches), [matches]);

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <span className="text-5xl">🏟️</span>
        <p className="text-white/40 text-sm">
          Registre partidas para ver as estatísticas do clube
        </p>
      </div>
    );
  }

  const avgPossession = avg(stats.possession);
  const avgShotsFor = avg(stats.shotsFor);
  const avgShotsAgainst = avg(stats.shotsAgainst);
  const avgGoalsFor = stats.total > 0 ? stats.goalsFor / stats.total : 0;
  const avgGoalsAgainst = stats.total > 0 ? stats.goalsAgainst / stats.total : 0;
  const goalDiff = stats.goalsFor - stats.goalsAgainst;
  const hasPossession = stats.possession.length > 0;
  const hasShots = stats.shotsFor.length > 0;

  return (
    <div className="w-full space-y-6 py-5">
      {/* Forma recente */}
      {stats.recentForm.length > 0 && (
        <div>
          <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-2 px-0.5">Forma recente</p>
          <div className="flex gap-1.5 flex-wrap">
            {stats.recentForm.map((r, i) => {
              const s = FORM_STYLE[r];
              return (
                <div
                  key={i}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40` }}
                >
                  {r}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resultados */}
      <div>
        <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3 px-0.5">Resultados</p>
        <div className="space-y-4 px-0.5">
          <WDLBar wins={stats.wins} draws={stats.draws} losses={stats.losses} label="Geral" />
          {stats.home.total > 0 && (
            <WDLBar wins={stats.home.wins} draws={stats.home.draws} losses={stats.home.losses} label="🏠 Casa" />
          )}
          {stats.away.total > 0 && (
            <WDLBar wins={stats.away.wins} draws={stats.away.draws} losses={stats.away.losses} label="✈️ Fora" />
          )}
        </div>
      </div>

      {/* Gols */}
      <div>
        <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3 px-0.5">Gols</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Marcados"
            value={stats.goalsFor}
            sub={`${fmt1(avgGoalsFor)}/jogo`}
            accent="#34d399"
            icon="⚽"
          />
          <StatCard
            label="Sofridos"
            value={stats.goalsAgainst}
            sub={`${fmt1(avgGoalsAgainst)}/jogo`}
            accent="#f87171"
            icon="🥅"
          />
          <StatCard
            label="Saldo"
            value={goalDiff > 0 ? `+${goalDiff}` : String(goalDiff)}
            accent={goalDiff > 0 ? "#34d399" : goalDiff < 0 ? "#f87171" : "#94a3b8"}
            icon="⚖️"
          />
          <StatCard
            label="Jogos"
            value={stats.total}
            sub={`temp. ${season ?? ""}`}
            icon="📅"
          />
        </div>

        {(stats.home.total > 0 || stats.away.total > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {stats.home.total > 0 && (
              <div
                className="flex flex-col gap-2 px-4 py-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-white/30 text-[11px] font-semibold">🏠 Gols em casa</span>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black tabular-nums" style={{ color: "#34d399" }}>{stats.home.goalsFor}</span>
                  <span className="text-white/20 text-sm">·</span>
                  <span className="text-xl font-black tabular-nums" style={{ color: "#f87171" }}>{stats.home.goalsAgainst}</span>
                  <span className="text-white/30 text-xs ml-auto">pro · contra</span>
                </div>
              </div>
            )}
            {stats.away.total > 0 && (
              <div
                className="flex flex-col gap-2 px-4 py-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-white/30 text-[11px] font-semibold">✈️ Gols fora</span>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black tabular-nums" style={{ color: "#34d399" }}>{stats.away.goalsFor}</span>
                  <span className="text-white/20 text-sm">·</span>
                  <span className="text-xl font-black tabular-nums" style={{ color: "#f87171" }}>{stats.away.goalsAgainst}</span>
                  <span className="text-white/30 text-xs ml-auto">pro · contra</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Posse + Finalizações */}
      {(hasPossession || hasShots) && (
        <div>
          <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3 px-0.5">
            Jogo
            <span className="text-white/20 font-normal normal-case ml-1.5">
              (média por jogo — baseado em {stats.possession.length > 0 ? stats.possession.length : stats.shotsFor.length} partidas com dados)
            </span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {hasPossession && (
              <StatCard
                label="Posse de bola"
                value={`${Math.round(avgPossession)}%`}
                accent={avgPossession >= 50 ? "#34d399" : "#fbbf24"}
                icon="🟢"
              />
            )}
            {hasShots && (
              <>
                <StatCard
                  label="Finalizações"
                  value={fmt1(avgShotsFor)}
                  sub="por jogo"
                  accent="var(--club-primary)"
                  icon="🎯"
                />
                <StatCard
                  label="Fins. cedidas"
                  value={fmt1(avgShotsAgainst)}
                  sub="por jogo"
                  accent="#fb923c"
                  icon="🛡️"
                />
              </>
            )}
          </div>

          {/* Barra de posse média */}
          {hasPossession && (
            <div
              className="mt-3 px-4 py-3 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: "var(--club-primary)" }}>
                  {Math.round(avgPossession)}%
                </span>
                <span className="text-white/30 text-xs font-semibold">
                  {Math.round(100 - avgPossession)}%
                </span>
              </div>
              <div className="flex rounded-full overflow-hidden h-2.5">
                <div
                  className="h-full transition-all duration-700"
                  style={{ width: `${avgPossession}%`, background: "var(--club-gradient, var(--club-primary))" }}
                />
                <div
                  className="h-full flex-1"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-white/20 text-[10px]">Você</span>
                <span className="text-white/20 text-[10px]">Adversário</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disciplina */}
      <div>
        <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3 px-0.5">Disciplina</p>
        <div className="grid grid-cols-2 gap-3">
          <div
            className="flex items-center gap-3 px-4 py-4 rounded-2xl"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)" }}
          >
            <div
              className="w-5 h-7 rounded-sm flex-shrink-0"
              style={{ background: "#fbbf24" }}
            />
            <div>
              <p className="text-white/35 text-[11px] font-semibold tracking-wide uppercase">Amarelos</p>
              <p className="text-3xl font-black tabular-nums leading-none mt-0.5" style={{ color: "#fbbf24" }}>
                {stats.yellowCards}
              </p>
              {stats.total > 0 && (
                <p className="text-white/25 text-[10px] mt-0.5">
                  {fmt1(stats.yellowCards / stats.total)}/jogo
                </p>
              )}
            </div>
          </div>
          <div
            className="flex items-center gap-3 px-4 py-4 rounded-2xl"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)" }}
          >
            <div
              className="w-5 h-7 rounded-sm flex-shrink-0"
              style={{ background: "#f87171" }}
            />
            <div>
              <p className="text-white/35 text-[11px] font-semibold tracking-wide uppercase">Vermelhos</p>
              <p className="text-3xl font-black tabular-nums leading-none mt-0.5" style={{ color: "#f87171" }}>
                {stats.redCards}
              </p>
              {stats.total > 0 && (
                <p className="text-white/25 text-[10px] mt-0.5">
                  {fmt1(stats.redCards / stats.total)}/jogo
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
