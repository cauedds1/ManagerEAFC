import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import type { SquadPlayer } from "@/lib/squadCache";
import { getAllCachedPlayers } from "@/lib/squadCache";
import type {
  MatchRecord,
  PlayerMatchStats,
  MatchLocation,
  GoalEntry,
  OpponentGoalEntry,
  PenaltyShootout,
  PenaltyKick,
} from "@/types/match";
import { LOCATION_LABELS, LOCATION_ICONS, GOAL_TYPE_LABELS, GOAL_TYPE_ICONS, type GoalType } from "@/types/match";
import {
  addMatch,
  updateMatch,
  generateMatchId,
  generateGoalId,
  applyMatchToPlayerStats,
  getMatches,
} from "@/lib/matchStorage";
import { getCustomLineup } from "@/lib/lineupStorage";
import { getCachedClubList } from "@/lib/clubListCache";
import { pickBestEleven } from "@/components/FootballPitch";
import { searchStaticClubs } from "@/lib/staticClubList";

interface Props {
  careerId: string;
  seasonId: string;
  season: string;
  clubName: string;
  clubLogoUrl?: string | null;
  allPlayers: SquadPlayer[];
  onMatchAdded: (match: MatchRecord) => void;
  onMatchUpdated?: (match: MatchRecord) => void;
  onClose: () => void;
  competitions?: string[];
  editMatch?: MatchRecord;
}

interface MatchDraft {
  opponent: string;
  opponentLogoUrl: string | null;
  date: string;
  location: MatchLocation;
  tournament: string;
  stage: string;
  myScore: number;
  opponentScore: number;
  tablePosition: string;
  starterIds: number[];
  subIds: number[];
  playerStats: Record<number, PlayerMatchStats>;
  motmPlayerId: number | null;
  motmPlayerName: string;
  opponentGoals: OpponentGoalEntry[];
  myShots: number;
  opponentShots: number;
  possessionPct: number;
  penaltyGoals: number;
  observations: string;
  hasExtraTime: boolean;
  penaltyShootout: PenaltyShootout | null;
}

function draftKey(careerId: string, seasonId: string) {
  return `fc-match-draft-${careerId}-${seasonId}`;
}

function loadSavedDraft(careerId: string, seasonId: string): MatchDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(careerId, seasonId));
    if (!raw) return null;
    return JSON.parse(raw) as MatchDraft;
  } catch {
    return null;
  }
}

function clearSavedDraft(careerId: string, seasonId: string) {
  try { localStorage.removeItem(draftKey(careerId, seasonId)); } catch { /* noop */ }
}

export function hasSavedDraft(careerId: string, seasonId: string): boolean {
  const d = loadSavedDraft(careerId, seasonId);
  return !!(d && (d.opponent.trim() || d.starterIds.length > 0 || d.myScore > 0 || d.opponentScore > 0));
}

export function discardSavedDraft(careerId: string, seasonId: string) {
  clearSavedDraft(careerId, seasonId);
}

function mkDefault(startedOnBench = false): PlayerMatchStats {
  return {
    startedOnBench,
    rating: 7.0,
    goals: [],
    ownGoal: false,
    missedPenalty: false,
    injured: false,
    substituted: false,
    shots: undefined,
    shotsOnTargetPct: undefined,
    passes: undefined,
    passAccuracy: undefined,
    keyPasses: undefined,
    dribblesCompleted: undefined,
    dribblesSuccessRate: undefined,
    ballRecoveries: undefined,
    ballLosses: undefined,
    saves: undefined,
    penaltiesSaved: undefined,
  };
}

function getRatingColor(rating: number): { color: string; bg: string; label: string } {
  if (rating < 5.0) return { color: "#ef4444", bg: "rgba(239,68,68,0.18)", label: "Ruim" };
  if (rating < 6.0) return { color: "#f97316", bg: "rgba(249,115,22,0.18)", label: "Abaixo" };
  if (rating < 7.0) return { color: "#eab308", bg: "rgba(234,179,8,0.18)", label: "Regular" };
  if (rating < 8.0) return { color: "#84cc16", bg: "rgba(132,204,22,0.18)", label: "Bom" };
  if (rating < 9.0) return { color: "#22c55e", bg: "rgba(34,197,94,0.18)", label: "Ótimo" };
  return { color: "#10b981", bg: "rgba(16,185,129,0.18)", label: "Excelente" };
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function buildInitialDraft(seasonId: string): Pick<MatchDraft, "date" | "tournament" | "stage"> {
  const matches = getMatches(seasonId);
  if (matches.length === 0) return { date: todayIso(), tournament: "", stage: "" };
  const last = matches[matches.length - 1];
  const date = last.date ?? todayIso();
  const tournament = last.tournament ?? "";
  let stage = "";
  if (tournament) {
    const sameTournament = matches.filter((m) => m.tournament === tournament);
    const lastSame = sameTournament[sameTournament.length - 1];
    if (lastSame?.stage) {
      const m = lastSame.stage.match(/^(.+?\s)(\d+)(\s*.*)?$/);
      if (m) {
        stage = m[1] + (parseInt(m[2], 10) + 1) + (m[3] ?? "");
      } else {
        stage = "";
      }
    }
  }
  return { date, tournament, stage };
}


const TOURNAMENT_CHIPS = ["Campeonato Nacional", "Copa Nacional", "Champions League", "Europa League", "Liga Europa", "Liga dos Campeões", "Copa do Mundo de Clubes"];

function NumericInput({
  value,
  onChange,
  min = 0,
  max = 999,
  placeholder = "",
  className = "",
  emptyAsZero = false,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  emptyAsZero?: boolean;
}) {
  const toDisplay = (v: number | undefined) =>
    v != null && !(emptyAsZero && v === 0) ? String(v) : "";

  const [text, setText] = useState(toDisplay(value));

  useEffect(() => {
    const n = text === "" ? (emptyAsZero ? 0 : undefined) : parseInt(text, 10);
    if (value !== n) {
      setText(toDisplay(value));
    }
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, "");
        const stripped = raw === "" ? "" : String(parseInt(raw, 10));
        setText(stripped);
        if (stripped === "") { onChange(emptyAsZero ? 0 : undefined); return; }
        const n = Math.max(min, Math.min(max, parseInt(stripped, 10)));
        onChange(isNaN(n) ? (emptyAsZero ? 0 : undefined) : n);
      }}
      className={`px-2.5 py-1.5 rounded-xl text-white text-sm font-semibold focus:outline-none glass tabular-nums ${className}`}
    />
  );
}

function ScoreInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [raw, setRaw] = useState(value === 0 ? "0" : String(value));

  useEffect(() => {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n !== value) {
      setRaw(value === 0 ? "0" : String(value));
    }
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      onChange={(e) => {
        const s = e.target.value.replace(/[^\d]/g, "").slice(0, 2);
        const num = s === "" ? 0 : Math.min(99, parseInt(s, 10));
        setRaw(s === "" ? "0" : String(num));
        onChange(num);
      }}
      onFocus={(e) => { if (raw === "0") e.target.select(); }}
      onBlur={() => { if (raw === "") setRaw("0"); }}
      className="rounded-xl text-white font-black text-center focus:outline-none glass tabular-nums"
      style={{
        width: 60, height: 56, fontSize: 28,
        border: "1px solid rgba(255,255,255,0.1)",
        caretColor: "var(--club-primary)",
      }}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 w-full"
    >
      <div
        className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors duration-200"
        style={{ background: checked ? "var(--club-primary)" : "rgba(255,255,255,0.1)" }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
          style={{ left: checked ? "calc(100% - 1.125rem)" : "0.125rem" }}
        />
      </div>
      <span className="text-white/70 text-sm">{label}</span>
    </button>
  );
}

function RatingBar({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const rc = getRatingColor(value);
  const pct = (value / 10) * 100;
  const stops = ["0", "2", "4", "6", "8", "10"];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-white/50 text-xs font-medium uppercase tracking-wider">Nota</span>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: rc.bg, color: rc.color }}>{rc.label}</span>
          <span className="text-2xl font-black tabular-nums" style={{ color: rc.color }}>{value.toFixed(1)}</span>
        </div>
      </div>
      <div className="relative h-4 rounded-full overflow-visible" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-100"
          style={{
            width: `${pct}%`,
            background:
              value < 5 ? "linear-gradient(to right,#b91c1c,#ef4444)"
              : value < 6 ? "linear-gradient(to right,#ef4444,#f97316)"
              : value < 7 ? "linear-gradient(to right,#f97316,#eab308)"
              : value < 8 ? "linear-gradient(to right,#eab308,#84cc16)"
              : "linear-gradient(to right,#84cc16,#22c55e)",
          }}
        />
        <input
          type="range" min={0} max={100} step={1}
          value={Math.round(value * 10)}
          onChange={(e) => onChange(Number(e.target.value) / 10)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex justify-between">
        {stops.map((s) => (
          <span key={s} className="text-white/20 text-xs tabular-nums">{s}</span>
        ))}
      </div>
    </div>
  );
}

const GOAL_TYPES: GoalType[] = ["normal", "cabeca", "bicicleta", "fora_area", "falta", "penalti", "contra_ataque"];

function GoalEditor({
  goal, playerIndex, allParticipants, currentPlayerId, onChange, onRemove,
}: {
  goal: GoalEntry; playerIndex: number; allParticipants: SquadPlayer[];
  currentPlayerId: number; onChange: (g: GoalEntry) => void; onRemove: () => void;
}) {
  const others = allParticipants.filter((p) => p.id !== currentPlayerId);
  const selectedType = goal.goalType ?? "normal";
  return (
    <div className="glass rounded-xl p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-base">{GOAL_TYPE_ICONS[selectedType]}</span>
        <span className="text-white/50 text-xs">Gol {playerIndex + 1}</span>
        <button type="button" onClick={onRemove} className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs">×</button>
      </div>

      {/* Forma do gol */}
      <div className="space-y-1.5">
        <label className="text-white/40 text-[11px] font-semibold uppercase tracking-wide">Forma do gol</label>
        <div className="flex flex-wrap gap-1.5">
          {GOAL_TYPES.map((type) => {
            const active = selectedType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onChange({ ...goal, goalType: type })}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150"
                style={{
                  background: active ? "rgba(var(--club-primary-rgb),0.25)" : "rgba(255,255,255,0.05)",
                  color: active ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                  border: active ? "1px solid rgba(var(--club-primary-rgb),0.4)" : "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <span>{GOAL_TYPE_ICONS[type]}</span>
                <span>{GOAL_TYPE_LABELS[type]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-white/40 text-xs w-14 flex-shrink-0">Minuto</label>
        <NumericInput value={goal.minute} onChange={(v) => onChange({ ...goal, minute: v ?? 0 })} min={1} max={120} placeholder="Min" className="w-16" />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-white/40 text-xs w-14 flex-shrink-0">Assist.</label>
        <select
          value={goal.assistPlayerId ?? ""}
          onChange={(e) => onChange({ ...goal, assistPlayerId: e.target.value ? Number(e.target.value) : undefined })}
          className="flex-1 px-2.5 py-1.5 rounded-xl text-white text-sm focus:outline-none glass"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <option value="">Sem assistência</option>
          {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function OpponentGoalEditor({
  goal, index, opponentName, allSystemPlayers, onChange, onRemove,
}: {
  goal: OpponentGoalEntry; index: number; opponentName: string;
  allSystemPlayers: SquadPlayer[];
  onChange: (g: OpponentGoalEntry) => void; onRemove: () => void;
}) {
  return (
    <div className="glass rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">⚽</span>
        <span className="text-white/50 text-xs">{opponentName || "Adversário"} — Gol {index + 1}</span>
        <button type="button" onClick={onRemove} className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs">×</button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-white/40 text-xs w-16 flex-shrink-0">Minuto</label>
        <NumericInput value={goal.minute} onChange={(v) => onChange({ ...goal, minute: v ?? 0 })} min={1} max={120} placeholder="Min" className="w-16" />
      </div>
      <div className="space-y-1">
        <label className="text-white/40 text-xs">Jogador (opcional)</label>
        <MotmAutocomplete
          playerId={null}
          playerName={goal.playerName ?? ""}
          allPlayers={allSystemPlayers}
          onChange={(val) => onChange({ ...goal, playerName: val.playerName || undefined })}
        />
      </div>
    </div>
  );
}

function ClubBadge({ src, name, size = 28 }: { src: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div
        className="rounded-lg flex items-center justify-center font-black text-white/40 flex-shrink-0"
        style={{ width: size, height: size, background: "rgba(255,255,255,0.06)", fontSize: size / 3 }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return <img src={src} alt={name} style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} onError={() => setErr(true)} />;
}

function OpponentAutocomplete({
  value,
  onChange,
  onSelectClub,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelectClub: (logo: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (!value.trim() || !open) return [];
    const cached = getCachedClubList();
    if (cached && cached.length > 0) {
      const q = value.toLowerCase().trim();
      return cached
        .filter((c) => c.name.toLowerCase().includes(q) || c.league.toLowerCase().includes(q))
        .slice(0, 8);
    }
    return searchStaticClubs(value);
  }, [value, open]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Ex: Real Madrid"
        autoFocus
        className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      />
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-30 left-0 right-0 mt-1 rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: "rgba(15,15,20,0.97)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}
        >
          {suggestions.map((club) => (
            <button
              key={club.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(club.name);
                onSelectClub(club.logo || null);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/05 transition-colors text-left"
            >
              <ClubBadge src={club.logo} name={club.name} size={24} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{club.name}</p>
                <p className="text-white/35 text-xs truncate">{club.league}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerAvatar({ photo, name, size = 28 }: { photo?: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (photo && !err) {
    return (
      <img
        src={photo}
        alt={name}
        style={{ width: size, height: size, objectFit: "cover", borderRadius: "50%", flexShrink: 0 }}
        onError={() => setErr(true)}
      />
    );
  }
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "rgba(var(--club-primary-rgb),0.15)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 800,
      color: "var(--club-primary)",
    }}>{initials}</div>
  );
}

function MotmAutocomplete({
  playerId,
  playerName,
  allPlayers,
  onChange,
}: {
  playerId: number | null;
  playerName: string;
  allPlayers: SquadPlayer[];
  onChange: (val: { playerId: number | null; playerName: string }) => void;
}) {
  const selectedSquadPlayer = playerId != null ? allPlayers.find((p) => p.id === playerId) ?? null : null;
  const displayName = selectedSquadPlayer?.name ?? playerName;
  const [query, setQuery] = useState(displayName);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedSquadPlayer?.name ?? playerName);
  }, [playerId, playerName]);

  const suggestions = useMemo(() => {
    if (!query.trim() || !open) return [];
    const q = query.toLowerCase().trim();
    return allPlayers
      .filter((p) => p.name.toLowerCase().includes(q) || p.positionPtBr.toLowerCase().includes(q))
      .slice(0, 10);
  }, [query, open, allPlayers]);

  const handleSelect = (player: SquadPlayer) => {
    onChange({ playerId: player.id, playerName: player.name });
    setQuery(player.name);
    setOpen(false);
  };

  const handleClear = () => {
    onChange({ playerId: null, playerName: "" });
    setQuery("");
  };

  const handleBlur = () => {
    setTimeout(() => {
      setOpen(false);
      if (query.trim() && !selectedSquadPlayer) {
        onChange({ playerId: null, playerName: query.trim() });
      }
    }, 180);
  };

  const posColors: Record<string, string> = {
    GOL: "#f59e0b", DEF: "#3b82f6", MID: "#22c55e", ATA: "#ef4444",
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange({ playerId: null, playerName: "" });
            else if (selectedSquadPlayer) onChange({ playerId: null, playerName: e.target.value });
          }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder="Buscar ou digitar nome do jogador..."
          className="w-full px-3 py-2.5 pr-9 rounded-xl text-white text-sm focus:outline-none glass"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-30 left-0 right-0 mt-1 rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: "rgba(15,15,20,0.97)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)", maxHeight: 320, overflowY: "auto" }}
        >
          {suggestions.map((player) => (
            <button
              key={player.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(player)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
            >
              <PlayerAvatar photo={player.photo} name={player.name} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{player.name}</p>
                <p className="text-[10px] font-bold" style={{ color: posColors[player.positionPtBr] ?? "rgba(255,255,255,0.4)" }}>
                  {player.positionPtBr}
                </p>
              </div>
              {player.age && (
                <span className="text-white/35 text-xs tabular-nums flex-shrink-0">{player.age} anos</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerPicker({
  allPlayers,
  usedIds,
  onSelect,
  onClose,
}: {
  allPlayers: SquadPlayer[];
  usedIds: Set<number>;
  onSelect: (player: SquadPlayer) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const available = allPlayers.filter(
    (p) => !usedIds.has(p.id) && (filter === "" || p.name.toLowerCase().includes(filter.toLowerCase()) || p.positionPtBr.toLowerCase().includes(filter.toLowerCase()))
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: "rgba(12,12,18,0.98)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(24px)" }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-white/70 text-sm font-semibold">Adicionar jogador</p>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <input
          type="text"
          autoFocus
          placeholder="Buscar jogador..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-1.5 rounded-xl text-white text-sm focus:outline-none glass"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        />
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
        {available.length === 0 ? (
          <p className="text-white/25 text-xs text-center py-6">Nenhum jogador disponível</p>
        ) : (
          available.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/05 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(var(--club-primary-rgb),0.06)" }}>
                {p.photo ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover" /> : (
                  <svg viewBox="0 0 40 40" className="w-4 h-4 text-white/20" fill="currentColor">
                    <circle cx="20" cy="14" r="7" />
                    <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{p.name}</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                {p.positionPtBr}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function SearchablePlayerSelect({
  allUnused,
  allParticipants,
  selectedId,
  onChange,
}: {
  allUnused: SquadPlayer[];
  allParticipants: SquadPlayer[];
  selectedId?: number;
  onChange: (id: number | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedPlayer = selectedId != null
    ? (allUnused.find((p) => p.id === selectedId) ?? allParticipants.find((p) => p.id === selectedId))
    : null;

  const filtered = allUnused.filter((p) =>
    query === "" || p.name.toLowerCase().includes(query.toLowerCase()) || p.positionPtBr.toLowerCase().includes(query.toLowerCase())
  );

  const updateRect = useCallback(() => {
    if (containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, updateRect]);

  useEffect(() => {
    if (open) { updateRect(); setQuery(""); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open, updateRect]);

  if (selectedPlayer && !open) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-xl glass" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {selectedPlayer.photo ? (
            <img src={selectedPlayer.photo} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(var(--club-primary-rgb),0.08)" }}>
              <svg viewBox="0 0 40 40" className="w-3 h-3 text-white/20" fill="currentColor"><circle cx="20" cy="14" r="7"/><path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z"/></svg>
            </div>
          )}
          <span className="text-white/90 text-sm font-semibold truncate flex-1">{selectedPlayer.name}</span>
          <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>{selectedPlayer.positionPtBr}</span>
        </div>
        <button
          type="button"
          onClick={() => { onChange(undefined); }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/08 transition-colors flex-shrink-0"
          title="Remover"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/08 transition-colors flex-shrink-0"
          title="Trocar"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>
    );
  }

  const dropdownPortal = open && dropdownRect
    ? createPortal(
        <div
          style={{
            position: "fixed",
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            zIndex: 9999,
            borderRadius: "0.75rem",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            background: "rgba(12,12,18,0.98)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            {filtered.length === 0 ? (
              <p className="text-white/25 text-xs text-center py-5">Nenhum jogador disponível</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onChange(p.id); setOpen(false); setQuery(""); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.06] transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(var(--club-primary-rgb),0.06)" }}>
                    {p.photo ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover" /> : (
                      <svg viewBox="0 0 40 40" className="w-4 h-4 text-white/20" fill="currentColor"><circle cx="20" cy="14" r="7"/><path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z"/></svg>
                    )}
                  </div>
                  <span className="flex-1 text-white text-sm font-semibold truncate">{p.name}</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" }}>
                    {p.positionPtBr}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl glass" style={{ border: "1px solid rgba(var(--club-primary-rgb),0.35)" }}>
        <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar jogador..."
          className="flex-1 bg-transparent text-white/90 text-sm placeholder-white/25 focus:outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="text-white/30 hover:text-white/60">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {dropdownPortal}
    </div>
  );
}

function PlayerLineupRow({
  player,
  stats,
  isSub,
  allParticipants,
  allUnused,
  assistCount,
  onUpdate,
  onRemove,
  onSubPlayerAdded,
}: {
  player: SquadPlayer;
  stats: PlayerMatchStats;
  isSub: boolean;
  allParticipants: SquadPlayer[];
  allUnused: SquadPlayer[];
  assistCount: number;
  onUpdate: (patch: Partial<PlayerMatchStats>) => void;
  onRemove: () => void;
  onSubPlayerAdded?: (playerId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isGK = player.positionPtBr === "GOL";
  const rc = getRatingColor(stats.rating);

  const addGoal = () => {
    onUpdate({ goals: [...stats.goals, { id: generateGoalId(), minute: 0 }] });
  };
  const updateGoal = (idx: number, g: GoalEntry) => {
    onUpdate({ goals: stats.goals.map((gp, i) => (i === idx ? g : gp)) });
  };
  const removeGoal = (idx: number) => {
    onUpdate({ goals: stats.goals.filter((_, i) => i !== idx) });
  };

  const handleSubToggle = (on: boolean) => {
    if (!on) onUpdate({ substituted: false, substitutedAtMinute: undefined, substitutedInPlayerId: undefined });
    else onUpdate({ substituted: true });
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-2.5 text-left min-w-0"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(var(--club-primary-rgb),0.07)" }}>
            {player.photo ? (
              <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
            ) : (
              <svg viewBox="0 0 40 40" className="w-4 h-4 text-white/20" fill="currentColor">
                <circle cx="20" cy="14" r="7" />
                <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">{player.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs font-bold" style={{ color: rc.color }}>{stats.rating.toFixed(1)}</span>
              <span className="text-white/30 text-xs">{player.positionPtBr}</span>
              {isSub && <span className="text-xs" style={{ color: "#2dd4bf" }}>sub</span>}
              {stats.goals.length > 0 && <span className="text-xs text-white/60">⚽ {stats.goals.length}</span>}
              {assistCount > 0 && <span className="text-xs" style={{ color: "#60a5fa" }}>👟 {assistCount > 1 ? assistCount : ""}</span>}
              {stats.ownGoal && <span className="text-xs" style={{ color: "#f87171" }}>GC</span>}
              {stats.yellowCard && !stats.yellowCard2 && <span className="text-xs">🟨</span>}
              {stats.yellowCard2 && <span className="text-xs">🟨🟨</span>}
              {stats.redCard && !stats.yellowCard2 && <span className="text-xs">🟥</span>}
              {stats.substituted && <span className="text-xs text-white/40">🔄</span>}
              {stats.injured && <span className="text-xs text-white/40">🚑</span>}
            </div>
          </div>
          <svg
            className="w-4 h-4 text-white/25 flex-shrink-0 transition-transform duration-200"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0 text-lg leading-none"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <RatingBar value={stats.rating} onChange={(v) => onUpdate({ rating: v })} />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/50 text-xs font-medium uppercase tracking-wider">Gols</span>
              <button
                type="button"
                onClick={addGoal}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }}
              >
                + Gol
              </button>
            </div>
            {stats.goals.length === 0 ? (
              <p className="text-white/20 text-xs text-center py-1">Nenhum gol</p>
            ) : (
              <div className="space-y-2">
                {stats.goals.map((g, i) => (
                  <GoalEditor
                    key={g.id}
                    goal={g}
                    playerIndex={i}
                    allParticipants={allParticipants}
                    currentPlayerId={player.id}
                    onChange={(gp) => updateGoal(i, gp)}
                    onRemove={() => removeGoal(i)}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="text-white/50 text-xs font-medium uppercase tracking-wider block mb-2">Estatísticas</span>
            <div className="space-y-0">
              {[
                ...(!isGK ? [
                  {
                    label: "Finalizações", icon: "⚽",
                    node: (
                      <div className="flex items-center gap-1">
                        <NumericInput emptyAsZero value={stats.shots} onChange={(v) => onUpdate({ shots: v })} placeholder="Total" className="w-14 text-right" />
                        <NumericInput emptyAsZero value={stats.shotsOnTargetPct} onChange={(v) => onUpdate({ shotsOnTargetPct: v != null ? Math.min(100, v) : undefined })} max={100} placeholder="%" className="w-12 text-right" />
                        <span className="text-white/30 text-xs">%</span>
                      </div>
                    ),
                  },
                  {
                    label: "Passes", icon: "🎯",
                    node: (
                      <div className="flex items-center gap-1">
                        <NumericInput emptyAsZero value={stats.passes} onChange={(v) => onUpdate({ passes: v })} placeholder="Total" className="w-14 text-right" />
                        <NumericInput emptyAsZero value={stats.passAccuracy} onChange={(v) => onUpdate({ passAccuracy: v != null ? Math.min(100, v) : undefined })} max={100} placeholder="%" className="w-12 text-right" />
                        <span className="text-white/30 text-xs">%</span>
                        <NumericInput emptyAsZero value={stats.keyPasses} onChange={(v) => onUpdate({ keyPasses: v })} placeholder="Chave" className="w-14 text-right" />
                      </div>
                    ),
                  },
                  {
                    label: "Dribles", icon: "🔄",
                    node: (
                      <div className="flex items-center gap-1">
                        <NumericInput emptyAsZero value={stats.dribblesCompleted} onChange={(v) => onUpdate({ dribblesCompleted: v })} placeholder="Dribles" className="w-16 text-right" />
                        <NumericInput emptyAsZero value={stats.dribblesSuccessRate} onChange={(v) => onUpdate({ dribblesSuccessRate: v != null ? Math.min(100, v) : undefined })} max={100} placeholder="%" className="w-12 text-right" />
                        <span className="text-white/30 text-xs">%</span>
                      </div>
                    ),
                  },
                  {
                    label: "Rec. / Perdas", icon: "🛡️",
                    node: (
                      <div className="flex items-center gap-1">
                        <NumericInput emptyAsZero value={stats.ballRecoveries} onChange={(v) => onUpdate({ ballRecoveries: v })} placeholder="Rec." className="w-14 text-right" />
                        <span className="text-white/20 text-xs">|</span>
                        <NumericInput emptyAsZero value={stats.ballLosses} onChange={(v) => onUpdate({ ballLosses: v })} placeholder="Perda" className="w-14 text-right" />
                      </div>
                    ),
                  },
                ] : []),
                ...(isGK ? [
                  { label: "Defesas", icon: "🧤", node: <NumericInput emptyAsZero value={stats.saves} onChange={(v) => onUpdate({ saves: v })} placeholder="Total" className="w-16 text-right" /> },
                  { label: "Pên. Def.", icon: "🥅", node: <NumericInput emptyAsZero value={stats.penaltiesSaved} onChange={(v) => onUpdate({ penaltiesSaved: v })} placeholder="—" className="w-16 text-right" /> },
                ] : []),
              ].map(({ label, icon, node }) => (
                <div key={label} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <span className="text-base w-6 text-center flex-shrink-0">{icon}</span>
                  <span className="text-white/55 text-xs flex-shrink-0 w-24">{label}</span>
                  <div className="flex-1 flex items-center justify-end">{node}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-white/50 text-xs font-medium uppercase tracking-wider block mb-2">Eventos</span>
            <div className="space-y-2">
              <div className="glass rounded-xl p-3 space-y-2">
                <Toggle checked={stats.ownGoal} onChange={(v) => onUpdate({ ownGoal: v, ownGoalMinute: v ? stats.ownGoalMinute : undefined })} label="Gol contra" />
                {stats.ownGoal && (
                  <div className="flex items-center gap-2 pl-11">
                    <span className="text-white/40 text-xs">Minuto:</span>
                    <NumericInput value={stats.ownGoalMinute} onChange={(v) => onUpdate({ ownGoalMinute: v })} min={1} max={120} placeholder="Min" className="w-16" />
                  </div>
                )}
              </div>
              <div className="glass rounded-xl p-3 space-y-2">
                <Toggle checked={stats.missedPenalty} onChange={(v) => onUpdate({ missedPenalty: v, missedPenaltyMinute: v ? stats.missedPenaltyMinute : undefined })} label="Pênalti perdido" />
                {stats.missedPenalty && (
                  <div className="flex items-center gap-2 pl-11">
                    <span className="text-white/40 text-xs">Minuto:</span>
                    <NumericInput value={stats.missedPenaltyMinute} onChange={(v) => onUpdate({ missedPenaltyMinute: v })} min={1} max={120} placeholder="Min" className="w-16" />
                  </div>
                )}
              </div>
              <div className="glass rounded-xl p-3 space-y-2">
                <Toggle
                  checked={stats.yellowCard ?? false}
                  onChange={(v) => {
                    if (!v) {
                      onUpdate({
                        yellowCard: false,
                        yellowCardMinute: undefined,
                        yellowCard2: false,
                        yellowCard2Minute: undefined,
                        ...(stats.yellowCard2 ? { redCard: false } : {}),
                      });
                    } else {
                      onUpdate({ yellowCard: true });
                    }
                  }}
                  label="Cartão amarelo"
                />
                {stats.yellowCard && (
                  <div className="pl-11 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-xs w-20 flex-shrink-0">1º amarelo:</span>
                      <NumericInput value={stats.yellowCardMinute} onChange={(v) => onUpdate({ yellowCardMinute: v })} min={1} max={120} placeholder="Min" className="w-16" />
                    </div>
                    <Toggle
                      checked={stats.yellowCard2 ?? false}
                      onChange={(v) => {
                        if (v) onUpdate({ yellowCard2: true, redCard: true });
                        else onUpdate({ yellowCard2: false, yellowCard2Minute: undefined, redCard: false });
                      }}
                      label="2º Amarelo → 🟥 Expulsão"
                    />
                    {stats.yellowCard2 && (
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 text-xs w-20 flex-shrink-0">2º amarelo:</span>
                        <NumericInput value={stats.yellowCard2Minute} onChange={(v) => onUpdate({ yellowCard2Minute: v })} min={1} max={120} placeholder="Min" className="w-16" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="glass rounded-xl p-3 space-y-2">
                {stats.yellowCard2 ? (
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                      background: "rgba(239,68,68,0.35)", border: "1px solid rgba(239,68,68,0.5)",
                      display: "flex", alignItems: "center", padding: "2px",
                    }}>
                      <div style={{ width: 16, height: 16, borderRadius: 8, background: "#ef4444", marginLeft: "auto" }} />
                    </div>
                    <span className="text-white/55 text-sm flex-1">Cartão vermelho</span>
                    <span className="text-xs text-white/30 italic">
                      2º amarelo{stats.yellowCard2Minute ? ` — ${stats.yellowCard2Minute}'` : ""}
                    </span>
                  </div>
                ) : (
                  <>
                    <Toggle
                      checked={stats.redCard ?? false}
                      onChange={(v) => onUpdate({ redCard: v, redCardMinute: v ? stats.redCardMinute : undefined })}
                      label="Cartão vermelho"
                    />
                    {stats.redCard && (
                      <div className="flex items-center gap-2 pl-11">
                        <span className="text-white/40 text-xs">Minuto:</span>
                        <NumericInput value={stats.redCardMinute} onChange={(v) => onUpdate({ redCardMinute: v })} min={1} max={120} placeholder="Min" className="w-16" />
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="glass rounded-xl p-3 space-y-2">
                <Toggle checked={stats.injured} onChange={(v) => onUpdate({ injured: v, injuryMinute: v ? stats.injuryMinute : undefined })} label="Lesionado" />
                {stats.injured && (
                  <div className="flex items-center gap-2 pl-11">
                    <span className="text-white/40 text-xs">Minuto:</span>
                    <NumericInput value={stats.injuryMinute} onChange={(v) => onUpdate({ injuryMinute: v })} min={1} max={120} placeholder="Min" className="w-16" />
                  </div>
                )}
              </div>
              {!isSub && (
                <div className="glass rounded-xl p-3 space-y-2">
                  <Toggle checked={stats.substituted} onChange={handleSubToggle} label="Substituído" />
                  {stats.substituted && (
                    <div className="space-y-2 pl-11">
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 text-xs">Minuto:</span>
                        <NumericInput value={stats.substitutedAtMinute} onChange={(v) => onUpdate({ substitutedAtMinute: v })} min={1} max={120} placeholder="Min" className="w-16" />
                      </div>
                      <div>
                        <span className="text-white/40 text-xs block mb-1">Quem entrou:</span>
                        <SearchablePlayerSelect
                          allUnused={allUnused}
                          allParticipants={allParticipants}
                          selectedId={stats.substitutedInPlayerId}
                          onChange={(newId) => {
                            onUpdate({ substitutedInPlayerId: newId });
                            if (newId) onSubPlayerAdded?.(newId);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RegistrarPartidaModal({
  careerId,
  seasonId,
  season,
  clubName,
  clubLogoUrl,
  allPlayers,
  onMatchAdded,
  onMatchUpdated,
  onClose,
  competitions,
  editMatch,
}: Props) {
  const isEditMode = editMatch != null;
  const [saving, setSaving] = useState(false);
  const [pickerMode, setPickerMode] = useState<"starter" | "sub" | null>(null);

  const allSystemPlayers = useMemo(() => {
    const cached = getAllCachedPlayers();
    const ownIds = new Set(allPlayers.map((p) => p.id));
    const extras = cached.filter((p) => !ownIds.has(p.id));
    return [...allPlayers, ...extras].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [allPlayers]);

  const initial = useMemo(() => buildInitialDraft(seasonId), [seasonId]);

  const [draft, setDraft] = useState<MatchDraft>(() => {
    if (editMatch) {
      return {
        opponent: editMatch.opponent,
        opponentLogoUrl: editMatch.opponentLogoUrl ?? null,
        date: editMatch.date ?? initial.date,
        location: editMatch.location ?? "casa",
        tournament: editMatch.tournament ?? initial.tournament,
        stage: editMatch.stage ?? initial.stage,
        myScore: editMatch.myScore,
        opponentScore: editMatch.opponentScore,
        tablePosition: editMatch.tablePositionBefore != null ? String(editMatch.tablePositionBefore) : "",
        starterIds: editMatch.starterIds,
        subIds: editMatch.subIds,
        playerStats: editMatch.playerStats,
        motmPlayerId: editMatch.motmPlayerId ?? null,
        motmPlayerName: editMatch.motmPlayerName ?? (editMatch.motmPlayerId != null ? allPlayers.find((p) => p.id === editMatch.motmPlayerId)?.name ?? "" : ""),
        opponentGoals: editMatch.opponentGoals ?? [],
        myShots: editMatch.matchStats?.myShots ?? 0,
        opponentShots: editMatch.matchStats?.opponentShots ?? 0,
        possessionPct: editMatch.matchStats?.possessionPct ?? 50,
        penaltyGoals: editMatch.matchStats?.penaltyGoals ?? 0,
        observations: editMatch.observations ?? "",
        hasExtraTime: editMatch.hasExtraTime ?? false,
        penaltyShootout: editMatch.penaltyShootout ?? null,
      };
    }
    const saved = loadSavedDraft(careerId, seasonId);
    if (saved) return { ...saved };
    return {
      opponent: "",
      opponentLogoUrl: null,
      date: initial.date,
      location: "casa",
      tournament: initial.tournament,
      stage: initial.stage,
      myScore: 0,
      opponentScore: 0,
      tablePosition: "",
      starterIds: [],
      subIds: [],
      playerStats: {},
      motmPlayerId: null,
      motmPlayerName: "",
      opponentGoals: [],
      myShots: 0,
      opponentShots: 0,
      possessionPct: 50,
      penaltyGoals: 0,
      observations: "",
      hasExtraTime: false,
      penaltyShootout: null,
    };
  });

  useEffect(() => {
    if (isEditMode) return;
    try { localStorage.setItem(draftKey(careerId, seasonId), JSON.stringify(draft)); } catch { /* noop */ }
  }, [draft, isEditMode, careerId, seasonId]);

  const onChange = useCallback((patch: Partial<MatchDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const updatePlayerStats = useCallback((playerId: number, patch: Partial<PlayerMatchStats>) => {
    setDraft((prev) => ({
      ...prev,
      playerStats: {
        ...prev.playerStats,
        [playerId]: { ...prev.playerStats[playerId], ...patch },
      },
    }));
  }, []);

  const addPlayer = useCallback((player: SquadPlayer, asSub: boolean) => {
    const isSub = asSub;
    setDraft((prev) => {
      if (prev.starterIds.includes(player.id) || prev.subIds.includes(player.id)) return prev;
      const nextStats = { ...prev.playerStats, [player.id]: mkDefault(isSub) };
      if (isSub) {
        return { ...prev, subIds: [...prev.subIds, player.id], playerStats: nextStats };
      } else {
        return { ...prev, starterIds: [...prev.starterIds, player.id], playerStats: nextStats };
      }
    });
    setPickerMode(null);
  }, []);

  const removePlayer = useCallback((playerId: number) => {
    setDraft((prev) => {
      const starterIds = prev.starterIds.filter((id) => id !== playerId);
      const subIds = prev.subIds.filter((id) => id !== playerId);
      const playerStats = { ...prev.playerStats };
      delete playerStats[playerId];
      const motmPlayerId = prev.motmPlayerId === playerId ? null : prev.motmPlayerId;
      const motmPlayerName = prev.motmPlayerId === playerId ? "" : prev.motmPlayerName;
      return { ...prev, starterIds, subIds, playerStats, motmPlayerId, motmPlayerName };
    });
  }, []);

  const handleSubPlayerAdded = useCallback((playerId: number) => {
    setDraft((prev) => {
      if (prev.starterIds.includes(playerId) || prev.subIds.includes(playerId)) return prev;
      const player = allPlayers.find((p) => p.id === playerId);
      if (!player) return prev;
      return {
        ...prev,
        subIds: [...prev.subIds, playerId],
        playerStats: { ...prev.playerStats, [playerId]: mkDefault(true) },
      };
    });
  }, [allPlayers]);

  const handleAutoFill = useCallback(() => {
    const saved = getCustomLineup(careerId);
    const ids = saved ?? (allPlayers.length > 0 ? pickBestEleven(allPlayers) : []);
    setDraft((prev) => {
      const nextStats = { ...prev.playerStats };
      const newStarters: number[] = [];
      for (const id of ids) {
        const exists = allPlayers.find((p) => p.id === id);
        if (!exists) continue;
        if (!prev.subIds.includes(id)) {
          newStarters.push(id);
          if (!nextStats[id]) nextStats[id] = mkDefault(false);
        }
      }
      return { ...prev, starterIds: newStarters, playerStats: nextStats };
    });
  }, [careerId, allPlayers]);

  const allParticipants = useMemo(
    () => [...draft.starterIds, ...draft.subIds].map((id) => allPlayers.find((p) => p.id === id)).filter((p): p is SquadPlayer => p != null),
    [draft.starterIds, draft.subIds, allPlayers]
  );

  const usedIds = useMemo(() => new Set([...draft.starterIds, ...draft.subIds]), [draft.starterIds, draft.subIds]);

  const allUnusedForSub = useCallback((excludeId: number) => {
    return allPlayers.filter((p) => !usedIds.has(p.id) && p.id !== excludeId);
  }, [allPlayers, usedIds]);

  const resultLabel = draft.myScore > draft.opponentScore ? "V" : draft.myScore < draft.opponentScore ? "D" : "E";
  const resultColor = draft.myScore > draft.opponentScore ? "#34d399" : draft.myScore < draft.opponentScore ? "#f87171" : "#94a3b8";

  const canSave = draft.opponent.trim().length > 0;

  const handleConfirm = useCallback(() => {
    if (!canSave || saving) return;
    setSaving(true);
    if (isEditMode && editMatch) {
      const updated: MatchRecord = {
        ...editMatch,
        date: draft.date,
        tournament: draft.tournament,
        stage: draft.stage,
        location: draft.location,
        opponent: draft.opponent.trim(),
        myScore: draft.myScore,
        opponentScore: draft.opponentScore,
        starterIds: draft.starterIds,
        subIds: draft.subIds,
        playerStats: draft.playerStats,
        matchStats: {
          myShots: draft.myShots,
          opponentShots: draft.opponentShots,
          possessionPct: draft.possessionPct,
          penaltyGoals: draft.penaltyGoals || undefined,
        },
        motmPlayerId: draft.motmPlayerId ?? undefined,
        motmPlayerName: draft.motmPlayerName.trim() || undefined,
        opponentGoals: draft.opponentGoals.length > 0 ? draft.opponentGoals : undefined,
        tablePositionBefore: draft.tablePosition ? Number(draft.tablePosition) : undefined,
        opponentLogoUrl: draft.opponentLogoUrl ?? undefined,
        hasExtraTime: draft.hasExtraTime || undefined,
        penaltyShootout: draft.penaltyShootout ?? undefined,
      };
      updateMatch(seasonId, updated);
      onMatchUpdated?.(updated);
      onClose();
    } else {
      const match: MatchRecord = {
        id: generateMatchId(),
        careerId,
        season,
        date: draft.date,
        tournament: draft.tournament,
        stage: draft.stage,
        location: draft.location,
        opponent: draft.opponent.trim(),
        myScore: draft.myScore,
        opponentScore: draft.opponentScore,
        starterIds: draft.starterIds,
        subIds: draft.subIds,
        playerStats: draft.playerStats,
        matchStats: {
          myShots: draft.myShots,
          opponentShots: draft.opponentShots,
          possessionPct: draft.possessionPct,
          penaltyGoals: draft.penaltyGoals || undefined,
        },
        motmPlayerId: draft.motmPlayerId ?? undefined,
        motmPlayerName: draft.motmPlayerName.trim() || undefined,
        opponentGoals: draft.opponentGoals.length > 0 ? draft.opponentGoals : undefined,
        tablePositionBefore: draft.tablePosition ? Number(draft.tablePosition) : undefined,
        opponentLogoUrl: draft.opponentLogoUrl ?? undefined,
        observations: draft.observations.trim() || undefined,
        hasExtraTime: draft.hasExtraTime || undefined,
        penaltyShootout: draft.penaltyShootout ?? undefined,
        createdAt: Date.now(),
      };
      addMatch(seasonId, match);
      applyMatchToPlayerStats(seasonId, draft.starterIds, draft.subIds, draft.playerStats);
      clearSavedDraft(careerId, seasonId);
      onMatchAdded(match);
      onClose();
    }
  }, [canSave, saving, isEditMode, editMatch, seasonId, careerId, season, draft, onMatchAdded, onMatchUpdated, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full sm:max-w-2xl flex flex-col rounded-2xl"
        style={{
          background: "rgba(12,12,20,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          maxHeight: "90vh",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: resultColor, boxShadow: `0 0 8px ${resultColor}` }}
            />
            <h2 className="text-white font-black text-base">{isEditMode ? "Editar Partida" : "Registrar Partida"}</h2>
            {draft.opponent && (
              <span className="text-white/40 text-sm truncate max-w-32">{draft.opponent}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Adversário */}
          <div className="space-y-1.5">
            <label className="text-white/40 text-xs font-medium uppercase tracking-wider">Adversário *</label>
            <OpponentAutocomplete
              value={draft.opponent}
              onChange={(v) => onChange({ opponent: v })}
              onSelectClub={(logo) => onChange({ opponentLogoUrl: logo })}
            />
          </div>

          {/* Placar */}
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {(() => {
              const isHome = draft.location !== "fora";
              const leftBadge = isHome
                ? <ClubBadge src={clubLogoUrl ?? null} name={clubName} size={36} />
                : <ClubBadge src={draft.opponentLogoUrl ?? null} name={draft.opponent || "?"} size={36} />;
              const leftName  = isHome ? clubName : (draft.opponent || "Adversário");
              const rightBadge = isHome
                ? <ClubBadge src={draft.opponentLogoUrl ?? null} name={draft.opponent || "?"} size={36} />
                : <ClubBadge src={clubLogoUrl ?? null} name={clubName} size={36} />;
              const rightName  = isHome ? (draft.opponent || "Adversário") : clubName;
              const leftInput  = isHome
                ? <ScoreInput value={draft.myScore} onChange={(v) => onChange({ myScore: v })} />
                : <ScoreInput value={draft.opponentScore} onChange={(v) => onChange({ opponentScore: v })} />;
              const rightInput = isHome
                ? <ScoreInput value={draft.opponentScore} onChange={(v) => onChange({ opponentScore: v })} />
                : <ScoreInput value={draft.myScore} onChange={(v) => onChange({ myScore: v })} />;
              return (
                <div className="flex items-center gap-3">
                  {/* Left team */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: 52 }}>
                    {leftBadge}
                    <span className="text-white/35 text-center font-medium leading-tight w-full truncate" style={{ fontSize: 10 }}>{leftName}</span>
                  </div>

                  {/* Score inputs + result */}
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      {leftInput}
                      <span className="text-white/20 font-light" style={{ fontSize: 22 }}>–</span>
                      {rightInput}
                    </div>
                    <span
                      className="text-xs font-bold px-3 py-0.5 rounded-full"
                      style={{
                        background: draft.myScore > draft.opponentScore ? "rgba(16,185,129,0.15)" : draft.myScore < draft.opponentScore ? "rgba(239,68,68,0.15)" : "rgba(148,163,184,0.1)",
                        color: resultColor,
                      }}
                    >
                      {draft.myScore > draft.opponentScore ? "Vitória" : draft.myScore < draft.opponentScore ? "Derrota" : "Empate"}
                    </span>
                  </div>

                  {/* Right team */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: 52 }}>
                    {rightBadge}
                    <span className="text-white/35 text-center font-medium leading-tight w-full truncate" style={{ fontSize: 10 }}>{rightName}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Prorrogação + Pênaltis */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onChange({ hasExtraTime: !draft.hasExtraTime });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex-shrink-0"
              style={{
                background: draft.hasExtraTime ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.05)",
                color: draft.hasExtraTime ? "#fbbf24" : "rgba(255,255,255,0.35)",
                border: draft.hasExtraTime ? "1px solid rgba(251,191,36,0.35)" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              ⏱ Prorrogação
            </button>
            <button
              type="button"
              onClick={() => {
                if (draft.penaltyShootout) {
                  onChange({ penaltyShootout: null });
                } else {
                  onChange({ penaltyShootout: { myScore: 0, opponentScore: 0, kicks: [] } });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex-shrink-0"
              style={{
                background: draft.penaltyShootout ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.05)",
                color: draft.penaltyShootout ? "#c084fc" : "rgba(255,255,255,0.35)",
                border: draft.penaltyShootout ? "1px solid rgba(168,85,247,0.35)" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              🥅 Pênaltis
            </button>
            {draft.hasExtraTime && !draft.penaltyShootout && (
              <span className="text-xs text-white/30 italic">+30 min para jogadores em campo</span>
            )}
          </div>

          {/* Seção de pênaltis */}
          {draft.penaltyShootout && (() => {
            const ps = draft.penaltyShootout;
            const allInField = [...draft.starterIds, ...draft.subIds].map((id) => allPlayers.find((p) => p.id === id)).filter((p): p is SquadPlayer => !!p);

            const updatePs = (patch: Partial<PenaltyShootout>) =>
              onChange({ penaltyShootout: { ...ps, ...patch } });

            const addKick = () =>
              updatePs({ kicks: [...ps.kicks, { scored: true }] });

            const updateKick = (idx: number, patch: Partial<PenaltyKick>) =>
              updatePs({ kicks: ps.kicks.map((k, i) => (i === idx ? { ...k, ...patch } : k)) });

            const removeKick = (idx: number) =>
              updatePs({ kicks: ps.kicks.filter((_, i) => i !== idx) });

            return (
              <div
                className="rounded-2xl p-4 space-y-4"
                style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}
              >
                <p className="text-white/50 text-xs font-bold uppercase tracking-wider">🥅 Disputa de Pênaltis</p>

                {/* Penalty score */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-white/30 text-xs text-center">{clubName}</span>
                    <ScoreInput
                      value={ps.myScore}
                      onChange={(v) => updatePs({ myScore: v })}
                    />
                  </div>
                  <span className="text-white/20 font-light flex-shrink-0" style={{ fontSize: 18 }}>×</span>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-white/30 text-xs text-center">{draft.opponent || "Adversário"}</span>
                    <ScoreInput
                      value={ps.opponentScore}
                      onChange={(v) => updatePs({ opponentScore: v })}
                    />
                  </div>
                </div>

                {/* Goalkeeper saves */}
                <div className="flex items-center gap-3">
                  <span className="text-white/40 text-xs font-medium flex-1">🧤 Defesas do goleiro</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updatePs({ goalkeeperSaves: Math.max(0, (ps.goalkeeperSaves ?? 0) - 1) })}
                      className="w-7 h-7 rounded-lg text-white/40 hover:text-white/80 transition-colors flex items-center justify-center font-bold"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    >−</button>
                    <span className="text-white/80 text-sm font-black tabular-nums w-5 text-center">{ps.goalkeeperSaves ?? 0}</span>
                    <button
                      type="button"
                      onClick={() => updatePs({ goalkeeperSaves: (ps.goalkeeperSaves ?? 0) + 1 })}
                      className="w-7 h-7 rounded-lg text-white/40 hover:text-white/80 transition-colors flex items-center justify-center font-bold"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    >+</button>
                  </div>
                </div>

                {/* Kicks list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white/30 text-xs font-medium uppercase tracking-wider">Cobradores ({ps.kicks.length})</span>
                    <button
                      type="button"
                      onClick={addKick}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc" }}
                    >
                      + Cobrador
                    </button>
                  </div>
                  {ps.kicks.length === 0 ? (
                    <p className="text-white/15 text-xs text-center py-2">Nenhum cobrador adicionado</p>
                  ) : (
                    <div className="space-y-1.5">
                      {ps.kicks.map((kick, idx) => {
                        const kickPlayer = kick.playerId != null ? allInField.find((p) => p.id === kick.playerId) : null;
                        return (
                          <div key={idx} className="flex items-center gap-2 rounded-xl px-2 py-1.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                            <span className="text-white/25 text-xs w-4 flex-shrink-0 tabular-nums">{idx + 1}.</span>
                            {/* Player select */}
                            <div className="flex-1 min-w-0">
                              <select
                                value={kick.playerId ?? ""}
                                onChange={(e) => updateKick(idx, { playerId: e.target.value ? Number(e.target.value) : undefined })}
                                className="w-full bg-transparent text-white text-xs focus:outline-none rounded-lg py-0.5"
                                style={{ border: "1px solid rgba(255,255,255,0.1)", padding: "2px 6px", background: "rgba(255,255,255,0.05)", color: kick.playerId ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)" }}
                              >
                                <option value="" style={{ background: "#1a1a2e" }}>Selecionar jogador...</option>
                                {allInField.map((p) => (
                                  <option key={p.id} value={p.id} style={{ background: "#1a1a2e" }}>{p.name} ({p.positionPtBr})</option>
                                ))}
                              </select>
                              {kickPlayer && (
                                <span className="text-[10px] text-white/30 block mt-0.5 px-1">{kickPlayer.positionPtBr}</span>
                              )}
                            </div>
                            {/* Scored/Missed toggle */}
                            <button
                              type="button"
                              onClick={() => updateKick(idx, { scored: !kick.scored })}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold flex-shrink-0 transition-all"
                              style={{
                                background: kick.scored ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                                color: kick.scored ? "#4ade80" : "#f87171",
                                border: kick.scored ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(239,68,68,0.35)",
                                minWidth: 70,
                              }}
                            >
                              {kick.scored ? "✓ Gol" : "✗ Erro"}
                            </button>
                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => removeKick(idx)}
                              className="w-6 h-6 flex items-center justify-center text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Data + Local */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium uppercase tracking-wider">Data</label>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => onChange({ date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass"
                style={{ border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium uppercase tracking-wider">Local</label>
              <div className="flex gap-2 h-[42px]">
                {(["casa", "fora", "neutro"] as MatchLocation[]).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => onChange({ location: loc })}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl font-semibold text-xs transition-all duration-200"
                    style={{
                      background: draft.location === loc ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.04)",
                      color: draft.location === loc ? "var(--club-primary)" : "rgba(255,255,255,0.35)",
                      border: draft.location === loc ? "1px solid rgba(var(--club-primary-rgb),0.4)" : "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <span>{LOCATION_ICONS[loc]}</span>
                    <span>{LOCATION_LABELS[loc]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Torneio + Rodada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium uppercase tracking-wider">Torneio</label>
              <input
                type="text"
                value={draft.tournament}
                onChange={(e) => onChange({ tournament: e.target.value })}
                placeholder="Ex: Premier League"
                className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              />
              <div className="flex flex-wrap gap-1">
                {(competitions && competitions.length > 0 ? competitions : TOURNAMENT_CHIPS).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange({ tournament: t })}
                    className="px-2 py-0.5 rounded-full text-xs transition-colors"
                    style={{
                      background: draft.tournament === t ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.05)",
                      color: draft.tournament === t ? "var(--club-primary)" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium uppercase tracking-wider">Estágio / Rodada</label>
              <input
                type="text"
                value={draft.stage}
                onChange={(e) => onChange({ stage: e.target.value })}
                placeholder="Ex: Rodada 15"
                className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              />
              <div className="space-y-1.5">
                <label className="text-white/40 text-xs font-medium uppercase tracking-wider">Posição na tabela</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={draft.tablePosition}
                  onChange={(e) => onChange({ tablePosition: e.target.value })}
                  placeholder="Ex: 3"
                  className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>
            </div>
          </div>

          {/* Escalação */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider">
                Titulares ({draft.starterIds.length})
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoFill}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                  style={{ background: "rgba(var(--club-primary-rgb),0.12)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Preencher auto
                </button>
                <button
                  type="button"
                  onClick={() => setPickerMode((m) => m === "starter" ? null : "starter")}
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-lg transition-all duration-200"
                  style={{
                    background: pickerMode === "starter" ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.06)",
                    color: pickerMode === "starter" ? "var(--club-primary)" : "rgba(255,255,255,0.5)",
                    border: pickerMode === "starter" ? "1px solid rgba(var(--club-primary-rgb),0.4)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                  title="Adicionar titular"
                >
                  +
                </button>
              </div>
            </div>

            {pickerMode === "starter" && (
              <PlayerPicker
                allPlayers={allPlayers}
                usedIds={usedIds}
                onSelect={(p) => addPlayer(p, false)}
                onClose={() => setPickerMode(null)}
              />
            )}

            {draft.starterIds.length === 0 && pickerMode !== "starter" && (
              <div
                className="flex items-center justify-center py-6 rounded-2xl"
                style={{ border: "1px dashed rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.01)" }}
              >
                <p className="text-white/20 text-sm">Nenhum titular adicionado</p>
              </div>
            )}

            <div className="space-y-2">
              {draft.starterIds.map((id) => {
                const player = allPlayers.find((p) => p.id === id);
                const stats = draft.playerStats[id];
                if (!player || !stats) return null;
                const assistCount = Object.values(draft.playerStats).reduce((n, ps) =>
                  n + ps.goals.filter((g) => g.assistPlayerId === id).length, 0);
                return (
                  <PlayerLineupRow
                    key={id}
                    player={player}
                    stats={stats}
                    isSub={false}
                    allParticipants={allParticipants}
                    allUnused={allUnusedForSub(id)}
                    assistCount={assistCount}
                    onUpdate={(patch) => updatePlayerStats(id, patch)}
                    onRemove={() => removePlayer(id)}
                    onSubPlayerAdded={handleSubPlayerAdded}
                  />
                );
              })}
            </div>

            {/* Substitutos */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider">
                Substitutos ({draft.subIds.length})
              </p>
              <button
                type="button"
                onClick={() => setPickerMode((m) => m === "sub" ? null : "sub")}
                className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-lg transition-all duration-200"
                style={{
                  background: pickerMode === "sub" ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.06)",
                  color: pickerMode === "sub" ? "var(--club-primary)" : "rgba(255,255,255,0.5)",
                  border: pickerMode === "sub" ? "1px solid rgba(var(--club-primary-rgb),0.4)" : "1px solid rgba(255,255,255,0.08)",
                }}
                title="Adicionar substituto"
              >
                +
              </button>
            </div>

            {pickerMode === "sub" && (
              <PlayerPicker
                allPlayers={allPlayers}
                usedIds={usedIds}
                onSelect={(p) => addPlayer(p, true)}
                onClose={() => setPickerMode(null)}
              />
            )}

            <div className="space-y-2">
              {draft.subIds.map((id) => {
                const player = allPlayers.find((p) => p.id === id);
                const stats = draft.playerStats[id];
                if (!player || !stats) return null;
                const assistCount = Object.values(draft.playerStats).reduce((n, ps) =>
                  n + ps.goals.filter((g) => g.assistPlayerId === id).length, 0);
                return (
                  <PlayerLineupRow
                    key={id}
                    player={player}
                    stats={stats}
                    isSub={true}
                    allParticipants={allParticipants}
                    allUnused={allUnusedForSub(id)}
                    assistCount={assistCount}
                    onUpdate={(patch) => updatePlayerStats(id, patch)}
                    onRemove={() => removePlayer(id)}
                  />
                );
              })}
            </div>

            {/* Gols do adversário */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-white/40 text-xs font-medium uppercase tracking-wider">
                  ⚽ Gols do {draft.opponent || "Adversário"}
                </label>
                <button
                  type="button"
                  onClick={() => onChange({ opponentGoals: [...draft.opponentGoals, { id: generateGoalId(), minute: 0, playerName: undefined }] })}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar gol
                </button>
              </div>
              {draft.opponentGoals.length > 0 && (
                <div className="space-y-2">
                  {draft.opponentGoals.map((g, idx) => (
                    <OpponentGoalEditor
                      key={g.id}
                      goal={g}
                      index={idx}
                      opponentName={draft.opponent}
                      allSystemPlayers={allSystemPlayers}
                      onChange={(updated) => onChange({ opponentGoals: draft.opponentGoals.map((og, i) => i === idx ? updated : og) })}
                      onRemove={() => onChange({ opponentGoals: draft.opponentGoals.filter((_, i) => i !== idx) })}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* MOTM */}
            <div className="space-y-1.5 pt-1">
              <label className="text-white/40 text-xs font-medium uppercase tracking-wider">⭐ Melhor em Campo (MOTM)</label>
              <MotmAutocomplete
                playerId={draft.motmPlayerId}
                playerName={draft.motmPlayerName}
                allPlayers={allSystemPlayers}
                onChange={(val) => onChange({ motmPlayerId: val.playerId, motmPlayerName: val.playerName })}
              />
            </div>
          </div>

          {/* Estatísticas da partida */}
          <div className="space-y-3">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Estatísticas da Partida</p>
            <div
              className="rounded-2xl p-4 space-y-4"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <p className="text-white/40 text-xs text-center">Chutes — {clubName}</p>
                  <div className="flex items-center justify-center">
                    <NumericInput value={draft.myShots} onChange={(v) => onChange({ myShots: v ?? 0 })} placeholder="0" className="w-16 text-center" />
                  </div>
                </div>
                <span className="text-white/15 text-xs flex-shrink-0">vs</span>
                <div className="flex-1 space-y-1">
                  <p className="text-white/40 text-xs text-center">Chutes — {draft.opponent || "Adversário"}</p>
                  <div className="flex items-center justify-center">
                    <NumericInput value={draft.opponentShots} onChange={(v) => onChange({ opponentShots: v ?? 0 })} placeholder="0" className="w-16 text-center" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span className="text-white/40 text-xs">Gols de pênalti 🎯</span>
                <NumericInput value={draft.penaltyGoals} onChange={(v) => onChange({ penaltyGoals: v ?? 0 })} placeholder="0" className="w-16 text-center" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-xs">Posse de bola</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/60 text-xs font-bold tabular-nums" style={{ color: "var(--club-primary)" }}>{draft.possessionPct}%</span>
                    <span className="text-white/25 text-xs">— {100 - draft.possessionPct}%</span>
                  </div>
                </div>
                <div className="relative h-4 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${draft.possessionPct}%`, background: "var(--club-primary)", opacity: 0.8 }}
                  />
                  <input
                    type="range" min={0} max={100} step={1}
                    value={draft.possessionPct}
                    onChange={(e) => onChange({ possessionPct: Number(e.target.value) })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex justify-between text-xs text-white/20">
                  <span>{clubName}</span>
                  <span>{draft.opponent || "Adversário"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Observações</p>
            <textarea
              value={draft.observations}
              onChange={(e) => onChange({ observations: e.target.value })}
              placeholder="Descreva como foi o jogo, lances importantes, tática usada... Isso ajuda a IA a gerar notícias mais ricas sobre a partida."
              rows={4}
              className="w-full px-3.5 py-3 rounded-2xl text-white text-sm focus:outline-none resize-none glass leading-relaxed"
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.8)",
                caretColor: "var(--club-primary)",
              }}
            />
            <p className="text-white/20 text-xs">Opcional — visível no resumo da partida e usado para geração de notícias.</p>
          </div>

          <div className="h-1" />
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 px-5 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          {!canSave && (
            <p className="text-white/30 text-xs text-center mb-2">Preencha o nome do adversário para salvar</p>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSave || saving}
            className="w-full py-3.5 rounded-2xl font-black text-sm text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
            style={{ background: canSave ? "var(--club-gradient)" : "rgba(255,255,255,0.08)" }}
          >
            {saving ? (isEditMode ? "Atualizando..." : "Salvando...") : (isEditMode ? "Atualizar Partida" : "Salvar Partida")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
