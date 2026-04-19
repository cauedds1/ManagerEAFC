import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { MatchRecord, PlayerMatchStats, GoalEntry } from "@/types/match";
import { getMatchResult, getMatchResultFull, RESULT_STYLE, LOCATION_ICONS, LOCATION_LABELS, GOAL_TYPE_ICONS, GOAL_TYPE_LABELS } from "@/types/match";
import { getAllMatchesForCareer } from "@/lib/matchStorage";
import type { SquadPlayer } from "@/lib/squadCache";
import { getCachedClubList } from "@/lib/clubListCache";
import { searchStaticClubs } from "@/lib/staticClubList";
import { FootballPitch, pickBestEleven } from "./FootballPitch";
import { RegistrarPartidaModal } from "./RegistrarPartidaModal";
import { isRival } from "@/lib/rivalsStorage";

function resolveOpponentLogo(name: string, stored?: string): string | undefined {
  if (stored) return stored;
  const q = name.toLowerCase().trim();
  const cached = getCachedClubList();
  if (cached && cached.length > 0) {
    const exact = cached.find((c) => c.name.toLowerCase() === q);
    if (exact?.logo) return exact.logo;
    const partial = cached.find(
      (c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()),
    );
    if (partial?.logo) return partial.logo;
  }
  return searchStaticClubs(name)[0]?.logo ?? undefined;
}

function ratingColor(r: number): string {
  if (r > 8.5) return "#60a5fa";
  if (r >= 7.6) return "#34d399";
  if (r >= 6.5) return "#fbbf24";
  return "#f87171";
}

function ratingBg(r: number): string {
  if (r > 8.5) return "rgba(96,165,250,0.18)";
  if (r >= 7.6) return "rgba(52,211,153,0.18)";
  if (r >= 6.5) return "rgba(251,191,36,0.18)";
  return "rgba(248,113,113,0.18)";
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts.at(-1) ?? name) : name;
}

function calcMinutes(
  playerId: number,
  stats: PlayerMatchStats,
  match: MatchRecord,
): number {
  if (!stats.startedOnBench) {
    return stats.substituted && stats.substitutedAtMinute != null
      ? stats.substitutedAtMinute
      : 90;
  }
  for (const sid of match.starterIds) {
    const s = match.playerStats[sid];
    if (s && s.substitutedInPlayerId === playerId && s.substitutedAtMinute != null) {
      return 90 - s.substitutedAtMinute;
    }
  }
  return 0;
}

function PlayerPhoto({
  photo,
  name,
  size,
  borderColor,
}: {
  photo: string;
  name: string;
  size: number;
  borderColor: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  if (!photo || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `2.5px solid ${borderColor}`,
          background: "rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.28,
          fontWeight: 900,
          color: "rgba(255,255,255,0.6)",
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
    );
  }
  return (
    <img
      src={photo}
      alt={name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2.5px solid ${borderColor}`,
        objectFit: "cover",
        flexShrink: 0,
      }}
      onError={() => setFailed(true)}
    />
  );
}


function StatRow({ label, leftVal, rightVal, leftHigher }: {
  label: string;
  leftVal: string | number;
  rightVal: string | number;
  leftHigher?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-sm font-bold tabular-nums w-10 text-right"
        style={{ color: leftHigher === true ? "white" : leftHigher === false ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.7)" }}
      >
        {leftVal}
      </span>
      <span className="text-xs text-white/40 flex-1 text-center">{label}</span>
      <span
        className="text-sm font-bold tabular-nums w-10"
        style={{ color: leftHigher === false ? "white" : leftHigher === true ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.7)" }}
      >
        {rightVal}
      </span>
    </div>
  );
}

const POS_BADGE: Record<string, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)", color: "#f59e0b" },
  DEF: { bg: "rgba(59,130,246,0.18)", color: "#60a5fa" },
  MID: { bg: "rgba(16,185,129,0.18)", color: "#34d399" },
  ATA: { bg: "rgba(239,68,68,0.18)", color: "#f87171" },
};

function PlayerDetailPanel({
  player,
  match,
  allPlayers,
  onClose,
}: {
  player: SquadPlayer;
  match: MatchRecord;
  allPlayers: SquadPlayer[];
  onClose: () => void;
}) {
  const stats = match.playerStats[player.id];
  const isStarter = match.starterIds.includes(player.id);
  const minutes = stats ? calcMinutes(player.id, stats, match) : 0;
  const rating = stats?.rating ?? 0;
  const ratingC = rating > 0 ? ratingColor(rating) : "rgba(255,255,255,0.3)";
  const ratingB = rating > 0 ? ratingBg(rating) : "rgba(255,255,255,0.06)";

  const goalsScored = stats?.goals?.length ?? 0;
  const assists = (() => {
    let count = 0;
    for (const pid of [...match.starterIds, ...match.subIds]) {
      const s = match.playerStats[pid];
      if (s?.goals) for (const g of s.goals) if (g.assistPlayerId === player.id) count++;
    }
    return count;
  })();

  const subEntryMinute = (() => {
    if (!isStarter && stats) {
      for (const sid of match.starterIds) {
        const s = match.playerStats[sid];
        if (s && s.substitutedInPlayerId === player.id && s.substitutedAtMinute != null)
          return s.substitutedAtMinute;
      }
    }
    return null;
  })();

  const replacedPlayer = !isStarter && stats?.substitutedForPlayerId != null
    ? allPlayers.find((p) => p.id === stats.substitutedForPlayerId)
    : null;

  const inPlayerForStarter = isStarter && stats?.substituted && stats.substitutedInPlayerId != null
    ? allPlayers.find((p) => p.id === stats.substitutedInPlayerId)
    : null;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const events: { label: string; minute?: number; color: string }[] = [
    ...(stats?.yellowCard ? [{ label: "Cartão amarelo", minute: stats.yellowCardMinute, color: "#fbbf24" }] : []),
    ...(stats?.yellowCard2 ? [{ label: "2º Cartão amarelo", minute: stats.yellowCard2Minute, color: "#fbbf24" }] : []),
    ...(stats?.redCard ? [{ label: "Cartão vermelho", minute: stats.yellowCard2 ? stats.yellowCard2Minute : stats.redCardMinute, color: "#ef4444" }] : []),
    ...(stats?.ownGoal ? [{ label: "Autogolo", minute: stats.ownGoalMinute, color: "#f87171" }] : []),
    ...(stats?.missedPenalty ? [{ label: "Pênalti falhado", minute: stats.missedPenaltyMinute, color: "#f97316" }] : []),
    ...(stats?.injured ? [{ label: "Lesão", minute: stats.injuryMinute, color: "#fb923c" }] : []),
  ];

  const extraStats = [
    stats?.shots != null ? {
      label: "Finalizações",
      value: stats.shotsOnTargetPct != null ? `${stats.shots} (${stats.shotsOnTargetPct}% no gol)` : stats.shots,
    } : null,
    stats?.passes != null ? { label: "Passes", value: stats.passes } : null,
    stats?.passAccuracy != null ? { label: "Precisão", value: `${stats.passAccuracy}%` } : null,
    stats?.keyPasses != null ? { label: "Passes-chave", value: stats.keyPasses } : null,
    stats?.dribblesCompleted != null ? {
      label: "Dribles",
      value: stats.dribblesSuccessRate != null ? `${stats.dribblesCompleted} (${stats.dribblesSuccessRate}%)` : stats.dribblesCompleted,
    } : null,
    stats?.saves != null ? { label: "Defesas", value: stats.saves } : null,
    stats?.ballRecoveries != null ? { label: "Recuperações", value: stats.ballRecoveries } : null,
  ].filter(Boolean).slice(0, 4) as { label: string; value: string | number }[];

  const pos = POS_BADGE[player.positionPtBr] ?? POS_BADGE.MID;
  const hasGoals = stats?.goals && stats.goals.length > 0;
  const hasExtras = extraStats.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="w-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          maxWidth: 460,
          background: "var(--app-bg-lighter, #141024)",
          border: "1px solid var(--surface-border)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-start justify-between px-5 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--surface-border)" }}
        >
          <div className="flex items-center gap-4 min-w-0">
            <PlayerPhoto photo={player.photo} name={player.name} size={68} borderColor={ratingC} />
            <div className="flex-1 min-w-0">
              <h2 className="text-white text-base font-black leading-tight truncate">{player.name}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {rating > 0 && (
                  <span className="text-sm font-black px-2 py-0.5 rounded-lg tabular-nums" style={{ background: ratingB, color: ratingC }}>
                    {rating.toFixed(1)}
                  </span>
                )}
                {player.number != null && (
                  <span className="text-white/35 text-xs font-semibold">#{player.number}</span>
                )}
                {player.id === match.motmPlayerId && (
                  <span className="text-xs px-2 py-0.5 rounded-lg font-semibold" style={{ background: "rgba(234,179,8,0.15)", color: "#fbbf24" }}>
                    ⭐ MOTM
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}>
                  {isStarter ? "Titular" : `Entrou${subEntryMinute != null ? ` ${subEntryMinute}'` : ""}`}
                </span>
                {replacedPlayer && (
                  <span className="text-white/35 text-[11px]">↑ {lastName(replacedPlayer.name)}</span>
                )}
                {inPlayerForStarter && (
                  <span className="text-white/35 text-[11px]">↓ {lastName(inPlayerForStarter.name)}{stats?.substitutedAtMinute != null ? ` ${stats.substitutedAtMinute}'` : ""}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-2 w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── 4-col stats row ── */}
        <div className="px-5 pt-4 pb-3 grid grid-cols-4 gap-2">
          {[
            { label: "Nota", value: rating > 0 ? rating.toFixed(1) : "—", accent: rating > 0 ? ratingC : undefined, sub: rating > 0 ? (rating > 8.5 ? "Excelente" : rating >= 7.6 ? "Bom" : rating >= 6.5 ? "Regular" : "Abaixo") : undefined, subColor: ratingB },
            { label: "Minutos", value: minutes > 0 ? `${minutes}'` : "—" },
            { label: "Golos", value: goalsScored > 0 ? goalsScored : "—" },
            { label: "Assist.", value: assists > 0 ? assists : "—" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1 rounded-xl py-3"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-xl font-black tabular-nums leading-none" style={{ color: item.accent ?? "white" }}>
                {item.value}
              </span>
              {item.sub && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: item.subColor, color: item.accent }}>
                  {item.sub}
                </span>
              )}
              <span className="text-white/35 text-[10px] font-semibold">{item.label}</span>
            </div>
          ))}
        </div>

        {/* ── Extra stats (passes, saves, etc.) ── */}
        {hasExtras && (
          <div className="px-5 pb-3 grid grid-cols-2 gap-1.5">
            {extraStats.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <span className="text-white/40 text-xs">{item.label}</span>
                <span className="text-white font-bold text-sm tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Goals + events list ── */}
        {(hasGoals || events.length > 0) && (
          <div
            className="mx-5 mb-4 rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {hasGoals && stats!.goals.map((g, i) => {
              const assister = g.assistPlayerId != null ? allPlayers.find((p) => p.id === g.assistPlayerId) : null;
              const isLast = i === stats!.goals.length - 1 && events.length === 0;
              const typeIcon = g.goalType ? GOAL_TYPE_ICONS[g.goalType] : "⚽";
              const typeLabel = g.goalType && g.goalType !== "normal" ? GOAL_TYPE_LABELS[g.goalType] : null;
              return (
                <div key={g.id ?? i} className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-sm">{typeIcon}</span>
                  <span className="text-white/80 text-sm font-semibold tabular-nums">{g.minute}'</span>
                  {typeLabel && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                      {typeLabel}
                    </span>
                  )}
                  {assister && <span className="text-white/35 text-xs ml-auto">👟 {lastName(assister.name)}</span>}
                </div>
              );
            })}
            {events.map((ev, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: i < events.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <span className="text-sm font-bold" style={{ color: ev.color }}>{ev.label}</span>
                {ev.minute != null && <span className="ml-auto text-xs tabular-nums font-semibold" style={{ color: ev.color }}>{ev.minute}'</span>}
              </div>
            ))}
          </div>
        )}

        {/* ── Close button ── */}
        <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--surface-border)", paddingTop: 14 }}>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ClubLogo({
  logoUrl,
  name,
  size,
}: {
  logoUrl?: string | null;
  name: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  if (!logoUrl || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.3,
          fontWeight: 900,
          color: "rgba(255,255,255,0.4)",
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
    );
  }
  return (
    <img
      src={logoUrl}
      alt={name}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}

export function MatchDetailPage({
  match: initialMatch,
  clubName,
  clubLogoUrl,
  allPlayers,
  onBack,
  careerId,
  seasonId,
  season,
  competitions,
  onMatchUpdated,
  onSelectMatch,
  isReadOnly,
}: {
  match: MatchRecord;
  clubName: string;
  clubLogoUrl?: string | null;
  allPlayers: SquadPlayer[];
  onBack: () => void;
  careerId?: string;
  seasonId?: string;
  season?: string;
  competitions?: string[];
  onMatchUpdated?: (match: MatchRecord) => void;
  onSelectMatch?: (match: MatchRecord) => void;
  isReadOnly?: boolean;
}) {
  const [match, setMatch] = useState<MatchRecord>(initialMatch);
  const [selectedPlayer, setSelectedPlayer] = useState<SquadPlayer | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [rivalCrestFlipped, setRivalCrestFlipped] = useState(false);
  const [showH2H, setShowH2H] = useState(false);

  const h2hMatches = useMemo(() => {
    if (!careerId) return [];
    const opponent = match.opponent.toLowerCase().trim();
    return getAllMatchesForCareer(careerId)
      .filter((m) => m.opponent.toLowerCase().trim() === opponent)
      .sort((a, b) => {
        const aT = a.date ? new Date(a.date + "T12:00:00").getTime() : a.createdAt;
        const bT = b.date ? new Date(b.date + "T12:00:00").getTime() : b.createdAt;
        return bT - aT;
      });
  }, [careerId, match.id, match.opponent]);

  const h2hStats = useMemo(() => {
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
    for (const m of h2hMatches) {
      goalsFor += m.myScore;
      goalsAgainst += m.opponentScore;
      if (m.myScore > m.opponentScore) wins++;
      else if (m.myScore === m.opponentScore) draws++;
      else losses++;
    }
    return { wins, draws, losses, goalsFor, goalsAgainst };
  }, [h2hMatches]);

  const handleMatchUpdated = (updated: MatchRecord) => {
    setMatch(updated);
    onMatchUpdated?.(updated);
    setIsEditModalOpen(false);
  };

  const result = getMatchResultFull(match.myScore, match.opponentScore, match.penaltyShootout);
  const rs = RESULT_STYLE[result];
  const isHome = match.location !== "fora";
  const oppLogo = resolveOpponentLogo(match.opponent, match.opponentLogoUrl);

  const isRivalWin  = result === "vitoria" && isRival(seasonId ?? "", match.opponent);
  const isRivalLoss = result === "derrota" && isRival(seasonId ?? "", match.opponent);

  useEffect(() => {
    if (isRivalWin) {
      const t = setTimeout(() => setRivalCrestFlipped(true), 300);
      return () => clearTimeout(t);
    } else {
      setRivalCrestFlipped(false);
    }
  }, [isRivalWin]);

  const myScore = match.myScore;
  const oppScore = match.opponentScore;

  // Posicionamento: home = meu time à esquerda; away = meu time à direita
  const leftLogoUrl  = isHome ? clubLogoUrl : oppLogo;
  const leftName     = isHome ? clubName    : match.opponent;
  const leftScore    = isHome ? myScore     : oppScore;
  const rightLogoUrl = isHome ? oppLogo     : clubLogoUrl;
  const rightName    = isHome ? match.opponent : clubName;
  const rightScore   = isHome ? oppScore    : myScore;
  const leftWon  = leftScore > rightScore;
  const rightWon = rightScore > leftScore;
  const isDraw   = leftScore === rightScore;

  const glowColor = isRivalWin
    ? "rgba(234,88,12,0.26)"
    : isRivalLoss
      ? "rgba(88,0,0,0.40)"
      : result === "vitoria"
        ? "rgba(16,185,129,0.14)"
        : result === "derrota"
          ? "rgba(239,68,68,0.14)"
          : "rgba(148,163,184,0.06)";

  // Gradiente vem do lado do meu escudo (esquerda=casa, direita=fora)
  const gradientAngle = isHome ? 135 : 225;

  const dateStr = match.date
    ? new Date(match.date + "T12:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  const motmPlayer =
    match.motmPlayerId != null
      ? allPlayers.find((p) => p.id === match.motmPlayerId)
      : null;
  const motmDisplayName = motmPlayer?.name ?? match.motmPlayerName ?? null;
  const motmPhoto = motmPlayer?.photo;

  const starters = match.starterIds
    .map((id) => allPlayers.find((p) => p.id === id))
    .filter((p): p is SquadPlayer => !!p);

  const sortedStarterIds = pickBestEleven(starters);

  const playerRatings: Record<number, number> = {};
  for (const [pidStr, stats] of Object.entries(match.playerStats)) {
    if (stats.rating > 0) playerRatings[Number(pidStr)] = stats.rating;
  }

  const subs = match.subIds
    .map((id) => allPlayers.find((p) => p.id === id))
    .filter((p): p is SquadPlayer => !!p);

  const myPoss = match.matchStats.possessionPct;
  const oppPoss = myPoss > 0 ? 100 - myPoss : 0;

  const goalsByPlayer: { player: SquadPlayer; goals: GoalEntry[] }[] = [];
  for (const pid of match.starterIds) {
    const stats = match.playerStats[pid];
    const player = allPlayers.find((p) => p.id === pid);
    if (stats && player && stats.goals.length > 0) {
      goalsByPlayer.push({ player, goals: stats.goals });
    }
  }
  for (const pid of match.subIds) {
    const stats = match.playerStats[pid];
    const player = allPlayers.find((p) => p.id === pid);
    if (stats && player && stats.goals.length > 0) {
      goalsByPlayer.push({ player, goals: stats.goals });
    }
  }

  interface SubEvent { goingOff: SquadPlayer; comingOn: SquadPlayer; minute: number }
  const subEvents: SubEvent[] = [];
  for (const sid of match.starterIds) {
    const stats = match.playerStats[sid];
    if (stats?.substituted && stats.substitutedAtMinute != null && stats.substitutedInPlayerId != null) {
      const goingOff = allPlayers.find((p) => p.id === sid);
      const comingOn = allPlayers.find((p) => p.id === stats.substitutedInPlayerId);
      if (goingOff && comingOn) {
        subEvents.push({ goingOff, comingOn, minute: stats.substitutedAtMinute });
      }
    }
  }
  subEvents.sort((a, b) => a.minute - b.minute);

  return (
    <div className="animate-fade-up space-y-5">
      {/* Back + Actions row */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/50 hover:text-white/90 transition-colors text-sm font-semibold"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>

        <div className="flex items-center gap-2">
          {careerId && h2hMatches.length > 0 && (
            <button
              onClick={() => setShowH2H(true)}
              title="Ver histórico de confrontos diretos"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors text-sm font-semibold"
              style={{
                border: "1px solid rgba(255,255,255,0.09)",
                color: "rgba(255,255,255,0.55)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"; (e.currentTarget as HTMLButtonElement).style.background = ""; }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" />
              </svg>
              Confrontos Diretos ({h2hMatches.length})
            </button>
          )}
          {!isReadOnly && careerId && seasonId && season && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              title="Editar partida"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/50 hover:text-white/90 hover:bg-white/08 transition-colors text-sm font-semibold"
              style={{ border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L8.122 19.167 4 20l.833-4.122 12.03-11.391z" />
              </svg>
              Editar
            </button>
          )}
        </div>
      </div>

      {/* H2H Modal */}
      {showH2H && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)" }}
            onClick={() => setShowH2H(false)}
          />
          <div
            className="relative w-full max-w-md flex flex-col animate-fade-up rounded-2xl overflow-hidden"
            style={{
              background: "var(--app-bg)",
              border: "1px solid rgba(var(--club-primary-rgb),0.18)",
              backdropFilter: "blur(24px)",
              maxHeight: "80vh",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(var(--club-primary-rgb),0.1)" }}
            >
              <div>
                <p className="text-white font-bold text-base">Confrontos Diretos</p>
                <p className="text-white/40 text-xs mt-0.5">
                  vs {match.opponent} — {h2hMatches.length} confronto{h2hMatches.length !== 1 ? "s" : ""}
                </p>
                {h2hMatches.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums"
                      style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}
                    >
                      {h2hStats.wins}V
                    </span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums"
                      style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}
                    >
                      {h2hStats.draws}E
                    </span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums"
                      style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}
                    >
                      {h2hStats.losses}D
                    </span>
                    <span className="text-white/20 text-xs mx-0.5">·</span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}
                    >
                      ⚽ {h2hStats.goalsFor} / {h2hStats.goalsAgainst}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowH2H(false)}
                className="text-white/35 hover:text-white/90 transition-colors p-1.5 rounded-lg hover:bg-white/06"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2 pb-6">
              {h2hMatches.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <svg className="w-10 h-10 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                  </svg>
                  <p className="text-white/30 text-sm">Nenhum confronto anterior registrado.</p>
                </div>
              )}
              {h2hMatches.map((m) => {
                const r = getMatchResult(m.myScore, m.opponentScore);
                const resultLabel = r === "vitoria" ? "V" : r === "empate" ? "E" : "D";
                const resultColor = r === "vitoria" ? "#34d399" : r === "empate" ? "#fbbf24" : "#f87171";
                const resultBg = r === "vitoria" ? "rgba(52,211,153,0.13)" : r === "empate" ? "rgba(251,191,36,0.13)" : "rgba(248,113,113,0.13)";
                const dateFormatted = m.date
                  ? new Date(m.date + "T12:00:00").toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "—";
                const competition = [m.tournament, m.stage].filter(Boolean).join(" • ");
                return (
                  <button
                    key={m.id}
                    onClick={() => { setShowH2H(false); onSelectMatch?.(m); }}
                    className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-colors active:scale-[0.99]"
                    style={{ border: "1px solid rgba(var(--club-primary-rgb),0.08)", background: "rgba(var(--club-primary-rgb),0.03)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(var(--club-primary-rgb),0.09)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(var(--club-primary-rgb),0.03)"; }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-sm"
                      style={{ background: resultBg, color: resultColor, border: `1px solid ${resultColor}28` }}
                    >
                      {resultLabel}
                    </div>
                    <div
                      className="text-white font-bold text-base w-10 text-center flex-shrink-0 tabular-nums"
                    >
                      {m.myScore}–{m.opponentScore}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white/75 text-sm font-medium">{dateFormatted}</p>
                      {competition && (
                        <p className="text-white/35 text-xs truncate mt-0.5">{competition}</p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-white/22 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {isEditModalOpen && careerId && seasonId && season && (
        <RegistrarPartidaModal
          careerId={careerId}
          seasonId={seasonId}
          season={season}
          clubName={clubName}
          clubLogoUrl={clubLogoUrl}
          allPlayers={allPlayers}
          competitions={competitions}
          editMatch={match}
          onMatchAdded={() => {}}
          onMatchUpdated={handleMatchUpdated}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}

      {/* Main 2-col layout: pitch left, info right */}
      <div className="grid gap-5 items-start" style={{ gridTemplateColumns: "320px 1fr" }}>

        {/* LEFT: Pitch */}
        <div>
          <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase mb-2">Titulares</p>
          {starters.length > 0 ? (
            <FootballPitch
              players={allPlayers}
              starterIds={sortedStarterIds}
              ratings={playerRatings}
              onPlayerClick={setSelectedPlayer}
              className="w-full"
            />
          ) : (
            <div
              className="rounded-2xl flex items-center justify-center py-16"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-white/25 text-sm">Nenhum titular registrado</span>
            </div>
          )}
        </div>

        {/* RIGHT: All match info */}
        <div className="space-y-4">

          {/* Match header */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: isRivalWin
                ? `linear-gradient(${gradientAngle}deg, rgba(154,52,18,0.30) 0%, rgba(234,88,12,0.08) 55%, rgba(0,0,0,0.18) 100%)`
                : isRivalLoss
                  ? `linear-gradient(${gradientAngle}deg, rgba(40,0,0,0.55) 0%, rgba(88,0,0,0.20) 60%, rgba(0,0,0,0.25) 100%)`
                  : `linear-gradient(${gradientAngle}deg, ${glowColor} 0%, rgba(255,255,255,0.02) 55%)`,
              border: isRivalWin
                ? "1px solid rgba(249,115,22,0.60)"
                : isRivalLoss
                  ? "1px solid rgba(127,29,29,0.65)"
                  : "1px solid rgba(255,255,255,0.08)",
            }}
          >
        {/* Meta */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1 gap-3">
          <div className="flex items-center gap-2">
            <span className="opacity-50 text-sm" title={LOCATION_LABELS[match.location]}>
              {LOCATION_ICONS[match.location]}
            </span>
            {match.tournament && (
              <span className="text-white/65 text-sm font-semibold">{match.tournament}</span>
            )}
            {match.stage && <span className="text-white/30 text-xs">{match.stage}</span>}
            {match.tablePositionBefore != null && (
              <span className="text-white/20 text-xs">· #{match.tablePositionBefore}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/30 text-xs capitalize">{dateStr}</span>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest"
              style={{ background: rs.bg, color: rs.color }}
            >
              {rs.label}
            </span>
          </div>
        </div>

        {/* Clássico banner */}
        {(isRivalWin || isRivalLoss) && (
          <div style={{
            textAlign: "center",
            padding: "7px 20px",
            fontSize: 11,
            fontVariant: "small-caps",
            letterSpacing: "0.09em",
            fontWeight: 700,
            background: isRivalWin ? "rgba(154,52,18,0.30)" : "rgba(40,0,0,0.45)",
            color: isRivalWin ? "#fb923c" : "#fca5a5",
            borderTop: isRivalWin ? "1px solid rgba(249,115,22,0.2)" : "1px solid rgba(127,29,29,0.3)",
            borderBottom: isRivalWin ? "1px solid rgba(249,115,22,0.2)" : "1px solid rgba(127,29,29,0.3)",
          }}>
            {isRivalWin ? "⚔️ CLÁSSICO · VITÓRIA SOBRE RIVAL" : "💀 DERROTA NO CLÁSSICO"}
          </div>
        )}

        {/* Score */}
        <div className="flex items-center gap-4 px-5 py-5">
          {/* Left team */}
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <div style={{
              transform: isRivalWin && !isHome ? (rivalCrestFlipped ? "rotate(180deg)" : "rotate(0deg)") : "none",
              transition: isRivalWin && !isHome ? "transform 0.6s cubic-bezier(0.34,1.56,0.64,1)" : undefined,
              opacity: isRivalLoss && isHome ? 0.4 : 1,
            }}>
              <ClubLogo logoUrl={leftLogoUrl} name={leftName} size={72} />
            </div>
            <span className="text-white/70 text-sm font-bold text-center leading-tight">{leftName}</span>
          </div>

          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span
                className="text-5xl font-black tabular-nums leading-none"
                style={{
                  color: isDraw
                    ? "rgba(255,255,255,0.85)"
                    : isRivalWin
                      ? (isHome ? "#f97316" : "rgba(255,255,255,0.15)")
                      : isRivalLoss
                        ? (isHome ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.85)")
                        : leftWon ? rs.color : "rgba(255,255,255,0.2)",
                }}
              >
                {leftScore}
              </span>
              <span className="text-2xl font-light" style={{ color: "rgba(255,255,255,0.15)" }}>:</span>
              <span
                className="text-5xl font-black tabular-nums leading-none"
                style={{
                  color: isDraw
                    ? "rgba(255,255,255,0.85)"
                    : isRivalWin
                      ? (!isHome ? "#f97316" : "rgba(255,255,255,0.15)")
                      : isRivalLoss
                        ? (!isHome ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.85)")
                        : rightWon ? rs.color : "rgba(255,255,255,0.2)",
                }}
              >
                {rightScore}
              </span>
            </div>

            {/* Extra time / penalty score */}
            {match.hasExtraTime && !match.penaltyShootout && (
              <span className="text-xs font-semibold" style={{ color: "rgba(251,191,36,0.75)" }}>após prorrogação</span>
            )}
            {match.penaltyShootout && (() => {
              const leftPen = isHome ? match.penaltyShootout.myScore : match.penaltyShootout.opponentScore;
              const rightPen = isHome ? match.penaltyShootout.opponentScore : match.penaltyShootout.myScore;
              const penWon = leftPen > rightPen;
              return (
                <div className="flex flex-col items-center gap-0.5 mt-1">
                  <span className="text-[10px] font-medium" style={{ color: "rgba(192,132,252,0.55)" }}>pênaltis</span>
                  <span
                    className="text-xl font-black tabular-nums leading-none"
                    style={{ color: "rgba(192,132,252,0.9)", letterSpacing: "0.04em" }}
                  >
                    {leftPen} × {rightPen}
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: penWon ? "rgba(52,211,153,0.7)" : "rgba(248,113,113,0.7)" }}>
                    {penWon ? `${leftName} vence nos pênaltis` : `${rightName} vence nos pênaltis`}
                  </span>
                </div>
              );
            })()}

            {/* Goal scorers — two-column layout */}
            {(goalsByPlayer.length > 0 || (match.opponentGoals?.length ?? 0) > 0) && (() => {
              const myGoalEntries = goalsByPlayer
                .flatMap((entry) =>
                  entry.goals.map((g) => ({
                    name: lastName(entry.player.name),
                    minute: g.minute,
                    isPenalty: g.goalType === "penalti",
                  }))
                )
                .sort((a, b) => a.minute - b.minute);
              const oppGoalEntries = (match.opponentGoals ?? [])
                .map((g) => ({ name: g.playerName ? lastName(g.playerName) : match.opponent.split(" ")[0], minute: g.minute, isPenalty: false }))
                .sort((a, b) => a.minute - b.minute);
              const leftGoals = isHome ? myGoalEntries : oppGoalEntries;
              const rightGoals = isHome ? oppGoalEntries : myGoalEntries;
              return (
                <div className="flex gap-3 mt-1.5 w-full">
                  {/* Left team goals — right-aligned */}
                  <div className="flex-1 flex flex-col items-end gap-0.5 overflow-hidden">
                    {leftGoals.map((g, i) => (
                      <span key={i} className="text-[10px] text-white/50 text-right leading-tight whitespace-nowrap">
                        {g.name} {g.minute}&apos;{g.isPenalty ? " (P)" : ""}
                      </span>
                    ))}
                  </div>
                  {/* Thin vertical divider */}
                  <div className="w-px self-stretch bg-white/10 flex-shrink-0" />
                  {/* Right team goals — left-aligned */}
                  <div className="flex-1 flex flex-col items-start gap-0.5 overflow-hidden">
                    {rightGoals.map((g, i) => (
                      <span key={i} className="text-[10px] text-white/50 text-left leading-tight whitespace-nowrap">
                        {g.name} {g.minute}&apos;{g.isPenalty ? " (P)" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right team */}
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <div style={{
              transform: isRivalWin && isHome ? (rivalCrestFlipped ? "rotate(180deg)" : "rotate(0deg)") : "none",
              transition: isRivalWin && isHome ? "transform 0.6s cubic-bezier(0.34,1.56,0.64,1)" : undefined,
              opacity: isRivalLoss && !isHome ? 0.4 : 1,
            }}>
              <ClubLogo logoUrl={rightLogoUrl} name={rightName} size={72} />
            </div>
            <span className="text-white/70 text-sm font-bold text-center leading-tight">{rightName}</span>
          </div>
        </div>

        {/* MOTM */}
        {motmDisplayName && (
          <div
            className="mx-5 mb-4 flex items-center gap-3 rounded-xl px-4 py-2.5"
            style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.15)" }}
          >
            <span className="text-sm">⭐</span>
            <span className="text-xs font-semibold" style={{ color: "#fbbf24" }}>Jogador da partida</span>
            <div className="flex items-center gap-2 ml-auto">
              <PlayerPhoto photo={motmPhoto} name={motmDisplayName} size={28} borderColor="#fbbf24" />
              <span className="text-white/80 text-sm font-bold">{motmDisplayName}</span>
              {motmPlayer && (match.playerStats[motmPlayer.id]?.rating ?? 0) > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: "#fbbf24", color: "#000" }}>
                  {match.playerStats[motmPlayer.id].rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        )}
          </div>

          {/* Stats + subs + bench */}
          <div className="flex flex-col gap-4">

          {/* Match stats */}
          {(myPoss > 0 || match.matchStats.myShots > 0 || match.matchStats.opponentShots > 0) && (
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase">Estatísticas</p>

              {/* Team labels */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-white/60 w-10 text-right truncate">{clubName.split(" ")[0]}</span>
                <span className="flex-1" />
                <span className="text-xs font-bold text-white/60 w-10 truncate">{match.opponent.split(" ")[0]}</span>
              </div>

              {myPoss > 0 && (
                <div className="space-y-1.5">
                  <StatRow
                    label="Posse de bola"
                    leftVal={`${myPoss}%`}
                    rightVal={`${oppPoss}%`}
                    leftHigher={myPoss > oppPoss ? true : myPoss < oppPoss ? false : undefined}
                  />
                  <div className="flex rounded-full overflow-hidden" style={{ height: 5 }}>
                    <div
                      style={{
                        width: `${myPoss}%`,
                        background: "var(--club-primary)",
                        transition: "width 0.4s",
                      }}
                    />
                    <div style={{ width: 2, background: "rgba(0,0,0,0.5)", flexShrink: 0 }} />
                    <div style={{ flex: 1, background: "rgba(255,255,255,0.15)" }} />
                  </div>
                </div>
              )}

              {(match.matchStats.myShots > 0 || match.matchStats.opponentShots > 0) && (
                <StatRow
                  label="Finalizações"
                  leftVal={match.matchStats.myShots}
                  rightVal={match.matchStats.opponentShots}
                  leftHigher={
                    match.matchStats.myShots > match.matchStats.opponentShots
                      ? true
                      : match.matchStats.myShots < match.matchStats.opponentShots
                      ? false
                      : undefined
                  }
                />
              )}
            </div>
          )}

          {/* Substitutions */}
          {subEvents.length > 0 && (
            <div
              className="rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase mb-3">Substituições</p>
              <div className="space-y-3">
                {subEvents.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 tabular-nums w-6 text-right flex-shrink-0">
                      {ev.minute}&apos;
                    </span>
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      {/* Entrou */}
                      <button
                        onClick={() => setSelectedPlayer(ev.comingOn)}
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity text-left"
                      >
                        <span className="text-green-400 text-[9px] font-bold w-10 text-right flex-shrink-0">Entrou</span>
                        <PlayerPhoto photo={ev.comingOn.photo} name={ev.comingOn.name} size={22} borderColor={
                          (match.playerStats[ev.comingOn.id]?.rating ?? 0) > 0
                            ? ratingColor(match.playerStats[ev.comingOn.id].rating)
                            : "rgba(255,255,255,0.25)"
                        } />
                        <span className="text-white/75 text-xs font-semibold truncate">{ev.comingOn.name}</span>
                        {(match.playerStats[ev.comingOn.id]?.rating ?? 0) > 0 && (
                          <span className="ml-auto text-[10px] font-bold flex-shrink-0" style={{ color: ratingColor(match.playerStats[ev.comingOn.id].rating) }}>
                            {match.playerStats[ev.comingOn.id].rating.toFixed(1)}
                          </span>
                        )}
                      </button>
                      {/* Saiu */}
                      <button
                        onClick={() => setSelectedPlayer(ev.goingOff)}
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity text-left"
                      >
                        <span className="text-red-400 text-[9px] font-bold w-10 text-right flex-shrink-0">Saiu</span>
                        <PlayerPhoto photo={ev.goingOff.photo} name={ev.goingOff.name} size={22} borderColor={
                          (match.playerStats[ev.goingOff.id]?.rating ?? 0) > 0
                            ? ratingColor(match.playerStats[ev.goingOff.id].rating)
                            : "rgba(255,255,255,0.25)"
                        } />
                        <span className="text-white/40 text-xs truncate">{ev.goingOff.name}</span>
                        {(match.playerStats[ev.goingOff.id]?.rating ?? 0) > 0 && (
                          <span className="ml-auto text-[10px] font-bold flex-shrink-0" style={{ color: ratingColor(match.playerStats[ev.goingOff.id].rating) }}>
                            {match.playerStats[ev.goingOff.id].rating.toFixed(1)}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unused subs */}
          {subs.filter((s) => !subEvents.some((ev) => ev.comingOn.id === s.id)).length > 0 && (
            <div
              className="rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase mb-3">No banco</p>
              <div className="space-y-2">
                {subs
                  .filter((s) => !subEvents.some((ev) => ev.comingOn.id === s.id))
                  .map((player) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayer(player)}
                      className="flex items-center gap-2 w-full hover:opacity-80 transition-opacity"
                    >
                      <PlayerPhoto
                        photo={player.photo}
                        name={player.name}
                        size={28}
                        borderColor="rgba(255,255,255,0.2)"
                      />
                      <span className="text-white/50 text-xs font-semibold">{player.name}</span>
                      <span className="text-white/20 text-[10px] ml-auto">{player.positionPtBr}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          </div>

          {/* Ratings table (all players who played) */}
          {(starters.length > 0 || subs.filter((s) => subEvents.some((ev) => ev.comingOn.id === s.id)).length > 0) && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
            <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase">Notas dos jogadores</p>
          </div>
          <div className="divide-y" style={{ "--tw-divide-opacity": 1 } as React.CSSProperties}>
            {[
              ...starters,
              ...subs.filter((s) => subEvents.some((ev) => ev.comingOn.id === s.id)),
            ]
              .sort((a, b) => {
                const ra = match.playerStats[a.id]?.rating ?? 0;
                const rb = match.playerStats[b.id]?.rating ?? 0;
                return rb - ra;
              })
              .map((player) => {
                const stats = match.playerStats[player.id];
                const rating = stats?.rating ?? 0;
                const color = rating > 0 ? ratingColor(rating) : undefined;
                const mins = stats ? calcMinutes(player.id, stats, match) : 0;
                return (
                  <button
                    key={player.id}
                    onClick={() => setSelectedPlayer(player)}
                    className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.03] transition-colors text-left"
                    style={{ borderColor: "rgba(255,255,255,0.05)" }}
                  >
                    <PlayerPhoto photo={player.photo} name={player.name} size={32} borderColor={color ?? "rgba(255,255,255,0.15)"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm font-semibold truncate">{player.name}</p>
                      <p className="text-white/30 text-[10px]">
                        {player.positionPtBr}
                        {mins > 0 && <span> · {mins}&apos;</span>}
                        {stats?.goals && stats.goals.length > 0 && (
                          <span className="ml-1">· {stats.goals.length} ⚽</span>
                        )}
                        {stats?.yellowCard && !stats?.yellowCard2 && <span className="ml-1">🟨</span>}
                        {stats?.yellowCard2 && <span className="ml-1">🟨🟨</span>}
                        {stats?.redCard && !stats?.yellowCard2 && <span className="ml-1">🟥</span>}
                      </p>
                    </div>
                    {rating > 0 ? (
                      <span
                        className="text-sm font-black tabular-nums px-2.5 py-1 rounded-lg"
                        style={{ background: ratingBg(rating), color: ratingColor(rating) }}
                      >
                        {rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-white/15 text-sm">—</span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
          )}

        </div>
      </div>

      {/* Penalty kicks detail */}
      {match.penaltyShootout && (match.penaltyShootout.kicks.length > 0 || (match.penaltyShootout.goalkeeperSaves ?? 0) > 0) && (
        <div
          className="mx-4 mb-4 rounded-2xl p-4 space-y-3"
          style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.18)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "rgba(192,132,252,0.6)" }}>🥅 Cobradores de Pênalti</p>
            {(match.penaltyShootout?.goalkeeperSaves ?? 0) > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
                🧤 {match.penaltyShootout!.goalkeeperSaves} defesa{match.penaltyShootout!.goalkeeperSaves !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {match.penaltyShootout.kicks.map((kick, i) => {
              const kPlayer = kick.playerId != null ? allPlayers.find((p) => p.id === kick.playerId) : null;
              const kName = kPlayer ? kPlayer.name : "Jogador desconhecido";
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-white/20 text-xs w-4 flex-shrink-0 tabular-nums">{i + 1}.</span>
                  <span className="text-white/70 text-xs flex-1 font-medium">{kName}</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-lg"
                    style={{
                      background: kick.scored ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
                      color: kick.scored ? "#4ade80" : "#f87171",
                    }}
                  >
                    {kick.scored ? "✓ Gol" : "✗ Erro"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Observations */}
      {match.observations && (
        <div
          className="mx-4 mb-4 rounded-2xl p-4 space-y-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase">Observações</p>
          <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap">{match.observations}</p>
        </div>
      )}

      {/* Player detail panel */}
      {selectedPlayer && (
        <PlayerDetailPanel
          player={selectedPlayer}
          match={match}
          allPlayers={allPlayers}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
