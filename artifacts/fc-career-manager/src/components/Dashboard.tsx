import { useState, useEffect, useCallback } from "react";
import type { Career } from "@/types/career";
import { Settings } from "./Settings";
import {
  getSquad,
  clearSquadCache,
  type SquadResult,
  type SquadPlayer,
  PT_BR_TO_POSITION,
} from "@/lib/squadCache";
import { getApiKey } from "@/lib/clubListCache";
import { getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import { getTransfers, addTransfer } from "@/lib/transferStorage";
import type { TransferRecord } from "@/types/transfer";
import { getMatches } from "@/lib/matchStorage";
import type { MatchRecord } from "@/types/match";
import { PainelView } from "./PainelView";
import { ElencoView } from "./ElencoView";
import { TransferenciasView } from "./TransferenciasView";
import { PartidasView } from "./PartidasView";

interface DashboardProps {
  career: Career;
  onSeasonChange: (season: string) => void;
  onGoToCareers: () => void;
  onChangeClub: () => void;
  onReloadClubs: () => void;
}

type CareerTab = "painel" | "partidas" | "elenco" | "transferencias";

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
    id: "elenco",
    label: "Elenco",
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
  const [editingSeason, setEditingSeason] = useState(false);
  const [seasonDraft, setSeasonDraft] = useState(career.season);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CareerTab>("painel");

  const [squad, setSquad] = useState<SquadResult | null>(null);
  const [squadLoading, setSquadLoading] = useState(true);
  const [squadError, setSquadError] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const [transfers, setTransfers] = useState<TransferRecord[]>(
    () => getTransfers(career.id)
  );

  const [matches, setMatches] = useState<MatchRecord[]>(
    () => getMatches(career.id)
  );

  useEffect(() => { setSeasonDraft(career.season); }, [career.season]);
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

  const handleRefreshSquad = useCallback(() => {
    clearSquadCache(teamId, career.clubName);
    setSquad(null);
    setRefetchKey((k) => k + 1);
  }, [teamId, career.clubName]);

  const [overrides, setOverrides] = useState(() => getAllPlayerOverrides(career.id));

  const refreshOverrides = useCallback(() => {
    setOverrides(getAllPlayerOverrides(career.id));
  }, [career.id]);

  const transferredPlayers: SquadPlayer[] = transfers.map((t) => ({
    id: t.playerId,
    name: overrides[t.playerId]?.nameOverride ?? t.playerName,
    age: t.playerAge,
    position: PT_BR_TO_POSITION[t.playerPositionPtBr],
    positionPtBr: t.playerPositionPtBr,
    photo: t.playerPhoto ?? "",
    number: overrides[t.playerId]?.shirtNumber ?? t.shirtNumber,
  }));

  const squadPlayers: SquadPlayer[] = (squad?.players ?? []).map((p) => ({
    ...p,
    name: overrides[p.id]?.nameOverride ?? p.name,
    number: overrides[p.id]?.shirtNumber ?? p.number,
  }));

  const existingIds = new Set(squadPlayers.map((p) => p.id));
  const newTransferredPlayers = transferredPlayers.filter((p) => !existingIds.has(p.id));
  const allPlayers = [...squadPlayers, ...newTransferredPlayers];

  const handleTransferAdded = useCallback((transfer: TransferRecord) => {
    addTransfer(career.id, transfer);
    setTransfers((prev) => [...prev, transfer]);
  }, [career.id]);

  const handleMatchAdded = useCallback((match: MatchRecord) => {
    setMatches((prev) => [...prev, match]);
  }, []);

  const commitSeason = () => {
    const trimmed = seasonDraft.trim();
    if (trimmed) onSeasonChange(trimmed);
    setEditingSeason(false);
  };

  return (
    <div className="relative min-h-screen flex flex-col">
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
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs">Temp:</span>
                {editingSeason ? (
                  <input
                    autoFocus
                    value={seasonDraft}
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
                  <button
                    onClick={() => setEditingSeason(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-sm text-white hover:bg-white/10 transition-colors duration-200 group glass"
                  >
                    {career.season}
                    <svg className="w-3 h-3 text-white/30 group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center justify-center w-9 h-9 rounded-xl text-white/50 hover:text-white transition-all duration-200 glass glass-hover"
                title="Configurações"
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

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {activeTab === "painel" && (
          <PainelView
            careerId={career.id}
            clubName={career.clubName}
            clubLogoUrl={logoUrl}
            allPlayers={allPlayers}
            season={career.season}
            matches={matches}
            transferCount={transfers.length}
          />
        )}
        {activeTab === "partidas" && (
          <PartidasView
            careerId={career.id}
            season={career.season}
            clubName={career.clubName}
            clubLogoUrl={logoUrl}
            matches={matches}
            allPlayers={allPlayers}
            onMatchAdded={handleMatchAdded}
          />
        )}
        {activeTab === "elenco" && (
          <ElencoView
            careerId={career.id}
            squad={squad}
            squadLoading={squadLoading}
            squadError={squadError}
            allPlayers={allPlayers}
            onRefresh={handleRefreshSquad}
            onOpenSettings={() => setSettingsOpen(true)}
            onOverridesUpdated={refreshOverrides}
            hasApiKey={Boolean(getApiKey())}
          />
        )}
        {activeTab === "transferencias" && (
          <TransferenciasView
            careerId={career.id}
            transfers={transfers}
            season={career.season}
            clubName={career.clubName}
            clubLogoUrl={logoUrl}
            allPlayers={allPlayers}
            onTransferAdded={handleTransferAdded}
          />
        )}
      </div>

      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onReloadClubs={onReloadClubs} />
    </div>
  );
}
