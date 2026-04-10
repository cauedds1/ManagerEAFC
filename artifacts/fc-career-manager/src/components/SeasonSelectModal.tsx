import { useState } from "react";
import type { Season } from "@/types/career";
import type { MatchRecord } from "@/types/match";
import { getMatches } from "@/lib/matchStorage";

interface SeasonSelectModalProps {
  seasons: Season[];
  activeSeasonId: string;
  onSelect: (season: Season) => void;
  onNewSeason: () => void;
  onClose: () => void;
}

function SeasonStats({ seasonId }: { seasonId: string }) {
  const matches = getMatches(seasonId);
  const wins = matches.filter((m) => m.myScore > m.opponentScore).length;
  const draws = matches.filter((m) => m.myScore === m.opponentScore).length;
  const losses = matches.filter((m) => m.myScore < m.opponentScore).length;
  if (!matches.length) return <span className="text-xs text-white/25">Sem partidas</span>;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-emerald-400 font-semibold">{wins}V</span>
      <span className="text-white/30">·</span>
      <span className="text-yellow-400 font-semibold">{draws}E</span>
      <span className="text-white/30">·</span>
      <span className="text-red-400 font-semibold">{losses}D</span>
      <span className="text-white/25 ml-1">{matches.length} partidas</span>
    </div>
  );
}

export function SeasonSelectModal({
  seasons,
  activeSeasonId,
  onSelect,
  onNewSeason,
  onClose,
}: SeasonSelectModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="h-full w-80 max-w-full flex flex-col shadow-2xl"
        style={{
          background: "rgba(15,15,25,0.97)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <h2 className="text-white font-black text-base">Temporadas</h2>
            <p className="text-white/35 text-xs mt-0.5">{seasons.length} temporada{seasons.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/08 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1.5">
          {seasons.length === 0 && (
            <div className="text-center py-10 text-white/25 text-sm">
              Nenhuma temporada encontrada
            </div>
          )}
          {[...seasons].reverse().map((season) => {
            const isActive = season.id === activeSeasonId;
            return (
              <button
                key={season.id}
                onClick={() => onSelect(season)}
                className="w-full text-left px-4 py-3 rounded-xl transition-all duration-150"
                style={{
                  background: isActive
                    ? "rgba(var(--club-primary-rgb),0.12)"
                    : "rgba(255,255,255,0.03)",
                  border: isActive
                    ? "1px solid rgba(var(--club-primary-rgb),0.3)"
                    : "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="font-bold text-sm"
                    style={{ color: isActive ? "var(--club-primary)" : "rgba(255,255,255,0.85)" }}
                  >
                    {season.label}
                  </span>
                  {isActive && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(var(--club-primary-rgb),0.2)",
                        color: "var(--club-primary)",
                      }}
                    >
                      Atual
                    </span>
                  )}
                  {!isActive && (
                    <span className="text-xs text-white/25 px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                      Ver
                    </span>
                  )}
                </div>
                <SeasonStats seasonId={season.id} />
              </button>
            );
          })}
        </div>

        <div
          className="p-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={onNewSeason}
            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            style={{
              background: "var(--club-gradient)",
              boxShadow: "0 4px 20px rgba(var(--club-primary-rgb),0.25)",
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nova Temporada
          </button>
        </div>
      </div>
    </div>
  );
}
