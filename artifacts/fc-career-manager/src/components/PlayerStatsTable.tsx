import { useMemo, useState, useRef, useEffect } from "react";
import { getAllPlayerStats, getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import { getMatches } from "@/lib/matchStorage";
import type { SquadPlayer } from "@/lib/squadCache";
import type { PlayerSeasonStats } from "@/types/playerStats";

const POS_STYLE: Record<string, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)",  color: "#f59e0b" },
  DEF: { bg: "rgba(59,130,246,0.18)",  color: "#60a5fa" },
  MID: { bg: "rgba(16,185,129,0.18)",  color: "#34d399" },
  ATA: { bg: "rgba(239,68,68,0.18)",   color: "#f87171" },
};

interface DerivedStats {
  avgRating: number | null;
  hatTricks: number;
  totalPenScored: number;
  totalPasses: number;
  passAccuracy: number | null;
  totalKeyPasses: number;
  totalDribblesCompleted: number;
  totalBallRecoveries: number;
  totalBallLosses: number;
  totalSaves: number;
  totalPenaltiesSaved: number;
  totalGoalsAgainst: number;
}

interface Row {
  player: SquadPlayer;
  stats: PlayerSeasonStats;
  derived: DerivedStats;
  shirtNumber: number | undefined;
  overall: number | undefined;
  displayPos: string;
}

type FilterTab = "ataque" | "intermediario" | "defesa" | "goleiro";

type SortCol =
  | "name" | "number" | "pos" | "total" | "starter" | "rating"
  | "goals" | "assists" | "ga" | "hat" | "penScored" | "penMissed"
  | "passes" | "passAcc" | "keyPasses" | "dribbles"
  | "recoveries" | "losses" | "yellow" | "red"
  | "saves" | "goalsAgainst" | "penSaved"
  | "overall";

const FILTER_TABS: { id: FilterTab; label: string; icon: string }[] = [
  { id: "ataque",       label: "Ataque",      icon: "⚽" },
  { id: "intermediario", label: "Intermediário", icon: "🔄" },
  { id: "defesa",       label: "Defesa",      icon: "🛡️" },
  { id: "goleiro",      label: "Goleiro",     icon: "🧤" },
];

const LEGEND_COMMON: { sigla: string; desc: string }[] = [
  { sigla: "#",    desc: "Nº da camisa" },
  { sigla: "Pos",  desc: "Posição" },
  { sigla: "J",    desc: "Jogos totais" },
  { sigla: "S11",  desc: "Jogos como titular (Started 11)" },
  { sigla: "Nota", desc: "Nota média por jogo" },
];

const LEGEND_BY_TAB: Record<FilterTab, { sigla: string; desc: string }[]> = {
  ataque: [
    { sigla: "G",     desc: "Gols" },
    { sigla: "A",     desc: "Assistências" },
    { sigla: "G+A",   desc: "Gols + Assistências" },
    { sigla: "Hat",   desc: "Hat-tricks (3 ou + gols em 1 jogo)" },
    { sigla: "Pên⚽",  desc: "Gols de pênalti" },
    { sigla: "Pên✗",  desc: "Pênaltis perdidos" },
    { sigla: "OVR",   desc: "Overall (nota geral do jogador)" },
  ],
  intermediario: [
    { sigla: "A",      desc: "Assistências" },
    { sigla: "Passes", desc: "Passes totais" },
    { sigla: "Prec%",  desc: "Precisão de passes (%)" },
    { sigla: "PC",     desc: "Passes chave" },
    { sigla: "Drib",   desc: "Dribles completados" },
    { sigla: "OVR",    desc: "Overall (nota geral do jogador)" },
  ],
  defesa: [
    { sigla: "Rec", desc: "Recuperações de bola" },
    { sigla: "Per", desc: "Perdas de posse" },
    { sigla: "CA",  desc: "Cartão amarelo" },
    { sigla: "CV",  desc: "Cartão vermelho" },
    { sigla: "OVR", desc: "Overall (nota geral do jogador)" },
  ],
  goleiro: [
    { sigla: "Def",  desc: "Defesas (finalizações defendidas)" },
    { sigla: "GS",   desc: "Gols sofridos" },
    { sigla: "Pên✓", desc: "Pênaltis defendidos" },
    { sigla: "OVR",  desc: "Overall (nota geral do jogador)" },
  ],
};

function PlayerPhoto({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(!src);
  return (
    <div
      className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
      style={{ background: "rgba(var(--club-primary-rgb),0.08)" }}
    >
      {!err ? (
        <img src={src} alt={name} className="w-8 h-8 object-cover" onError={() => setErr(true)} />
      ) : (
        <svg viewBox="0 0 40 40" className="w-5 h-5 text-white/15" fill="currentColor">
          <circle cx="20" cy="14" r="7" />
          <path d="M4 36c0-8.837 7.163-16 16-16s16 7.163 16 16" />
        </svg>
      )}
    </div>
  );
}

interface ThProps {
  label: string;
  col: SortCol;
  sortCol: SortCol;
  asc: boolean;
  onSort: (c: SortCol) => void;
  title?: string;
  left?: boolean;
  accent?: string;
}

function Th({ label, col, sortCol, asc, onSort, title, left, accent }: ThProps) {
  const active = sortCol === col;
  return (
    <th
      className={`px-2 py-2 ${left ? "text-left" : "text-center"} cursor-pointer select-none whitespace-nowrap`}
      style={{ color: active ? (accent ?? "rgb(var(--club-primary-rgb))") : "rgba(255,255,255,0.35)" }}
      onClick={() => onSort(col)}
      title={title}
    >
      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${left ? "" : "justify-center"}`}>
        {label}
        {active && <span className="text-[10px]">{asc ? "↑" : "↓"}</span>}
      </span>
    </th>
  );
}

function Dash() {
  return <span className="text-white/20">—</span>;
}

function NumCell({ value, accent, min = 1 }: { value: number; accent?: string; min?: number }) {
  if (value === 0) return <Dash />;
  return (
    <span
      className="font-semibold tabular-nums text-xs"
      style={{ color: value >= min ? (accent ?? "rgba(255,255,255,0.7)") : "rgba(255,255,255,0.35)" }}
    >
      {value}
    </span>
  );
}

function RatingCell({ value }: { value: number | null }) {
  if (value === null) return <Dash />;
  const color = value >= 8 ? "#34d399" : value >= 7 ? "#a3e635" : value >= 6 ? "#fbbf24" : "#f87171";
  return <span className="font-bold tabular-nums text-xs" style={{ color }}>{value.toFixed(1)}</span>;
}

function PctCell({ value }: { value: number | null }) {
  if (value === null) return <Dash />;
  const color = value >= 85 ? "#34d399" : value >= 75 ? "#fbbf24" : "#f87171";
  return <span className="tabular-nums text-xs font-semibold" style={{ color }}>{value.toFixed(0)}%</span>;
}

interface Props {
  careerId: string;
  seasonId: string;
  allPlayers: SquadPlayer[];
  statsOverride?: Record<number, PlayerSeasonStats>;
  matchesOverride?: ReturnType<typeof getMatches>;
}

export function PlayerStatsTable({ careerId, seasonId, allPlayers, statsOverride, matchesOverride }: Props) {
  const [filter, setFilter] = useState<FilterTab>("ataque");
  const [sortCol, setSortCol] = useState<SortCol>("goals");
  const [asc, setAsc] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showLegend) return;
    function handleClickOutside(e: MouseEvent) {
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) {
        setShowLegend(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showLegend]);

  const rawStats = useMemo(() => statsOverride ?? getAllPlayerStats(seasonId), [statsOverride, seasonId]);
  const overrides = useMemo(() => getAllPlayerOverrides(careerId), [careerId]);
  const matches = useMemo(() => matchesOverride ?? getMatches(seasonId), [matchesOverride, seasonId]);

  const derivedMap = useMemo<Record<number, DerivedStats>>(() => {
    const map: Record<number, DerivedStats> = {};

    for (const p of allPlayers) {
      let ratingSum = 0; let ratingCount = 0;
      let hatTricks = 0;
      let totalPenScored = 0;
      let totalPasses = 0;
      let passAccSum = 0; let passAccCount = 0;
      let totalKeyPasses = 0;
      let totalDrib = 0;
      let totalRecov = 0;
      let totalLosses = 0;
      let totalSaves = 0;
      let totalPenSaved = 0;
      let totalGoalsAgainst = 0;

      for (const m of matches) {
        const ps = m.playerStats[p.id];
        const isInMatch = m.starterIds.includes(p.id) || m.subIds.includes(p.id);
        if (!isInMatch) continue;

        if (ps) {
          if (ps.rating > 0) { ratingSum += ps.rating; ratingCount++; }
          if (ps.goals.length >= 3) hatTricks++;
          totalPenScored += ps.goals.filter((g) => g.goalType === "penalti").length;
          if (ps.passes != null)           totalPasses     += ps.passes;
          if (ps.passAccuracy != null)     { passAccSum += ps.passAccuracy; passAccCount++; }
          if (ps.keyPasses != null)        totalKeyPasses  += ps.keyPasses;
          if (ps.dribblesCompleted != null) totalDrib      += ps.dribblesCompleted;
          if (ps.ballRecoveries != null)   totalRecov      += ps.ballRecoveries;
          if (ps.ballLosses != null)       totalLosses     += ps.ballLosses;
          if (ps.saves != null)            totalSaves      += ps.saves;
          if (ps.penaltiesSaved != null)   totalPenSaved   += ps.penaltiesSaved;
        }

        const ov = overrides[p.id];
        const effectivePos = (ov?.positionOverride ?? p.positionPtBr);
        if (effectivePos === "GOL" && m.starterIds.includes(p.id)) {
          totalGoalsAgainst += m.opponentScore;
        }
      }

      map[p.id] = {
        avgRating: ratingCount > 0 ? ratingSum / ratingCount : null,
        hatTricks,
        totalPenScored,
        totalPasses,
        passAccuracy: passAccCount > 0 ? passAccSum / passAccCount : null,
        totalKeyPasses,
        totalDribblesCompleted: totalDrib,
        totalBallRecoveries: totalRecov,
        totalBallLosses: totalLosses,
        totalSaves,
        totalPenaltiesSaved: totalPenSaved,
        totalGoalsAgainst,
      };
    }

    return map;
  }, [allPlayers, matches, overrides]);

  const rows: Row[] = useMemo(() => {
    return allPlayers
      .filter((p) => {
        const s = rawStats[p.id];
        if (!s) return false;
        return s.goals > 0 || s.assists > 0 || s.matchesAsStarter > 0 || s.matchesAsSubstitute > 0;
      })
      .map((p) => {
        const ov = overrides[p.id];
        return {
          player: p,
          stats: rawStats[p.id],
          derived: derivedMap[p.id] ?? {
            avgRating: null, hatTricks: 0, totalPenScored: 0, totalPasses: 0, passAccuracy: null,
            totalKeyPasses: 0, totalDribblesCompleted: 0, totalBallRecoveries: 0,
            totalBallLosses: 0, totalSaves: 0, totalPenaltiesSaved: 0, totalGoalsAgainst: 0,
          },
          shirtNumber: ov?.shirtNumber ?? p.number,
          overall: ov?.overall,
          displayPos: ov?.positionOverride ?? p.positionPtBr,
        };
      });
  }, [allPlayers, rawStats, overrides, derivedMap]);

  const visibleRows = useMemo(() => {
    if (filter === "goleiro") return rows.filter((r) => r.displayPos === "GOL");
    return rows;
  }, [rows, filter]);

  const defaultSortByFilter: Record<FilterTab, SortCol> = {
    ataque: "goals",
    intermediario: "passes",
    defesa: "recoveries",
    goleiro: "saves",
  };

  function handleFilterChange(f: FilterTab) {
    setFilter(f);
    setSortCol(defaultSortByFilter[f]);
    setAsc(false);
  }

  const sorted = useMemo(() => {
    const factor = asc ? 1 : -1;
    return [...visibleRows].sort((a, b) => {
      let diff = 0;
      const tA = a.stats.matchesAsStarter + a.stats.matchesAsSubstitute;
      const tB = b.stats.matchesAsStarter + b.stats.matchesAsSubstitute;
      switch (sortCol) {
        case "name":        diff = a.player.name.localeCompare(b.player.name); break;
        case "number":      diff = (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99); break;
        case "pos":         diff = a.displayPos.localeCompare(b.displayPos); break;
        case "total":       diff = tA - tB; break;
        case "starter":     diff = a.stats.matchesAsStarter - b.stats.matchesAsStarter; break;
        case "rating":      diff = (a.derived.avgRating ?? 0) - (b.derived.avgRating ?? 0); break;
        case "goals":       diff = a.stats.goals - b.stats.goals; break;
        case "assists":     diff = a.stats.assists - b.stats.assists; break;
        case "ga":          diff = (a.stats.goals + a.stats.assists) - (b.stats.goals + b.stats.assists); break;
        case "hat":         diff = a.derived.hatTricks - b.derived.hatTricks; break;
        case "penScored":   diff = a.derived.totalPenScored - b.derived.totalPenScored; break;
        case "penMissed":   diff = a.stats.totalMissedPenalties - b.stats.totalMissedPenalties; break;
        case "passes":      diff = a.derived.totalPasses - b.derived.totalPasses; break;
        case "passAcc":     diff = (a.derived.passAccuracy ?? 0) - (b.derived.passAccuracy ?? 0); break;
        case "keyPasses":   diff = a.derived.totalKeyPasses - b.derived.totalKeyPasses; break;
        case "dribbles":    diff = a.derived.totalDribblesCompleted - b.derived.totalDribblesCompleted; break;
        case "recoveries":  diff = a.derived.totalBallRecoveries - b.derived.totalBallRecoveries; break;
        case "losses":      diff = a.derived.totalBallLosses - b.derived.totalBallLosses; break;
        case "yellow":      diff = a.stats.yellowCards - b.stats.yellowCards; break;
        case "red":         diff = a.stats.redCards - b.stats.redCards; break;
        case "saves":       diff = a.derived.totalSaves - b.derived.totalSaves; break;
        case "goalsAgainst":diff = a.derived.totalGoalsAgainst - b.derived.totalGoalsAgainst; break;
        case "penSaved":    diff = a.derived.totalPenaltiesSaved - b.derived.totalPenaltiesSaved; break;
        case "overall":     diff = (a.overall ?? 0) - (b.overall ?? 0); break;
      }
      return diff * factor;
    });
  }, [visibleRows, sortCol, asc]);

  function handleSort(col: SortCol) {
    if (sortCol === col) setAsc((v) => !v);
    else { setSortCol(col); setAsc(false); }
  }

  const hasData = rows.length > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <span className="text-5xl">📋</span>
        <p className="text-white/40 text-sm">Registre partidas para ver as estatísticas dos jogadores</p>
      </div>
    );
  }

  const th = { sortCol, asc, onSort: handleSort };
  const THEAD_BG = { background: "rgba(var(--club-primary-rgb), 0.08)", borderBottom: "1px solid rgba(255,255,255,0.07)" };

  const ALWAYS_HEADER = (
    <>
      <Th label="#"      col="number"  {...th} title="Nº camisa" />
      <Th label="Jogador" col="name"   {...th} left />
      <Th label="Pos"    col="pos"     {...th} />
      <Th label="J"      col="total"   {...th} title="Jogos totais" />
      <Th label="S11"    col="starter" {...th} title="Jogos como titular (Started 11)" />
      <Th label="Nota"   col="rating"  {...th} title="Nota média" />
    </>
  );

  return (
    <div className="w-full pb-6 pt-1">
      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 pb-3 flex-wrap">
        {FILTER_TABS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => handleFilterChange(f.id)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200"
              style={{
                background: active ? "rgba(var(--club-primary-rgb),0.15)" : "rgba(255,255,255,0.05)",
                color: active ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                border: active
                  ? "1px solid rgba(var(--club-primary-rgb),0.25)"
                  : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </button>
          );
        })}

        {/* Legend button */}
        <div className="relative" ref={legendRef}>
          <button
            onClick={() => setShowLegend((v) => !v)}
            title="Legenda das siglas"
            className="flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200"
            style={{
              background: showLegend ? "rgba(var(--club-primary-rgb),0.18)" : "rgba(255,255,255,0.05)",
              border: showLegend ? "1px solid rgba(var(--club-primary-rgb),0.3)" : "1px solid rgba(255,255,255,0.08)",
              color: showLegend ? "var(--club-primary)" : "rgba(255,255,255,0.35)",
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>

          {showLegend && (
            <div
              className="absolute left-0 top-8 z-30 rounded-xl shadow-2xl py-3 px-4 min-w-[230px]"
              style={{
                background: "#141024",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">
                Siglas — {FILTER_TABS.find((f) => f.id === filter)?.label}
              </p>
              <div className="space-y-1">
                {LEGEND_COMMON.map(({ sigla, desc }) => (
                  <div key={sigla} className="flex items-baseline gap-2">
                    <span
                      className="text-[11px] font-bold tabular-nums flex-shrink-0 w-10 text-right"
                      style={{ color: "rgba(var(--club-primary-rgb),0.8)" }}
                    >
                      {sigla}
                    </span>
                    <span className="text-white/50 text-[11px]">{desc}</span>
                  </div>
                ))}
              </div>
              <div className="my-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
              <div className="space-y-1">
                {LEGEND_BY_TAB[filter].map(({ sigla, desc }) => (
                  <div key={sigla} className="flex items-baseline gap-2">
                    <span
                      className="text-[11px] font-bold tabular-nums flex-shrink-0 w-10 text-right"
                      style={{ color: "rgba(var(--club-primary-rgb),0.8)" }}
                    >
                      {sigla}
                    </span>
                    <span className="text-white/50 text-[11px]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {filter === "goleiro" && visibleRows.length === 0 && (
          <span className="text-white/25 text-xs ml-2">Nenhum goleiro com dados</span>
        )}
      </div>

      {visibleRows.length === 0 && filter === "goleiro" ? null : (
        <table className="w-full border-collapse text-sm min-w-[700px]">
          <thead>
            {filter === "ataque" && (
              <tr style={THEAD_BG}>
                {ALWAYS_HEADER}
                <Th label="G"      col="goals"    {...th} title="Gols" accent="#34d399" />
                <Th label="A"      col="assists"  {...th} title="Assistências" accent="#60a5fa" />
                <Th label="G+A"    col="ga"       {...th} title="Gols + Assistências" accent="#a78bfa" />
                <Th label="Hat"    col="hat"      {...th} title="Hat-tricks (3+ gols em 1 jogo)" accent="#fbbf24" />
                <Th label="Pên⚽"  col="penScored" {...th} title="Gols de pênalti" accent="#34d399" />
                <Th label="Pên✗"   col="penMissed" {...th} title="Pênaltis perdidos" accent="#f87171" />
                <Th label="OVR"    col="overall"  {...th} title="Overall" />
              </tr>
            )}
            {filter === "intermediario" && (
              <tr style={THEAD_BG}>
                {ALWAYS_HEADER}
                <Th label="A"      col="assists"  {...th} title="Assistências" accent="#60a5fa" />
                <Th label="Passes" col="passes"   {...th} title="Passes totais" />
                <Th label="Prec%"  col="passAcc"  {...th} title="Precisão de passes (%)" />
                <Th label="PC"     col="keyPasses" {...th} title="Passes chave" accent="#a3e635" />
                <Th label="Drib"   col="dribbles" {...th} title="Dribles completados" accent="#fbbf24" />
                <Th label="OVR"    col="overall"  {...th} title="Overall" />
              </tr>
            )}
            {filter === "defesa" && (
              <tr style={THEAD_BG}>
                {ALWAYS_HEADER}
                <Th label="Rec"  col="recoveries" {...th} title="Recuperações de bola" accent="#34d399" />
                <Th label="Per"  col="losses"     {...th} title="Perdas de posse" accent="#f87171" />
                <Th label="CA"   col="yellow"     {...th} title="Cartões amarelos" accent="#fbbf24" />
                <Th label="CV"   col="red"        {...th} title="Cartões vermelhos" accent="#f87171" />
                <Th label="OVR"  col="overall"    {...th} title="Overall" />
              </tr>
            )}
            {filter === "goleiro" && (
              <tr style={THEAD_BG}>
                {ALWAYS_HEADER}
                <Th label="Def"  col="saves"        {...th} title="Defesas" accent="#34d399" />
                <Th label="GS"   col="goalsAgainst" {...th} title="Gols sofridos" accent="#f87171" />
                <Th label="Pên✓" col="penSaved"     {...th} title="Pênaltis defendidos" accent="#60a5fa" />
                <Th label="OVR"  col="overall"      {...th} title="Overall" />
              </tr>
            )}
          </thead>
          <tbody>
            {sorted.map(({ player, stats, derived, shirtNumber, overall, displayPos }, i) => {
              const posStyle = POS_STYLE[displayPos] ?? { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" };
              const totalGames = stats.matchesAsStarter + stats.matchesAsSubstitute;
              const ga = stats.goals + stats.assists;

              const rowBg = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)";

              const AlwaysCells = (
                <>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-white/40 text-xs tabular-nums font-medium">{shirtNumber ?? "—"}</span>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <PlayerPhoto src={player.photo} name={player.name} />
                      <span className="text-white/80 font-medium text-xs truncate max-w-[130px]">{player.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: posStyle.bg, color: posStyle.color }}>
                      {displayPos}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-center text-white/70 text-xs tabular-nums">{totalGames}</td>
                  <td className="px-2 py-2.5 text-center text-white/50 text-xs tabular-nums">{stats.matchesAsStarter}</td>
                  <td className="px-2 py-2.5 text-center"><RatingCell value={derived.avgRating} /></td>
                </>
              );

              return (
                <tr
                  key={player.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: rowBg }}
                >
                  {filter === "ataque" && (
                    <>
                      {AlwaysCells}
                      <td className="px-2 py-2.5 text-center"><NumCell value={stats.goals} accent="#34d399" /></td>
                      <td className="px-2 py-2.5 text-center"><NumCell value={stats.assists} accent="#60a5fa" /></td>
                      <td className="px-2 py-2.5 text-center">
                        {ga > 0
                          ? <span className="font-bold tabular-nums text-xs" style={{ color: "#a78bfa" }}>{ga}</span>
                          : <Dash />}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {derived.hatTricks > 0
                          ? <span className="font-bold tabular-nums text-xs" style={{ color: "#fbbf24" }}>🎩 {derived.hatTricks}</span>
                          : <Dash />}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {derived.totalPenScored > 0
                          ? <span className="font-semibold tabular-nums text-xs" style={{ color: "#34d399" }}>{derived.totalPenScored}</span>
                          : <Dash />}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {stats.totalMissedPenalties > 0
                          ? <span className="font-semibold tabular-nums text-xs" style={{ color: "#f87171" }}>{stats.totalMissedPenalties}</span>
                          : <Dash />}
                      </td>
                      <td className="px-2 py-2.5 text-center text-xs tabular-nums">
                        {overall != null
                          ? <span className="font-bold" style={{ color: overall >= 80 ? "#34d399" : overall >= 70 ? "#fbbf24" : "#94a3b8" }}>{overall}</span>
                          : <Dash />}
                      </td>
                    </>
                  )}
                  {filter === "intermediario" && (
                    <>
                      {AlwaysCells}
                      <td className="px-2 py-2.5 text-center"><NumCell value={stats.assists} accent="#60a5fa" /></td>
                      <td className="px-2 py-2.5 text-center"><NumCell value={derived.totalPasses} /></td>
                      <td className="px-2 py-2.5 text-center"><PctCell value={derived.passAccuracy} /></td>
                      <td className="px-2 py-2.5 text-center"><NumCell value={derived.totalKeyPasses} accent="#a3e635" /></td>
                      <td className="px-2 py-2.5 text-center"><NumCell value={derived.totalDribblesCompleted} accent="#fbbf24" /></td>
                      <td className="px-2 py-2.5 text-center text-xs tabular-nums">
                        {overall != null
                          ? <span className="font-bold" style={{ color: overall >= 80 ? "#34d399" : overall >= 70 ? "#fbbf24" : "#94a3b8" }}>{overall}</span>
                          : <Dash />}
                      </td>
                    </>
                  )}
                  {filter === "defesa" && (
                    <>
                      {AlwaysCells}
                      <td className="px-2 py-2.5 text-center"><NumCell value={derived.totalBallRecoveries} accent="#34d399" /></td>
                      <td className="px-2 py-2.5 text-center"><NumCell value={derived.totalBallLosses} accent="#f87171" /></td>
                      <td className="px-2 py-2.5 text-center text-xs tabular-nums">
                        {stats.yellowCards > 0 ? (
                          <span className="inline-flex items-center gap-1 justify-center" style={{ color: "#fbbf24" }}>
                            <span className="inline-block w-2.5 h-3.5 rounded-sm" style={{ background: "#fbbf24" }} />
                            {stats.yellowCards}
                          </span>
                        ) : <Dash />}
                      </td>
                      <td className="px-2 py-2.5 text-center text-xs tabular-nums">
                        {stats.redCards > 0 ? (
                          <span className="inline-flex items-center gap-1 justify-center" style={{ color: "#f87171" }}>
                            <span className="inline-block w-2.5 h-3.5 rounded-sm" style={{ background: "#f87171" }} />
                            {stats.redCards}
                          </span>
                        ) : <Dash />}
                      </td>
                      <td className="px-2 py-2.5 text-center text-xs tabular-nums">
                        {overall != null
                          ? <span className="font-bold" style={{ color: overall >= 80 ? "#34d399" : overall >= 70 ? "#fbbf24" : "#94a3b8" }}>{overall}</span>
                          : <Dash />}
                      </td>
                    </>
                  )}
                  {filter === "goleiro" && (
                    <>
                      {AlwaysCells}
                      <td className="px-2 py-2.5 text-center"><NumCell value={derived.totalSaves} accent="#34d399" /></td>
                      <td className="px-2 py-2.5 text-center"><NumCell value={derived.totalGoalsAgainst} accent="#f87171" /></td>
                      <td className="px-2 py-2.5 text-center"><NumCell value={derived.totalPenaltiesSaved} accent="#60a5fa" /></td>
                      <td className="px-2 py-2.5 text-center text-xs tabular-nums">
                        {overall != null
                          ? <span className="font-bold" style={{ color: overall >= 80 ? "#34d399" : overall >= 70 ? "#fbbf24" : "#94a3b8" }}>{overall}</span>
                          : <Dash />}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
