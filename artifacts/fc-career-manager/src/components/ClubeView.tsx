import { useState, useMemo, useEffect, useRef } from "react";
import type { SquadResult, SquadPlayer, PositionPtBr } from "@/lib/squadCache";
import type { TransferRecord } from "@/types/transfer";
import type { Career, Season } from "@/types/career";
import type { MatchRecord } from "@/types/match";
import { getMatches } from "@/lib/matchStorage";
import { aggregatePlayerStats } from "@/lib/playerStatsStorage";
import { syncSeasonFromDb } from "@/lib/dbSync";
import { ElencoView } from "./ElencoView";
import { PlayerStatsTable } from "./PlayerStatsTable";
import { LesoesView } from "./LesoesView";
import { SequenciasView } from "./SequenciasView";
import { FinanceiroView } from "./FinanceiroView";
import { ClubStatsView } from "./ClubStatsView";
import { CompetitionResultsView } from "./CompetitionResultsView";
import { TrophyCabinetView } from "./TrophyCabinetView";
type ClubeSubTab = "elenco" | "estatisticas" | "lesoes" | "sequencias" | "financeiro" | "competicoes" | "trofeus";
type StatsMiniTab = "jogadores" | "clube";

const SUB_TABS: { id: ClubeSubTab; label: string; icon: string }[] = [
  { id: "elenco",       label: "Elenco",       icon: "👥" },
  { id: "estatisticas", label: "Estatísticas",  icon: "📊" },
  { id: "lesoes",       label: "Lesões",        icon: "🤕" },
  { id: "sequencias",   label: "Sequências",    icon: "🔥" },
  { id: "financeiro",   label: "Financeiro",    icon: "💰" },
  { id: "competicoes",  label: "Competições",   icon: "🏆" },
  { id: "trofeus",      label: "Troféus",       icon: "🥇" },
];

interface ClubeViewProps {
  careerId: string;
  seasonId: string;
  career: Career;
  seasons: Season[];
  squad: SquadResult | null;
  squadLoading: boolean;
  squadError: boolean;
  allPlayers: SquadPlayer[];
  historicalPlayers?: SquadPlayer[];
  formerPlayers?: SquadPlayer[];
  transfers: TransferRecord[];
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOverridesUpdated?: () => void;
  onPlayerRemoved?: () => void;
  onImportSquad?: (players: SquadPlayer[]) => void;
  isReadOnly?: boolean;
  isFinalized?: boolean;
  finalizedPlayers?: SquadPlayer[];
  finalizedLeftIds?: Set<number>;
  finalizedSeasonStats?: Record<number, { matchesAsStarter: number; totalMinutes: number }>;
}

type SeqScope = "atual" | "todas";

function ScopeToggle({ scope, setScope }: { scope: SeqScope; setScope: (s: SeqScope) => void }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-white/10">
      {(["atual", "todas"] as SeqScope[]).map((s) => (
        <button
          key={s}
          onClick={() => setScope(s)}
          className="px-3 py-1.5 text-xs font-semibold transition-all"
          style={{
            background: scope === s ? "rgba(var(--club-primary-rgb),0.18)" : "rgba(255,255,255,0.04)",
            color: scope === s ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
          }}
        >
          {s === "atual" ? "Temporada atual" : "Todas as temporadas"}
        </button>
      ))}
    </div>
  );
}

export function ClubeView({
  careerId,
  seasonId,
  career,
  seasons,
  squad,
  squadLoading,
  squadError,
  allPlayers,
  historicalPlayers,
  formerPlayers,
  transfers,
  onRefresh,
  onOpenSettings,
  onOverridesUpdated,
  onPlayerRemoved,
  onImportSquad,
  isReadOnly,
  isFinalized,
  finalizedPlayers,
  finalizedLeftIds,
  finalizedSeasonStats,
}: ClubeViewProps) {
  const statsPlayers = historicalPlayers ?? allPlayers;
  const currentPlayerIds = useMemo(() => new Set(allPlayers.map((p) => p.id)), [allPlayers]);
  const formerPlayerIds = useMemo(() => {
    if (!historicalPlayers) return undefined;
    return new Set(historicalPlayers.filter((p) => !currentPlayerIds.has(p.id)).map((p) => p.id));
  }, [historicalPlayers, currentPlayerIds]);
  const [sub, setSub] = useState<ClubeSubTab>("elenco");
  const [statsMini, setStatsMini] = useState<StatsMiniTab>("jogadores");
  const [seqScope, setSeqScope] = useState<SeqScope>("atual");
  const [statsScope, setStatsScope] = useState<SeqScope>("atual");
  const [pastSeasonsLoaded, setPastSeasonsLoaded] = useState(false);
  const loadingPastRef = useRef(false);

  const hasMultipleSeasons = seasons.length > 1;
  const allSeasonIds = seasons.map((s) => s.id);

  useEffect(() => {
    if (statsScope !== "todas" || pastSeasonsLoaded || loadingPastRef.current) return;
    if (allSeasonIds.length <= 1) { setPastSeasonsLoaded(true); return; }
    loadingPastRef.current = true;
    const otherIds = allSeasonIds.filter((id) => id !== seasonId);
    Promise.all(otherIds.map((id) => syncSeasonFromDb(id))).then(() => {
      setPastSeasonsLoaded(true);
      loadingPastRef.current = false;
    }).catch(() => {
      setPastSeasonsLoaded(true);
      loadingPastRef.current = false;
    });
  }, [statsScope, allSeasonIds, seasonId, pastSeasonsLoaded]);

  const allSeasonMatches = useMemo<MatchRecord[]>(
    () => allSeasonIds.flatMap((id) => getMatches(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allSeasonIds, pastSeasonsLoaded]
  );

  const allStatsOverride = useMemo(
    () => aggregatePlayerStats(allSeasonIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allSeasonIds, pastSeasonsLoaded]
  );

  // For "todas as temporadas": cover every player ID present in allStatsOverride.
  // statsPlayers = allTimeCareerPlayers (built from current squad + former players +
  // squad cache + all transfer records), so virtually all IDs resolve here.
  // A minimal placeholder is created only for genuinely unresolvable IDs.
  const expandedStatsPlayers = useMemo(() => {
    if (!hasMultipleSeasons) return statsPlayers;
    const statsPlayerMap = new Map(statsPlayers.map((p) => [p.id, p]));
    const extras: SquadPlayer[] = [];
    for (const idStr of Object.keys(allStatsOverride)) {
      const id = Number(idStr);
      if (!statsPlayerMap.has(id)) {
        // Last-resort placeholder — name/position unknown for this player ID
        extras.push({
          id,
          name: `Jogador #${id}`,
          age: 0,
          position: "Midfielder",
          positionPtBr: "MID" as PositionPtBr,
          photo: "",
          number: 0,
        });
      }
    }
    return extras.length > 0 ? [...statsPlayers, ...extras] : statsPlayers;
  }, [hasMultipleSeasons, statsPlayers, allStatsOverride]);

  const expandedFormerPlayerIds = useMemo(() => {
    if (!hasMultipleSeasons) return formerPlayerIds;
    return new Set(expandedStatsPlayers.filter((p) => !currentPlayerIds.has(p.id)).map((p) => p.id));
  }, [hasMultipleSeasons, expandedStatsPlayers, currentPlayerIds, formerPlayerIds]);

  const allMatchesForSeq = useMemo<MatchRecord[] | undefined>(() => {
    if (seqScope === "atual" || !hasMultipleSeasons) return undefined;
    return allSeasonMatches;
  }, [seqScope, hasMultipleSeasons, allSeasonMatches]);

  return (
    <div className="w-full">
      {/* Sub-tab nav — sticky logo abaixo da tab nav principal (~50px) */}
      <div
        className="sticky top-[50px] z-20 flex items-center gap-1 px-4 pt-3 pb-0 overflow-x-auto"
        style={{
          borderBottom: "1px solid var(--surface-border, rgba(255,255,255,0.07))",
          background: "rgba(var(--club-primary-rgb), 0.04)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {SUB_TABS.map((t) => {
          const active = sub === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium whitespace-nowrap transition-colors relative"
              style={{
                background: active ? "rgba(var(--club-primary-rgb),0.12)" : "transparent",
                color: active ? "rgb(var(--club-primary-rgb))" : "rgba(255,255,255,0.4)",
                borderBottom: active ? "2px solid rgb(var(--club-primary-rgb))" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="w-full">
        {sub === "elenco" && (
          <ElencoView
            careerId={careerId}
            seasonId={seasonId}
            squad={squad}
            squadLoading={squadLoading}
            squadError={squadError}
            allPlayers={allPlayers}
            transfers={transfers}
            formerPlayers={formerPlayers}
            onRefresh={onRefresh}
            onOpenSettings={onOpenSettings}
            onOverridesUpdated={onOverridesUpdated}
            onPlayerRemoved={onPlayerRemoved}
            onImportSquad={onImportSquad}
            isFinalized={isFinalized}
            finalizedPlayers={finalizedPlayers}
            finalizedLeftIds={finalizedLeftIds}
            finalizedSeasonStats={finalizedSeasonStats}
          />
        )}

        {sub === "estatisticas" && (
          <div className="px-4 sm:px-6">
            {/* Mini-tabs + scope toggle row */}
            <div className="flex items-center justify-between gap-3 pt-4 pb-3 flex-wrap">
              <div className="flex gap-1">
                {(["jogadores", "clube"] as StatsMiniTab[]).map((t) => {
                  const active = statsMini === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setStatsMini(t)}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                      style={{
                        background: active ? "rgba(var(--club-primary-rgb),0.15)" : "rgba(255,255,255,0.05)",
                        color: active ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                        border: active
                          ? "1px solid rgba(var(--club-primary-rgb),0.25)"
                          : "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      {t === "jogadores" ? "👤 Jogadores" : "🏟️ Clube"}
                    </button>
                  );
                })}
              </div>
              {/* Scope toggle only for Jogadores tab with multiple seasons */}
              {hasMultipleSeasons && statsMini === "jogadores" && (
                <ScopeToggle scope={statsScope} setScope={setStatsScope} />
              )}
            </div>

            {statsMini === "jogadores" && (
              <div className="overflow-x-auto">
                <PlayerStatsTable
                  careerId={careerId}
                  seasonId={seasonId}
                  allPlayers={statsScope === "todas" && hasMultipleSeasons ? expandedStatsPlayers : statsPlayers}
                  statsOverride={statsScope === "todas" && hasMultipleSeasons ? allStatsOverride : undefined}
                  matchesOverride={statsScope === "todas" && hasMultipleSeasons ? allSeasonMatches : undefined}
                  formerPlayerIds={statsScope === "todas" && hasMultipleSeasons ? expandedFormerPlayerIds : formerPlayerIds}
                />
              </div>
            )}
            {statsMini === "clube" && (
              <ClubStatsView
                careerId={careerId}
                seasonId={seasonId}
                season={career.season}
                seasons={seasons}
                allSeasonMatches={allSeasonMatches}
              />
            )}
          </div>
        )}

        {sub === "lesoes" && (
          <LesoesView careerId={careerId} seasonId={seasonId} allPlayers={allPlayers} />
        )}
        {sub === "sequencias" && (
          <div>
            {hasMultipleSeasons && (
              <div className="flex justify-end px-4 sm:px-6 pt-4">
                <ScopeToggle scope={seqScope} setScope={setSeqScope} />
              </div>
            )}
            <SequenciasView
              careerId={careerId}
              seasonId={seasonId}
              matchesOverride={allMatchesForSeq}
            />
          </div>
        )}
        {sub === "financeiro" && (
          <div className="px-4 sm:px-6 py-6">
            <FinanceiroView
              careerId={careerId}
              seasonId={seasonId}
              transfers={transfers}
              season={career.season}
              isReadOnly={isReadOnly}
            />
          </div>
        )}
        {sub === "competicoes" && (
          <CompetitionResultsView
            careerId={careerId}
            seasonId={seasonId}
            seasons={seasons}
            clubName={career.clubName}
            clubLogoUrl={career.clubLogo || null}
          />
        )}
        {sub === "trofeus" && (
          <TrophyCabinetView careerId={careerId} />
        )}

      </div>
    </div>
  );
}
