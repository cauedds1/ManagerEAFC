import { useState, useMemo } from "react";
import type { SquadPlayer, PositionPtBr } from "@/lib/squadCache";
import { migratePositionOverride } from "@/lib/squadCache";
import type { PlayerOverride, OvrHistoryEntry } from "@/types/playerStats";
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
import { getMomentos, type Momento } from "@/lib/momentoStorage";

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

function PlayerPhoto({ src, name, size = 72 }: { src: string; name: string; size?: number }) {
  const [err, setErr] = useState(!src);
  const initials = name.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className="rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center"
      style={{
        width: size, height: size,
        background: "rgba(var(--club-primary-rgb),0.1)",
        border: "2px solid rgba(var(--club-primary-rgb),0.2)",
      }}
    >
      {!err ? (
        <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setErr(true)} />
      ) : (
        <span className="text-white/50 font-black" style={{ fontSize: size * 0.3 }}>{initials}</span>
      )}
    </div>
  );
}

interface LabeledInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}

function LabeledInput({ label, value, onChange, type = "text", min, max, placeholder }: LabeledInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-white/40 text-xs font-semibold tracking-wide uppercase">{label}</label>
      <input
        type={type}
        min={min}
        max={max}
        value={value}
        placeholder={placeholder ?? "—"}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl text-white text-sm font-semibold focus:outline-none transition-colors"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.09)",
          fontSize: 16,
        }}
        onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(var(--club-primary-rgb),0.5)"; }}
        onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.09)"; }}
      />
    </div>
  );
}

interface PlayerDetailPanelProps {
  player: SquadPlayer;
  careerId: string;
  seasonId?: string;
  override?: PlayerOverride;
  onClose: () => void;
  onUpdated: () => void;
  onRemove?: () => void;
  isDemo?: boolean;
}

type Tab = "stats" | "edit" | "momentos";

export function PlayerDetailPanel({
  player,
  careerId,
  seasonId,
  override,
  onClose,
  onUpdated,
  onRemove,
  isDemo,
}: PlayerDetailPanelProps) {
  const [tab, setTab] = useState<Tab>("stats");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [stats, setStatsState] = useState(() => getPlayerStats(careerId, player.id));

  const playerMomentos = useMemo<Momento[]>(() => {
    if (!seasonId) return [];
    return getMomentos(seasonId).filter((m) => m.playerIds?.includes(player.id));
  }, [seasonId, player.id]);

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

  const displayName     = override?.nameOverride ?? player.name;
  const displayNumber   = override?.shirtNumber ?? player.number;
  const displayOverall  = override?.overall;
  const displayPosition = (migratePositionOverride(override?.positionOverride) ?? player.positionPtBr) as PositionPtBr;
  const displayPhoto    = override?.photoOverride ?? player.photo;

  const [editName,     setEditName]     = useState(displayName);
  const [editNumber,   setEditNumber]   = useState(String(displayNumber ?? ""));
  const [editOverall,  setEditOverall]  = useState(String(displayOverall ?? ""));
  const [editSalary,   setEditSalary]   = useState(String(override?.salary ?? ""));
  const [editPosition, setEditPosition] = useState<PositionPtBr>(displayPosition);
  const [editPhoto,    setEditPhoto]    = useState(override?.photoOverride ?? "");
  const [photoPreviewErr, setPhotoPreviewErr] = useState(false);

  const pos      = POS_STYLE[displayPosition] ?? POS_STYLE.MID;
  const moodStyle = MOOD_COLORS[stats.mood];
  const fanStyle  = FAN_MORAL_COLORS[stats.fanMoral];

  const saveEdit = (logHistory = false) => {
    const numberVal  = parseInt(editNumber, 10);
    const overallVal = parseInt(editOverall, 10);
    const salaryVal  = parseInt(editSalary, 10);
    setPlayerOverride(careerId, player.id, {
      nameOverride:     editName.trim() || undefined,
      photoOverride:    editPhoto.trim() || undefined,
      shirtNumber:      !isNaN(numberVal)  && editNumber.trim()  ? numberVal                              : undefined,
      overall:          !isNaN(overallVal) && editOverall.trim() ? Math.max(1, Math.min(99, overallVal))  : undefined,
      salary:           !isNaN(salaryVal)  && editSalary.trim()  ? Math.max(0, salaryVal)                 : undefined,
      positionOverride: editPosition !== player.positionPtBr     ? editPosition                           : undefined,
    }, logHistory);
    setTab("stats");
    onUpdated();
  };

  const cancelEdit = () => {
    setEditName(displayName);
    setEditNumber(String(displayNumber ?? ""));
    setEditOverall(String(displayOverall ?? ""));
    setEditSalary(String(override?.salary ?? ""));
    setEditPosition(displayPosition);
    setEditPhoto(override?.photoOverride ?? "");
    setPhotoPreviewErr(false);
    setTab("stats");
  };

  const updateStat = (field: "goals" | "assists" | "matchesAsStarter" | "totalMinutes", val: number) => {
    const updated = { ...stats, [field]: Math.max(0, val) };
    setPlayerStats(careerId, player.id, updated);
    setStatsState(updated);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex min-h-full items-start justify-center p-4 py-6">
      <div
        className="w-full flex flex-col rounded-2xl animate-slide-up overflow-hidden"
        style={{
          maxWidth: 520,
          background: "var(--app-bg-lighter, #141024)",
          border: "1px solid var(--surface-border)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-start justify-between px-6 pt-6 pb-5 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--surface-border)" }}
        >
          <div className="flex items-center gap-4 min-w-0">
            <PlayerPhoto src={displayPhoto} name={displayName} size={72} />
            <div className="flex-1 min-w-0">
              <h2 className="text-white text-lg font-black leading-tight truncate">{displayName}</h2>
              <p className="text-white/40 text-sm mt-0.5">
                {player.age > 0 ? `${player.age} anos` : ""}
                {displayNumber != null ? ` · #${displayNumber}` : ""}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="text-xs font-bold px-2.5 py-0.5 rounded-lg"
                  style={{ background: pos.bg, color: pos.color }}
                >
                  {displayPosition}
                </span>
                {displayOverall != null && (
                  <span
                    className="text-xs font-black px-2.5 py-0.5 rounded-lg"
                    style={overallColor(displayOverall)}
                  >
                    {displayOverall} OVR
                  </span>
                )}
                {override?.salary != null && override.salary > 0 && (
                  <span
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-lg"
                    style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}
                  >
                    €{override.salary.toLocaleString("pt-BR")}k/sem
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 transition-all flex-shrink-0 ml-3"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 px-6 pt-4 pb-0 flex-shrink-0 overflow-x-auto">
          {([
            { key: "stats",    label: "Estatísticas" },
            ...(playerMomentos.length > 0 ? [{ key: "momentos", label: `Momentos (${playerMomentos.length})` }] : []),
            ...(!isDemo ? [{ key: "edit", label: "Editar Jogador" }] : []),
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                if (key === "edit") {
                  setEditName(displayName);
                  setEditNumber(String(displayNumber ?? ""));
                  setEditOverall(String(displayOverall ?? ""));
                  setEditSalary(String(override?.salary ?? ""));
                  setEditPosition(displayPosition);
                  setEditPhoto(override?.photoOverride ?? "");
                  setPhotoPreviewErr(false);
                }
                setTab(key);
              }}
              className="flex-shrink-0 flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap"
              style={tab === key
                ? { background: "var(--club-gradient)", color: "#fff", boxShadow: "0 2px 12px rgba(var(--club-primary-rgb),0.3)" }
                : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-5 flex flex-col gap-4">

            {tab === "stats" && (
              <>
                {/* Humor / Torcida */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Humor",   badge: MOOD_LABELS[stats.mood],      style: moodStyle },
                    { label: "Torcida", badge: FAN_MORAL_LABELS[stats.fanMoral], style: fanStyle },
                  ].map(({ label, badge, style }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between px-4 py-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <span className="text-white/35 text-xs font-semibold uppercase tracking-wider">{label}</span>
                      <span
                        className="text-xs font-bold px-2.5 py-0.5 rounded-lg"
                        style={{ background: style.bg, color: style.color }}
                      >
                        {badge}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Computed stats */}
                <div
                  className="grid grid-cols-3 rounded-xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {[
                    {
                      label: "Nota Média",
                      value: avgRating ?? "—",
                      color: ratingColor,
                      note:  avgRating ? `${stats.recentRatings?.length ?? 0} jogos` : "sem dados",
                    },
                    {
                      label: "Partidas",
                      value: totalMatches,
                      color: "rgba(255,255,255,0.85)",
                      note:  `${stats.matchesAsStarter ?? 0}T · ${stats.matchesAsSubstitute ?? 0}B`,
                    },
                    {
                      label: "Cartões",
                      value: (stats.yellowCards ?? 0) + (stats.redCards ?? 0) > 0
                        ? `${stats.yellowCards ?? 0}🟡 ${stats.redCards ?? 0}🔴`
                        : "—",
                      color: (stats.yellowCards ?? 0) >= 3 || (stats.redCards ?? 0) > 0
                        ? "#fb923c"
                        : "rgba(255,255,255,0.35)",
                      note:  (stats.totalOwnGoals ?? 0) > 0 ? `${stats.totalOwnGoals} gol c.` : "limpo",
                    },
                  ].map((item, i) => (
                    <div
                      key={item.label}
                      className="flex flex-col items-center gap-1 py-4 px-2"
                      style={i < 2 ? { borderRight: "1px solid rgba(255,255,255,0.06)" } : {}}
                    >
                      <span className="text-lg font-black tabular-nums leading-none" style={{ color: item.color }}>
                        {item.value}
                      </span>
                      <span className="text-white/40 text-[11px] font-semibold mt-0.5">{item.label}</span>
                      <span className="text-white/20 text-[10px]">{item.note}</span>
                    </div>
                  ))}
                </div>

                {/* Editable stats */}
                <div>
                  <p className="text-white/25 text-xs font-semibold uppercase tracking-wider mb-3">Registrar</p>
                  <div className="grid grid-cols-4 gap-2.5">
                    {([
                      { label: "Gols",    field: "goals"            as const },
                      { label: "Assist.", field: "assists"          as const },
                      { label: "Titular", field: "matchesAsStarter" as const },
                      { label: "Minutos", field: "totalMinutes"     as const },
                    ]).map(({ label, field }) => (
                      <div
                        key={field}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <span className="text-white text-xl font-black tabular-nums leading-none">
                          {stats[field]}
                        </span>
                        <span className="text-white/35 text-[10px] text-center leading-tight font-semibold">
                          {label}
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={stats[field]}
                          onChange={(e) => updateStat(field, parseInt(e.target.value, 10) || 0)}
                          className="w-full px-1.5 py-1.5 rounded-lg text-white/70 text-xs font-semibold focus:outline-none text-center tabular-nums transition-colors"
                          style={{
                            background: "rgba(255,255,255,0.07)",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                          onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(var(--club-primary-rgb),0.5)"; }}
                          onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {onRemove && !isDemo && (
                  <div
                    className="mt-1 p-3 rounded-xl flex items-center justify-between gap-3"
                    style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-red-400/80">Remover do Elenco</p>
                      <p className="text-[10px] text-white/25 leading-snug mt-0.5">
                        {confirmRemove ? "Confirma a remoção? Essa ação não pode ser desfeita." : "Remove o jogador da visualização do elenco."}
                      </p>
                    </div>
                    {confirmRemove ? (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => setConfirmRemove(false)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white/50 transition-all hover:text-white/80"
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => { onRemove(); onClose(); }}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-red-400 transition-all hover:opacity-80"
                          style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}
                        >
                          Confirmar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(true)}
                        className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-red-400/70 transition-all hover:text-red-400"
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {tab === "momentos" && (
              <div className="flex flex-col gap-3">
                {playerMomentos.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <svg className="w-6 h-6 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-white/40 text-sm">Nenhum momento com {displayName}</p>
                  </div>
                ) : (
                  playerMomentos.map((m) => (
                    <div
                      key={m.id}
                      className="flex gap-3 items-start rounded-xl p-3"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0 bg-black/30">
                        {m.mediaType === "video" ? (
                          <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(124,92,252,0.12)" }}>
                            <svg className="w-6 h-6 text-purple-400/70" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        ) : (
                          <img src={m.photoDataUrl} alt={m.title} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <p className="text-white text-sm font-bold leading-snug line-clamp-2">{m.title}</p>
                        <p className="text-white/35 text-xs">🗓 {m.gameDate}</p>
                      </div>
                      <button
                        type="button"
                        title="Ver na aba Momentos"
                        onClick={() => {
                          document.dispatchEvent(
                            new CustomEvent("fc:open-momentos", { detail: { momentoId: m.id } })
                          );
                          onClose();
                        }}
                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white transition-colors"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "edit" && (
              <div className="flex flex-col gap-4">
                <LabeledInput
                  label="Nome exibido"
                  value={editName}
                  onChange={setEditName}
                  placeholder={player.name}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-white/40 text-xs font-semibold tracking-wide uppercase">Foto do jogador</label>
                  <div className="flex gap-3 items-start">
                    <div
                      className="flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
                      style={{ width: 52, height: 52, background: "rgba(var(--club-primary-rgb),0.1)", border: "2px solid rgba(var(--club-primary-rgb),0.2)" }}
                    >
                      {editPhoto.trim() && !photoPreviewErr ? (
                        <img
                          src={editPhoto.trim()}
                          alt="preview"
                          className="w-full h-full object-cover"
                          onError={() => setPhotoPreviewErr(true)}
                          onLoad={() => setPhotoPreviewErr(false)}
                        />
                      ) : (
                        <span className="text-white/30 font-black text-base">
                          {displayName.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <input
                        type="url"
                        value={editPhoto}
                        onChange={(e) => { setEditPhoto(e.target.value); setPhotoPreviewErr(false); }}
                        placeholder="https://... (URL da foto)"
                        className="w-full px-3 py-2.5 rounded-xl text-white text-sm font-semibold focus:outline-none transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.09)",
                        }}
                        onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(var(--club-primary-rgb),0.5)"; }}
                        onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.09)"; }}
                      />
                      {photoPreviewErr && editPhoto.trim() && (
                        <p className="text-[11px] text-red-400/70">URL inválida ou imagem não carregou</p>
                      )}
                      {editPhoto.trim() && !photoPreviewErr && (
                        <button
                          type="button"
                          onClick={() => { setEditPhoto(""); setPhotoPreviewErr(false); }}
                          className="self-start text-[11px] text-white/30 hover:text-white/60 transition-colors"
                        >
                          Remover foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <LabeledInput
                    label="Número"
                    value={editNumber}
                    onChange={setEditNumber}
                    type="number"
                    min={1}
                    max={99}
                  />
                  <LabeledInput
                    label="Overall"
                    value={editOverall}
                    onChange={setEditOverall}
                    type="number"
                    min={1}
                    max={99}
                  />
                  <LabeledInput
                    label="Sal. (k/sem)"
                    value={editSalary}
                    onChange={setEditSalary}
                    type="number"
                    min={0}
                  />
                </div>

                {(() => {
                  const history: OvrHistoryEntry[] = override?.ovrHistory ?? [];
                  const currentOvr = override?.overall;
                  if (history.length === 0 && currentOvr == null) return null;
                  const allEntries = currentOvr != null
                    ? [...history, { ovr: currentOvr, date: override?.ovrUpdatedAt ?? Date.now() }]
                    : history;
                  if (allEntries.length < 2) return null;
                  const fmtDate = (ts: number) => {
                    const d = new Date(ts);
                    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(".", "");
                  };
                  return (
                    <div
                      className="p-3 rounded-xl flex flex-col gap-2"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider">Evolução de OVR</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {allEntries.map((entry, i) => {
                          const isLast = i === allEntries.length - 1;
                          const prevEntry = i > 0 ? allEntries[i - 1] : null;
                          const delta = prevEntry ? entry.ovr - prevEntry.ovr : 0;
                          const color = isLast ? overallColor(entry.ovr).color : "rgba(255,255,255,0.35)";
                          return (
                            <div key={i} className="flex items-center gap-1">
                              {i > 0 && (
                                <span style={{ color: delta > 0 ? "#34d399" : delta < 0 ? "#f87171" : "rgba(255,255,255,0.2)", fontSize: 10 }}>
                                  {delta > 0 ? `▲+${delta}` : delta < 0 ? `▼${delta}` : "→"}
                                </span>
                              )}
                              <div className="flex flex-col items-center">
                                <span
                                  className="font-black tabular-nums text-sm px-2 py-0.5 rounded-lg"
                                  style={{ color, background: isLast ? overallColor(entry.ovr).bg : "transparent" }}
                                >
                                  {entry.ovr}
                                </span>
                                {entry.date > 0 && (
                                  <span className="text-white/20 text-[9px] tabular-nums leading-tight">{fmtDate(entry.date)}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-col gap-1.5">
                  <label className="text-white/40 text-xs font-semibold tracking-wide uppercase">Posição</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["GOL","DEF","MID","ATA"] as PositionPtBr[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setEditPosition(p)}
                        className="py-2.5 rounded-xl text-xs font-bold transition-all duration-150"
                        style={editPosition === p
                          ? { background: POS_STYLE[p].bg, color: POS_STYLE[p].color, border: `1px solid ${POS_STYLE[p].color}55` }
                          : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.07)" }
                        }
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="flex gap-3 px-6 py-5 flex-shrink-0"
          style={{ borderTop: "1px solid var(--surface-border)" }}
        >
          {tab === "edit" ? (() => {
            const newOvrVal = parseInt(editOverall, 10);
            const newOvr = !isNaN(newOvrVal) && editOverall.trim() ? Math.max(1, Math.min(99, newOvrVal)) : undefined;
            const isOvrChange = displayOverall != null && newOvr != null && newOvr !== displayOverall;
            return (
              <>
                <button
                  onClick={cancelEdit}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/55 transition-all hover:text-white/80"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Cancelar
                </button>
                {isOvrChange ? (
                  <>
                    <button
                      onClick={() => saveEdit(false)}
                      className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.7)" }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => saveEdit(true)}
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                      style={{ background: "var(--club-gradient)", boxShadow: "0 4px 16px rgba(var(--club-primary-rgb),0.25)" }}
                    >
                      Atualizar OVR ↑
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => saveEdit(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                    style={{ background: "var(--club-gradient)", boxShadow: "0 4px 16px rgba(var(--club-primary-rgb),0.25)" }}
                  >
                    Salvar Alterações
                  </button>
                )}
              </>
            );
          })() : (
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
    </div>
  );
}
