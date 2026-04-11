import { useState, useEffect, useRef } from "react";
import type { MatchRecord, PlayerMatchStats } from "@/types/match";
import { getMatchResult, RESULT_STYLE, LOCATION_ICONS, LOCATION_LABELS } from "@/types/match";
import type { SquadPlayer } from "@/lib/squadCache";
import { getCachedClubList } from "@/lib/clubListCache";
import { searchStaticClubs } from "@/lib/staticClubList";

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
  if (r >= 8.0) return "#34d399";
  if (r >= 6.5) return "#fbbf24";
  return "#f87171";
}

function ratingBg(r: number): string {
  if (r >= 8.0) return "rgba(52,211,153,0.18)";
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

function PitchPlayerPin({
  player,
  stats,
  isMotm,
  onClick,
}: {
  player: SquadPlayer;
  stats?: PlayerMatchStats;
  isMotm: boolean;
  onClick: () => void;
}) {
  const rating = stats?.rating ?? 0;
  const color = rating > 0 ? ratingColor(rating) : "rgba(255,255,255,0.35)";
  const lname = lastName(player.name);
  const hasYellow = stats?.yellowCard;
  const hasRed = stats?.redCard;
  const scored = stats?.goals && stats.goals.length > 0;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 group"
      style={{ minWidth: 52, maxWidth: 72 }}
    >
      <div style={{ position: "relative" }}>
        <PlayerPhoto photo={player.photo} name={player.name} size={44} borderColor={color} />
        {player.number != null && (
          <span
            style={{
              position: "absolute",
              top: -4,
              left: -5,
              background: "rgba(0,0,0,0.75)",
              color: "rgba(255,255,255,0.85)",
              borderRadius: "50%",
              fontSize: 9,
              fontWeight: 900,
              width: 17,
              height: 17,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            {player.number}
          </span>
        )}
        {rating > 0 && (
          <span
            style={{
              position: "absolute",
              bottom: -5,
              right: -6,
              background: color,
              color: "#000",
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 900,
              padding: "1px 3px",
              lineHeight: 1.3,
              boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
            }}
          >
            {rating.toFixed(1)}
          </span>
        )}
        {isMotm && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -6,
              fontSize: 11,
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))",
            }}
          >
            ⭐
          </span>
        )}
        <div
          style={{
            position: "absolute",
            bottom: -5,
            left: -5,
            display: "flex",
            gap: 1,
          }}
        >
          {scored && (
            <span style={{ fontSize: 9, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}>
              ⚽
            </span>
          )}
          {hasYellow && (
            <span
              style={{
                width: 7,
                height: 10,
                background: "#fbbf24",
                borderRadius: 1,
                boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}
            />
          )}
          {hasRed && (
            <span
              style={{
                width: 7,
                height: 10,
                background: "#ef4444",
                borderRadius: 1,
                boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}
            />
          )}
        </div>
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "rgba(255,255,255,0.9)",
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
          lineHeight: 1.2,
          maxWidth: 68,
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {lname}
      </span>
    </button>
  );
}

function PitchView({
  starters,
  playerStats,
  motmPlayerId,
  onPlayerClick,
}: {
  starters: SquadPlayer[];
  playerStats: Record<number, PlayerMatchStats>;
  motmPlayerId?: number;
  onPlayerClick: (p: SquadPlayer) => void;
}) {
  const gks = starters.filter((p) => p.positionPtBr === "GOL");
  const defs = starters.filter((p) => p.positionPtBr === "DEF");
  const mids = starters.filter((p) => p.positionPtBr === "MID");
  const atas = starters.filter((p) => p.positionPtBr === "ATA");

  const rows = [gks, defs, mids, atas];

  return (
    <div
      style={{
        position: "relative",
        background: "linear-gradient(180deg, #1c6b30 0%, #22813a 45%, #22813a 55%, #1c6b30 100%)",
        borderRadius: 16,
        overflow: "hidden",
        paddingTop: 24,
        paddingBottom: 24,
        paddingLeft: 12,
        paddingRight: 12,
        minHeight: 340,
      }}
    >
      {/* Field markings */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 320 360"
        preserveAspectRatio="none"
      >
        <rect x="16" y="6" width="288" height="348" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
        <line x1="16" y1="180" x2="304" y2="180" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
        <circle cx="160" cy="180" r="36" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
        <circle cx="160" cy="180" r="2" fill="rgba(255,255,255,0.25)" />
        <rect x="92" y="6" width="136" height="60" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <rect x="120" y="6" width="80" height="24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <circle cx="160" cy="56" r="2" fill="rgba(255,255,255,0.2)" />
        <rect x="92" y="294" width="136" height="60" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <rect x="120" y="330" width="80" height="24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <circle cx="160" cy="304" r="2" fill="rgba(255,255,255,0.2)" />
      </svg>

      {/* Players */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          height: "100%",
        }}
      >
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              gap: row.length > 4 ? 4 : 12,
              flexWrap: row.length > 5 ? "wrap" : "nowrap",
            }}
          >
            {row.map((player) => (
              <PitchPlayerPin
                key={player.id}
                player={player}
                stats={playerStats[player.id]}
                isMotm={player.id === motmPlayerId}
                onClick={() => onPlayerClick(player)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
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
  const panelRef = useRef<HTMLDivElement>(null);
  const stats = match.playerStats[player.id];
  const isStarter = match.starterIds.includes(player.id);
  const minutes = stats ? calcMinutes(player.id, stats, match) : 0;
  const rating = stats?.rating ?? 0;
  const color = rating > 0 ? ratingColor(rating) : "rgba(255,255,255,0.3)";
  const bg = rating > 0 ? ratingBg(rating) : "rgba(255,255,255,0.06)";

  const assists = stats?.goals?.filter((g) => g.assistPlayerId != null).length ?? 0;
  const goalsScored = stats?.goals?.filter((g) => !stats.ownGoal).length ?? 0;

  const subEntryMinute = (() => {
    if (!isStarter && stats) {
      for (const sid of match.starterIds) {
        const s = match.playerStats[sid];
        if (s && s.substitutedInPlayerId === player.id && s.substitutedAtMinute != null) {
          return s.substitutedAtMinute;
        }
      }
    }
    return null;
  })();

  const replacedPlayer = (() => {
    if (!isStarter && stats?.substitutedForPlayerId != null) {
      return allPlayers.find((p) => p.id === stats.substitutedForPlayerId);
    }
    return null;
  })();

  const inPlayerForStarter = (() => {
    if (isStarter && stats?.substituted && stats.substitutedInPlayerId != null) {
      return allPlayers.find((p) => p.id === stats.substitutedInPlayerId);
    }
    return null;
  })();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const statItems: { label: string; value: number | string; icon?: string }[] = [
    { label: "Minutos", value: minutes ? `${minutes}'` : "—", icon: "⏱" },
    { label: "Gols", value: goalsScored, icon: "⚽" },
    { label: "Assistências", value: assists, icon: "🎯" },
    ...(stats?.passes != null ? [{ label: "Passes", value: stats.passes, icon: "🔄" }] : []),
    ...(stats?.passAccuracy != null ? [{ label: "Precisão passes", value: `${stats.passAccuracy}%`, icon: "✅" }] : []),
    ...(stats?.keyPasses != null ? [{ label: "Passes-chave", value: stats.keyPasses, icon: "🔑" }] : []),
    ...(stats?.dribblesCompleted != null ? [{ label: "Dribles", value: stats.dribblesCompleted, icon: "🏃" }] : []),
    ...(stats?.ballRecoveries != null ? [{ label: "Recuperações", value: stats.ballRecoveries, icon: "💪" }] : []),
    ...(stats?.ballLosses != null ? [{ label: "Perdas de bola", value: stats.ballLosses, icon: "❌" }] : []),
    ...(stats?.saves != null ? [{ label: "Defesas", value: stats.saves, icon: "🧤" }] : []),
    ...(stats?.penaltiesSaved != null ? [{ label: "Pênaltis defendidos", value: stats.penaltiesSaved, icon: "🧱" }] : []),
  ];

  const events: { label: string; minute?: number; color: string }[] = [
    ...(stats?.yellowCard ? [{ label: "Cartão amarelo", color: "#fbbf24" }] : []),
    ...(stats?.redCard ? [{ label: "Cartão vermelho", color: "#ef4444" }] : []),
    ...(stats?.ownGoal ? [{ label: "Autogolo", minute: stats.ownGoalMinute, color: "#f87171" }] : []),
    ...(stats?.missedPenalty ? [{ label: "Pênalti falhado", minute: stats.missedPenaltyMinute, color: "#f97316" }] : []),
    ...(stats?.injured ? [{ label: "Lesão", minute: stats.injuryMinute, color: "#fb923c" }] : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="ml-auto flex flex-col overflow-y-auto"
        style={{
          width: "min(380px, 95vw)",
          height: "100%",
          background: "#0d1b2e",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 20px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div className="flex items-start gap-4">
            <div style={{ position: "relative", flexShrink: 0 }}>
              <PlayerPhoto photo={player.photo} name={player.name} size={64} borderColor={color} />
              {player.number != null && (
                <span
                  style={{
                    position: "absolute",
                    bottom: -4,
                    right: -4,
                    background: "rgba(0,0,0,0.85)",
                    color: "rgba(255,255,255,0.8)",
                    borderRadius: "50%",
                    fontSize: 10,
                    fontWeight: 900,
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  {player.number}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-white font-black text-base leading-tight">{player.name}</h3>
              <p className="text-white/40 text-xs mt-0.5">{player.positionPtBr}</p>
              {rating > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className="text-xl font-black"
                    style={{ color }}
                  >
                    {rating.toFixed(1)}
                  </span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: bg, color }}
                  >
                    {rating >= 8.0 ? "Excelente" : rating >= 7.0 ? "Bom" : rating >= 6.5 ? "Regular" : "Abaixo"}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status chips */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
            >
              {isStarter ? "Titular" : `Entrou ${subEntryMinute != null ? `${subEntryMinute}'` : ""}`}
            </span>
            {replacedPlayer && (
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}
              >
                ↑ {lastName(replacedPlayer.name)}
              </span>
            )}
            {inPlayerForStarter && (
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}
              >
                ↓ {lastName(inPlayerForStarter.name)} {stats?.substitutedAtMinute != null ? `${stats.substitutedAtMinute}'` : ""}
              </span>
            )}
            {player.id === match.motmPlayerId && (
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(234,179,8,0.15)", color: "#fbbf24" }}
              >
                ⭐ Jogador da partida
              </span>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ padding: "16px 20px" }}>
          <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase mb-3">Estatísticas</p>
          <div className="grid grid-cols-2 gap-2">
            {statItems.map((item, i) => (
              <div
                key={i}
                className="flex flex-col gap-0.5 rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-white/35 text-[10px]">{item.icon} {item.label}</span>
                <span className="text-white font-black text-lg tabular-nums leading-tight">
                  {typeof item.value === "number" && item.value === 0 ? (
                    <span className="text-white/20">—</span>
                  ) : (
                    item.value
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Events */}
        {events.length > 0 && (
          <div style={{ padding: "0 20px 20px" }}>
            <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase mb-3">Eventos</p>
            <div className="flex flex-col gap-2">
              {events.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${ev.color}22` }}
                >
                  <span className="text-sm font-bold" style={{ color: ev.color }}>
                    {ev.label}
                  </span>
                  {ev.minute != null && (
                    <span className="ml-auto text-xs tabular-nums" style={{ color: ev.color }}>
                      {ev.minute}&apos;
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scorers detail */}
        {stats?.goals && stats.goals.length > 0 && (
          <div style={{ padding: "0 20px 20px" }}>
            <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase mb-3">Golos</p>
            <div className="flex flex-col gap-2">
              {stats.goals.map((g, i) => {
                const assister = g.assistPlayerId != null
                  ? allPlayers.find((p) => p.id === g.assistPlayerId)
                  : null;
                return (
                  <div
                    key={g.id ?? i}
                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.12)" }}
                  >
                    <span className="text-xs">⚽</span>
                    <span className="text-white/70 text-sm">{g.minute}&apos;</span>
                    {assister && (
                      <span className="text-white/35 text-xs ml-auto">Ass: {lastName(assister.name)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
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
  match,
  clubName,
  clubLogoUrl,
  allPlayers,
  onBack,
}: {
  match: MatchRecord;
  clubName: string;
  clubLogoUrl?: string | null;
  allPlayers: SquadPlayer[];
  onBack: () => void;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<SquadPlayer | null>(null);

  const result = getMatchResult(match.myScore, match.opponentScore);
  const rs = RESULT_STYLE[result];
  const isHome = match.location !== "fora";
  const oppLogo = resolveOpponentLogo(match.opponent, match.opponentLogoUrl);

  const myScore = match.myScore;
  const oppScore = match.opponentScore;

  const glowColor =
    result === "vitoria"
      ? "rgba(16,185,129,0.14)"
      : result === "derrota"
      ? "rgba(239,68,68,0.14)"
      : "rgba(148,163,184,0.06)";

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

  const starters = match.starterIds
    .map((id) => allPlayers.find((p) => p.id === id))
    .filter((p): p is SquadPlayer => !!p);

  const subs = match.subIds
    .map((id) => allPlayers.find((p) => p.id === id))
    .filter((p): p is SquadPlayer => !!p);

  const myPoss = match.matchStats.possessionPct;
  const oppPoss = myPoss > 0 ? 100 - myPoss : 0;

  const goalsByPlayer: { player: SquadPlayer; minutes: number[] }[] = [];
  for (const pid of match.starterIds) {
    const stats = match.playerStats[pid];
    const player = allPlayers.find((p) => p.id === pid);
    if (stats && player && stats.goals.length > 0) {
      goalsByPlayer.push({
        player,
        minutes: stats.goals.map((g) => g.minute),
      });
    }
  }
  for (const pid of match.subIds) {
    const stats = match.playerStats[pid];
    const player = allPlayers.find((p) => p.id === pid);
    if (stats && player && stats.goals.length > 0) {
      goalsByPlayer.push({
        player,
        minutes: stats.goals.map((g) => g.minute),
      });
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
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-white/50 hover:text-white/90 transition-colors text-sm font-semibold"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Partidas
      </button>

      {/* Match header */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${glowColor} 0%, rgba(255,255,255,0.02) 55%)`,
          border: "1px solid rgba(255,255,255,0.08)",
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

        {/* Score */}
        <div className="flex items-center gap-4 px-5 py-5">
          {/* My team (always on left) */}
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <ClubLogo logoUrl={clubLogoUrl} name={clubName} size={72} />
            <span className="text-white/70 text-sm font-bold text-center leading-tight">{clubName}</span>
          </div>

          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span
                className="text-5xl font-black tabular-nums leading-none"
                style={{
                  color: myScore > oppScore ? rs.color : myScore === oppScore ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)",
                }}
              >
                {myScore}
              </span>
              <span className="text-2xl font-light" style={{ color: "rgba(255,255,255,0.15)" }}>:</span>
              <span
                className="text-5xl font-black tabular-nums leading-none"
                style={{
                  color: oppScore > myScore ? rs.color : oppScore === myScore ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)",
                }}
              >
                {oppScore}
              </span>
            </div>

            {/* Goal scorers */}
            {goalsByPlayer.length > 0 && (
              <div className="flex flex-col items-center gap-0.5 mt-1">
                {goalsByPlayer.map((entry, i) => (
                  <span key={i} className="text-[10px] text-white/45 text-center">
                    ⚽ {lastName(entry.player.name)} {entry.minutes.map((m) => `${m}'`).join(", ")}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Opponent */}
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <ClubLogo logoUrl={oppLogo} name={match.opponent} size={72} />
            <span className="text-white/70 text-sm font-bold text-center leading-tight">{match.opponent}</span>
          </div>
        </div>

        {/* MOTM */}
        {motmPlayer && (
          <div
            className="mx-5 mb-4 flex items-center gap-3 rounded-xl px-4 py-2.5"
            style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.15)" }}
          >
            <span className="text-sm">⭐</span>
            <span className="text-xs font-semibold" style={{ color: "#fbbf24" }}>Jogador da partida</span>
            <div className="flex items-center gap-2 ml-auto">
              <PlayerPhoto photo={motmPlayer.photo} name={motmPlayer.name} size={28} borderColor="#fbbf24" />
              <span className="text-white/80 text-sm font-bold">{motmPlayer.name}</span>
              {(match.playerStats[motmPlayer.id]?.rating ?? 0) > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: "#fbbf24", color: "#000" }}>
                  {match.playerStats[motmPlayer.id].rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Two-column layout: pitch + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">

        {/* Pitch */}
        <div>
          <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase mb-2">Titulares</p>
          {starters.length > 0 ? (
            <PitchView
              starters={starters}
              playerStats={match.playerStats}
              motmPlayerId={match.motmPlayerId}
              onPlayerClick={setSelectedPlayer}
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

        {/* Side panel: stats + subs */}
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
                      <button
                        onClick={() => setSelectedPlayer(ev.comingOn)}
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity text-left"
                      >
                        <span className="text-green-400 text-xs">↑</span>
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
                      <button
                        onClick={() => setSelectedPlayer(ev.goingOff)}
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity text-left"
                      >
                        <span className="text-red-400 text-xs">↓</span>
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
                        {stats?.yellowCard && <span className="ml-1">🟨</span>}
                        {stats?.redCard && <span className="ml-1">🟥</span>}
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
