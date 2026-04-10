import { useState } from "react";
import type { SquadResult, SquadPlayer } from "@/lib/squadCache";
import { ElencoView } from "./ElencoView";
import { PlayerStatsTable } from "./PlayerStatsTable";
import { LesoesView } from "./LesoesView";
import { SequenciasView } from "./SequenciasView";

type ClubeSubTab = "elenco" | "estatisticas" | "lesoes" | "sequencias";

const SUB_TABS: { id: ClubeSubTab; label: string; icon: string }[] = [
  { id: "elenco",       label: "Elenco",       icon: "👥" },
  { id: "estatisticas", label: "Estatísticas",  icon: "📊" },
  { id: "lesoes",       label: "Lesões",        icon: "🤕" },
  { id: "sequencias",   label: "Sequências",    icon: "🔥" },
];

interface ClubeViewProps {
  careerId: string;
  squad: SquadResult | null;
  squadLoading: boolean;
  squadError: boolean;
  allPlayers: SquadPlayer[];
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOverridesUpdated?: () => void;
  hasApiKey: boolean;
}

export function ClubeView({
  careerId,
  squad,
  squadLoading,
  squadError,
  allPlayers,
  onRefresh,
  onOpenSettings,
  onOverridesUpdated,
  hasApiKey,
}: ClubeViewProps) {
  const [sub, setSub] = useState<ClubeSubTab>("elenco");

  return (
    <div className="flex flex-col w-full min-h-0 flex-1">
      <div
        className="flex items-center gap-1 px-4 pt-3 pb-0 overflow-x-auto"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
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

      <div className="flex-1 min-h-0 overflow-y-auto w-full">
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
          <PlayerStatsTable careerId={careerId} allPlayers={allPlayers} />
        )}
        {sub === "lesoes" && (
          <LesoesView careerId={careerId} allPlayers={allPlayers} />
        )}
        {sub === "sequencias" && (
          <SequenciasView careerId={careerId} />
        )}
      </div>
    </div>
  );
}
