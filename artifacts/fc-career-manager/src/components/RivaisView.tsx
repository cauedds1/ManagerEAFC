import { useState, useEffect, useRef, useCallback } from "react";
import {
  getSeasonRivals,
  setSeasonRivals,
  areRivalsLocked,
  lockRivals,
  MAX_RIVALS,
} from "@/lib/rivalsStorage";
import { getCachedClubList, searchClubs } from "@/lib/clubListCache";
import { ClubEntry } from "@/types/club";

interface RivaisViewProps {
  seasonId: string;
  isReadOnly?: boolean;
}

function ClubLogo({ logo, name }: { logo: string; name: string }) {
  const [err, setErr] = useState(false);
  return (
    <div
      className="flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
      style={{ width: 28, height: 28, background: "rgba(255,255,255,0.06)" }}
    >
      {logo && !err ? (
        <img
          src={logo}
          alt={name}
          onError={() => setErr(true)}
          style={{ width: 20, height: 20, objectFit: "contain" }}
        />
      ) : (
        <span className="text-white/40 font-black text-[9px]">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

const MAX_SUGGESTIONS = 8;

export function RivaisView({ seasonId, isReadOnly }: RivaisViewProps) {
  const [rivals, setRivals] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [clubs] = useState<ClubEntry[]>(() => getCachedClubList() ?? []);
  const [suggestions, setSuggestions] = useState<ClubEntry[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRivals(getSeasonRivals(seasonId));
    setLocked(areRivalsLocked(seasonId));
  }, [seasonId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addRival = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (rivals.length >= MAX_RIVALS) {
      setError(`Máximo de ${MAX_RIVALS} rivais por temporada.`);
      return;
    }
    if (rivals.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      setError("Este rival já foi adicionado.");
      return;
    }
    const next = [...rivals, trimmed];
    setSaving(true);
    const saved = await setSeasonRivals(seasonId, next);
    setSaving(false);
    if (saved) {
      setRivals(next);
      setInput("");
      setError("");
      setSuggestions([]);
      setShowDropdown(false);
      setActiveIdx(-1);
    } else {
      setError("Rivais bloqueados — não é possível editar.");
    }
  }, [rivals, seasonId]);

  const handleInputChange = (value: string) => {
    setInput(value);
    setError("");
    setActiveIdx(-1);
    if (!value.trim() || clubs.length === 0) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    const filtered = searchClubs(value, clubs).slice(0, MAX_SUGGESTIONS);
    setSuggestions(filtered);
    setShowDropdown(filtered.length > 0);
  };

  const handleSelectSuggestion = (club: ClubEntry) => {
    setShowDropdown(false);
    setActiveIdx(-1);
    void addRival(club.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (e.key === "Enter") void addRival(input);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        handleSelectSuggestion(suggestions[activeIdx]);
      } else {
        void addRival(input);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIdx(-1);
    }
  };

  const handleRemove = async (name: string) => {
    if (locked) return;
    const next = rivals.filter((r) => r !== name);
    setSaving(true);
    const saved = await setSeasonRivals(seasonId, next);
    setSaving(false);
    if (saved) setRivals(next);
  };

  const handleLock = async () => {
    if (rivals.length === 0) {
      setError("Adicione pelo menos um rival antes de confirmar.");
      return;
    }
    setSaving(true);
    await lockRivals(seasonId);
    setSaving(false);
    setLocked(true);
    setError("");
  };

  const canEdit = !locked && !isReadOnly;
  const isDisabled = rivals.length >= MAX_RIVALS || saving;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white/90">Rivais da Temporada</h3>
          <p className="text-xs text-white/40 mt-0.5">
            {locked
              ? "Rivais confirmados e bloqueados para esta temporada."
              : `Adicione até ${MAX_RIVALS} rivais. Após confirmar, não poderão ser alterados.`}
          </p>
        </div>
        {locked && (
          <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-lg shrink-0">
            🔒 Bloqueado
          </span>
        )}
      </div>

      {rivals.length === 0 && locked && (
        <p className="text-xs text-white/30 italic">Nenhum rival definido para esta temporada.</p>
      )}

      {rivals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rivals.map((r) => (
            <div
              key={r}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
              style={{
                background: "rgba(var(--club-primary-rgb),0.15)",
                border: "1px solid rgba(var(--club-primary-rgb),0.35)",
                color: "var(--club-primary)",
              }}
            >
              ⚔️ {r}
              {canEdit && (
                <button
                  onClick={() => void handleRemove(r)}
                  disabled={saving}
                  className="ml-1 text-white/30 hover:text-red-400 transition-colors text-xs leading-none disabled:opacity-40"
                  title="Remover"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="space-y-3">
          <div ref={wrapperRef} className="relative">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
                placeholder={clubs.length > 0 ? "Pesquise um time do sistema..." : "Nome do time rival..."}
                disabled={isDisabled}
                className="flex-1 rounded-xl px-3 py-2 text-sm bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-white/25 disabled:opacity-40"
              />
              <button
                onClick={() => void addRival(input)}
                disabled={!input.trim() || isDisabled}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{
                  background: "rgba(var(--club-primary-rgb),0.2)",
                  border: "1px solid rgba(var(--club-primary-rgb),0.4)",
                  color: "var(--club-primary)",
                }}
              >
                {saving ? "..." : "Adicionar"}
              </button>
            </div>

            {showDropdown && suggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden"
                style={{
                  background: "var(--app-bg-lighter, #1a1a1a)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                }}
              >
                {suggestions.map((club, idx) => {
                  const isActive = idx === activeIdx;
                  return (
                    <button
                      key={club.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(club);
                      }}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors duration-100"
                      style={{
                        background: isActive
                          ? "rgba(var(--club-primary-rgb),0.12)"
                          : "transparent",
                        borderBottom: idx < suggestions.length - 1
                          ? "1px solid rgba(255,255,255,0.05)"
                          : "none",
                      }}
                    >
                      <ClubLogo logo={club.logo} name={club.name} />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold truncate leading-tight"
                          style={{ color: isActive ? "var(--club-primary)" : "rgba(255,255,255,0.85)" }}
                        >
                          {club.name}
                        </p>
                        <p className="text-xs text-white/35 truncate leading-tight mt-0.5">
                          {club.league}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {input.trim().length > 0 && clubs.length > 0 && suggestions.length === 0 && !showDropdown && (
              <p className="text-xs text-white/30 mt-1.5 px-1">Nenhum time encontrado para "{input}"</p>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {rivals.length > 0 && (
            <button
              onClick={() => void handleLock()}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{
                background: "rgba(var(--club-primary-rgb),0.18)",
                border: "1px solid rgba(var(--club-primary-rgb),0.4)",
                color: "var(--club-primary)",
              }}
            >
              🔒 Confirmar rivais da temporada
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl p-3 space-y-1.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-xs font-semibold text-white/50">Como funciona</p>
        <ul className="text-xs text-white/35 space-y-1 list-disc list-inside">
          <li>Partidas contra rivais são reconhecidas como <strong className="text-white/50">clássicos</strong></li>
          <li>Notícias de clássicos têm tom mais intenso e maior impacto</li>
          <li>Derrotas em clássicos geram comentários dos torcedores rivais zoando</li>
          <li>A Diretoria reage com mais severidade a derrotas em clássicos</li>
          <li>Rivais bloqueados valem apenas para esta temporada</li>
        </ul>
      </div>
    </div>
  );
}
