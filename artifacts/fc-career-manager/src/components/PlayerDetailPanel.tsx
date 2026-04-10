import { useState } from "react";
import type { SquadPlayer, PositionPtBr } from "@/lib/squadCache";
import type { PlayerOverride } from "@/types/playerStats";
import {
  MOOD_LABELS,
  MOOD_COLORS,
  FAN_MORAL_LABELS,
  FAN_MORAL_COLORS,
  type Mood,
  type FanMoral,
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
      className="w-20 h-20 rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center"
      style={{ background: "rgba(var(--club-primary-rgb),0.1)", border: "1.5px solid rgba(var(--club-primary-rgb),0.2)" }}
    >
      {!err ? (
        <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setErr(true)} />
      ) : (
        <span className="text-white/50 text-2xl font-black">{initials}</span>
      )}
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

function StatBox({ label, value, icon }: StatBoxProps) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl"
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      <div className="text-white/40 w-4 h-4">{icon}</div>
      <span className="text-white text-xl font-black tabular-nums">{value}</span>
      <span className="text-white/35 text-xs text-center leading-tight">{label}</span>
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

  const pos = POS_STYLE[player.positionPtBr] ?? POS_STYLE.MC;

  const saveEdit = () => {
    const numberVal = parseInt(editNumber, 10);
    const overallVal = parseInt(editOverall, 10);
    setPlayerOverride(careerId, player.id, {
      nameOverride: editName.trim() || undefined,
      shirtNumber: !isNaN(numberVal) && editNumber.trim() ? numberVal : undefined,
      overall: !isNaN(overallVal) && editOverall.trim() ? Math.max(1, Math.min(99, overallVal)) : undefined,
    });
    setEditing(false);
    onUpdated();
  };

  const updateMood = (mood: Mood) => {
    const updated = { ...stats, mood };
    setPlayerStats(careerId, player.id, updated);
    setStatsState(updated);
  };

  const updateFanMoral = (fanMoral: FanMoral) => {
    const updated = { ...stats, fanMoral };
    setPlayerStats(careerId, player.id, updated);
    setStatsState(updated);
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
        className="w-full max-w-md max-h-[88vh] overflow-y-auto flex flex-col rounded-2xl animate-slide-up"
        style={{
          background: "var(--app-bg-lighter)",
          border: "1px solid var(--surface-border)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 rounded-t-2xl"
          style={{ background: "var(--app-bg-lighter)", borderBottom: "1px solid var(--surface-border)" }}>
          <span className="text-white/60 text-xs font-semibold uppercase tracking-widest">
            Jogador
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/8 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 p-5 flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <PlayerPhoto src={player.photo} name={displayName} />
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-white text-lg font-black leading-tight">{displayName}</h2>
              <p className="text-white/40 text-sm mt-0.5">
                {player.age > 0 ? `${player.age} anos` : ""}
                {displayNumber != null ? ` · #${displayNumber}` : ""}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-md"
                  style={{ background: pos.bg, color: pos.color }}
                >
                  {player.positionPtBr}
                </span>
                {displayOverall != null && (
                  <span
                    className="text-xs font-black px-2.5 py-1 rounded-md"
                    style={overallColor(displayOverall)}
                  >
                    {displayOverall} OVR
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <StatBox
              label="Gols"
              value={stats.goals}
              icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 0110 10" /></svg>}
            />
            <StatBox
              label="Assist."
              value={stats.assists}
              icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>}
            />
            <StatBox
              label="Titular"
              value={stats.matchesAsStarter}
              icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
            />
            <StatBox
              label="Minutos"
              value={stats.totalMinutes}
              icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
          </div>

          <div
            className="p-4 rounded-2xl flex flex-col gap-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-white/35 text-xs font-semibold uppercase tracking-wider">Editar estatísticas</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { field: "goals", label: "Gols" },
                  { field: "assists", label: "Assistências" },
                  { field: "matchesAsStarter", label: "Titular" },
                  { field: "totalMinutes", label: "Minutos" },
                ] as Array<{ field: "goals" | "assists" | "matchesAsStarter" | "totalMinutes"; label: string }>
              ).map(({ field, label }) => (
                <div key={field} className="flex flex-col gap-1">
                  <label className="text-white/35 text-xs">{label}</label>
                  <input
                    type="number"
                    min={0}
                    value={stats[field]}
                    onChange={(e) => updateStat(field, parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-white text-sm font-semibold focus:outline-none glass tabular-nums"
                  />
                </div>
              ))}
            </div>
          </div>

          <div
            className="p-4 rounded-2xl flex flex-col gap-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-white/35 text-xs font-semibold uppercase tracking-wider">Humor do Jogador</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MOOD_LABELS) as Mood[]).map((m) => {
                const c = MOOD_COLORS[m];
                const active = stats.mood === m;
                return (
                  <button
                    key={m}
                    onClick={() => updateMood(m)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150"
                    style={{
                      background: active ? c.bg : "rgba(255,255,255,0.04)",
                      color: active ? c.color : "rgba(255,255,255,0.35)",
                      border: active ? `1px solid ${c.color}44` : "1px solid rgba(255,255,255,0.06)",
                      transform: active ? "scale(1.04)" : "scale(1)",
                    }}
                  >
                    {MOOD_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="p-4 rounded-2xl flex flex-col gap-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-white/35 text-xs font-semibold uppercase tracking-wider">Moral com a Torcida</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FAN_MORAL_LABELS) as FanMoral[]).map((m) => {
                const c = FAN_MORAL_COLORS[m];
                const active = stats.fanMoral === m;
                return (
                  <button
                    key={m}
                    onClick={() => updateFanMoral(m)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150"
                    style={{
                      background: active ? c.bg : "rgba(255,255,255,0.04)",
                      color: active ? c.color : "rgba(255,255,255,0.35)",
                      border: active ? `1px solid ${c.color}44` : "1px solid rgba(255,255,255,0.06)",
                      transform: active ? "scale(1.04)" : "scale(1)",
                    }}
                  >
                    {FAN_MORAL_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <button
              onClick={() => {
                setEditName(displayName);
                setEditNumber(String(displayNumber ?? ""));
                setEditOverall(String(displayOverall ?? ""));
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
                <div className="grid grid-cols-2 gap-2">
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
