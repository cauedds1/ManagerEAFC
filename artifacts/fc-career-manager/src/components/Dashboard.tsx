import { useState, useEffect, useCallback } from "react";
import { Club } from "@/types/club";
import { Settings } from "./Settings";
import {
  getSquad,
  clearSquadCache,
  SquadResult,
  SquadPlayer,
  PositionPtBr,
} from "@/lib/squadCache";
import { getApiKey } from "@/lib/clubListCache";

interface DashboardProps {
  club: Club;
  season: string;
  onSeasonChange: (season: string) => void;
  onChangeClub: () => void;
  onReloadClubs: () => void;
}

const POS_STYLE: Record<PositionPtBr, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)", color: "#f59e0b" },
  ZAG: { bg: "rgba(59,130,246,0.18)", color: "#60a5fa" },
  VOL: { bg: "rgba(16,185,129,0.18)", color: "#34d399" },
  ATA: { bg: "rgba(239,68,68,0.18)", color: "#f87171" },
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function PlayerPhoto({ src, name }: { src: string; name: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(!src);

  useEffect(() => {
    setLoaded(false);
    setError(!src);
  }, [src]);

  return (
    <div
      className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      {!error ? (
        <img
          src={src}
          alt={name}
          className={`w-10 h-10 object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      ) : (
        <svg viewBox="0 0 40 40" className="w-7 h-7" style={{ color: "rgba(255,255,255,0.15)" }} fill="currentColor">
          <circle cx="20" cy="14" r="7" />
          <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
        </svg>
      )}
    </div>
  );
}

function PlayerRow({ player }: { player: SquadPlayer }) {
  const pos = POS_STYLE[player.positionPtBr];
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <PlayerPhoto src={player.photo} name={player.name} />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold leading-tight truncate">{player.name}</p>
        <p className="text-white/30 text-xs mt-0.5">{player.age > 0 ? `${player.age} anos` : ""}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums"
          style={{ background: pos.bg, color: pos.color }}
        >
          {player.positionPtBr}
        </span>
        {player.number != null && (
          <span className="text-white/25 text-xs font-mono tabular-nums w-5 text-right">
            #{player.number}
          </span>
        )}
      </div>
    </div>
  );
}

function SquadSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)", width: "60%" }} />
            <div className="h-2.5 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)", width: "30%" }} />
          </div>
          <div className="w-10 h-5 rounded-md animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
      ))}
    </div>
  );
}

interface SquadSectionProps {
  club: Club;
  onOpenSettings: () => void;
  onPlayersLoaded?: (count: number) => void;
}

function SquadSection({ club, onOpenSettings, onPlayersLoaded }: SquadSectionProps) {
  const [squad, setSquad] = useState<SquadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);
  const hasApiKey = Boolean(getApiKey());
  const teamId = club.apiFootballId ?? 0;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    getSquad(teamId, club.name)
      .then((result) => {
        if (!cancelled) {
          setSquad(result);
          setLoading(false);
          onPlayersLoaded?.(result.players.length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [teamId, club.name, refetchKey]);

  const handleRefresh = useCallback(() => {
    clearSquadCache(teamId);
    setSquad(null);
    setRefetchKey((k) => k + 1);
  }, [teamId]);

  const sourceLabel =
    squad?.source === "api-football"
      ? `API-Football · ${formatDate(squad.cachedAt)}`
      : `EA FC 26 · ${formatDate(squad?.cachedAt ?? Date.now())}`;

  return (
    <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-white/40 text-xs font-semibold tracking-widest uppercase">
            Elenco
          </h2>
          {squad && !loading && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background: squad.source === "api-football" ? "rgba(16,185,129,0.12)" : "rgba(99,102,241,0.12)",
                color: squad.source === "api-football" ? "#34d399" : "#818cf8",
              }}
            >
              {sourceLabel}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors duration-200 disabled:opacity-30"
          title="Atualizar elenco"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-xs">Atualizar</span>
        </button>
      </div>

      {loading ? (
        <SquadSkeleton />
      ) : error ? (
        <div
          className="flex flex-col items-center justify-center py-12 rounded-2xl gap-3"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-white/30 text-sm">Erro ao carregar o elenco</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all duration-200 hover:opacity-80"
            style={{ background: "var(--club-primary)" }}
          >
            Tentar novamente
          </button>
        </div>
      ) : !squad || squad.players.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-12 rounded-2xl gap-3"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-white/30 text-sm text-center leading-relaxed">
            {hasApiKey
              ? "Nenhum jogador encontrado para este clube"
              : "Configure sua chave de API para carregar o elenco real"}
          </p>
          {!hasApiKey && (
            <button
              onClick={onOpenSettings}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all duration-200 hover:opacity-80"
              style={{ background: "var(--club-primary)" }}
            >
              Configurar API key
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {squad.players.map((player) => (
              <PlayerRow key={player.id} player={player} />
            ))}
          </div>
          {!hasApiKey && squad.source === "fc26" && (
            <div
              className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}
            >
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: "#818cf8" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs" style={{ color: "#a5b4fc" }}>
                Dados do EA FC 26. Configure sua{" "}
                <button
                  onClick={onOpenSettings}
                  className="underline font-semibold hover:text-white transition-colors"
                >
                  API key
                </button>{" "}
                para ver o elenco real com fotos.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function useClubLogo(club: Club): string | null {
  const [src, setSrc] = useState<string | null>(() => {
    if (club.logo) return club.logo;
    if (club.apiFootballId) return `https://media.api-sports.io/football/teams/${club.apiFootballId}.png`;
    return null;
  });

  useEffect(() => {
    if (club.logo) { setSrc(club.logo); return; }
    if (club.apiFootballId) {
      setSrc(`https://media.api-sports.io/football/teams/${club.apiFootballId}.png`);
      return;
    }
    setSrc(null);
  }, [club.name, club.logo, club.apiFootballId]);

  return src;
}

function BallIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 0110 10M12 2C6.477 2 2 6.477 2 12m10-10l2 6H10l2-6zM2 12l4.5-3 3 5-3 5L2 12zm20 0l-4.5-3-3 5 3 5L22 12z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

interface RoadmapItem {
  fase: string;
  titulo: string;
  descricao: string;
  accentOpacity: string;
}

const ROADMAP: RoadmapItem[] = [
  { fase: "Fase 3", titulo: "Registro de Partidas", descricao: "Registre resultados, gols, assistências e estatísticas de cada partida", accentOpacity: "18" },
  { fase: "Fase 4", titulo: "Mercado de Transferências", descricao: "Registre chegadas e saídas, controle investimentos e o valor do seu elenco", accentOpacity: "12" },
  { fase: "Fase 5", titulo: "Estatísticas da Temporada", descricao: "Gráficos, artilheiros, sequências, médias e análise completa do desempenho", accentOpacity: "10" },
];

export function Dashboard({ club, season, onSeasonChange, onChangeClub, onReloadClubs }: DashboardProps) {
  const logoUrl = useClubLogo(club);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [editingSeason, setEditingSeason] = useState(false);
  const [seasonDraft, setSeasonDraft] = useState(season);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Squad player count for stat card
  const [squadCount, setSquadCount] = useState(0);

  useEffect(() => { setSeasonDraft(season); }, [season]);
  useEffect(() => { setImgLoaded(false); setImgError(false); }, [logoUrl]);

  const commitSeason = () => {
    const trimmed = seasonDraft.trim();
    if (trimmed) onSeasonChange(trimmed);
    setEditingSeason(false);
  };

  const statCards = [
    { label: "Partidas", value: 0, icon: <BallIcon />, description: "partidas registradas" },
    { label: "Elenco", value: squadCount, icon: <PeopleIcon />, description: "jogadores no elenco" },
    { label: "Transferências", value: 0, icon: <TransferIcon />, description: "movimentações registradas" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--app-bg, #0a0a0a)" }}>
      {/* Header */}
      <header className="relative w-full overflow-hidden" style={{ background: "var(--club-gradient)" }}>
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, var(--club-primary) 0%, transparent 60%), radial-gradient(circle at 80% 50%, var(--club-secondary) 0%, transparent 60%)`,
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                {logoUrl && !imgError ? (
                  <img
                    src={logoUrl}
                    alt={club.name}
                    className={`w-16 h-16 object-contain transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className="text-3xl font-black text-white/40">
                    {club.name.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <p className="text-[var(--club-primary)] text-xs font-semibold tracking-widest uppercase mb-1">
                  Gerenciador de Carreira
                </p>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {club.name}
                </h1>
                <p className="text-white/50 text-sm mt-1">{club.league}</p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-3">
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs">Temporada atual:</span>
                {editingSeason ? (
                  <input
                    autoFocus
                    value={seasonDraft}
                    onChange={(e) => setSeasonDraft(e.target.value)}
                    onBlur={commitSeason}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitSeason();
                      if (e.key === "Escape") { setSeasonDraft(season); setEditingSeason(false); }
                    }}
                    className="px-3 py-1 rounded-lg text-white font-bold text-sm focus:outline-none focus:ring-1 focus:ring-[var(--club-primary)]"
                    style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", minWidth: "80px" }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingSeason(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-sm text-white hover:bg-white/10 transition-colors duration-200 group"
                    style={{ border: "1px solid rgba(255,255,255,0.15)" }}
                    title="Clique para editar a temporada"
                  >
                    {season}
                    <svg className="w-3 h-3 text-white/40 group-hover:text-white/70 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Settings button */}
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="flex items-center justify-center w-10 h-10 rounded-xl text-white/50 hover:text-white transition-all duration-200 hover:bg-white/10"
                  style={{ border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
                  title="Configurações"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                <button
                  onClick={onChangeClub}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:opacity-80 active:scale-95"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Trocar de clube
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        <h2 className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-5">Visão Geral</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="relative flex flex-col gap-4 p-6 rounded-2xl overflow-hidden group"
              style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: "linear-gradient(135deg, var(--club-primary)08, transparent)" }}
              />
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-sm font-medium">{card.label}</span>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--club-primary)]"
                  style={{ background: "var(--club-primary)18" }}
                >
                  {card.icon}
                </div>
              </div>
              <div>
                <p className="text-4xl font-black text-white tabular-nums">{card.value}</p>
                <p className="text-white/30 text-xs mt-1">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Squad Section */}
      <SquadSection
        club={club}
        onOpenSettings={() => setSettingsOpen(true)}
        onPlayersLoaded={setSquadCount}
      />

      {/* Roadmap */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-12">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-white/40 text-xs font-semibold tracking-widest uppercase">
            Próximas funcionalidades
          </h2>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "var(--club-primary)20", color: "var(--club-primary)" }}
          >
            Em breve
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ROADMAP.map((item) => (
            <div
              key={item.fase}
              className="relative flex gap-4 p-5 rounded-2xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, var(--club-primary)${item.accentOpacity}, var(--club-secondary)0a)`,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex-shrink-0">
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
                >
                  {item.fase}
                </span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">{item.titulo}</p>
                <p className="text-white/40 text-xs mt-1.5 leading-relaxed">{item.descricao}</p>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-white/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Settings Modal */}
      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onReloadClubs={() => {
          setSettingsOpen(false);
          onReloadClubs();
        }}
      />
    </div>
  );
}
