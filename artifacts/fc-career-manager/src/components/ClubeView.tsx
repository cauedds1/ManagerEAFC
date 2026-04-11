import { useState, useMemo } from "react";
import type { SquadResult, SquadPlayer } from "@/lib/squadCache";
import type { TransferRecord } from "@/types/transfer";
import type { Career, Season } from "@/types/career";
import type { MatchRecord } from "@/types/match";
import { getMatches } from "@/lib/matchStorage";
import { aggregatePlayerStats } from "@/lib/playerStatsStorage";
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
  transfers: TransferRecord[];
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOverridesUpdated?: () => void;
  isReadOnly?: boolean;
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
  transfers,
  onRefresh,
  onOpenSettings,
  onOverridesUpdated,
  isReadOnly,
}: ClubeViewProps) {
  const [sub, setSub] = useState<ClubeSubTab>("elenco");
  const [statsMini, setStatsMini] = useState<StatsMiniTab>("jogadores");
  const [seqScope, setSeqScope] = useState<SeqScope>("atual");
  const [statsScope, setStatsScope] = useState<SeqScope>("atual");

  const hasMultipleSeasons = seasons.length > 1;
  const allSeasonIds = seasons.map((s) => s.id);

  const allSeasonMatches = useMemo<MatchRecord[]>(
    () => allSeasonIds.flatMap((id) => getMatches(id)),
    [allSeasonIds]
  );

  const allStatsOverride = useMemo(
    () => aggregatePlayerStats(allSeasonIds),
    [allSeasonIds]
  );

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
            squad={squad}
            squadLoading={squadLoading}
            squadError={squadError}
            allPlayers={allPlayers}
            onRefresh={onRefresh}
            onOpenSettings={onOpenSettings}
            onOverridesUpdated={onOverridesUpdated}
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
                  allPlayers={allPlayers}
                  statsOverride={statsScope === "todas" && hasMultipleSeasons ? allStatsOverride : undefined}
                  matchesOverride={statsScope === "todas" && hasMultipleSeasons ? allSeasonMatches : undefined}
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
            allSeasonMatches={allSeasonMatches}
          />
        )}
        {sub === "trofeus" && (
          <TrophyCabinetView careerId={careerId} />
        )}
      </div>
    </div>
  );
}
