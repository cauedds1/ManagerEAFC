import { useMemo, useState } from "react";
import type { Career } from "@/types/career";
import type { SquadPlayer, PositionPtBr } from "@/lib/squadCache";
import { getAllPlayerStats } from "@/lib/playerStatsStorage";
import { getMatches } from "@/lib/matchStorage";
import { getCompetitionResults } from "@/lib/competitionResultStorage";
import { getSeasonSummary } from "@/lib/seasonSummaryStorage";
import { getMatchResultFull } from "@/types/match";
import { getCachedClubList } from "@/lib/clubListCache";
import { searchStaticClubs } from "@/lib/staticClubList";

const POS_STYLE: Record<PositionPtBr, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)", color: "#f59e0b" },
  DEF: { bg: "rgba(59,130,246,0.18)", color: "#60a5fa" },
  MID: { bg: "rgba(16,185,129,0.18)", color: "#34d399" },
  ATA: { bg: "rgba(239,68,68,0.18)", color: "#f87171" },
};

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

function MiniCrest({ logoUrl, name, size = 28 }: { logoUrl?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  if (!logoUrl || failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.36, fontWeight: 900, color: "rgba(255,255,255,0.4)",
      }}>{initials}</div>
    );
  }
  return <img src={logoUrl} alt={name} width={size} height={size} style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} onError={() => setFailed(true)} />;
}

function PlayerPhoto({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(!src);
  return (
    <div
      className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
      style={{ background: "rgba(var(--club-primary-rgb),0.08)", border: "1px solid rgba(var(--club-primary-rgb),0.15)" }}
    >
      {!err ? (
        <img src={src} alt={name} className="w-9 h-9 object-cover" onError={() => setErr(true)} />
      ) : (
        <svg viewBox="0 0 40 40" className="w-4 h-4 text-white/20" fill="currentColor">
          <circle cx="20" cy="14" r="7" />
          <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
        </svg>
      )}
    </div>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon && <span className="text-white/30">{icon}</span>}
      <h2 className="text-white/35 text-xs font-bold tracking-widest uppercase">{children}</h2>
    </div>
  );
}

interface SeasonSummaryViewProps {
  careerId: string;
  seasonId: string;
  seasonLabel: string;
  career: Career;
  allPlayers: SquadPlayer[];
  clubLogoUrl?: string | null;
}

export function SeasonSummaryView({ careerId, seasonId, seasonLabel, career, allPlayers, clubLogoUrl }: SeasonSummaryViewProps) {
  const summary = getSeasonSummary(seasonId);
  const matches = useMemo(() => getMatches(seasonId), [seasonId]);
  const allStats = useMemo(() => getAllPlayerStats(seasonId), [seasonId]);
  const trophies = useMemo(
    () => getCompetitionResults(careerId).filter((r) => r.seasonId === seasonId && r.isChampion),
    [careerId, seasonId],
  );

  const playerMap = useMemo(() => new Map(allPlayers.map((p) => [p.id, p])), [allPlayers]);

  const topScorers = useMemo(
    () =>
      Object.values(allStats)
        .filter((s) => s.goals > 0)
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 3)
        .map((s) => ({ stats: s, player: playerMap.get(s.playerId) ?? null }))
        .filter((r) => r.player !== null),
    [allStats, playerMap],
  );

  const topAssisters = useMemo(
    () =>
      Object.values(allStats)
        .filter((s) => s.assists > 0)
        .sort((a, b) => b.assists - a.assists)
        .slice(0, 3)
        .map((s) => ({ stats: s, player: playerMap.get(s.playerId) ?? null }))
        .filter((r) => r.player !== null),
    [allStats, playerMap],
  );

  const seasonTotals = useMemo(() => {
    let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
    for (const m of matches) {
      const r = getMatchResultFull(m.myScore, m.opponentScore, m.penaltyShootout);
      if (r === "vitoria") wins++;
      else if (r === "empate") draws++;
      else losses++;
      gf += m.myScore;
      ga += m.opponentScore;
    }
    return { total: matches.length, wins, draws, losses, gf, ga };
  }, [matches]);

  const bestWin = useMemo(() => {
    const wins = matches.filter((m) => m.myScore > m.opponentScore);
    if (!wins.length) return null;
    return wins.reduce((best, m) => {
      const diff = m.myScore - m.opponentScore;
      const bestDiff = best.myScore - best.opponentScore;
      return diff > bestDiff || (diff === bestDiff && m.myScore > best.myScore) ? m : best;
    });
  }, [matches]);

  const worstLoss = useMemo(() => {
    const losses = matches.filter((m) => m.myScore < m.opponentScore);
    if (!losses.length) return null;
    return losses.reduce((worst, m) => {
      const diff = m.opponentScore - m.myScore;
      const worstDiff = worst.opponentScore - worst.myScore;
      return diff > worstDiff || (diff === worstDiff && m.opponentScore > worst.opponentScore) ? m : worst;
    });
  }, [matches]);

  const medals = ["🥇", "🥈", "🥉"];

  const league = summary?.league;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">

      {/* Header banner */}
      <div
        className="rounded-2xl overflow-hidden relative flex items-center gap-5 px-6 py-5"
        style={{
          background: "linear-gradient(135deg, rgba(var(--club-primary-rgb),0.18) 0%, rgba(0,0,0,0.2) 100%)",
          border: "1px solid rgba(var(--club-primary-rgb),0.2)",
        }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: `radial-gradient(circle at 10% 50%, var(--club-primary) 0%, transparent 60%)` }}
        />
        <div className="relative z-10 flex items-center gap-4 w-full">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(var(--club-primary-rgb),0.12)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}
          >
            {clubLogoUrl ? (
              <img src={clubLogoUrl} alt={career.clubName} className="w-12 h-12 object-contain" />
            ) : (
              <span className="text-2xl font-black text-white/40">{career.clubName.substring(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(var(--club-primary-rgb),0.2)", color: "var(--club-primary)" }}
              >
                Temporada {seasonLabel}
              </span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(16,185,129,0.15)", color: "#34d399" }}
              >
                🏁 Finalizada
              </span>
            </div>
            <h1 className="text-xl font-black text-white">{career.clubName}</h1>
            <p className="text-white/40 text-sm">{career.clubLeague}</p>
          </div>
          {matches.length > 0 && (
            <div className="text-right flex-shrink-0">
              <span className="text-3xl font-black text-white tabular-nums">{seasonTotals.wins}</span>
              <p className="text-white/30 text-xs">vitórias</p>
            </div>
          )}
        </div>
      </div>

      {/* Trophies */}
      {trophies.length > 0 && (
        <div
          className="rounded-2xl px-6 py-5"
          style={{
            background: "linear-gradient(135deg, rgba(234,179,8,0.10) 0%, rgba(0,0,0,0.15) 100%)",
            border: "1px solid rgba(234,179,8,0.20)",
          }}
        >
          <SectionTitle icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          }>Títulos Conquistados</SectionTitle>
          <div className="flex flex-wrap gap-3">
            {trophies.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
                style={{
                  background: "rgba(234,179,8,0.10)",
                  border: "1px solid rgba(234,179,8,0.25)",
                }}
              >
                <span className="text-xl">🏆</span>
                <span className="text-white font-bold text-sm">{t.competitionName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* League card */}
      {league && (
        <div
          className="rounded-2xl px-6 py-5"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <SectionTitle icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }>Desempenho na Liga</SectionTitle>
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-black text-white tabular-nums leading-none">{league.position}°</span>
              <span className="text-white/30 text-sm mb-1">/ {league.totalTeams} times</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-black tabular-nums" style={{ color: "#34d399" }}>{league.wins}</div>
                <div className="text-white/30 text-xs">V</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black tabular-nums text-white/50">{league.draws}</div>
                <div className="text-white/30 text-xs">E</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black tabular-nums" style={{ color: "#f87171" }}>{league.losses}</div>
                <div className="text-white/30 text-xs">D</div>
              </div>
              <div
                className="px-4 py-2 rounded-xl text-center"
                style={{ background: "rgba(var(--club-primary-rgb),0.1)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}
              >
                <div className="text-2xl font-black tabular-nums" style={{ color: "var(--club-primary)" }}>{league.points}</div>
                <div className="text-xs font-semibold" style={{ color: "rgba(var(--club-primary-rgb),0.6)" }}>pts</div>
              </div>
            </div>
            {(league.goalsFor != null || league.goalsAgainst != null) && (
              <div className="flex items-center gap-3 text-sm">
                {league.goalsFor != null && (
                  <span className="text-white/60">
                    <span className="font-black text-white tabular-nums">{league.goalsFor}</span> GF
                  </span>
                )}
                {league.goalsAgainst != null && (
                  <span className="text-white/60">
                    <span className="font-black text-white tabular-nums">{league.goalsAgainst}</span> GS
                  </span>
                )}
                {league.goalsFor != null && league.goalsAgainst != null && (
                  <span
                    className="font-black tabular-nums text-sm px-2 py-0.5 rounded-lg"
                    style={{
                      background: (league.goalsFor - league.goalsAgainst) >= 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                      color: (league.goalsFor - league.goalsAgainst) >= 0 ? "#34d399" : "#f87171",
                    }}
                  >
                    {(league.goalsFor - league.goalsAgainst) >= 0 ? "+" : ""}{league.goalsFor - league.goalsAgainst} SG
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Match totals from match history */}
      {matches.length > 0 && (
        <div
          className="rounded-2xl px-6 py-5"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <SectionTitle icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2c0 0 2.5 4 2.5 10S12 22 12 22M12 2c0 0-2.5 4-2.5 10s2.5 10 2.5 10M2 12h20" />
            </svg>
          }>Temporada nas Partidas</SectionTitle>
          <div className="flex flex-wrap gap-4">
            {[
              { label: "Jogos", value: seasonTotals.total, color: "rgba(255,255,255,0.7)" },
              { label: "Vitórias", value: seasonTotals.wins, color: "#34d399" },
              { label: "Empates", value: seasonTotals.draws, color: "#facc15" },
              { label: "Derrotas", value: seasonTotals.losses, color: "#f87171" },
              { label: "Gols feitos", value: seasonTotals.gf, color: "rgba(var(--club-primary-rgb),1)" },
              { label: "Gols sofridos", value: seasonTotals.ga, color: "rgba(255,255,255,0.4)" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 px-5 py-3 rounded-xl min-w-[72px]"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-3xl font-black tabular-nums" style={{ color }}>{value}</span>
                <span className="text-white/30 text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top performers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { type: "goals" as const, label: "Artilheiros", statLabel: "gols", data: topScorers },
          { type: "assists" as const, label: "Assistentes", statLabel: "assist.", data: topAssisters },
        ].map(({ type, label, statLabel, data }) => (
          <div
            key={type}
            className="rounded-2xl px-5 py-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <SectionTitle icon={
              type === "goals" ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              )
            }>Top 3 {label}</SectionTitle>
            {data.length === 0 ? (
              <p className="text-white/20 text-xs text-center py-4">Nenhum registro</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.map(({ stats, player }, idx) => {
                  if (!player) return null;
                  const pos = POS_STYLE[player.positionPtBr] ?? POS_STYLE.MID;
                  return (
                    <div key={player.id} className="flex items-center gap-3">
                      <span className="text-base leading-none w-5 text-center flex-shrink-0">{medals[idx]}</span>
                      <PlayerPhoto src={player.photo} name={player.name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{player.name}</p>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-md" style={{ background: pos.bg, color: pos.color }}>
                          {player.positionPtBr}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-white font-black text-xl tabular-nums">{stats[type]}</span>
                        <p className="text-white/35 text-xs">{statLabel}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Best win / Worst loss */}
      {(bestWin || worstLoss) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { match: bestWin, label: "Maior Vitória", color: "#34d399", border: "rgba(16,185,129,0.2)", bg: "rgba(16,185,129,0.06)" },
            { match: worstLoss, label: "Pior Derrota", color: "#f87171", border: "rgba(239,68,68,0.2)", bg: "rgba(239,68,68,0.06)" },
          ].map(({ match, label, color, border, bg }) => {
            if (!match) return <div key={label} />;
            const isHome = match.location !== "fora";
            const leftScore = isHome ? match.myScore : match.opponentScore;
            const rightScore = isHome ? match.opponentScore : match.myScore;
            const leftName = isHome ? career.clubName : match.opponent;
            const rightName = isHome ? match.opponent : career.clubName;
            const leftLogo = isHome ? clubLogoUrl : resolveOpponentLogo(match.opponent, match.opponentLogoUrl);
            const rightLogo = isHome ? resolveOpponentLogo(match.opponent, match.opponentLogoUrl) : clubLogoUrl;
            return (
              <div
                key={label}
                className="rounded-2xl px-5 py-4"
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-black tracking-widest uppercase" style={{ color }}>{label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1.5" style={{ width: 40 }}>
                    <MiniCrest logoUrl={leftLogo} name={leftName} size={28} />
                    <span className="text-white/35 text-center leading-tight w-full" style={{ fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {leftName.split(" ")[0]}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-white font-black tabular-nums text-2xl leading-none">
                      {leftScore}
                      <span className="text-white/20 font-light text-lg mx-1">–</span>
                      {rightScore}
                    </span>
                    {match.tournament && (
                      <span className="text-white/30 text-xs mt-1 truncate max-w-full">{match.tournament}</span>
                    )}
                    {match.date && (
                      <span className="text-white/20 text-xs tabular-nums">{formatDate(match.date)}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1.5" style={{ width: 40 }}>
                    <MiniCrest logoUrl={rightLogo} name={rightName} size={28} />
                    <span className="text-white/35 text-center leading-tight w-full" style={{ fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {rightName.split(" ")[0]}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
