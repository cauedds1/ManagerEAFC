import { useState } from "react";
import type { SquadPlayer, PositionPtBr } from "@/lib/squadCache";
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

  const displayName = override?.nameOverride ?? player.name;
  const displayNumber = override?.shirtNumber ?? player.number;
  const displayOverall = override?.overall;

  const [editName, setEditName] = useState(displayName);
  const [editNumber, setEditNumber] = useState(String(displayNumber ?? ""));
  const [editOverall, setEditOverall] = useState(String(displayOverall ?? ""));
  const [editSalary, setEditSalary] = useState(String(override?.salary ?? ""));

  const pos = POS_STYLE[player.positionPtBr] ?? POS_STYLE.MC;
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
    });
    setEditing(false);
    onUpdated();
  };

  const updateStat = (field: "goals" | "assists" | "matchesAsStarter" | "totalMinutes", val: number) => {
    const updated = { ...stats, [field]: Math.max(0, val) };
    setPlayerStats(careerId, player.id, updated);
    setStatsState(updated);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md flex flex-col rounded-2xl animate-slide-up"
        style={{
          background: "var(--app-bg-lighter)",
          border: "1px solid var(--surface-border)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 rounded-t-2xl"
          style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <span className="text-white/50 text-xs font-semibold uppercase tracking-widest">Jogador</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/8 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Player identity */}
          <div className="flex items-center gap-4">
            <PlayerPhoto src={player.photo} name={displayName} />
            <div className="flex-1 min-w-0">
              <h2 className="text-white text-base font-black leading-tight">{displayName}</h2>
              <p className="text-white/40 text-xs mt-0.5">
                {player.age > 0 ? `${player.age} anos` : ""}
                {displayNumber != null ? ` · #${displayNumber}` : ""}
              </p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: pos.bg, color: pos.color }}>
                  {player.positionPtBr}
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

          {/* Read-only status row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-white/30 text-[10px] font-semibold uppercase tracking-wide">Humor</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md ml-auto" style={{ background: moodStyle.bg, color: moodStyle.color }}>
                {MOOD_LABELS[stats.mood]}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-0 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-white/30 text-[10px] font-semibold uppercase tracking-wide">Torcida</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md ml-auto" style={{ background: fanStyle.bg, color: fanStyle.color }}>
                {FAN_MORAL_LABELS[stats.fanMoral]}
              </span>
            </div>
          </div>

          {/* Stats */}
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

          {/* Edit player accordion */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => {
                setEditName(displayName);
                setEditNumber(String(displayNumber ?? ""));
                setEditOverall(String(displayOverall ?? ""));
                setEditSalary(String(override?.salary ?? ""));
                setEditing(!editing);
              }}
              className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/4"
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
              <div className="px-4 pb-4 pt-2 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex flex-col gap-1">
                  <label className="text-white/35 text-xs">Nome exibido</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={player.name}
                    className="w-full px-3 py-2 rounded-lg text-white text-sm focus:outline-none glass"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-white/35 text-xs">Número</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={editNumber}
                      onChange={(e) => setEditNumber(e.target.value)}
                      placeholder="—"
                      className="w-full px-3 py-2 rounded-lg text-white text-sm font-semibold focus:outline-none glass tabular-nums"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-white/35 text-xs">Overall</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={editOverall}
                      onChange={(e) => setEditOverall(e.target.value)}
                      placeholder="—"
                      className="w-full px-3 py-2 rounded-lg text-white text-sm font-semibold focus:outline-none glass tabular-nums"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-white/35 text-xs">Salário (k/sem)</label>
                    <input
                      type="number"
                      min={0}
                      value={editSalary}
                      onChange={(e) => setEditSalary(e.target.value)}
                      placeholder="—"
                      className="w-full px-3 py-2 rounded-lg text-white text-sm font-semibold focus:outline-none glass tabular-nums"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-white/50 glass glass-hover transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveEdit}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                    style={{ background: "var(--club-gradient)" }}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
