import { useState, useEffect, useCallback } from "react";
import { Club } from "@/types/club";
import { Career } from "@/types/career";
import { Settings } from "./Settings";
import {
  getSquad,
  clearSquadCache,
  SquadResult,
  SquadPlayer,
  PositionPtBr,
} from "@/lib/squadCache";
import { getApiKey } from "@/lib/clubListCache";
import { FootballPitch, pickBestElevenIds } from "./FootballPitch";

interface DashboardProps {
  career: Career;
  onSeasonChange: (season: string) => void;
  onGoToCareers: () => void;
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
    <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "rgba(var(--club-primary-rgb),0.06)" }}>
      {!error ? (
        <img src={src} alt={name} className={`w-9 h-9 object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`} onLoad={() => setLoaded(true)} onError={() => setError(true)} />
      ) : (
        <svg viewBox="0 0 40 40" className="w-6 h-6" style={{ color: "rgba(255,255,255,0.15)" }} fill="currentColor">
          <circle cx="20" cy="14" r="7" />
          <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
        </svg>
      )}
    </div>
  );
}

function PitchWithBench({ squad }: { squad: SquadResult }) {
  const starterIds = pickBestElevenIds(squad.players);
  const benchPlayers = squad.players.filter((p) => !starterIds.has(p.id));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
      <FootballPitch players={squad.players} className="w-full" />
      <div className="flex flex-col gap-1 overflow-y-auto lg:max-h-[500px]">
        <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-2">Reservas ({benchPlayers.length})</p>
        {benchPlayers.map((player) => (
          <PlayerRow key={player.id} player={player} />
        ))}
        {benchPlayers.length === 0 && (
          <p className="text-white/20 text-xs text-center py-4">Todos os jogadores estao no time titular</p>
        )}
      </div>
    </div>
  );
}

function PlayerRow({ player }: { player: SquadPlayer }) {
  const pos = POS_STYLE[player.positionPtBr];
  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl glass glass-hover transition-all duration-200">
      <PlayerPhoto src={player.photo} name={player.name} />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold leading-tight truncate">{player.name}</p>
        <p className="text-white/30 text-xs mt-0.5">{player.age > 0 ? `${player.age} anos` : ""}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums" style={{ background: pos.bg, color: pos.color }}>
          {player.positionPtBr}
        </span>
        {player.number != null && (
          <span className="text-white/25 text-xs font-mono tabular-nums w-5 text-right">#{player.number}</span>
        )}
      </div>
    </div>
  );
}

function SquadSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl glass">
          <div className="w-9 h-9 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
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

type SquadTab = "pitch" | "list";

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
  const [tab, setTab] = useState<SquadTab>("pitch");
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
        if (!cancelled) { setError(true); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [teamId, club.name, refetchKey]);

  const handleRefresh = useCallback(() => {
    clearSquadCache(teamId, club.name);
    setSquad(null);
    setRefetchKey((k) => k + 1);
  }, [teamId, club.name]);

  const sourceLabel =
    squad?.source === "api-football"
      ? `API-Football · ${formatDate(squad.cachedAt)}`
      : `EA FC 26 · ${formatDate(squad?.cachedAt ?? Date.now())}`;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-white/40 text-xs font-semibold tracking-widest uppercase">Elenco</h2>
          {squad && !loading && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background: squad.source === "api-football" ? "rgba(16,185,129,0.12)" : "rgba(var(--club-primary-rgb),0.12)",
                color: squad.source === "api-football" ? "#34d399" : "var(--club-primary)",
              }}>
              {sourceLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {squad && squad.players.length > 0 && !loading && (
            <div className="flex rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
              {(["pitch", "list"] as SquadTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200"
                  style={{
                    background: tab === t ? "rgba(var(--club-primary-rgb),0.15)" : "transparent",
                    color: tab === t ? "var(--club-primary)" : "rgba(255,255,255,0.35)",
                  }}
                >
                  {t === "pitch" ? "Campo" : "Lista"}
                </button>
              ))}
            </div>
          )}
          <button onClick={handleRefresh} disabled={loading}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors duration-200 disabled:opacity-30">
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs">Atualizar</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl overflow-hidden" style={{ background: "#0d2218", minHeight: 300 }}>
            <div className="flex items-center justify-center h-72">
              <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "transparent" }} />
            </div>
          </div>
          <SquadSkeleton />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-2xl gap-3 glass">
          <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <p className="text-white/30 text-sm">Erro ao carregar o elenco</p>
          <button onClick={handleRefresh} className="px-4 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-80 transition-opacity"
            style={{ background: "var(--club-gradient)" }}>Tentar novamente</button>
        </div>
      ) : !squad || squad.players.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-2xl gap-3 glass">
          <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <p className="text-white/30 text-sm text-center leading-relaxed">
            {hasApiKey ? "Nenhum jogador encontrado para este clube" : "Configure sua chave de API para carregar o elenco real"}
          </p>
          {!hasApiKey && (
            <button onClick={onOpenSettings} className="px-4 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-80 transition-opacity"
              style={{ background: "var(--club-gradient)" }}>Configurar API key</button>
          )}
        </div>
      ) : (
        <>
          {tab === "pitch" ? (
            <PitchWithBench squad={squad} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {squad.players.map((player) => <PlayerRow key={player.id} player={player} />)}
            </div>
          )}
          {!hasApiKey && squad.source === "fc26" && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl glass">
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--club-primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                Dados do EA FC 26. Configure sua{" "}
                <button onClick={onOpenSettings} className="underline font-semibold hover:text-white transition-colors">API key</button>{" "}
                para ver o elenco real com fotos.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function useClubLogo(career: Career): string | null {
  const [src, setSrc] = useState<string | null>(() => {
    if (career.clubLogo) return career.clubLogo;
    if (career.clubId > 0) return `https://media.api-sports.io/football/teams/${career.clubId}.png`;
    return null;
  });

  useEffect(() => {
    if (career.clubLogo) { setSrc(career.clubLogo); return; }
    if (career.clubId > 0) { setSrc(`https://media.api-sports.io/football/teams/${career.clubId}.png`); return; }
    setSrc(null);
  }, [career.clubName, career.clubLogo, career.clubId]);

  return src;
}

function CoachAvatar({ career }: { career: Career }) {
  const [imgErr, setImgErr] = useState(false);
  const { photo, name } = career.coach;
  const initials = name.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
      style={{ border: "1.5px solid rgba(var(--club-primary-rgb),0.3)", background: "rgba(var(--club-primary-rgb),0.08)" }}>
      {photo && !imgErr ? (
        <img src={photo} alt={name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
      ) : (
        <span className="text-white/60 text-xs font-bold">{initials}</span>
      )}
    </div>
  );
}

const ROADMAP = [
  { fase: "Fase 3", titulo: "Registro de Partidas", descricao: "Registre resultados, gols, assistencias e estatisticas de cada partida" },
  { fase: "Fase 4", titulo: "Mercado de Transferencias", descricao: "Registre chegadas e saidas, controle investimentos e o valor do seu elenco" },
  { fase: "Fase 5", titulo: "Estatisticas da Temporada", descricao: "Graficos, artilheiros, sequencias, medias e analise completa do desempenho" },
];

export function Dashboard({ career, onSeasonChange, onGoToCareers, onChangeClub, onReloadClubs }: DashboardProps) {
  const club: Club = {
    name: career.clubName,
    league: career.clubLeague,
    apiFootballId: career.clubId > 0 ? career.clubId : undefined,
    logo: career.clubLogo || undefined,
  };

  const logoUrl = useClubLogo(career);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [editingSeason, setEditingSeason] = useState(false);
  const [seasonDraft, setSeasonDraft] = useState(career.season);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [squadCount, setSquadCount] = useState(0);

  useEffect(() => { setSeasonDraft(career.season); }, [career.season]);
  useEffect(() => { setImgLoaded(false); setImgError(false); }, [logoUrl]);

  const commitSeason = () => {
    const trimmed = seasonDraft.trim();
    if (trimmed) onSeasonChange(trimmed);
    setEditingSeason(false);
  };

  const statCards = [
    {
      label: "Partidas",
      value: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 0110 10M12 2C6.477 2 2 6.477 2 12m10-10l2 6H10l2-6zM2 12l4.5-3 3 5-3 5L2 12zm20 0l-4.5-3-3 5 3 5L22 12z" />
        </svg>
      ),
      description: "partidas registradas",
    },
    {
      label: "Elenco",
      value: squadCount,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      description: "jogadores no elenco",
    },
    {
      label: "Transferencias",
      value: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      ),
      description: "movimentacoes registradas",
    },
  ];

  return (
    <div className="relative min-h-screen flex flex-col">
      <header className="relative w-full overflow-hidden glass" style={{ borderBottom: "1px solid var(--surface-border)" }}>
        <div className="absolute inset-0 opacity-15"
          style={{ backgroundImage: `radial-gradient(circle at 15% 50%, var(--club-primary) 0%, transparent 55%), radial-gradient(circle at 85% 50%, var(--club-secondary) 0%, transparent 55%)` }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={onGoToCareers}
              className="flex items-center gap-1.5 text-white/40 hover:text-white/80 text-xs font-medium transition-colors duration-200">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Carreiras
            </button>
            <span className="text-white/15 text-xs">/</span>
            <div className="flex items-center gap-1.5">
              <CoachAvatar career={career} />
              <span className="text-white/50 text-xs font-medium truncate max-w-32">{career.coach.name}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(var(--club-primary-rgb),0.1)", border: "1px solid rgba(var(--club-primary-rgb),0.15)", boxShadow: "0 0 30px rgba(var(--club-primary-rgb),0.1)" }}>
                {logoUrl && !imgError ? (
                  <img src={logoUrl} alt={career.clubName}
                    className={`w-12 h-12 object-contain transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} />
                ) : (
                  <span className="text-2xl font-black text-white/40">{career.clubName.substring(0, 2).toUpperCase()}</span>
                )}
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">{career.clubName}</h1>
                <p className="text-white/50 text-sm">{career.clubLeague}</p>
                {(career.clubStadium || career.clubFounded) && (
                  <p className="text-white/20 text-xs mt-0.5 truncate">
                    {career.clubStadium && <span>{career.clubStadium}</span>}
                    {career.clubStadium && career.clubFounded && <span> · </span>}
                    {career.clubFounded && <span>Fundado em {career.clubFounded}</span>}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs">Temp:</span>
                {editingSeason ? (
                  <input autoFocus value={seasonDraft}
                    onChange={(e) => setSeasonDraft(e.target.value)}
                    onBlur={commitSeason}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitSeason();
                      if (e.key === "Escape") { setSeasonDraft(career.season); setEditingSeason(false); }
                    }}
                    className="px-2.5 py-1 rounded-lg text-white font-bold text-sm focus:outline-none glass"
                    style={{ minWidth: "70px", boxShadow: "0 0 12px rgba(var(--club-primary-rgb),0.2)" }}
                  />
                ) : (
                  <button onClick={() => setEditingSeason(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-sm text-white hover:bg-white/10 transition-colors duration-200 group glass">
                    {career.season}
                    <svg className="w-3 h-3 text-white/30 group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
              <button onClick={() => setSettingsOpen(true)}
                className="flex items-center justify-center w-9 h-9 rounded-xl text-white/50 hover:text-white transition-all duration-200 glass glass-hover"
                title="Configuracoes">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button onClick={onChangeClub}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] glass glass-hover">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Trocar
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((card) => (
            <div key={card.label} className="relative flex flex-col gap-3 p-4 rounded-2xl overflow-hidden glass glass-hover transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs font-medium">{card.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(var(--club-primary-rgb),0.1)", color: "var(--club-primary)" }}>
                  {card.icon}
                </div>
              </div>
              <div>
                <p className="text-3xl font-black text-white tabular-nums">{card.value}</p>
                <p className="text-white/30 text-xs mt-0.5">{card.description}</p>
              </div>
            </div>
          ))}
          <div className="relative flex flex-col gap-3 p-4 rounded-2xl overflow-hidden glass glass-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs font-medium">Tecnico</span>
              <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(var(--club-primary-rgb),0.08)", border: "1px solid rgba(var(--club-primary-rgb),0.1)" }}>
                {career.coach.photo ? (
                  <img src={career.coach.photo} alt={career.coach.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-black text-white/30">
                    {career.coach.name.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-base">{career.coach.nationalityFlag}</span>
                <p className="text-white font-black text-sm truncate">{career.coach.name}</p>
              </div>
              <p className="text-white/30 text-xs">{career.coach.nationality} · {career.coach.age} anos</p>
            </div>
          </div>
        </div>

        <SquadSection club={club} onOpenSettings={() => setSettingsOpen(true)} onPlayersLoaded={setSquadCount} />

        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-white/40 text-xs font-semibold tracking-widest uppercase">Proximas funcionalidades</h2>
            <div className="flex-1 h-px" style={{ background: "var(--surface-border)" }} />
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(var(--club-primary-rgb),0.12)", color: "var(--club-primary)" }}>
              Em breve
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ROADMAP.map((item) => (
              <div key={item.fase} className="relative flex gap-3 p-4 rounded-2xl overflow-hidden glass glass-hover transition-all duration-200">
                <div className="flex-shrink-0">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(var(--club-primary-rgb),0.1)", color: "var(--club-primary)" }}>
                    {item.fase}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-bold text-sm mb-1">{item.titulo}</h3>
                  <p className="text-white/30 text-xs leading-relaxed">{item.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onReloadClubs={onReloadClubs} />
    </div>
  );
}
