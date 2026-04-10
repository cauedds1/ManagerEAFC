import { useState } from "react";
import type { SquadPlayer, PositionPtBr } from "@/lib/squadCache";
import { migratePositionOverride } from "@/lib/squadCache";
import type { PlayerOverride } from "@/types/playerStats";
import {
  MOOD_LABELS,
  MOOD_COLORS,
  FAN_MORAL_LABELS,
  FAN_MORAL_COLORS,
} from "@/types/playerStats";
import {
  getPlayerStats,
  setPlayerStats,
  setPlayerOverride,
} from "@/lib/playerStatsStorage";

const POS_STYLE: Record<PositionPtBr, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)",  color: "#f59e0b" },
  DEF: { bg: "rgba(59,130,246,0.18)",  color: "#60a5fa" },
  MID: { bg: "rgba(16,185,129,0.18)",  color: "#34d399" },
  ATA: { bg: "rgba(239,68,68,0.18)",   color: "#f87171" },
};

function overallColor(ov: number): { bg: string; color: string } {
  if (ov >= 90) return { bg: "rgba(245,158,11,0.2)", color: "#fbbf24" };
  if (ov >= 80) return { bg: "rgba(16,185,129,0.2)", color: "#34d399" };
  if (ov >= 70) return { bg: "rgba(20,184,166,0.2)", color: "#2dd4bf" };
  if (ov >= 60) return { bg: "rgba(249,115,22,0.2)", color: "#fb923c" };
  return { bg: "rgba(239,68,68,0.2)", color: "#f87171" };
}

function PlayerPhoto({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(!src);
  const initials = name
    .trim()
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="w-16 h-16 rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center"
      style={{ background: "rgba(var(--club-primary-rgb),0.1)", border: "1.5px solid rgba(var(--club-primary-rgb),0.2)" }}
    >
      {!err ? (
        <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setErr(true)} />
      ) : (
        <span className="text-white/50 text-xl font-black">{initials}</span>
      )}
    </div>
  );
}

interface PlayerDetailPanelProps {
  player: SquadPlayer;
  careerId: string;
  override?: PlayerOverride;
  onClose: () => void;
  onUpdated: () => void;
}

export function PlayerDetailPanel({
  player,
  careerId,
  override,
  onClose,
  onUpdated,
}: PlayerDetailPanelProps) {
  const [stats, setStatsState] = useState(() => getPlayerStats(careerId, player.id));
  const [editing, setEditing] = useState(false);

  const totalMatches = (stats.matchesAsStarter ?? 0) + (stats.matchesAsSubstitute ?? 0);
  const avgRating = (() => {
    const r = stats.recentRatings ?? [];
    if (r.length === 0) return null;
    return (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1);
  })();
  const ratingColor = (() => {
    if (!avgRating) return "rgba(255,255,255,0.3)";
    const v = parseFloat(avgRating);
    if (v >= 7.8) return "#34d399";
    if (v >= 7.0) return "#a3e635";
    if (v >= 6.0) return "#fbbf24";
    if (v >= 5.0) return "#fb923c";
    return "#f87171";
  })();

  const displayName = override?.nameOverride ?? player.name;
  const displayNumber = override?.shirtNumber ?? player.number;
  const displayOverall = override?.overall;
  const displayPosition = (migratePositionOverride(override?.positionOverride) ?? player.positionPtBr) as PositionPtBr;

  const [editName, setEditName] = useState(displayName);
  const [editNumber, setEditNumber] = useState(String(displayNumber ?? ""));
  const [editOverall, setEditOverall] = useState(String(displayOverall ?? ""));
  const [editSalary, setEditSalary] = useState(String(override?.salary ?? ""));
  const [editPosition, setEditPosition] = useState<PositionPtBr>(displayPosition);

  const pos = POS_STYLE[displayPosition] ?? POS_STYLE.MID;
  const moodStyle = MOOD_COLORS[stats.mood];
  const fanStyle = FAN_MORAL_COLORS[stats.fanMoral];

  const saveEdit = () => {
    const numberVal = parseInt(editNumber, 10);
    const overallVal = parseInt(editOverall, 10);
    const salaryVal = parseInt(editSalary, 10);
    setPlayerOverride(careerId, player.id, {
      nameOverride: editName.trim() || undefined,
      shirtNumber: !isNaN(numberVal) && editNumber.trim() ? numberVal : undefined,
      overall: !isNaN(overallVal) && editOverall.trim() ? Math.max(1, Math.min(99, overallVal)) : undefined,
      salary: !isNaN(salaryVal) && editSalary.trim() ? Math.max(0, salaryVal) : undefined,
      positionOverride: editPosition !== player.positionPtBr ? editPosition : undefined,
    });
    setEditing(false);
    onUpdated();
  };

  const cancelEdit = () => {
    setEditName(displayName);
    setEditNumber(String(displayNumber ?? ""));
    setEditOverall(String(displayOverall ?? ""));
    setEditSalary(String(override?.salary ?? ""));
    setEditPosition(displayPosition);
    setEditing(false);
  };

  const updateStat = (field: "goals" | "assists" | "matchesAsStarter" | "totalMinutes", val: number) => {
    const updated = { ...stats, [field]: Math.max(0, val) };
    setPlayerStats(careerId, player.id, updated);
    setStatsState(updated);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md flex flex-col rounded-2xl animate-slide-up overflow-hidden"
        style={{
          background: "var(--app-bg-lighter, #141024)",
          border: "1px solid var(--surface-border)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
          maxHeight: "calc(100vh - 2rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header (always visible) ── */}
        <div
          className="flex items-start justify-between px-5 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--surface-border)" }}
        >
          <div className="flex items-center gap-4 min-w-0">
            <PlayerPhoto src={player.photo} name={displayName} />
            <div className="flex-1 min-w-0">
              <h2 className="text-white text-base font-black leading-tight truncate">{displayName}</h2>
              <p className="text-white/40 text-xs mt-0.5">
                {player.age > 0 ? `${player.age} anos` : ""}
                {displayNumber != null ? ` · #${displayNumber}` : ""}
              </p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: pos.bg, color: pos.color }}>
                  {displayPosition}
                </span>
                {displayOverall != null && (
                  <span className="text-xs font-black px-2 py-0.5 rounded-md" style={overallColor(displayOverall)}>
                    {displayOverall} OVR
                  </span>
                )}
                {override?.salary != null && override.salary > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>
                    €{override.salary.toLocaleString("pt-BR")}k/sem
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 transition-all flex-shrink-0 ml-2 mt-0.5"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="p-5 flex flex-col gap-4">

            {/* Mood / fan row */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-white/30 text-[10px] font-semibold uppercase tracking-wide">Humor</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md ml-auto" style={{ background: moodStyle.bg, color: moodStyle.color }}>
                  {MOOD_LABELS[stats.mood]}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-1 min-w-0 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-white/30 text-[10px] font-semibold uppercase tracking-wide">Torcida</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md ml-auto" style={{ background: fanStyle.bg, color: fanStyle.color }}>
                  {FAN_MORAL_LABELS[stats.fanMoral]}
                </span>
              </div>
            </div>

            {/* Computed stats strip */}
            <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              {[
                {
                  label: "Nota Média",
                  value: avgRating ?? "—",
                  color: ratingColor,
                  note: avgRating ? `${stats.recentRatings?.length ?? 0} jogos` : "sem dados",
                },
                {
                  label: "Partidas",
                  value: totalMatches,
                  color: "rgba(255,255,255,0.85)",
                  note: `${stats.matchesAsStarter ?? 0}T · ${stats.matchesAsSubstitute ?? 0}B`,
                },
                {
                  label: "Cartões",
                  value: (stats.yellowCards ?? 0) + (stats.redCards ?? 0) > 0
                    ? `${stats.yellowCards ?? 0}🟡 ${stats.redCards ?? 0}🔴`
                    : "—",
                  color: (stats.yellowCards ?? 0) >= 3 || (stats.redCards ?? 0) > 0 ? "#fb923c" : "rgba(255,255,255,0.35)",
                  note: (stats.totalOwnGoals ?? 0) > 0 ? `${stats.totalOwnGoals} gol c.` : "limpo",
                },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-0.5 py-3 px-2" style={{ background: "rgba(255,255,255,0.025)" }}>
                  <span className="text-xs font-black tabular-nums" style={{ color: item.color }}>{item.value}</span>
                  <span className="text-white/35 text-[10px] font-semibold">{item.label}</span>
                  <span className="text-white/20 text-[9px]">{item.note}</span>
                </div>
              ))}
            </div>

            {/* Editable stats grid */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Gols", field: "goals" as const },
                { label: "Assist.", field: "assists" as const },
                { label: "Titular", field: "matchesAsStarter" as const },
                { label: "Minutos", field: "totalMinutes" as const },
              ].map(({ label, field }) => (
                <div
                  key={field}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <span className="text-white text-lg font-black tabular-nums">{stats[field]}</span>
                  <span className="text-white/35 text-[10px] text-center leading-tight">{label}</span>
                  <input
                    type="number"
                    min={0}
                    value={stats[field]}
                    onChange={(e) => updateStat(field, parseInt(e.target.value, 10) || 0)}
                    className="w-full px-1.5 py-1 rounded-lg text-white/60 text-xs font-semibold focus:outline-none focus:text-white text-center tabular-nums"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                </div>
              ))}
            </div>

            {/* Edit player section */}
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={() => {
                  if (!editing) {
                    setEditName(displayName);
                    setEditNumber(String(displayNumber ?? ""));
                    setEditOverall(String(displayOverall ?? ""));
                    setEditSalary(String(override?.salary ?? ""));
                    setEditPosition(displayPosition);
                  }
                  setEditing(!editing);
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/4"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <span className="text-white/60 text-sm font-semibold">Editar jogador</span>
                <svg
                  className={`w-4 h-4 text-white/35 transition-transform duration-200 ${editing ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {editing && (
                <div className="px-4 pb-4 pt-3 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/40 text-xs font-medium">Nome exibido</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={player.name}
                      className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-white/40 text-xs font-medium">Número</label>
                      <input
                        type="number" min={1} max={99}
                        value={editNumber}
                        onChange={(e) => setEditNumber(e.target.value)}
                        placeholder="—"
                        className="w-full px-3 py-2.5 rounded-xl text-white text-sm font-semibold focus:outline-none tabular-nums"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-white/40 text-xs font-medium">Overall</label>
                      <input
                        type="number" min={1} max={99}
                        value={editOverall}
                        onChange={(e) => setEditOverall(e.target.value)}
                        placeholder="—"
                        className="w-full px-3 py-2.5 rounded-xl text-white text-sm font-semibold focus:outline-none tabular-nums"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-white/40 text-xs font-medium">Sal. (k/sem)</label>
                      <input
                        type="number" min={0}
                        value={editSalary}
                        onChange={(e) => setEditSalary(e.target.value)}
                        placeholder="—"
                        className="w-full px-3 py-2.5 rounded-xl text-white text-sm font-semibold focus:outline-none tabular-nums"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/40 text-xs font-medium">Posição</label>
                    <select
                      value={editPosition}
                      onChange={(e) => setEditPosition(e.target.value as PositionPtBr)}
                      className="w-full px-3 py-2.5 rounded-xl text-white text-sm font-semibold focus:outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      {(["GOL","DEF","MID","ATA"] as PositionPtBr[]).map((p) => (
                        <option key={p} value={p} style={{ background: "#141024" }}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer (always visible) ── */}
        <div
          className="flex gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid var(--surface-border)" }}
        >
          {editing ? (
            <>
              <button
                onClick={cancelEdit}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/60 transition-all hover:text-white/80"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: "var(--club-gradient)" }}
              >
                Salvar alterações
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/50 transition-all hover:text-white/80"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
