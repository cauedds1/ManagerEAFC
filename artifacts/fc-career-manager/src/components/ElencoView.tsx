import { useState, useCallback } from "react";
import type { SquadResult, SquadPlayer, PositionPtBr } from "@/lib/squadCache";
import type { PlayerOverride } from "@/types/playerStats";
import { getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import { FootballPitch, pickBestElevenIds } from "./FootballPitch";
import { PlayerDetailPanel } from "./PlayerDetailPanel";

const POS_STYLE: Record<PositionPtBr, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)",  color: "#f59e0b" },
  ZAG: { bg: "rgba(59,130,246,0.18)",  color: "#60a5fa" },
  LAT: { bg: "rgba(14,165,233,0.18)",  color: "#38bdf8" },
  VOL: { bg: "rgba(16,185,129,0.18)",  color: "#34d399" },
  MC:  { bg: "rgba(20,184,166,0.18)",  color: "#2dd4bf" },
  MEI: { bg: "rgba(132,204,22,0.18)",  color: "#a3e635" },
  PE:  { bg: "rgba(249,115,22,0.18)",  color: "#fb923c" },
  PD:  { bg: "rgba(245,156,10,0.18)",  color: "#fbbf24" },
  SA:  { bg: "rgba(244,63,94,0.18)",   color: "#fb7185" },
  CA:  { bg: "rgba(239,68,68,0.18)",   color: "#f87171" },
  ATA: { bg: "rgba(185,28,28,0.18)",   color: "#ef4444" },
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function PlayerPhoto({ src, name }: { src: string; name: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(!src);
  return (
    <div
      className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
      style={{ background: "rgba(var(--club-primary-rgb),0.06)" }}
    >
      {!error ? (
        <img
          src={src}
          alt={name}
          className={`w-9 h-9 object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      ) : (
        <svg viewBox="0 0 40 40" className="w-6 h-6 text-white/15" fill="currentColor">
          <circle cx="20" cy="14" r="7" />
          <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
        </svg>
      )}
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

function PlayerRow({
  player,
  overrides,
  selected,
  onClick,
}: {
  player: SquadPlayer;
  overrides: Record<number, PlayerOverride>;
  selected?: boolean;
  onClick: (player: SquadPlayer) => void;
}) {
  const ov = overrides[player.id];
  const displayName = ov?.nameOverride ?? player.name;
  const displayNumber = ov?.shirtNumber ?? player.number;
  const displayOverall = ov?.overall;
  const pos = POS_STYLE[player.positionPtBr] ?? POS_STYLE.MC;

  return (
    <button
      onClick={() => onClick(player)}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 text-left"
      style={{
        background: selected
          ? "rgba(var(--club-primary-rgb),0.12)"
          : "rgba(255,255,255,0.04)",
        border: selected
          ? "1px solid rgba(var(--club-primary-rgb),0.3)"
          : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <PlayerPhoto src={player.photo} name={displayName} />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold leading-tight truncate">{displayName}</p>
        <p className="text-white/30 text-xs mt-0.5">
          {player.age > 0 ? `${player.age} anos` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {displayOverall != null && (
          <span className="text-white/50 text-xs font-bold tabular-nums">{displayOverall}</span>
        )}
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-md"
          style={{ background: pos.bg, color: pos.color }}
        >
          {player.positionPtBr}
        </span>
        {displayNumber != null && (
          <span className="text-white/25 text-xs font-mono tabular-nums w-5 text-right">
            #{displayNumber}
          </span>
        )}
      </div>
    </button>
  );
}

type SquadTab = "pitch" | "list";

interface ElencoViewProps {
  careerId: string;
  clubName?: string;
  teamId?: number;
  squad: SquadResult | null;
  squadLoading: boolean;
  squadError: boolean;
  allPlayers: SquadPlayer[];
  onRefresh: () => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
}

export function ElencoView({
  careerId,
  squad,
  squadLoading,
  squadError,
  allPlayers,
  onRefresh,
  onOpenSettings,
  hasApiKey,
}: ElencoViewProps) {
  const [tab, setTab] = useState<SquadTab>("pitch");
  const [selectedPlayer, setSelectedPlayer] = useState<SquadPlayer | null>(null);
  const [overrides, setOverrides] = useState<Record<number, PlayerOverride>>(
    () => getAllPlayerOverrides(careerId)
  );

  const refreshOverrides = useCallback(() => {
    setOverrides(getAllPlayerOverrides(careerId));
  }, [careerId]);

  const starterIds = allPlayers.length > 0 ? pickBestElevenIds(allPlayers) : new Set<number>();
  const starters = allPlayers.filter((p) => starterIds.has(p.id));
  const bench = allPlayers.filter((p) => !starterIds.has(p.id));

  const sourceLabel = squad
    ? squad.source === "api-football"
      ? `API-Football · ${formatDate(squad.cachedAt)}`
      : `EA FC 26 · ${formatDate(squad.cachedAt)}`
    : "";

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-white/35 text-xs font-bold tracking-widest uppercase">Elenco</h2>
          {squad && !squadLoading && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background:
                  squad.source === "api-football"
                    ? "rgba(16,185,129,0.12)"
                    : "rgba(var(--club-primary-rgb),0.12)",
                color:
                  squad.source === "api-football"
                    ? "#34d399"
                    : "var(--club-primary)",
              }}
            >
              {sourceLabel}
            </span>
          )}
          {allPlayers.length > 0 && !squadLoading && (
            <span className="text-white/25 text-xs">{allPlayers.length} jogadores</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {allPlayers.length > 0 && !squadLoading && (
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
          <button
            onClick={onRefresh}
            disabled={squadLoading}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors duration-200 disabled:opacity-30"
          >
            <svg
              className={`w-3.5 h-3.5 ${squadLoading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs">Atualizar</span>
          </button>
        </div>
      </div>

      {squadLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl overflow-hidden" style={{ background: "#0d2218", minHeight: 300 }}>
            <div className="flex items-center justify-center h-72">
              <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "transparent" }} />
            </div>
          </div>
          <SquadSkeleton />
        </div>
      ) : squadError ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-2xl gap-3 glass">
          <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-white/30 text-sm">Erro ao carregar o elenco</p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-80 transition-opacity"
            style={{ background: "var(--club-gradient)" }}
          >
            Tentar novamente
          </button>
        </div>
      ) : allPlayers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-2xl gap-3 glass">
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
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-80 transition-opacity"
              style={{ background: "var(--club-gradient)" }}
            >
              Configurar API key
            </button>
          )}
        </div>
      ) : tab === "pitch" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-white/25 text-xs font-semibold tracking-widest uppercase">
                Titulares ({starters.length})
              </p>
              {selectedPlayer && (
                <p className="text-xs" style={{ color: "var(--club-primary)" }}>
                  Clique novamente para fechar
                </p>
              )}
            </div>
            <FootballPitch
              players={allPlayers}
              className="w-full"
              onPlayerClick={(p) =>
                setSelectedPlayer((prev) => (prev?.id === p.id ? null : p))
              }
              highlightedPlayerId={selectedPlayer?.id}
            />
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto lg:max-h-[500px]">
            <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-1">
              Reservas ({bench.length})
            </p>
            {bench.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                overrides={overrides}
                selected={selectedPlayer?.id === player.id}
                onClick={(p) =>
                  setSelectedPlayer((prev) => (prev?.id === p.id ? null : p))
                }
              />
            ))}
            {bench.length === 0 && (
              <p className="text-white/20 text-xs text-center py-4">
                Todos os jogadores estão no time titular
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="mb-1">
            <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-2">
              Titulares ({starters.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {starters.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  overrides={overrides}
                  selected={selectedPlayer?.id === player.id}
                  onClick={(p) =>
                    setSelectedPlayer((prev) => (prev?.id === p.id ? null : p))
                  }
                />
              ))}
            </div>
          </div>
          {bench.length > 0 && (
            <div className="mt-2">
              <p className="text-white/25 text-xs font-semibold tracking-widest uppercase mb-2">
                Reservas ({bench.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {bench.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    overrides={overrides}
                    selected={selectedPlayer?.id === player.id}
                    onClick={(p) =>
                      setSelectedPlayer((prev) => (prev?.id === p.id ? null : p))
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!hasApiKey && squad?.source === "fc26" && allPlayers.length > 0 && (
        <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl glass">
          <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--club-primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-white/50">
            Dados do EA FC 26. Configure sua{" "}
            <button onClick={onOpenSettings} className="underline font-semibold hover:text-white transition-colors">
              API key
            </button>{" "}
            para ver o elenco real com fotos.
          </p>
        </div>
      )}

      {selectedPlayer && (
        <PlayerDetailPanel
          player={selectedPlayer}
          careerId={careerId}
          override={overrides[selectedPlayer.id]}
          onClose={() => setSelectedPlayer(null)}
          onUpdated={refreshOverrides}
        />
      )}
    </div>
  );
}
