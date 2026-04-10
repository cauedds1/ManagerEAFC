import { useMemo, useState } from "react";
import { getAllPlayerStats, getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import type { SquadPlayer } from "@/lib/squadCache";
import type { PlayerSeasonStats } from "@/types/playerStats";

const POS_STYLE: Record<string, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)",  color: "#f59e0b" },
  ZAG: { bg: "rgba(59,130,246,0.18)",  color: "#60a5fa" },
  LAT: { bg: "rgba(14,165,233,0.18)",  color: "#38bdf8" },
  VOL: { bg: "rgba(16,185,129,0.18)",  color: "#34d399" },
  MC:  { bg: "rgba(20,184,166,0.18)",  color: "#2dd4bf" },
  MEI: { bg: "rgba(132,204,22,0.18)",  color: "#a3e635" },
  PE:  { bg: "rgba(249,115,22,0.18)",  color: "#fb923c" },
  PD:  { bg: "rgba(245,156,10,0.18)",  color: "#fbbf24" },
  SA:  { bg: "rgba(244,63,94,0.18)",   color: "#fb7185" },
  CA:  { bg: "rgba(239,68,68,0.18)",   color: "#f87171" },
  ATA: { bg: "rgba(185,28,28,0.18)",   color: "#ef4444" },
};

type SortCol =
  | "name" | "number" | "pos" | "total" | "starter" | "sub"
  | "minutes" | "goals" | "assists" | "yellow" | "red" | "overall";

interface Row {
  player: SquadPlayer;
  stats: PlayerSeasonStats;
  shirtNumber: number | undefined;
  overall: number | undefined;
}

function PlayerPhoto({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(!src);
  return (
    <div
      className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
      style={{ background: "rgba(var(--club-primary-rgb),0.08)" }}
    >
      {!err ? (
        <img
          src={src}
          alt={name}
          className="w-8 h-8 object-cover"
          onError={() => setErr(true)}
        />
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
}

function Th({ label, col, sortCol, asc, onSort, title, left }: ThProps) {
  const active = sortCol === col;
  return (
    <th
      className={`px-2 py-2 ${left ? "text-left" : "text-center"} cursor-pointer select-none whitespace-nowrap`}
      style={{ color: active ? "rgb(var(--club-primary-rgb))" : "rgba(255,255,255,0.35)" }}
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

interface Props {
  careerId: string;
  allPlayers: SquadPlayer[];
}

export function PlayerStatsTable({ careerId, allPlayers }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>("goals");
  const [asc, setAsc] = useState(false);

  const rawStats = useMemo(() => getAllPlayerStats(careerId), [careerId]);
  const overrides = useMemo(() => getAllPlayerOverrides(careerId), [careerId]);

  const rows: Row[] = useMemo(() => {
    return allPlayers
      .filter((p) => {
        const s = rawStats[p.id];
        if (!s) return false;
        return (
          s.goals > 0 ||
          s.assists > 0 ||
          s.matchesAsStarter > 0 ||
          s.matchesAsSubstitute > 0
        );
      })
      .map((p) => {
        const ov = overrides[p.id];
        return {
          player: p,
          stats: rawStats[p.id],
          shirtNumber: ov?.shirtNumber ?? p.number,
          overall: ov?.overall,
        };
      });
  }, [allPlayers, rawStats, overrides]);

  const hasData = rows.length > 0;

  const sorted = useMemo(() => {
    const factor = asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      let diff = 0;
      switch (sortCol) {
        case "name":    diff = a.player.name.localeCompare(b.player.name); break;
        case "number":  diff = (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99); break;
        case "pos":     diff = a.player.positionPtBr.localeCompare(b.player.positionPtBr); break;
        case "total":   diff = (a.stats.matchesAsStarter + a.stats.matchesAsSubstitute) - (b.stats.matchesAsStarter + b.stats.matchesAsSubstitute); break;
        case "starter": diff = a.stats.matchesAsStarter - b.stats.matchesAsStarter; break;
        case "sub":     diff = a.stats.matchesAsSubstitute - b.stats.matchesAsSubstitute; break;
        case "minutes": diff = a.stats.totalMinutes - b.stats.totalMinutes; break;
        case "goals":   diff = a.stats.goals - b.stats.goals; break;
        case "assists": diff = a.stats.assists - b.stats.assists; break;
        case "yellow":  diff = a.stats.yellowCards - b.stats.yellowCards; break;
        case "red":     diff = a.stats.redCards - b.stats.redCards; break;
        case "overall": diff = (a.overall ?? 0) - (b.overall ?? 0); break;
      }
      return diff * factor;
    });
  }, [rows, sortCol, asc]);

  function handleSort(col: SortCol) {
    if (sortCol === col) setAsc((v) => !v);
    else { setSortCol(col); setAsc(false); }
  }

  const topGoals   = Math.max(...rows.map((r) => r.stats.goals), 0);
  const topAssists = Math.max(...rows.map((r) => r.stats.assists), 0);
  const topMin     = Math.max(...rows.map((r) => r.stats.totalMinutes), 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <span className="text-5xl">📋</span>
        <p className="text-white/40 text-sm">Registre partidas para ver as estatísticas dos jogadores</p>
      </div>
    );
  }

  const thProps = { sortCol, asc, onSort: handleSort };

  return (
    <div className="w-full pb-6 pt-1 overflow-x-auto">
      <table className="w-full border-collapse text-sm min-w-[720px]">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <Th label="#"    col="number"  {...thProps} title="Nº camisa" />
            <Th label="Jogador" col="name" {...thProps} left />
            <Th label="Pos"  col="pos"     {...thProps} />
            <Th label="J"    col="total"   {...thProps} title="Jogos totais" />
            <Th label="JT"   col="starter" {...thProps} title="Jogos como titular" />
            <Th label="JB"   col="sub"     {...thProps} title="Jogos como reserva" />
            <Th label="Min"  col="minutes" {...thProps} title="Minutos jogados" />
            <Th label="G"    col="goals"   {...thProps} title="Gols" />
            <Th label="A"    col="assists" {...thProps} title="Assistências" />
            <Th label="CA"   col="yellow"  {...thProps} title="Cartões amarelos" />
            <Th label="CV"   col="red"     {...thProps} title="Cartões vermelhos" />
            <Th label="OVR"  col="overall" {...thProps} title="Overall" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ player, stats, shirtNumber, overall }, i) => {
            const isTopGoals   = stats.goals > 0   && stats.goals   === topGoals;
            const isTopAssists = stats.assists > 0 && stats.assists === topAssists;
            const isTopMin     = stats.totalMinutes > 0 && stats.totalMinutes === topMin;
            const posStyle = POS_STYLE[player.positionPtBr] ?? { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" };
            const totalGames = stats.matchesAsStarter + stats.matchesAsSubstitute;

            return (
              <tr
                key={player.id}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                }}
              >
                <td className="px-3 py-2.5 text-center">
                  <span className="text-white/40 text-xs tabular-nums font-medium">
                    {shirtNumber ?? "—"}
                  </span>
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <PlayerPhoto src={player.photo} name={player.name} />
                    <span className="text-white/80 font-medium text-xs truncate max-w-[130px]">{player.name}</span>
                    {isTopGoals   && <span className="text-[10px]" title="Artilheiro">⚽</span>}
                    {isTopAssists && <span className="text-[10px]" title="Garçom">🎯</span>}
                    {isTopMin     && <span className="text-[10px]" title="Mais minutos">⏱️</span>}
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: posStyle.bg, color: posStyle.color }}
                  >
                    {player.positionPtBr}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-center text-white/70 text-xs tabular-nums">{totalGames}</td>
                <td className="px-2 py-2.5 text-center text-white/50 text-xs tabular-nums">{stats.matchesAsStarter}</td>
                <td className="px-2 py-2.5 text-center text-white/50 text-xs tabular-nums">{stats.matchesAsSubstitute}</td>
                <td className="px-2 py-2.5 text-center text-white/50 text-xs tabular-nums">{stats.totalMinutes}&apos;</td>
                <td className="px-2 py-2.5 text-center text-xs tabular-nums font-semibold" style={{ color: stats.goals > 0 ? "#34d399" : "rgba(255,255,255,0.3)" }}>{stats.goals}</td>
                <td className="px-2 py-2.5 text-center text-xs tabular-nums font-semibold" style={{ color: stats.assists > 0 ? "#60a5fa" : "rgba(255,255,255,0.3)" }}>{stats.assists}</td>
                <td className="px-2 py-2.5 text-center text-xs tabular-nums">
                  {stats.yellowCards > 0 ? (
                    <span className="inline-flex items-center gap-1 justify-center" style={{ color: "#fbbf24" }}>
                      <span className="inline-block w-2.5 h-3.5 rounded-sm" style={{ background: "#fbbf24" }} />
                      {stats.yellowCards}
                    </span>
                  ) : <span className="text-white/25">—</span>}
                </td>
                <td className="px-2 py-2.5 text-center text-xs tabular-nums">
                  {stats.redCards > 0 ? (
                    <span className="inline-flex items-center gap-1 justify-center" style={{ color: "#f87171" }}>
                      <span className="inline-block w-2.5 h-3.5 rounded-sm" style={{ background: "#f87171" }} />
                      {stats.redCards}
                    </span>
                  ) : <span className="text-white/25">—</span>}
                </td>
                <td className="px-2 py-2.5 text-center text-xs tabular-nums">
                  {overall != null ? (
                    <span className="font-bold" style={{ color: overall >= 80 ? "#34d399" : overall >= 70 ? "#fbbf24" : "#94a3b8" }}>
                      {overall}
                    </span>
                  ) : <span className="text-white/20">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
