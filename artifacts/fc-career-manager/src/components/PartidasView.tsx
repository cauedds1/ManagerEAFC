import { useState } from "react";
import type { MatchRecord, MatchResult } from "@/types/match";
import { getMatchResult, RESULT_STYLE, LOCATION_ICONS, LOCATION_LABELS } from "@/types/match";
import type { SquadPlayer } from "@/lib/squadCache";
import { getCachedClubList } from "@/lib/clubListCache";
import { searchStaticClubs } from "@/lib/staticClubList";
import { RegistrarPartidaModal } from "./RegistrarPartidaModal";
import { MatchDetailPage } from "./MatchDetailPage";

function resolveOpponentLogo(name: string, stored?: string): string | undefined {
  if (stored) return stored;
  const q = name.toLowerCase().trim();
  const cached = getCachedClubList();
  if (cached && cached.length > 0) {
    const exact = cached.find((c) => c.name.toLowerCase() === q);
    if (exact?.logo) return exact.logo;
    const partial = cached.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()));
    if (partial?.logo) return partial.logo;
  }
  const statics = searchStaticClubs(name);
  return statics[0]?.logo ?? undefined;
}

interface PartidasViewProps {
  careerId: string;
  seasonId: string;
  season: string;
  clubName: string;
  clubLogoUrl?: string | null;
  matches: MatchRecord[];
  allPlayers: SquadPlayer[];
  onMatchAdded: (match: MatchRecord) => void;
  competitions?: string[];
  isReadOnly?: boolean;
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
  themed = false,
}: {
  logoUrl?: string | null;
  name: string;
  size?: number;
  themed?: boolean;
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
        background: themed ? "rgba(var(--club-primary-rgb),0.18)" : "rgba(255,255,255,0.08)",
        border: themed ? "1px solid rgba(var(--club-primary-rgb),0.35)" : "1px solid rgba(255,255,255,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.32,
        fontWeight: 900,
        color: themed ? "var(--club-primary)" : "rgba(255,255,255,0.55)",
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
  onClick,
}: {
  match: MatchRecord;
  clubName: string;
  clubLogoUrl?: string | null;
  allPlayers: SquadPlayer[];
  onClick?: () => void;
}) {
  const result = getMatchResult(match.myScore, match.opponentScore);
  const rs = RESULT_STYLE[result];
  const motm = match.motmPlayerId != null ? allPlayers.find((p) => p.id === match.motmPlayerId) : null;
  const isHome = match.location !== "fora";
  const oppResolvedLogo = resolveOpponentLogo(match.opponent, match.opponentLogoUrl);

  const leftLogo   = isHome ? clubLogoUrl    : oppResolvedLogo;
  const leftName   = isHome ? clubName       : match.opponent;
  const leftScore  = isHome ? match.myScore  : match.opponentScore;
  const leftThemed = isHome;
  const rightLogo   = isHome ? oppResolvedLogo : clubLogoUrl;
  const rightName   = isHome ? match.opponent  : clubName;
  const rightScore  = isHome ? match.opponentScore : match.myScore;
  const rightThemed = !isHome;

  const myPoss   = match.matchStats.possessionPct;
  const oppPoss  = myPoss > 0 ? 100 - myPoss : 0;
  const leftPoss  = isHome ? myPoss  : oppPoss;
  const rightPoss = isHome ? oppPoss : myPoss;

  const myShots  = match.matchStats.myShots;
  const oppShots = match.matchStats.opponentShots;
  const leftShots  = isHome ? myShots  : oppShots;
  const rightShots = isHome ? oppShots : myShots;

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
    !!motm ||
    myPoss > 0 ||
    myShots > 0 ||
    oppShots > 0;

  const leftWon  = leftScore > rightScore;
  const rightWon = rightScore > leftScore;
  const isDraw   = leftScore === rightScore;

  const glowColor =
    result === "vitoria" ? "rgba(16,185,129,0.22)"
    : result === "derrota" ? "rgba(239,68,68,0.22)"
    : "rgba(200,210,220,0.10)";

  const borderColor =
    result === "vitoria" ? "rgba(52,211,153,0.35)"
    : result === "derrota" ? "rgba(248,113,113,0.35)"
    : "rgba(148,163,184,0.20)";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(150deg, ${glowColor} 0%, rgba(255,255,255,0.025) 50%)`,
        border: `1px solid ${borderColor}`,
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
    >
      {/* ── Meta row ── */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-0 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-xs flex-shrink-0 opacity-50" title={LOCATION_LABELS[match.location]}>
            {LOCATION_ICONS[match.location]}
          </span>
          {match.tournament && (
            <span className="text-white/60 text-xs font-semibold flex-shrink-0">
              {match.tournament}
            </span>
          )}
          {match.stage && (
            <span className="text-white/25 text-xs truncate">{match.stage}</span>
          )}
          {match.tablePositionBefore != null && (
            <span className="text-white/20 text-xs flex-shrink-0">· #{match.tablePositionBefore}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {dateStr && <span className="text-white/25 text-xs">{dateStr}</span>}
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest"
            style={{ background: rs.bg, color: rs.color }}
          >
            {rs.label}
          </span>
        </div>
      </div>

      {/* ── Score zone ── */}
      <div className="flex items-center px-4 py-4 gap-2">
        {/* Left team */}
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <ClubCrest logoUrl={leftLogo} name={leftName} size={48} themed={leftThemed} />
          <span className="text-white/60 text-xs font-semibold text-center w-full leading-tight line-clamp-1">
            {leftName}
          </span>
        </div>

        {/* Score */}
        <div className="flex items-center gap-3 flex-shrink-0 px-2">
          <span
            className="text-4xl font-black tabular-nums leading-none"
            style={{
              color: leftWon ? rs.color : isDraw ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)",
            }}
          >
            {leftScore}
          </span>
          <span className="text-xl font-light leading-none select-none" style={{ color: "rgba(255,255,255,0.12)" }}>:</span>
          <span
            className="text-4xl font-black tabular-nums leading-none"
            style={{
              color: rightWon ? rs.color : isDraw ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)",
            }}
          >
            {rightScore}
          </span>
        </div>

        {/* Right team */}
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <ClubCrest logoUrl={rightLogo} name={rightName} size={48} themed={rightThemed} />
          <span className="text-white/60 text-xs font-semibold text-center w-full leading-tight line-clamp-1">
            {rightName}
          </span>
        </div>
      </div>

      {/* ── Stats footer ── */}
      {hasFooter && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>

          {/* Possession bar */}
          {myPoss > 0 && (
            <div className="px-4 pt-3 pb-1">
              <div className="flex rounded-full overflow-hidden" style={{ height: 5 }}>
                <div
                  style={{
                    width: `${leftPoss}%`,
                    background: leftThemed ? "var(--club-primary)" : "rgba(255,255,255,0.18)",
                    transition: "width 0.4s",
                  }}
                />
                <div style={{ width: 2, background: "rgba(0,0,0,0.4)", flexShrink: 0 }} />
                <div
                  style={{
                    flex: 1,
                    background: rightThemed ? "var(--club-primary)" : "rgba(255,255,255,0.18)",
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-white/30 tabular-nums">{leftPoss}%</span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>posse de bola</span>
                <span className="text-[10px] text-white/30 tabular-nums">{rightPoss}%</span>
              </div>
            </div>
          )}

          {/* Three-column stats row */}
          {(leftShots > 0 || rightShots > 0 || goalScorers.length > 0 || !!motm) && (
            <div className="grid grid-cols-3 px-4 pb-3 pt-2 gap-x-2">

              {/* Left team stats */}
              <div className="flex flex-col gap-1 items-start justify-start">
                {leftShots > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/50 font-bold tabular-nums">{leftShots}</span>
                    <span className="text-[10px] text-white/25">finalizações</span>
                  </div>
                )}
              </div>

              {/* Center: scorers + MOTM */}
              <div className="flex flex-col items-center gap-1">
                {goalScorers.map((g, i) => (
                  <span
                    key={i}
                    className="text-[10px] text-white/50 leading-tight text-center px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    ⚽ {g.name} {g.minute}&apos;
                  </span>
                ))}
                {motm && (
                  <span
                    className="text-[10px] font-semibold mt-0.5 px-2 py-0.5 rounded-full"
                    style={{ color: "#fbbf24", background: "rgba(234,179,8,0.1)" }}
                  >
                    ⭐ {motm.name.split(" ").at(-1)}
                  </span>
                )}
              </div>

              {/* Right team stats */}
              <div className="flex flex-col gap-1 items-end justify-start">
                {rightShots > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/25">finalizações</span>
                    <span className="text-[10px] text-white/50 font-bold tabular-nums">{rightShots}</span>
                  </div>
                )}
              </div>

            </div>
          )}
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

export function PartidasView({ careerId, seasonId, season, clubName, clubLogoUrl, matches, allPlayers, onMatchAdded, competitions, isReadOnly }: PartidasViewProps) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchRecord | null>(null);

  if (selectedMatch) {
    return (
      <MatchDetailPage
        match={selectedMatch}
        clubName={clubName}
        clubLogoUrl={clubLogoUrl}
        allPlayers={allPlayers}
        onBack={() => setSelectedMatch(null)}
        careerId={careerId}
        seasonId={seasonId}
        season={season}
        competitions={competitions}
        isReadOnly={isReadOnly}
        onMatchUpdated={(updated) => setSelectedMatch(updated)}
      />
    );
  }

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
        {!isReadOnly && (
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
        )}
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
                  onClick={() => setSelectedMatch(m)}
                />
              ))
            )}
          </div>
        </>
      )}

      {matches.length === 0 && <EmptyState onAdd={() => setModalOpen(true)} />}

      {!isReadOnly && modalOpen && (
        <RegistrarPartidaModal
          careerId={careerId}
          seasonId={seasonId}
          season={season}
          clubName={clubName}
          clubLogoUrl={clubLogoUrl}
          allPlayers={allPlayers}
          onMatchAdded={onMatchAdded}
          onClose={() => setModalOpen(false)}
          competitions={competitions}
        />
      )}
    </div>
  );
}
