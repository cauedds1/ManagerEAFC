import { useState, useMemo } from "react";
import type { SquadPlayer, PositionPtBr } from "@/lib/squadCache";
import { getAllPlayerStats } from "@/lib/playerStatsStorage";
import {
  getLeaguePosition,
  setLeaguePosition,
  type LeaguePosition,
} from "@/lib/leagueStorage";
import type { MatchRecord } from "@/types/match";
import { getMatchResultFull, RESULT_STYLE } from "@/types/match";
import { getCachedClubList } from "@/lib/clubListCache";
import { searchStaticClubs } from "@/lib/staticClubList";
import { isRival } from "@/lib/rivalsStorage";

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

function MiniCrest({ logoUrl, name, size = 26, themed = false }: { logoUrl?: string | null; name: string; size?: number; themed?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  if (!logoUrl || failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: themed ? "rgba(var(--club-primary-rgb),0.18)" : "rgba(255,255,255,0.08)",
        border: themed ? "1px solid rgba(var(--club-primary-rgb),0.3)" : "1px solid rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.36, fontWeight: 900,
        color: themed ? "var(--club-primary)" : "rgba(255,255,255,0.5)",
      }}>{initials}</div>
    );
  }
  return <img src={logoUrl} alt={name} width={size} height={size} style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} onError={() => setFailed(true)} />;
}

const POS_STYLE: Record<PositionPtBr, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)",  color: "#f59e0b" },
  DEF: { bg: "rgba(59,130,246,0.18)",  color: "#60a5fa" },
  MID: { bg: "rgba(16,185,129,0.18)",  color: "#34d399" },
  ATA: { bg: "rgba(239,68,68,0.18)",   color: "#f87171" },
};

interface PainelViewProps {
  careerId: string;
  seasonId: string;
  clubName: string;
  clubLogoUrl?: string | null;
  allPlayers: SquadPlayer[];
  season: string;
  matches: MatchRecord[];
  transferCount: number;
  isReadOnly?: boolean;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-white/35 text-xs font-bold tracking-widest uppercase mb-3">
      {children}
    </h2>
  );
}

function PlayerPhoto({ src, name, size = 8 }: { src: string; name: string; size?: number }) {
  const [err, setErr] = useState(!src);
  const dim = `w-${size} h-${size}`;
  return (
    <div
      className={`${dim} rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center`}
      style={{ background: "rgba(var(--club-primary-rgb),0.08)" }}
    >
      {!err ? (
        <img
          src={src}
          alt={name}
          className={`${dim} object-cover`}
          onError={() => setErr(true)}
        />
      ) : (
        <svg viewBox="0 0 40 40" className="w-4 h-4 text-white/20" fill="currentColor">
          <circle cx="20" cy="14" r="7" />
          <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
        </svg>
      )}
    </div>
  );
}

function LeagueCard({ careerId, isReadOnly }: { careerId: string; isReadOnly?: boolean }) {
  const [data, setData] = useState<LeaguePosition | null>(() => getLeaguePosition(careerId));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LeaguePosition>(
    data ?? { position: 1, totalTeams: 20, wins: 0, draws: 0, losses: 0, points: 0 }
  );

  const save = () => {
    const updated = { ...draft, points: draft.wins * 3 + draft.draws };
    setLeaguePosition(careerId, updated);
    setData(updated);
    setEditing(false);
  };

  const numInput = (
    label: string,
    field: keyof LeaguePosition,
    min = 0,
    max = 99
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-white/40 text-xs">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={draft[field]}
        onChange={(e) =>
          setDraft((d) => ({ ...d, [field]: Math.max(min, Math.min(max, Number(e.target.value) || 0)) }))
        }
        className="w-full px-2.5 py-1.5 rounded-lg text-white text-sm font-semibold focus:outline-none glass tabular-nums"
      />
    </div>
  );

  if (editing) {
    return (
      <div className="glass rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Posição na Liga</SectionTitle>
          <button onClick={() => setEditing(false)} className="text-white/30 hover:text-white/60 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {numInput("Posição", "position", 1, 40)}
          {numInput("Nº de times", "totalTeams", 2, 40)}
          {numInput("Vitórias", "wins", 0, 99)}
          {numInput("Empates", "draws", 0, 99)}
          {numInput("Derrotas", "losses", 0, 99)}
        </div>
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" />
          </svg>
          Pontos calculados automaticamente ({draft.wins * 3 + draft.draws} pts)
        </div>
        <button
          onClick={save}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{ background: "var(--club-gradient)" }}
        >
          Salvar posição
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass rounded-2xl p-5 flex flex-col gap-3 items-center justify-center text-center min-h-[140px]">
        <SectionTitle>Posição na Liga</SectionTitle>
        <svg className="w-7 h-7 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-white/30 text-xs">Nenhuma posição registrada</p>
        {!isReadOnly && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-80"
            style={{ background: "rgba(var(--club-primary-rgb),0.2)", color: "var(--club-primary)" }}
          >
            + Registrar posição
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-2 relative">
      <div className="flex items-center justify-between mb-1">
        <SectionTitle>Posição na Liga</SectionTitle>
        {!isReadOnly && (
          <button
            onClick={() => { setDraft(data); setEditing(true); }}
            className="text-white/25 hover:text-white/55 transition-colors"
            title="Editar"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-5xl font-black text-white tabular-nums leading-none">{data.position}°</span>
        <span className="text-white/35 text-sm mb-1">/ {data.totalTeams} times</span>
      </div>
      <div className="flex items-center gap-3 mt-1">
        <span className="text-xs font-semibold tabular-nums" style={{ color: "#34d399" }}>{data.wins}V</span>
        <span className="text-xs font-semibold tabular-nums text-white/40">{data.draws}E</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color: "#f87171" }}>{data.losses}D</span>
        <span className="text-white/20 text-xs">·</span>
        <span className="text-xs font-black text-white tabular-nums">{data.points} pts</span>
      </div>
    </div>
  );
}

function TopPerformers({
  careerId,
  allPlayers,
  type,
  matchCount,
}: {
  careerId: string;
  allPlayers: SquadPlayer[];
  type: "goals" | "assists";
  matchCount: number;
}) {
  const playerMap = useMemo(
    () => new Map(allPlayers.map((p) => [p.id, p])),
    [allPlayers]
  );

  const ranked = useMemo(() => {
    const allStats = getAllPlayerStats(careerId);
    return Object.values(allStats)
      .filter((s) => s[type] > 0)
      .sort((a, b) => b[type] - a[type])
      .slice(0, 3)
      .map((s) => ({
        stats: s,
        player: playerMap.get(s.playerId) ?? null,
      }))
      .filter((r) => r.player !== null);
  }, [careerId, playerMap, type, matchCount]);

  const label = type === "goals" ? "Artilheiros" : "Assistentes";
  const statLabel = type === "goals" ? "gols" : "assist.";
  const emptyMsg =
    type === "goals"
      ? "Nenhum gol registrado ainda"
      : "Nenhuma assistência registrada ainda";

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-3">
      <SectionTitle>Top 3 {label}</SectionTitle>
      {ranked.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-5 gap-2 text-center">
          <svg
            className="w-7 h-7 text-white/12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            {type === "goals" ? (
              <>
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 0110 10M12 2C6.477 2 2 6.477 2 12m10-10l2 6H10l2-6zM2 12l4.5-3 3 5-3 5L2 12zm20 0l-4.5-3-3 5 3 5L22 12z" />
              </>
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            )}
          </svg>
          <p className="text-white/25 text-xs">{emptyMsg}</p>
          <p className="text-white/15 text-xs">
            Registre partidas com autores dos gols para ver aqui
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ranked.map(({ stats, player }, idx) => {
            if (!player) return null;
            const pos = POS_STYLE[player.positionPtBr] ?? POS_STYLE.MID;
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <div key={player.id} className="flex items-center gap-3">
                <span className="text-base leading-none w-5 text-center flex-shrink-0">{medals[idx]}</span>
                <PlayerPhoto src={player.photo} name={player.name} size={8} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{player.name}</p>
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                    style={{ background: pos.bg, color: pos.color }}
                  >
                    {player.positionPtBr}
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-white font-black text-lg tabular-nums">{stats[type]}</span>
                  <p className="text-white/35 text-xs">{statLabel}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LastMatches({
  seasonId,
  matches,
  clubName,
  clubLogoUrl,
}: {
  seasonId: string;
  matches: MatchRecord[];
  clubName: string;
  clubLogoUrl?: string | null;
}) {
  const last5 = [...matches].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  const LOCATION_LABEL: Record<string, string> = { casa: "Casa", fora: "Fora", neutro: "Neutro" };
  const LOCATION_ICON: Record<string, string> = { casa: "🏠", fora: "✈️", neutro: "⚖️" };

  if (matches.length === 0) {
    return (
      <div className="glass rounded-2xl p-5 flex flex-col gap-3">
        <SectionTitle>Últimas Partidas</SectionTitle>
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl flex-shrink-0 flex flex-col items-center justify-center gap-3 p-4"
              style={{
                width: 136, minHeight: 168,
                background: "rgba(255,255,255,0.025)",
                border: "1px dashed rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="w-8 h-8 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
              </div>
              <div className="w-14 h-3 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
              <div className="w-8 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
            </div>
          ))}
        </div>
        <p className="text-white/20 text-xs text-center">Nenhuma partida registrada ainda</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-3">
      <SectionTitle>Últimas Partidas</SectionTitle>
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {last5.map((m) => {
          const result = getMatchResultFull(m.myScore, m.opponentScore, m.penaltyShootout);
          const rs = RESULT_STYLE[result];
          const isRivalWin = result === "vitoria" && isRival(seasonId, m.opponent);
          const isRivalLoss = result === "derrota" && isRival(seasonId, m.opponent);
          const oppLogoUrl = resolveOpponentLogo(m.opponent, m.opponentLogoUrl);
          const dateStr = m.date
            ? new Date(m.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
            : null;
          const shortOpp = m.opponent.length > 14 ? m.opponent.split(" ").slice(0, 2).join(" ") : m.opponent;
          const shortClub = clubName.length > 14 ? clubName.split(" ").slice(0, 2).join(" ") : clubName;
          const isHome = m.location !== "fora";
          const leftLogo = isHome ? clubLogoUrl : oppLogoUrl;
          const leftName = isHome ? shortClub : shortOpp;
          const leftThemed = isHome;
          const leftScore = isHome ? m.myScore : m.opponentScore;
          const rightLogo = isHome ? oppLogoUrl : clubLogoUrl;
          const rightName = isHome ? shortOpp : shortClub;
          const rightThemed = !isHome;
          const rightScore = isHome ? m.opponentScore : m.myScore;
          const cardBorderLeft = isRivalWin
            ? "3px solid #f97316"
            : isRivalLoss
              ? "3px solid rgba(127,29,29,0.9)"
              : `3px solid ${rs.color}`;
          const cardBorderRest = isRivalWin
            ? "1px solid rgba(249,115,22,0.30)"
            : isRivalLoss
              ? "1px solid rgba(127,29,29,0.45)"
              : `1px solid ${rs.border}`;
          const cardBg = isRivalWin
            ? "linear-gradient(160deg, rgba(154,52,18,0.30) 0%, rgba(0,0,0,0.18) 100%)"
            : isRivalLoss
              ? "linear-gradient(160deg, rgba(40,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%)"
              : `linear-gradient(160deg, ${rs.bg} 0%, rgba(0,0,0,0.18) 100%)`;
          const tournamentColor = isRivalWin
            ? "#fb923c"
            : isRivalLoss
              ? "rgba(252,165,165,0.6)"
              : rs.color;
          const tournamentPrefix = isRivalWin ? "⚔️ " : isRivalLoss ? "💀 " : "";

          return (
            <div
              key={m.id}
              className="rounded-2xl flex-shrink-0 flex flex-col overflow-hidden"
              style={{
                width: 190,
                borderTop: cardBorderRest,
                borderRight: cardBorderRest,
                borderBottom: cardBorderRest,
                borderLeft: cardBorderLeft,
                background: cardBg,
              }}
            >
              {/* Header: tournament (full) + date */}
              <div
                className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2.5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span
                  className="text-xs font-bold leading-tight"
                  style={{ color: tournamentColor, flex: 1, minWidth: 0, wordBreak: "break-word" }}
                >
                  {tournamentPrefix}{m.tournament || "Amistoso"}
                </span>
                {dateStr && (
                  <span className="text-white/35 text-xs flex-shrink-0 font-medium tabular-nums">{dateStr}</span>
                )}
              </div>

              {/* Middle: crests + score — perfectly symmetric 3 columns */}
              <div className="flex items-center justify-between px-3 py-4 gap-1">
                {/* Left club */}
                <div className="flex flex-col items-center gap-1.5" style={{ width: 52 }}>
                  <MiniCrest logoUrl={leftLogo} name={leftName} size={36} themed={leftThemed} />
                  <span
                    className="text-white/40 text-center leading-tight w-full"
                    style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {leftName}
                  </span>
                </div>

                {/* Score + badge — center column */}
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="text-white font-black tabular-nums leading-none" style={{ fontSize: 24 }}>
                    {leftScore}
                    <span className="text-white/20 font-light" style={{ fontSize: 16, margin: "0 3px" }}>–</span>
                    {rightScore}
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full font-black"
                    style={{ background: "rgba(0,0,0,0.3)", color: rs.color, fontSize: 10, letterSpacing: "0.05em" }}
                  >
                    {rs.label}
                  </span>
                </div>

                {/* Right club */}
                <div className="flex flex-col items-center gap-1.5" style={{ width: 52 }}>
                  <MiniCrest logoUrl={rightLogo} name={rightName} size={36} themed={rightThemed} />
                  <span
                    className="text-white/40 text-center leading-tight w-full"
                    style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {rightName}
                  </span>
                </div>
              </div>

              {/* Footer: stage (left) + location (right) */}
              <div
                className="flex items-center justify-between px-3.5 py-2.5 gap-2"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-white/30 text-xs font-medium truncate">
                  {m.stage || "—"}
                </span>
                <span className="text-white/35 flex-shrink-0" style={{ fontSize: 12 }} title={LOCATION_LABEL[m.location]}>
                  {LOCATION_ICON[m.location]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MessagesSection() {
  const senders = [
    { role: "Presidente", icon: "🏛️", color: "rgba(245,158,11,0.18)", text: "#fbbf24" },
    { role: "Auxiliar Técnico", icon: "📋", color: "rgba(59,130,246,0.18)", text: "#60a5fa" },
    { role: "Executivo de Mercado", icon: "💼", color: "rgba(16,185,129,0.18)", text: "#34d399" },
  ];

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionTitle>Mensagens da Direção</SectionTitle>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: "rgba(var(--club-primary-rgb),0.12)", color: "var(--club-primary)" }}
        >
          Em breve
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {senders.map((s) => (
          <div
            key={s.role}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: s.color }}
            >
              {s.icon}
            </div>
            <div className="flex-1 min-w-0">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-md"
                style={{ background: s.color, color: s.text }}
              >
                {s.role}
              </span>
              <p className="text-white/20 text-xs mt-1.5 italic">
                Nenhuma mensagem no momento
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-white/15 text-xs text-center">
        Mensagens aparecerão aqui conforme o progresso da temporada
      </p>
    </div>
  );
}

export function PainelView({
  seasonId,
  clubName,
  clubLogoUrl,
  allPlayers,
  season,
  matches,
  transferCount,
  isReadOnly,
}: PainelViewProps) {
  const careerId = seasonId;
  const quickStats = [
    {
      label: "Partidas",
      value: matches.length,
      sub: "registradas",
      icon: (
        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 0110 10" />
        </svg>
      ),
    },
    {
      label: "Temporada",
      value: season,
      sub: "em andamento",
      icon: (
        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: "Elenco",
      value: allPlayers.length,
      sub: "jogadores",
      icon: (
        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: "Transferências",
      value: transferCount,
      sub: "movimentações",
      icon: (
        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickStats.map((s) => (
          <div
            key={s.label}
            className="glass rounded-2xl p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs font-medium">{s.label}</span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(var(--club-primary-rgb),0.1)", color: "var(--club-primary)" }}
              >
                {s.icon}
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-white/30 text-xs mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <LastMatches seasonId={seasonId} matches={matches} clubName={clubName} clubLogoUrl={clubLogoUrl} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <LeagueCard careerId={careerId} isReadOnly={isReadOnly} />
        <TopPerformers careerId={careerId} allPlayers={allPlayers} type="goals" matchCount={matches.length} />
        <TopPerformers careerId={careerId} allPlayers={allPlayers} type="assists" matchCount={matches.length} />
      </div>

      <MessagesSection />
    </div>
  );
}
