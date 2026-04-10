import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import type { SquadPlayer } from "@/lib/squadCache";
import type {
  MatchRecord,
  PlayerMatchStats,
  MatchLocation,
  GoalEntry,
} from "@/types/match";
import { LOCATION_LABELS, LOCATION_ICONS } from "@/types/match";
import {
  addMatch,
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
  onClose: () => void;
  competitions?: string[];
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
  myShots: number;
  opponentShots: number;
  possessionPct: number;
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
    passes: undefined,
    passAccuracy: undefined,
    keyPasses: undefined,
    dribblesCompleted: undefined,
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
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value != null ? String(value) : "");

  useEffect(() => {
    const n = text === "" ? undefined : parseInt(text, 10);
    if (value !== n) {
      setText(value != null ? String(value) : "");
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
        if (stripped === "") { onChange(undefined); return; }
        const n = Math.max(min, Math.min(max, parseInt(stripped, 10)));
        onChange(isNaN(n) ? undefined : n);
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

function GoalEditor({
  goal, playerIndex, allParticipants, currentPlayerId, onChange, onRemove,
}: {
  goal: GoalEntry; playerIndex: number; allParticipants: SquadPlayer[];
  currentPlayerId: number; onChange: (g: GoalEntry) => void; onRemove: () => void;
}) {
  const others = allParticipants.filter((p) => p.id !== currentPlayerId);
  return (
    <div className="glass rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">⚽</span>
        <span className="text-white/50 text-xs">Gol {playerIndex + 1}</span>
        <button type="button" onClick={onRemove} className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs">×</button>
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

function MotmAutocomplete({
  value,
  allPlayers,
  onChange,
}: {
  value: number | null;
  allPlayers: SquadPlayer[];
  onChange: (playerId: number | null) => void;
}) {
  const selectedPlayer = value != null ? allPlayers.find((p) => p.id === value) ?? null : null;
  const [query, setQuery] = useState(selectedPlayer?.name ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedPlayer?.name ?? "");
  }, [value]);

  const suggestions = useMemo(() => {
    if (!query.trim() || !open) return [];
    const q = query.toLowerCase().trim();
    return allPlayers
      .filter((p) => p.name.toLowerCase().includes(q) || p.positionPtBr.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, open, allPlayers]);

  const handleSelect = (player: SquadPlayer) => {
    onChange(player.id);
    setQuery(player.name);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(null); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder="Buscar jogador..."
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
          style={{ background: "rgba(15,15,20,0.97)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}
        >
          {suggestions.map((player) => (
            <button
              key={player.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(player)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }}
              >
                {player.positionPtBr.slice(0, 3)}
              </div>
              <p className="text-white text-sm font-semibold truncate flex-1">{player.name}</p>
              {player.age && (
                <span className="text-white/35 text-xs tabular-nums">{player.age} anos</span>
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

function PlayerLineupRow({
  player,
  stats,
  isSub,
  allParticipants,
  allUnused,
  onUpdate,
  onRemove,
  onSubPlayerAdded,
}: {
  player: SquadPlayer;
  stats: PlayerMatchStats;
  isSub: boolean;
  allParticipants: SquadPlayer[];
  allUnused: SquadPlayer[];
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
              {stats.ownGoal && <span className="text-xs" style={{ color: "#f87171" }}>GC</span>}
              {stats.yellowCard && <span className="text-xs">🟨</span>}
              {stats.redCard && <span className="text-xs">🟥</span>}
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
                {
                  label: "Passes", icon: "🎯",
                  node: (
                    <div className="flex items-center gap-1">
                      <NumericInput value={stats.passes} onChange={(v) => onUpdate({ passes: v })} placeholder="Total" className="w-14 text-right" />
                      <NumericInput value={stats.passAccuracy} onChange={(v) => onUpdate({ passAccuracy: v ? Math.min(100, v) : undefined })} max={100} placeholder="%" className="w-12 text-right" />
                      <span className="text-white/30 text-xs">%</span>
                      <NumericInput value={stats.keyPasses} onChange={(v) => onUpdate({ keyPasses: v })} placeholder="Chave" className="w-14 text-right" />
                    </div>
                  ),
                },
                {
                  label: "Dribles", icon: "🔄",
                  node: <NumericInput value={stats.dribblesCompleted} onChange={(v) => onUpdate({ dribblesCompleted: v })} placeholder="Completos" className="w-20 text-right" />,
                },
                {
                  label: "Rec. / Perdas", icon: "🛡️",
                  node: (
                    <div className="flex items-center gap-1">
                      <NumericInput value={stats.ballRecoveries} onChange={(v) => onUpdate({ ballRecoveries: v })} placeholder="Rec." className="w-14 text-right" />
                      <span className="text-white/20 text-xs">|</span>
                      <NumericInput value={stats.ballLosses} onChange={(v) => onUpdate({ ballLosses: v })} placeholder="Perda" className="w-14 text-right" />
                    </div>
                  ),
                },
                ...(isGK ? [
                  { label: "Defesas", icon: "🧤", node: <NumericInput value={stats.saves} onChange={(v) => onUpdate({ saves: v })} placeholder="Total" className="w-16 text-right" /> },
                  { label: "Pên. Def.", icon: "🥅", node: <NumericInput value={stats.penaltiesSaved} onChange={(v) => onUpdate({ penaltiesSaved: v })} placeholder="—" className="w-16 text-right" /> },
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
              <div className="glass rounded-xl p-3">
                <Toggle checked={stats.yellowCard ?? false} onChange={(v) => onUpdate({ yellowCard: v })} label="Cartão amarelo" />
              </div>
              <div className="glass rounded-xl p-3">
                <Toggle checked={stats.redCard ?? false} onChange={(v) => onUpdate({ redCard: v })} label="Cartão vermelho" />
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
                        <select
                          value={stats.substitutedInPlayerId ?? ""}
                          onChange={(e) => {
                            const newId = e.target.value ? Number(e.target.value) : undefined;
                            onUpdate({ substitutedInPlayerId: newId });
                            if (newId) onSubPlayerAdded?.(newId);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl text-white text-sm focus:outline-none glass"
                          style={{ background: "rgba(255,255,255,0.05)" }}
                        >
                          <option value="">Selecionar</option>
                          {allUnused.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.positionPtBr})</option>)}
                          {stats.substitutedInPlayerId != null && !allUnused.find((p) => p.id === stats.substitutedInPlayerId) && (
                            <option value={stats.substitutedInPlayerId}>
                              {allParticipants.find((p) => p.id === stats.substitutedInPlayerId)?.name ?? `#${stats.substitutedInPlayerId}`}
                            </option>
                          )}
                        </select>
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
  onClose,
  competitions,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [pickerMode, setPickerMode] = useState<"starter" | "sub" | null>(null);

  const initial = useMemo(() => buildInitialDraft(seasonId), [seasonId]);

  const [draft, setDraft] = useState<MatchDraft>({
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
    myShots: 0,
    opponentShots: 0,
    possessionPct: 50,
  });

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
      return { ...prev, starterIds, subIds, playerStats, motmPlayerId };
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
      },
      motmPlayerId: draft.motmPlayerId ?? undefined,
      tablePositionBefore: draft.tablePosition ? Number(draft.tablePosition) : undefined,
      opponentLogoUrl: draft.opponentLogoUrl ?? undefined,
      createdAt: Date.now(),
    };
    addMatch(seasonId, match);
    applyMatchToPlayerStats(seasonId, draft.starterIds, draft.subIds, draft.playerStats);
    onMatchAdded(match);
    onClose();
  }, [canSave, saving, seasonId, careerId, season, draft, onMatchAdded, onClose]);

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
            <h2 className="text-white font-black text-base">Registrar Partida</h2>
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
                return (
                  <PlayerLineupRow
                    key={id}
                    player={player}
                    stats={stats}
                    isSub={false}
                    allParticipants={allParticipants}
                    allUnused={allUnusedForSub(id)}
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
                return (
                  <PlayerLineupRow
                    key={id}
                    player={player}
                    stats={stats}
                    isSub={true}
                    allParticipants={allParticipants}
                    allUnused={allUnusedForSub(id)}
                    onUpdate={(patch) => updatePlayerStats(id, patch)}
                    onRemove={() => removePlayer(id)}
                  />
                );
              })}
            </div>

            {/* MOTM */}
            <div className="space-y-1.5 pt-1">
              <label className="text-white/40 text-xs font-medium uppercase tracking-wider">⭐ Melhor em Campo (MOTM)</label>
              <MotmAutocomplete
                value={draft.motmPlayerId}
                allPlayers={allPlayers}
                onChange={(playerId) => onChange({ motmPlayerId: playerId })}
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
            {saving ? "Salvando..." : "Salvar Partida"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
