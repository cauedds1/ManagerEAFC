import { useState } from "react";
import type { MatchRecord, MatchResult } from "@/types/match";
import { getMatchResult, RESULT_STYLE, LOCATION_ICONS, LOCATION_LABELS } from "@/types/match";
import type { SquadPlayer } from "@/lib/squadCache";
import { RegistrarPartidaModal } from "./RegistrarPartidaModal";

interface PartidasViewProps {
  careerId: string;
  season: string;
  clubName: string;
  clubLogoUrl?: string | null;
  matches: MatchRecord[];
  allPlayers: SquadPlayer[];
  onMatchAdded: (match: MatchRecord) => void;
}

type Filter = "todos" | MatchResult;

const FILTER_LABELS: Record<Filter, string> = {
  todos:   "Todos",
  vitoria: "Vitórias",
  empate:  "Empates",
  derrota: "Derrotas",
};

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-2 flex-1">
      <span className="text-white/40 text-xs font-medium uppercase tracking-wider">{label}</span>
      <p className="text-2xl font-black tabular-nums" style={{ color: color ?? "white" }}>{value}</p>
      {sub && <p className="text-white/25 text-xs">{sub}</p>}
    </div>
  );
}

function ClubCrest({
  logoUrl,
  name,
  size = 52,
}: {
  logoUrl?: string | null;
  name: string;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const fallback = (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.32,
        fontWeight: 900,
        color: "rgba(255,255,255,0.55)",
        letterSpacing: "-0.5px",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );

  if (!logoUrl || imgFailed) {
    return fallback;
  }

  return (
    <img
      src={logoUrl}
      alt={name}
      width={size}
      height={size}
      className="object-contain drop-shadow-md"
      style={{ width: size, height: size, flexShrink: 0 }}
      onError={() => setImgFailed(true)}
    />
  );
}

function MatchCard({
  match,
  clubName,
  clubLogoUrl,
  allPlayers,
}: {
  match: MatchRecord;
  clubName: string;
  clubLogoUrl?: string | null;
  allPlayers: SquadPlayer[];
}) {
  const result = getMatchResult(match.myScore, match.opponentScore);
  const rs = RESULT_STYLE[result];
  const motm = match.motmPlayerId != null ? allPlayers.find((p) => p.id === match.motmPlayerId) : null;

  const allParticipantIds = [...match.starterIds, ...match.subIds];
  const goalScorers: { name: string; minute: number }[] = [];
  for (const pid of allParticipantIds) {
    const pStats = match.playerStats[pid];
    const player = allPlayers.find((p) => p.id === pid);
    if (pStats && player) {
      for (const g of pStats.goals) {
        goalScorers.push({ name: player.name.split(" ").at(-1) ?? player.name, minute: g.minute });
      }
    }
  }
  goalScorers.sort((a, b) => a.minute - b.minute);

  const dateStr = match.date
    ? new Date(match.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "";

  const hasFooter =
    goalScorers.length > 0 ||
    motm ||
    match.matchStats.possessionPct > 0 ||
    match.matchStats.myShots > 0 ||
    match.matchStats.opponentShots > 0;

  return (
    <div
      className="glass rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        borderLeft: `3px solid ${rs.color}`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span
            className="text-xs"
            title={LOCATION_LABELS[match.location]}
          >
            {LOCATION_ICONS[match.location]}
          </span>
          {match.tournament && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium text-white/55 flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              {match.tournament}
            </span>
          )}
          {match.stage && (
            <span className="text-white/30 text-xs truncate">{match.stage}</span>
          )}
          {match.tablePositionBefore != null && (
            <span className="text-white/20 text-xs">· #{match.tablePositionBefore}</span>
          )}
        </div>
        <span className="text-white/30 text-xs flex-shrink-0">{dateStr}</span>
      </div>

      {/* Score body — 3 columns */}
      <div className="flex items-center gap-2 px-4 pb-3">
        {/* My club */}
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <ClubCrest logoUrl={clubLogoUrl} name={clubName} size={48} />
          <span className="text-white/40 text-xs font-medium text-center leading-tight truncate w-full text-center">
            {clubName}
          </span>
        </div>

        {/* Score + result */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 px-2">
          <div className="flex items-center gap-3 tabular-nums">
            <span className="text-4xl font-black text-white leading-none">{match.myScore}</span>
            <span className="text-white/20 text-2xl font-light leading-none">–</span>
            <span className="text-4xl font-black text-white leading-none">{match.opponentScore}</span>
          </div>
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black"
            style={{ background: rs.bg, color: rs.color }}
          >
            {rs.label}
          </span>
        </div>

        {/* Opponent */}
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <ClubCrest logoUrl={match.opponentLogoUrl} name={match.opponent} size={48} />
          <span className="text-white/40 text-xs font-medium text-center leading-tight truncate w-full text-center">
            {match.opponent}
          </span>
        </div>
      </div>

      {/* Footer */}
      {hasFooter && (
        <div
          className="flex items-center justify-between gap-2 flex-wrap px-4 py-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-1.5 text-xs text-white/40 flex-wrap min-w-0">
            {goalScorers.length > 0 && (
              <span>⚽ {goalScorers.map((g) => `${g.name} ${g.minute}'`).join(" · ")}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-white/30 flex-wrap flex-shrink-0">
            {match.matchStats.possessionPct > 0 && (
              <span
                className="px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                {match.matchStats.possessionPct}% posse
              </span>
            )}
            {(match.matchStats.myShots > 0 || match.matchStats.opponentShots > 0) && (
              <span
                className="px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                🎯 {match.matchStats.myShots}–{match.matchStats.opponentShots}
              </span>
            )}
            {motm && (
              <span
                className="px-2 py-0.5 rounded-full"
                style={{ background: "rgba(234,179,8,0.08)", color: "#fbbf24" }}
              >
                ⭐ {motm.name.split(" ").at(-1)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
        style={{ background: "rgba(var(--club-primary-rgb),0.08)" }}
      >
        ⚽
      </div>
      <div className="text-center">
        <p className="text-white/60 font-semibold text-sm">Nenhuma partida registrada</p>
        <p className="text-white/25 text-xs mt-1">Registre a primeira partida da temporada</p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: "var(--club-primary)", color: "white" }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Registrar Partida
      </button>
    </div>
  );
}

export function PartidasView({ careerId, season, clubName, clubLogoUrl, matches, allPlayers, onMatchAdded }: PartidasViewProps) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [modalOpen, setModalOpen] = useState(false);

  const wins   = matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === "vitoria").length;
  const draws  = matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === "empate").length;
  const losses = matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === "derrota").length;
  const goalsFor     = matches.reduce((s, m) => s + m.myScore, 0);
  const goalsAgainst = matches.reduce((s, m) => s + m.opponentScore, 0);

  const filtered = filter === "todos"
    ? matches
    : matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === filter);

  const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-white/35 text-xs font-bold tracking-widest uppercase">Partidas — {season}</h2>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "var(--club-primary)", color: "white" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Registrar
        </button>
      </div>

      {matches.length > 0 && (
        <>
          <div className="flex gap-2 flex-wrap">
            <StatCard label="Vitórias"  value={wins}   color={RESULT_STYLE.vitoria.color} />
            <StatCard label="Empates"   value={draws}  color={RESULT_STYLE.empate.color} />
            <StatCard label="Derrotas"  value={losses} color={RESULT_STYLE.derrota.color} />
            <StatCard label="Gols Pró"  value={goalsFor} />
            <StatCard label="Gols Con." value={goalsAgainst} />
          </div>

          <div className="flex gap-2 flex-wrap">
            {(["todos", "vitoria", "empate", "derrota"] as Filter[]).map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
                  style={{
                    background: active
                      ? f === "todos" ? "rgba(var(--club-primary-rgb),0.2)"
                        : RESULT_STYLE[f as MatchResult].bg
                      : "rgba(255,255,255,0.06)",
                    color: active
                      ? f === "todos" ? "var(--club-primary)"
                        : RESULT_STYLE[f as MatchResult].color
                      : "rgba(255,255,255,0.35)",
                  }}
                >
                  {FILTER_LABELS[f]} {f !== "todos" && `(${matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === f).length})`}
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {sorted.length === 0 ? (
              <p className="text-white/25 text-sm text-center py-8">Nenhuma partida com esse filtro.</p>
            ) : (
              sorted.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  clubName={clubName}
                  clubLogoUrl={clubLogoUrl}
                  allPlayers={allPlayers}
                />
              ))
            )}
          </div>
        </>
      )}

      {matches.length === 0 && <EmptyState onAdd={() => setModalOpen(true)} />}

      {modalOpen && (
        <RegistrarPartidaModal
          careerId={careerId}
          season={season}
          clubName={clubName}
          clubLogoUrl={clubLogoUrl}
          allPlayers={allPlayers}
          onMatchAdded={onMatchAdded}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
