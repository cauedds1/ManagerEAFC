import { useMemo, useState } from "react";
import { getMatches } from "@/lib/matchStorage";
import { getMatchResult } from "@/types/match";
import type { MatchRecord } from "@/types/match";
import type { Season } from "@/types/career";
import { useLang } from "@/hooks/useLang";
import { SectionHelp } from "./SectionHelp";
import { CLUBE, getResultChip } from "@/lib/i18n";

interface Props {
  careerId: string;
  seasonId: string;
  season?: string;
  seasons?: Season[];
  matchesOverride?: MatchRecord[];
  allSeasonMatches?: MatchRecord[];
}

interface ClubStats {
  total: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  ownGoals: number;
  possession: number[];
  shotsFor: number[];
  shotsAgainst: number[];
  shotsForTotal: number;
  playerShotsTotal: number;
  playerShotsOnTargetTotal: number;
  penaltyGoals: number;
  yellowCards: number;
  redCards: number;
  passAccuracyPerMatch: number[];
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
    goalsFor: 0, goalsAgainst: 0, ownGoals: 0,
    possession: [], shotsFor: [], shotsAgainst: [],
    shotsForTotal: 0, playerShotsTotal: 0, playerShotsOnTargetTotal: 0, penaltyGoals: 0,
    yellowCards: 0, redCards: 0,
    passAccuracyPerMatch: [],
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
        stats.shotsForTotal += m.matchStats.myShots;
      }
      if (m.matchStats.penaltyGoals) stats.penaltyGoals += m.matchStats.penaltyGoals;
    }

    const playerValues = Object.values(m.playerStats);
    const passAccList: number[] = [];
    for (const ps of playerValues) {
      if (ps.yellowCard) stats.yellowCards++;
      if (ps.redCard) stats.redCards++;
      if (ps.ownGoal) stats.ownGoals++;
      if (ps.passAccuracy != null) {
        passAccList.push(ps.passAccuracy);
      }
      if (ps.shots != null && ps.shots > 0) {
        stats.playerShotsTotal += ps.shots;
        if (ps.shotsOnTargetPct != null) {
          stats.playerShotsOnTargetTotal += ps.shots * (ps.shotsOnTargetPct / 100);
        }
      }
    }
    if (passAccList.length > 0) {
      const matchAvg = passAccList.reduce((s, v) => s + v, 0) / passAccList.length;
      stats.passAccuracyPerMatch.push(matchAvg);
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
  t: typeof CLUBE["pt"];
}

function WDLBar({ wins, draws, losses, label, t }: WDLBarProps) {
  const total = wins + draws + losses;
  if (total === 0) return null;
  const wPct = (wins / total) * 100;
  const dPct = (draws / total) * 100;
  const lPct = (losses / total) * 100;
  const aproveitamento = total > 0 ? ((wins * 3 + draws) / (total * 3)) * 100 : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-white/40 text-xs font-semibold">{label}</span>
        <span className="text-white/25 text-xs">{total} {t.gamePlural}</span>
      </div>
      <div className="flex rounded-full overflow-hidden h-2.5 gap-0.5">
        {wins > 0 && (
          <div
            className="h-full rounded-l-full transition-all duration-500"
            style={{ width: `${wPct}%`, background: "#34d399" }}
            title={`${wins} ${t.winsTip}`}
          />
        )}
        {draws > 0 && (
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${dPct}%`, background: "#94a3b8" }}
            title={`${draws} ${t.drawsTip}`}
          />
        )}
        {losses > 0 && (
          <div
            className="h-full rounded-r-full transition-all duration-500"
            style={{ width: `${lPct}%`, background: "#f87171" }}
            title={`${losses} ${t.lossesTip}`}
          />
        )}
      </div>
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#34d399" }} />
          <span className="text-white/50 text-xs tabular-nums">{wins}{t.winsChip}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#94a3b8" }} />
          <span className="text-white/50 text-xs tabular-nums">{draws}{t.drawsChip}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#f87171" }} />
          <span className="text-white/50 text-xs tabular-nums">{losses}{t.lossesChip}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-white/20 text-[10px]">{t.winRateAbbr}</span>
          <span className="text-white/50 text-xs font-semibold tabular-nums">
            {Math.round(aproveitamento)}%
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

function FilterDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs font-semibold rounded-xl px-3 py-1.5 outline-none cursor-pointer"
      style={{
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.7)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: "#1a1a2e" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ClubStatsView({
  careerId: _careerId,
  seasonId,
  season,
  seasons,
  matchesOverride,
  allSeasonMatches,
}: Props) {
  const [lang] = useLang();
  const t = CLUBE[lang];

  const hasMultipleSeasons = (seasons?.length ?? 0) > 1;

  const [filterSeasonId, setFilterSeasonId] = useState<string>(seasonId);
  const [filterCompetition, setFilterCompetition] = useState<string>("todas");

  const baseMatches = useMemo<MatchRecord[]>(() => {
    if (filterSeasonId === "todas") {
      return allSeasonMatches ?? matchesOverride ?? getMatches(seasonId);
    }
    if (filterSeasonId === seasonId) {
      return matchesOverride ?? getMatches(seasonId);
    }
    return getMatches(filterSeasonId);
  }, [filterSeasonId, seasonId, matchesOverride, allSeasonMatches]);

  const competitions = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const m of baseMatches) {
      if (m.tournament) set.add(m.tournament);
    }
    return Array.from(set).sort();
  }, [baseMatches]);

  const matches = useMemo<MatchRecord[]>(() => {
    if (filterCompetition === "todas") return baseMatches;
    return baseMatches.filter((m) => m.tournament === filterCompetition);
  }, [baseMatches, filterCompetition]);

  const stats = useMemo(() => computeStats(matches), [matches]);

  const seasonOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    if (seasons && seasons.length > 0) {
      for (const s of [...seasons].sort((a, b) => b.createdAt - a.createdAt)) {
        opts.push({ value: s.id, label: s.label + (s.id === seasonId ? ` ${t.currentSeason}` : "") });
      }
      opts.push({ value: "todas", label: t.allSeasons });
    }
    return opts;
  }, [seasons, seasonId, t]);

  const competitionOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: "todas", label: t.allComps }];
    for (const c of competitions) {
      opts.push({ value: c, label: c });
    }
    return opts;
  }, [competitions, t]);

  const showSeasonFilter = hasMultipleSeasons;
  const showCompFilter = competitionOptions.length > 1;
  const showFilters = showSeasonFilter || showCompFilter;

  if (matches.length === 0) {
    return (
      <div>
        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-4 pb-3">
            {showSeasonFilter && (
              <FilterDropdown value={filterSeasonId} onChange={(v) => { setFilterSeasonId(v); setFilterCompetition("todas"); }} options={seasonOptions} />
            )}
            {showCompFilter && (
              <FilterDropdown value={filterCompetition} onChange={setFilterCompetition} options={competitionOptions} />
            )}
          </div>
        )}
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <span className="text-5xl">🏟️</span>
          <p className="text-white/40 text-sm">
            {filterCompetition !== "todas" || filterSeasonId === "todas"
              ? t.noMatchesFiltered
              : t.noMatchesEmpty}
          </p>
        </div>
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
  const aproveitamento = stats.total > 0 ? ((stats.wins * 3 + stats.draws) / (stats.total * 3)) * 100 : 0;
  const avgPassAccuracy = stats.passAccuracyPerMatch.length > 0 ? avg(stats.passAccuracyPerMatch) : null;

  const totalFinalizacoes = stats.shotsForTotal > 0 ? stats.shotsForTotal : stats.playerShotsTotal;
  const precisaoFinalizacoes = stats.playerShotsTotal > 0
    ? Math.round((stats.playerShotsOnTargetTotal / stats.playerShotsTotal) * 100)
    : null;
  const hasAtaqueData = totalFinalizacoes > 0 || stats.penaltyGoals > 0;

  return (
    <div className="w-full space-y-6 py-5">
      <div className="flex items-center gap-2 px-1">
        <SectionHelp section="estatisticas" />
      </div>
      {showFilters && (
        <div className="flex flex-wrap gap-2">
          {showSeasonFilter && (
            <FilterDropdown
              value={filterSeasonId}
              onChange={(v) => { setFilterSeasonId(v); setFilterCompetition("todas"); }}
              options={seasonOptions}
            />
          )}
          {showCompFilter && (
            <FilterDropdown
              value={filterCompetition}
              onChange={setFilterCompetition}
              options={competitionOptions}
            />
          )}
        </div>
      )}

      {stats.recentForm.length > 0 && (
        <div>
          <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-2 px-0.5">{t.recentForm}</p>
          <div className="flex gap-1.5 flex-wrap">
            {stats.recentForm.map((r, i) => {
              const s = FORM_STYLE[r];
              return (
                <div
                  key={i}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40` }}
                >
                  {getResultChip(lang, r)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3 px-0.5">{t.resultsSection}</p>
        <div className="space-y-4 px-0.5">
          <WDLBar wins={stats.wins} draws={stats.draws} losses={stats.losses} label={t.generalLabel} t={t} />
          {stats.home.total > 0 && (
            <WDLBar wins={stats.home.wins} draws={stats.home.draws} losses={stats.home.losses} label={t.homeLabel} t={t} />
          )}
          {stats.away.total > 0 && (
            <WDLBar wins={stats.away.wins} draws={stats.away.draws} losses={stats.away.losses} label={t.awayLabel} t={t} />
          )}
        </div>
        <div
          className="mt-3 flex items-center justify-between px-4 py-3 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-white/35 text-xs font-semibold uppercase tracking-wide">{t.winRate}</span>
          <span
            className="text-2xl font-black tabular-nums"
            style={{
              color: aproveitamento >= 60 ? "#34d399" : aproveitamento >= 40 ? "#fbbf24" : "#f87171",
            }}
          >
            {Math.round(aproveitamento)}%
          </span>
        </div>
      </div>

      <div>
        <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3 px-0.5">{t.goalsSection}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label={t.goalsScored}
            value={stats.goalsFor}
            sub={`${fmt1(avgGoalsFor)}${t.perGameSuffix}`}
            accent="#34d399"
            icon="⚽"
          />
          <StatCard
            label={t.goalsConceded}
            value={stats.goalsAgainst}
            sub={`${fmt1(avgGoalsAgainst)}${t.perGameSuffix}`}
            accent="#f87171"
            icon="🥅"
          />
          <StatCard
            label={t.goalDiff}
            value={goalDiff > 0 ? `+${goalDiff}` : String(goalDiff)}
            accent={goalDiff > 0 ? "#34d399" : goalDiff < 0 ? "#f87171" : "#94a3b8"}
            icon="⚖️"
          />
          <StatCard
            label={t.ownGoals}
            value={stats.ownGoals}
            accent={stats.ownGoals > 0 ? "#fb923c" : "rgba(255,255,255,0.85)"}
            icon="🤦"
          />
        </div>

        {(stats.home.total > 0 || stats.away.total > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {stats.home.total > 0 && (
              <div
                className="flex flex-col gap-2 px-4 py-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-white/30 text-[11px] font-semibold">{t.homeGoals}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black tabular-nums" style={{ color: "#34d399" }}>{stats.home.goalsFor}</span>
                  <span className="text-white/20 text-sm">·</span>
                  <span className="text-xl font-black tabular-nums" style={{ color: "#f87171" }}>{stats.home.goalsAgainst}</span>
                  <span className="text-white/30 text-xs ml-auto">{t.forAgainst}</span>
                </div>
              </div>
            )}
            {stats.away.total > 0 && (
              <div
                className="flex flex-col gap-2 px-4 py-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-white/30 text-[11px] font-semibold">{t.awayGoals}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black tabular-nums" style={{ color: "#34d399" }}>{stats.away.goalsFor}</span>
                  <span className="text-white/20 text-sm">·</span>
                  <span className="text-xl font-black tabular-nums" style={{ color: "#f87171" }}>{stats.away.goalsAgainst}</span>
                  <span className="text-white/30 text-xs ml-auto">{t.forAgainst}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {hasAtaqueData && (
        <div>
          <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3 px-0.5">{t.attackSection}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {totalFinalizacoes > 0 && (
              <StatCard
                label={t.shots}
                value={totalFinalizacoes}
                sub={stats.shotsFor.length > 0 ? `${fmt1(avgShotsFor)}${t.perGameSuffix}` : undefined}
                accent="var(--club-primary)"
                icon="🎯"
              />
            )}
            {precisaoFinalizacoes !== null && (
              <div
                className="flex flex-col gap-1.5 px-4 py-4 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🏹</span>
                  <span className="text-white/35 text-[11px] font-semibold tracking-wide uppercase">{t.shotAccuracy}</span>
                </div>
                <div className="flex items-end gap-2">
                  <span
                    className="text-3xl font-black tabular-nums leading-none"
                    style={{
                      color: precisaoFinalizacoes >= 40 ? "#34d399" : precisaoFinalizacoes >= 25 ? "#fbbf24" : "#f87171",
                    }}
                  >
                    {precisaoFinalizacoes}%
                  </span>
                </div>
                <div className="flex rounded-full overflow-hidden h-1.5 bg-white/5 mt-1">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(precisaoFinalizacoes, 100)}%`,
                      background: precisaoFinalizacoes >= 40 ? "#34d399" : precisaoFinalizacoes >= 25 ? "#fbbf24" : "#f87171",
                    }}
                  />
                </div>
              </div>
            )}
            {stats.penaltyGoals > 0 && (
              <StatCard
                label={t.penaltyGoals}
                value={stats.penaltyGoals}
                accent="#fbbf24"
                icon="⚽"
              />
            )}
          </div>
        </div>
      )}

      <div>
        <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3 px-0.5">{t.passesSection}</p>
        <div
          className="flex items-center justify-between px-4 py-4 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div>
            <p className="text-white/35 text-[11px] font-semibold tracking-wide uppercase mb-1">{t.passAccLabel}</p>
            <p className="text-white/25 text-[10px]">
              {avgPassAccuracy !== null
                ? t.passAccData.replace("{n}", String(stats.passAccuracyPerMatch.length))
                : t.passAccEmpty}
            </p>
          </div>
          {avgPassAccuracy !== null ? (
            <span
              className="text-3xl font-black tabular-nums"
              style={{
                color: avgPassAccuracy >= 80 ? "#34d399" : avgPassAccuracy >= 65 ? "#fbbf24" : "#f87171",
              }}
            >
              {Math.round(avgPassAccuracy)}%
            </span>
          ) : (
            <span className="text-2xl font-black" style={{ color: "rgba(255,255,255,0.2)" }}>
              {t.nd}
            </span>
          )}
        </div>
        {avgPassAccuracy !== null && (
          <div
            className="mt-2 px-4 py-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex rounded-full overflow-hidden h-2 bg-white/5">
              <div
                className="h-full transition-all duration-700 rounded-full"
                style={{
                  width: `${avgPassAccuracy}%`,
                  background: avgPassAccuracy >= 80 ? "#34d399" : avgPassAccuracy >= 65 ? "#fbbf24" : "#f87171",
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-white/15 text-[10px]">0%</span>
              <span className="text-white/15 text-[10px]">100%</span>
            </div>
          </div>
        )}
      </div>

      {(hasPossession || hasShots) && (
        <div>
          <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3 px-0.5">
            {t.gameSection}
            <span className="text-white/20 font-normal normal-case ml-1.5">
              {t.gameSubLabel.replace("{n}", String(stats.possession.length > 0 ? stats.possession.length : stats.shotsFor.length))}
            </span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {hasPossession && (
              <StatCard
                label={t.possession}
                value={`${Math.round(avgPossession)}%`}
                accent={avgPossession >= 50 ? "#34d399" : "#fbbf24"}
                icon="🟢"
              />
            )}
            {hasShots && (
              <>
                <StatCard
                  label={t.shotsPerGame}
                  value={fmt1(avgShotsFor)}
                  sub={t.perGameLabel}
                  accent="var(--club-primary)"
                  icon="🎯"
                />
                <StatCard
                  label={t.shotsConceded}
                  value={fmt1(avgShotsAgainst)}
                  sub={t.perGameLabel}
                  accent="#fb923c"
                  icon="🛡️"
                />
              </>
            )}
          </div>

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
                <span className="text-white/20 text-[10px]">{t.youLabel}</span>
                <span className="text-white/20 text-[10px]">{t.opponentLabel}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3 px-0.5">{t.discipline}</p>
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
              <p className="text-white/35 text-[11px] font-semibold tracking-wide uppercase">{t.yellowCards}</p>
              <p className="text-3xl font-black tabular-nums leading-none mt-0.5" style={{ color: "#fbbf24" }}>
                {stats.yellowCards}
              </p>
              {stats.total > 0 && (
                <p className="text-white/25 text-[10px] mt-0.5">
                  {fmt1(stats.yellowCards / stats.total)}{t.perGameSuffix}
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
              <p className="text-white/35 text-[11px] font-semibold tracking-wide uppercase">{t.redCards}</p>
              <p className="text-3xl font-black tabular-nums leading-none mt-0.5" style={{ color: "#f87171" }}>
                {stats.redCards}
              </p>
              {stats.total > 0 && (
                <p className="text-white/25 text-[10px] mt-0.5">
                  {fmt1(stats.redCards / stats.total)}{t.perGameSuffix}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
