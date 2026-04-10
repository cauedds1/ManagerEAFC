import { useState } from "react";
import type { SquadResult, SquadPlayer } from "@/lib/squadCache";
import type { TransferRecord } from "@/types/transfer";
import type { Career } from "@/types/career";
import { ElencoView } from "./ElencoView";
import { PlayerStatsTable } from "./PlayerStatsTable";
import { LesoesView } from "./LesoesView";
import { SequenciasView } from "./SequenciasView";
import { FinanceiroView } from "./FinanceiroView";
import { ClubStatsView } from "./ClubStatsView";

type ClubeSubTab = "elenco" | "estatisticas" | "lesoes" | "sequencias" | "financeiro";
type StatsMiniTab = "jogadores" | "clube";

const SUB_TABS: { id: ClubeSubTab; label: string; icon: string }[] = [
  { id: "elenco",       label: "Elenco",       icon: "👥" },
  { id: "estatisticas", label: "Estatísticas",  icon: "📊" },
  { id: "lesoes",       label: "Lesões",        icon: "🤕" },
  { id: "sequencias",   label: "Sequências",    icon: "🔥" },
  { id: "financeiro",   label: "Financeiro",    icon: "💰" },
];

interface ClubeViewProps {
  careerId: string;
  seasonId: string;
  career: Career;
  squad: SquadResult | null;
  squadLoading: boolean;
  squadError: boolean;
  allPlayers: SquadPlayer[];
  transfers: TransferRecord[];
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOverridesUpdated?: () => void;
  hasApiKey: boolean;
}

export function ClubeView({
  careerId,
  seasonId,
  career,
  squad,
  squadLoading,
  squadError,
  allPlayers,
  transfers,
  onRefresh,
  onOpenSettings,
  onOverridesUpdated,
  hasApiKey,
}: ClubeViewProps) {
  const [sub, setSub] = useState<ClubeSubTab>("elenco");
  const [statsMini, setStatsMini] = useState<StatsMiniTab>("jogadores");

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
            hasApiKey={hasApiKey}
          />
        )}

        {sub === "estatisticas" && (
          <div className="px-4 sm:px-6">
            {/* Mini-tabs: Jogadores | Clube */}
            <div className="flex gap-1 pt-4 pb-3">
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

            {statsMini === "jogadores" && (
              <div className="overflow-x-auto">
                <PlayerStatsTable careerId={careerId} seasonId={seasonId} allPlayers={allPlayers} />
              </div>
            )}
            {statsMini === "clube" && (
              <ClubStatsView careerId={careerId} seasonId={seasonId} season={career.season} />
            )}
          </div>
        )}

        {sub === "lesoes" && (
          <LesoesView careerId={careerId} seasonId={seasonId} allPlayers={allPlayers} />
        )}
        {sub === "sequencias" && (
          <SequenciasView careerId={careerId} seasonId={seasonId} />
        )}
        {sub === "financeiro" && (
          <div className="px-4 sm:px-6 py-6">
            <FinanceiroView
              careerId={careerId}
              seasonId={seasonId}
              transfers={transfers}
              season={career.season}
            />
          </div>
        )}
      </div>
    </div>
  );
}
