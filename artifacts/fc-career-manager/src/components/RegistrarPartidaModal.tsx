import { useState, useCallback, useRef, useMemo, useEffect } from "react";
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
import type { ClubEntry } from "@/types/club";

interface Props {
  careerId: string;
  season: string;
  clubName: string;
  clubLogoUrl?: string | null;
  allPlayers: SquadPlayer[];
  onMatchAdded: (match: MatchRecord) => void;
  onClose: () => void;
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

function buildInitialDraft(careerId: string): Pick<MatchDraft, "date" | "tournament" | "stage"> {
  const matches = getMatches(careerId);
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

const FALLBACK_CLUBS: Pick<ClubEntry, "id" | "name" | "logo" | "league">[] = [
  { id: 541, name: "Real Madrid", logo: "https://media.api-sports.io/football/teams/541.png", league: "La Liga" },
  { id: 529, name: "Barcelona", logo: "https://media.api-sports.io/football/teams/529.png", league: "La Liga" },
  { id: 530, name: "Atlético de Madrid", logo: "https://media.api-sports.io/football/teams/530.png", league: "La Liga" },
  { id: 533, name: "Villarreal", logo: "https://media.api-sports.io/football/teams/533.png", league: "La Liga" },
  { id: 532, name: "Valencia", logo: "https://media.api-sports.io/football/teams/532.png", league: "La Liga" },
  { id: 728, name: "Real Sociedad", logo: "https://media.api-sports.io/football/teams/728.png", league: "La Liga" },
  { id: 543, name: "Real Betis", logo: "https://media.api-sports.io/football/teams/543.png", league: "La Liga" },
  { id: 157, name: "Bayern Munich", logo: "https://media.api-sports.io/football/teams/157.png", league: "Bundesliga" },
  { id: 165, name: "Borussia Dortmund", logo: "https://media.api-sports.io/football/teams/165.png", league: "Bundesliga" },
  { id: 168, name: "Bayer Leverkusen", logo: "https://media.api-sports.io/football/teams/168.png", league: "Bundesliga" },
  { id: 173, name: "RB Leipzig", logo: "https://media.api-sports.io/football/teams/173.png", league: "Bundesliga" },
  { id: 169, name: "Eintracht Frankfurt", logo: "https://media.api-sports.io/football/teams/169.png", league: "Bundesliga" },
  { id: 40, name: "Liverpool", logo: "https://media.api-sports.io/football/teams/40.png", league: "Premier League" },
  { id: 50, name: "Manchester City", logo: "https://media.api-sports.io/football/teams/50.png", league: "Premier League" },
  { id: 33, name: "Manchester United", logo: "https://media.api-sports.io/football/teams/33.png", league: "Premier League" },
  { id: 42, name: "Arsenal", logo: "https://media.api-sports.io/football/teams/42.png", league: "Premier League" },
  { id: 49, name: "Chelsea", logo: "https://media.api-sports.io/football/teams/49.png", league: "Premier League" },
  { id: 47, name: "Tottenham", logo: "https://media.api-sports.io/football/teams/47.png", league: "Premier League" },
  { id: 48, name: "West Ham", logo: "https://media.api-sports.io/football/teams/48.png", league: "Premier League" },
  { id: 51, name: "Brighton", logo: "https://media.api-sports.io/football/teams/51.png", league: "Premier League" },
  { id: 45, name: "Everton", logo: "https://media.api-sports.io/football/teams/45.png", league: "Premier League" },
  { id: 66, name: "Aston Villa", logo: "https://media.api-sports.io/football/teams/66.png", league: "Premier League" },
  { id: 55, name: "Brentford", logo: "https://media.api-sports.io/football/teams/55.png", league: "Premier League" },
  { id: 505, name: "Nottingham Forest", logo: "https://media.api-sports.io/football/teams/505.png", league: "Premier League" },
  { id: 496, name: "Newcastle", logo: "https://media.api-sports.io/football/teams/496.png", league: "Premier League" },
  { id: 489, name: "AC Milan", logo: "https://media.api-sports.io/football/teams/489.png", league: "Serie A" },
  { id: 505, name: "Inter", logo: "https://media.api-sports.io/football/teams/505.png", league: "Serie A" },
  { id: 492, name: "Napoli", logo: "https://media.api-sports.io/football/teams/492.png", league: "Serie A" },
  { id: 496, name: "Juventus", logo: "https://media.api-sports.io/football/teams/496.png", league: "Serie A" },
  { id: 487, name: "Roma", logo: "https://media.api-sports.io/football/teams/487.png", league: "Serie A" },
  { id: 488, name: "Lazio", logo: "https://media.api-sports.io/football/teams/488.png", league: "Serie A" },
  { id: 500, name: "Atalanta", logo: "https://media.api-sports.io/football/teams/500.png", league: "Serie A" },
  { id: 91, name: "Paris Saint-Germain", logo: "https://media.api-sports.io/football/teams/91.png", league: "Ligue 1" },
  { id: 80, name: "Lyon", logo: "https://media.api-sports.io/football/teams/80.png", league: "Ligue 1" },
  { id: 81, name: "Marseille", logo: "https://media.api-sports.io/football/teams/81.png", league: "Ligue 1" },
  { id: 93, name: "Monaco", logo: "https://media.api-sports.io/football/teams/93.png", league: "Ligue 1" },
  { id: 212, name: "Porto", logo: "https://media.api-sports.io/football/teams/212.png", league: "Liga Portugal" },
  { id: 211, name: "Benfica", logo: "https://media.api-sports.io/football/teams/211.png", league: "Liga Portugal" },
  { id: 228, name: "Sporting CP", logo: "https://media.api-sports.io/football/teams/228.png", league: "Liga Portugal" },
  { id: 194, name: "Ajax", logo: "https://media.api-sports.io/football/teams/194.png", league: "Eredivisie" },
  { id: 197, name: "PSV Eindhoven", logo: "https://media.api-sports.io/football/teams/197.png", league: "Eredivisie" },
  { id: 193, name: "Feyenoord", logo: "https://media.api-sports.io/football/teams/193.png", league: "Eredivisie" },
  { id: 131, name: "Celtic", logo: "https://media.api-sports.io/football/teams/131.png", league: "Scottish Premiership" },
  { id: 132, name: "Rangers", logo: "https://media.api-sports.io/football/teams/132.png", league: "Scottish Premiership" },
  { id: 568, name: "Flamengo", logo: "https://media.api-sports.io/football/teams/568.png", league: "Brasileirão" },
  { id: 119, name: "Palmeiras", logo: "https://media.api-sports.io/football/teams/119.png", league: "Brasileirão" },
  { id: 118, name: "São Paulo", logo: "https://media.api-sports.io/football/teams/118.png", league: "Brasileirão" },
  { id: 121, name: "Santos", logo: "https://media.api-sports.io/football/teams/121.png", league: "Brasileirão" },
  { id: 116, name: "Corinthians", logo: "https://media.api-sports.io/football/teams/116.png", league: "Brasileirão" },
  { id: 130, name: "Grêmio", logo: "https://media.api-sports.io/football/teams/130.png", league: "Brasileirão" },
  { id: 115, name: "Internacional", logo: "https://media.api-sports.io/football/teams/115.png", league: "Brasileirão" },
  { id: 124, name: "Athletico Paranaense", logo: "https://media.api-sports.io/football/teams/124.png", league: "Brasileirão" },
  { id: 126, name: "Cruzeiro", logo: "https://media.api-sports.io/football/teams/126.png", league: "Brasileirão" },
  { id: 127, name: "Atlético Mineiro", logo: "https://media.api-sports.io/football/teams/127.png", league: "Brasileirão" },
  { id: 120, name: "Fluminense", logo: "https://media.api-sports.io/football/teams/120.png", league: "Brasileirão" },
  { id: 7323, name: "Botafogo", logo: "https://media.api-sports.io/football/teams/7323.png", league: "Brasileirão" },
  { id: 435, name: "Boca Juniors", logo: "https://media.api-sports.io/football/teams/435.png", league: "Argentina" },
  { id: 436, name: "River Plate", logo: "https://media.api-sports.io/football/teams/436.png", league: "Argentina" },
  { id: 246, name: "Celtic FC", logo: "https://media.api-sports.io/football/teams/246.png", league: "Escócia" },
  { id: 569, name: "Club América", logo: "https://media.api-sports.io/football/teams/569.png", league: "Liga MX" },
  { id: 570, name: "Cruz Azul", logo: "https://media.api-sports.io/football/teams/570.png", league: "Liga MX" },
  { id: 571, name: "Chivas Guadalajara", logo: "https://media.api-sports.io/football/teams/571.png", league: "Liga MX" },
];

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
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") { onChange(undefined); return; }
        const n = Math.max(min, Math.min(max, Number(raw)));
        onChange(isNaN(n) ? undefined : n);
      }}
      className={`px-2.5 py-1.5 rounded-xl text-white text-sm font-semibold focus:outline-none glass tabular-nums ${className}`}
    />
  );
}

function ScoreInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [raw, setRaw] = useState(value === 0 ? "0" : String(value));

  useEffect(() => {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n !== value) {
      setRaw(value === 0 ? "0" : String(value));
    }
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <p className="text-white/30 text-xs truncate max-w-full text-center">{label}</p>
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
        onFocus={(e) => {
          if (raw === "0") {
            e.target.select();
          }
        }}
        onBlur={() => {
          if (raw === "") setRaw("0");
        }}
        className="w-full px-3 py-3 rounded-xl text-white text-3xl font-black text-center focus:outline-none glass tabular-nums"
        style={{ border: "1px solid rgba(255,255,255,0.08)", caretColor: "var(--club-primary)", minWidth: 0 }}
      />
    </div>
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

  const clubs = useMemo<Pick<ClubEntry, "id" | "name" | "logo" | "league">[]>(() => {
    const cached = getCachedClubList();
    return cached && cached.length > 0 ? cached : FALLBACK_CLUBS;
  }, []);

  const suggestions = useMemo(() => {
    if (!value.trim() || !open) return [];
    const q = value.toLowerCase().trim();
    return clubs
      .filter((c) => c.name.toLowerCase().includes(q) || c.league.toLowerCase().includes(q))
      .slice(0, 8);
  }, [value, open, clubs]);

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
}: {
  player: SquadPlayer;
  stats: PlayerMatchStats;
  isSub: boolean;
  allParticipants: SquadPlayer[];
  allUnused: SquadPlayer[];
  onUpdate: (patch: Partial<PlayerMatchStats>) => void;
  onRemove: () => void;
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
                          onChange={(e) => onUpdate({ substitutedInPlayerId: e.target.value ? Number(e.target.value) : undefined })}
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
  season,
  clubName,
  clubLogoUrl,
  allPlayers,
  onMatchAdded,
  onClose,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [pickerMode, setPickerMode] = useState<"starter" | "sub" | null>(null);

  const initial = useMemo(() => buildInitialDraft(careerId), [careerId]);

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
      createdAt: Date.now(),
    };
    addMatch(careerId, match);
    applyMatchToPlayerStats(careerId, draft.starterIds, draft.subIds, draft.playerStats);
    onMatchAdded(match);
    onClose();
  }, [canSave, saving, careerId, season, draft, onMatchAdded, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full sm:max-w-2xl flex flex-col rounded-t-3xl sm:rounded-2xl"
        style={{
          background: "rgba(12,12,20,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          maxHeight: "92vh",
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
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-3">
              <ScoreInput value={draft.myScore} onChange={(v) => onChange({ myScore: v })} label={clubName} />
              <div className="flex flex-col items-center gap-1 flex-shrink-0 px-1">
                <div className="flex items-center gap-2">
                  {clubLogoUrl && <ClubBadge src={clubLogoUrl} name={clubName} size={22} />}
                  <span className="text-white/20 text-xl font-black">×</span>
                  {draft.opponentLogoUrl && <ClubBadge src={draft.opponentLogoUrl} name={draft.opponent} size={22} />}
                </div>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: draft.myScore > draft.opponentScore ? "rgba(16,185,129,0.15)" : draft.myScore < draft.opponentScore ? "rgba(239,68,68,0.15)" : "rgba(148,163,184,0.1)",
                    color: resultColor,
                  }}
                >
                  {draft.myScore > draft.opponentScore ? "Vitória" : draft.myScore < draft.opponentScore ? "Derrota" : "Empate"}
                </span>
              </div>
              <ScoreInput value={draft.opponentScore} onChange={(v) => onChange({ opponentScore: v })} label={draft.opponent || "Adversário"} />
            </div>
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
                {TOURNAMENT_CHIPS.map((t) => (
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
            {allParticipants.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <label className="text-white/40 text-xs font-medium uppercase tracking-wider">⭐ Melhor em Campo (MOTM)</label>
                <select
                  value={draft.motmPlayerId ?? ""}
                  onChange={(e) => onChange({ motmPlayerId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none glass"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <option value="">Nenhum</option>
                  {allParticipants.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
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
    </div>
  );
}
