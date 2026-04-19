import { useState, useRef, useEffect } from "react";
import type { Season } from "@/types/career";
import { getMatches } from "@/lib/matchStorage";

interface SeasonSelectModalProps {
  seasons: Season[];
  activeSeasonId: string;
  onSelect: (season: Season) => void;
  onNewSeason: () => void;
  onRenameSeason: (seasonId: string, newLabel: string) => void;
  onFinalizeSeason: (seasonId: string) => void;
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

function EditLabelInline({
  currentLabel,
  onSave,
  onCancel,
}: {
  currentLabel: string;
  onSave: (label: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(currentLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== currentLabel) onSave(trimmed);
    else onCancel();
  };

  return (
    <div className="flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onCancel();
        }}
        className="flex-1 px-2 py-0.5 rounded-lg text-sm font-bold focus:outline-none"
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(var(--club-primary-rgb),0.5)",
          color: "var(--club-primary)",
          caretColor: "var(--club-primary)",
        }}
        placeholder="ex: 2025/26"
        maxLength={20}
      />
      <button
        onClick={commit}
        className="w-6 h-6 flex items-center justify-center rounded text-emerald-400 hover:bg-emerald-400/10 transition-colors flex-shrink-0"
        title="Salvar"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <button
        onClick={onCancel}
        className="w-6 h-6 flex items-center justify-center rounded text-white/30 hover:bg-white/10 transition-colors flex-shrink-0"
        title="Cancelar"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

export function SeasonSelectModal({
  seasons,
  activeSeasonId,
  onSelect,
  onNewSeason,
  onRenameSeason,
  onFinalizeSeason,
  onClose,
}: SeasonSelectModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="h-full w-80 max-w-full flex flex-col shadow-2xl"
        style={{
          background: "var(--app-bg)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderLeft: "1px solid rgba(var(--club-primary-rgb),0.15)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(var(--club-primary-rgb),0.1)" }}
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
            const isEditing = editingId === season.id;
            const isFinalized = !!season.finalized;

            return (
              <div
                key={season.id}
                className="w-full text-left px-4 py-3 rounded-xl transition-all duration-150 group"
                style={{
                  background: isActive
                    ? "rgba(var(--club-primary-rgb),0.12)"
                    : "rgba(255,255,255,0.03)",
                  border: isActive
                    ? "1px solid rgba(var(--club-primary-rgb),0.3)"
                    : "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  {isEditing ? (
                    <EditLabelInline
                      currentLabel={season.label}
                      onSave={(newLabel) => {
                        onRenameSeason(season.id, newLabel);
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <>
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => { if (!isEditing) onSelect(season); }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-bold text-sm truncate block"
                            style={{ color: isActive ? "var(--club-primary)" : "rgba(255,255,255,0.85)" }}
                          >
                            {season.label}
                          </span>
                          {isFinalized && (
                            <span className="text-xs flex-shrink-0" title="Temporada finalizada">🏁</span>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!isFinalized && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingId(season.id); }}
                            className="w-6 h-6 flex items-center justify-center rounded text-white/20 hover:text-white/70 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                            title="Renomear temporada"
                          >
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                              <path d="M7.5 1.5L9.5 3.5L3.5 9.5H1.5V7.5L7.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}
                        {isActive ? (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: "rgba(var(--club-primary-rgb),0.2)",
                              color: "var(--club-primary)",
                            }}
                          >
                            {isFinalized ? "🏁 Finalizada" : "Atual"}
                          </span>
                        ) : (
                          <button
                            onClick={() => onSelect(season)}
                            className="text-xs font-semibold px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity"
                            style={isFinalized
                              ? { background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }
                              : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)" }
                            }
                          >
                            {isFinalized ? "Ver Resumo" : "Ver"}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {!isEditing && <SeasonStats seasonId={season.id} />}

                {/* Finalizar button — only for active non-finalized season */}
                {isActive && !isFinalized && !isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFinalizeSeason(season.id);
                      onClose();
                    }}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90 active:scale-95"
                    style={{
                      background: "rgba(234,179,8,0.12)",
                      border: "1px solid rgba(234,179,8,0.25)",
                      color: "#fbbf24",
                    }}
                  >
                    <span>🏁</span>
                    Finalizar Temporada
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="p-4"
          style={{ borderTop: "1px solid rgba(var(--club-primary-rgb),0.1)" }}
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
