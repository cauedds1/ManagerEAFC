import { useState, useEffect, useCallback } from "react";
import type { Career, Season } from "@/types/career";
import { SettingsPage } from "./SettingsPage";
import {
  getSquad,
  clearSquadCache,
  type SquadResult,
  type SquadPlayer,
  PT_BR_TO_POSITION,
  migratePositionOverride,
} from "@/lib/squadCache";
import { getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import { getTransfers, addTransfer } from "@/lib/transferStorage";
import type { TransferRecord } from "@/types/transfer";
import { getMatches } from "@/lib/matchStorage";
import type { MatchRecord } from "@/types/match";
import { runPerformanceEngine } from "@/lib/playerPerformanceEngine";
import { copyPlayerMoodsToNewSeason } from "@/lib/playerStatsStorage";
import { PainelView } from "./PainelView";
import { ClubeView } from "./ClubeView";
import { TransferenciasView } from "./TransferenciasView";
import { PartidasView } from "./PartidasView";
import { NoticiasView } from "./NoticiasView";
import { DiretoriaView } from "./DiretoriaView";
import { MomentosView } from "./MomentosView";
import { SeasonSelectModal } from "./SeasonSelectModal";
import { NewSeasonWizard } from "./NewSeasonWizard";
import { getSeasons, createSeason, activateSeason, generateSeasonId } from "@/lib/seasonStorage";
import { ensureCareerAndSeason1 } from "@/lib/careerStorage";
import { syncSeasonFromDb, syncCareerFromDb } from "@/lib/dbSync";

interface DashboardProps {
  career: Career;
  onSeasonChange: (season: string) => void;
  onGoToCareers: () => void;
  onChangeClub: () => void;
  onReloadClubs: () => void;
}

type CareerTab = "painel" | "partidas" | "clube" | "transferencias" | "noticias" | "diretoria" | "momentos" | "configuracoes";

const TABS: { id: CareerTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "painel",
    label: "Painel",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: "partidas",
    label: "Partidas",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c0 0 2.5 4 2.5 9s-2.5 9-2.5 9M12 3c0 0-2.5 4-2.5 9s2.5 9 2.5 9M3 12h18" />
      </svg>
    ),
  },
  {
    id: "clube",
    label: "Clube",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: "transferencias",
    label: "Transferências",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    id: "noticias",
    label: "Notícias",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h2" />
      </svg>
    ),
  },
  {
    id: "diretoria",
    label: "Diretoria",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: "momentos",
    label: "Momentos",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

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
    <div
      className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
      style={{ border: "1.5px solid rgba(var(--club-primary-rgb),0.3)", background: "rgba(var(--club-primary-rgb),0.08)" }}
    >
      {photo && !imgErr ? (
        <img src={photo} alt={name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
      ) : (
        <span className="text-white/60 text-xs font-bold">{initials}</span>
      )}
    </div>
  );
}

export function Dashboard({ career, onSeasonChange, onGoToCareers, onChangeClub, onReloadClubs }: DashboardProps) {
  const teamId = career.clubId > 0 ? career.clubId : 0;

  const logoUrl = useClubLogo(career);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const logoImgRef = useCallback((el: HTMLImageElement | null) => {
    if (!el) return;
    if (el.complete) {
      if (el.naturalWidth > 0) setImgLoaded(true);
      else setImgError(true);
    }
  }, []);
  const [activeTab, setActiveTab] = useState<CareerTab>("painel");

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string>(career.currentSeasonId ?? career.id);
  const [activeSeasonLabel, setActiveSeasonLabel] = useState<string>(career.season);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [showNewSeasonWizard, setShowNewSeasonWizard] = useState(false);
  const [creatingNewSeason, setCreatingNewSeason] = useState(false);
  const [dbSynced, setDbSynced] = useState(false);
  const isReadOnly = seasons.length > 0 && seasons.find((s) => s.id === activeSeasonId)?.isActive === false;

  const [squad, setSquad] = useState<SquadResult | null>(null);
  const [squadLoading, setSquadLoading] = useState(true);
  const [squadError, setSquadError] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const [transfers, setTransfers] = useState<TransferRecord[]>(
    () => getTransfers(activeSeasonId)
  );

  const [matches, setMatches] = useState<MatchRecord[]>(
    () => getMatches(activeSeasonId)
  );

  useEffect(() => { setImgLoaded(false); setImgError(false); }, [logoUrl]);

  useEffect(() => {
    let cancelled = false;
    setSquadLoading(true);
    setSquadError(false);
    getSquad(teamId, career.clubName)
      .then((result) => {
        if (!cancelled) { setSquad(result); setSquadLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setSquadError(true); setSquadLoading(false); }
      });
    return () => { cancelled = true; };
  }, [teamId, career.clubName, refetchKey]);

  useEffect(() => {
    setDbSynced(false);
    ensureCareerAndSeason1(career).then(async (initialSeasonId) => {
      const seasonId = initialSeasonId;
      await Promise.all([
        syncCareerFromDb(career.id),
        syncSeasonFromDb(seasonId),
      ]);
      setActiveSeasonId((prev) => {
        if (prev === career.id) return seasonId;
        return prev;
      });
      setTransfers(getTransfers(seasonId));
      setMatches(getMatches(seasonId));
      setOverrides(getAllPlayerOverrides(career.id));
      setDbSynced(true);
      loadSeasons();
    });
  }, [career.id]);

  const loadSeasons = useCallback(async () => {
    const loaded = await getSeasons(career.id);
    setSeasons(loaded);
    if (loaded.length > 0) {
      const active = loaded.find((s) => s.isActive) ?? loaded[loaded.length - 1];
      setActiveSeasonId(active.id);
      setActiveSeasonLabel(active.label);
    }
  }, [career.id]);

  const switchToSeason = useCallback(async (season: Season) => {
    setShowSeasonModal(false);
    await syncSeasonFromDb(season.id);
    setActiveSeasonId(season.id);
    setActiveSeasonLabel(season.label);
    setTransfers(getTransfers(season.id));
    setMatches(getMatches(season.id));
  }, []);

  const handleRefreshSquad = useCallback(() => {
    clearSquadCache(teamId, career.clubName);
    setSquad(null);
    setRefetchKey((k) => k + 1);
  }, [teamId, career.clubName]);

  const [overrides, setOverrides] = useState(() => getAllPlayerOverrides(career.id));

  const refreshOverrides = useCallback(() => {
    setOverrides(getAllPlayerOverrides(career.id));
  }, [career.id]);

  const transferredPlayers: SquadPlayer[] = transfers.map((t) => {
    const pos = migratePositionOverride(t.playerPositionPtBr) ?? "MID";
    return {
      id: t.playerId,
      name: overrides[t.playerId]?.nameOverride ?? t.playerName,
      age: t.playerAge,
      position: PT_BR_TO_POSITION[pos] ?? "Midfielder",
      positionPtBr: pos,
      photo: t.playerPhoto ?? "",
      number: overrides[t.playerId]?.shirtNumber ?? t.shirtNumber,
    };
  });

  const squadPlayers: SquadPlayer[] = (squad?.players ?? []).map((p) => ({
    ...p,
    name: overrides[p.id]?.nameOverride ?? p.name,
    number: overrides[p.id]?.shirtNumber ?? p.number,
  }));

  const soldPlayerIds = new Set(
    transfers.filter((t) => t.type === "venda").map((t) => t.playerId),
  );
  const soldPlayerNames = new Set(
    transfers
      .filter((t) => t.type === "venda" && !transfers.find((c) => (!c.type || c.type === "compra") && c.playerId === t.playerId))
      .map((t) => t.playerName.toLowerCase().trim()),
  );

  const existingIds = new Set(squadPlayers.map((p) => p.id));
  const newTransferredPlayers = transferredPlayers.filter(
    (p) => !existingIds.has(p.id) && !soldPlayerIds.has(p.id),
  );
  const allPlayers = [
    ...squadPlayers.filter((p) => !soldPlayerIds.has(p.id) && !soldPlayerNames.has(p.name.toLowerCase().trim())),
    ...newTransferredPlayers,
  ];

  const handleTransferAdded = useCallback((transfer: TransferRecord) => {
    addTransfer(activeSeasonId, transfer);
    setTransfers((prev) => [...prev, transfer]);
  }, [activeSeasonId]);

  const handleMatchAdded = useCallback((match: MatchRecord) => {
    setMatches((prev) => [...prev, match]);
    setTimeout(() => runPerformanceEngine(activeSeasonId), 50);
  }, [activeSeasonId]);

  const handleNewSeasonConfirm = useCallback(async (label: string, competitions: string[]) => {
    setCreatingNewSeason(true);
    try {
      const newId = generateSeasonId();
      copyPlayerMoodsToNewSeason(activeSeasonId, newId);
      const newSeason = await createSeason(career.id, label, competitions, true, newId);
      if (newSeason) {
        await activateSeason(newSeason.id);
        onSeasonChange(label);
        await loadSeasons();
        setActiveSeasonId(newSeason.id);
        setActiveSeasonLabel(label);
        setTransfers([]);
        setMatches([]);
        setShowNewSeasonWizard(false);
        setShowSeasonModal(false);
      }
    } finally {
      setCreatingNewSeason(false);
    }
  }, [activeSeasonId, career.id, loadSeasons, onSeasonChange]);

  const activeSeason = seasons.find((s) => s.id === activeSeasonId);
  const displayLabel = activeSeason?.label ?? activeSeasonLabel;

  if (!dbSynced) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "var(--club-primary)" }}>
        <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm opacity-60">Carregando carreira...</span>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {showSeasonModal && (
        <SeasonSelectModal
          seasons={seasons}
          activeSeasonId={activeSeasonId}
          onSelect={switchToSeason}
          onNewSeason={() => { setShowSeasonModal(false); setShowNewSeasonWizard(true); }}
          onClose={() => setShowSeasonModal(false)}
        />
      )}
      {showNewSeasonWizard && (
        <NewSeasonWizard
          existingSeasons={seasons}
          currentCompetitions={activeSeason?.competitions ?? career.competitions}
          onConfirm={handleNewSeasonConfirm}
          onCancel={() => setShowNewSeasonWizard(false)}
          isLoading={creatingNewSeason}
        />
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <header
          className="relative w-full overflow-hidden glass"
          style={{ borderBottom: "1px solid var(--surface-border)" }}
        >
          <div
            className="absolute inset-0 opacity-15"
            style={{ backgroundImage: `radial-gradient(circle at 15% 50%, var(--club-primary) 0%, transparent 55%), radial-gradient(circle at 85% 50%, var(--club-secondary) 0%, transparent 55%)` }}
          />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={onGoToCareers}
                className="flex items-center gap-1.5 text-white/40 hover:text-white/80 text-xs font-medium transition-colors duration-200"
              >
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
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(var(--club-primary-rgb),0.1)", border: "1px solid rgba(var(--club-primary-rgb),0.15)", boxShadow: "0 0 30px rgba(var(--club-primary-rgb),0.1)" }}
                >
                  {logoUrl && !imgError ? (
                    <img
                      key={logoUrl}
                      ref={logoImgRef}
                      src={logoUrl}
                      alt={career.clubName}
                      className={`w-12 h-12 object-contain transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                      onLoad={() => setImgLoaded(true)}
                      onError={() => setImgError(true)}
                    />
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
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40 text-xs">Temp:</span>
                  <button
                    onClick={() => setShowSeasonModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-sm text-white hover:bg-white/10 transition-colors duration-200 group glass"
                  >
                    {displayLabel}
                    {isReadOnly && (
                      <span className="text-xs font-normal text-white/40 px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)" }}>
                        leitura
                      </span>
                    )}
                    <svg className="w-3 h-3 text-white/30 group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => setActiveTab("configuracoes")}
                  className="flex items-center justify-center w-9 h-9 rounded-xl text-white/50 hover:text-white transition-all duration-200 glass glass-hover"
                  title="Configurações"
                  style={activeTab === "configuracoes" ? { color: "var(--club-primary)", background: "rgba(var(--club-primary-rgb),0.1)" } : {}}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <button
                  onClick={onChangeClub}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] glass glass-hover"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Trocar
                </button>
              </div>
            </div>
          </div>
        </header>

        <div
          className="sticky top-0 z-30"
          style={{ background: "rgba(var(--club-primary-rgb), 0.06)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid var(--surface-border)" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex">
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="relative flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all duration-200"
                    style={{
                      color: active ? "var(--club-primary)" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    <span style={{ color: active ? "var(--club-primary)" : "rgba(255,255,255,0.3)" }}>
                      {tab.icon}
                    </span>
                    {tab.label}
                    {tab.id === "transferencias" && transfers.length > 0 && (
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded-full tabular-nums min-w-[20px] text-center"
                        style={{
                          background: active ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.08)",
                          color: active ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {transfers.length}
                      </span>
                    )}
                    {active && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                        style={{ background: "var(--club-primary)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {isReadOnly && (
          <div
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4"
          >
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-yellow-400/80">
                Você está visualizando a temporada <strong>{displayLabel}</strong> em modo somente leitura.
              </span>
              <button
                onClick={() => setShowSeasonModal(true)}
                className="ml-auto text-yellow-400/70 hover:text-yellow-400 text-xs font-semibold underline whitespace-nowrap"
              >
                Voltar à atual
              </button>
            </div>
          </div>
        )}

        {activeTab === "clube" && (
          <ClubeView
            careerId={career.id}
            seasonId={activeSeasonId}
            career={career}
            seasons={seasons}
            squad={squad}
            squadLoading={squadLoading}
            squadError={squadError}
            allPlayers={allPlayers}
            transfers={transfers}
            onRefresh={handleRefreshSquad}
            onOpenSettings={() => setActiveTab("configuracoes")}
            onOverridesUpdated={refreshOverrides}
            isReadOnly={isReadOnly}
          />
        )}
        {activeTab !== "clube" && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
            {activeTab === "painel" && (
              <PainelView
                careerId={career.id}
                seasonId={activeSeasonId}
                clubName={career.clubName}
                clubLogoUrl={logoUrl}
                allPlayers={allPlayers}
                season={displayLabel}
                matches={matches}
                transferCount={transfers.length}
                isReadOnly={isReadOnly}
              />
            )}
            {activeTab === "partidas" && (
              <PartidasView
                careerId={career.id}
                seasonId={activeSeasonId}
                season={displayLabel}
                clubName={career.clubName}
                clubLogoUrl={logoUrl}
                matches={matches}
                allPlayers={allPlayers}
                onMatchAdded={handleMatchAdded}
                competitions={activeSeason?.competitions ?? career.competitions}
                isReadOnly={isReadOnly}
              />
            )}
            {activeTab === "transferencias" && (
              <TransferenciasView
                careerId={career.id}
                seasonId={activeSeasonId}
                transfers={transfers}
                season={displayLabel}
                clubName={career.clubName}
                clubLogoUrl={logoUrl}
                allPlayers={allPlayers}
                onTransferAdded={handleTransferAdded}
                isReadOnly={isReadOnly}
              />
            )}
            {activeTab === "noticias" && (
              <NoticiasView
                career={career}
                seasonId={activeSeasonId}
                allPlayers={allPlayers}
                matches={matches}
                pastSeasons={seasons.filter((s) => !s.isActive)}
                isReadOnly={isReadOnly}
              />
            )}
            {activeTab === "diretoria" && (
              <DiretoriaView
                career={career}
                matches={matches}
                transfers={transfers}
                squadSize={allPlayers.length}
                allPlayers={allPlayers}
              />
            )}
            {activeTab === "momentos" && (
              <MomentosView
                seasonId={activeSeasonId}
                allSeasonIds={seasons.map((s) => s.id)}
                isReadOnly={isReadOnly}
              />
            )}
            {activeTab === "configuracoes" && (
              <SettingsPage onReloadClubs={onReloadClubs} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
