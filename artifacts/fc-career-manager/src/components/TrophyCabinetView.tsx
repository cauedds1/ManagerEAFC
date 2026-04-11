import { useState, useMemo, useRef, useEffect } from "react";
import { getTrophies, addTrophy, removeTrophy, type Trophy } from "@/lib/trophyStorage";
import { findTrophyPhoto, findTrophyEntry, TROPHY_ENTRIES } from "@/lib/trophyPhotoMap";

interface Props {
  careerId: string;
}

function TrophyImage({ url, size = 96 }: { url: string | null; size?: number }) {
  const [error, setError] = useState(false);

  if (!url || error) {
    return (
      <span style={{ fontSize: size * 0.6, lineHeight: 1 }} className="select-none">
        🏆
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      onError={() => setError(true)}
      style={{ maxHeight: size, maxWidth: size * 1.2, objectFit: "contain" }}
      className="drop-shadow-md"
    />
  );
}

function AddTrophyModal({
  careerId,
  onClose,
  onAdded,
}: {
  careerId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [season, setSeason] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!q) return TROPHY_ENTRIES;
    return TROPHY_ENTRIES.filter((e) => {
      const label = e.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const aliasMatch = e.aliases.some((a) => a.includes(q));
      return label.includes(q) || aliasMatch;
    });
  }, [search]);

  const competitionName = selected || search.trim();
  const preview = competitionName ? findTrophyPhoto(competitionName) : null;
  const matchedEntry = competitionName ? findTrophyEntry(competitionName) : null;

  function handleSelect(label: string) {
    setSelected(label);
    setSearch(label);
    setShowDropdown(false);
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    setSelected("");
    setShowDropdown(true);
  }

  function handleSubmit() {
    if (!competitionName || !season.trim()) return;
    addTrophy(careerId, { competitionName, seasonLabel: season.trim() });
    onAdded();
    onClose();
  }

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl px-5 pt-6 pb-8"
        style={{ background: "#1a1a2e", border: "1px solid rgba(251,191,36,0.2)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="text-white font-bold text-base">Adicionar troféu</p>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-xl leading-none font-light"
          >
            ×
          </button>
        </div>

        {/* Trophy preview */}
        <div
          className="flex items-center justify-center rounded-2xl mb-5"
          style={{
            height: 140,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(251,191,36,0.15)",
          }}
        >
          <TrophyImage url={preview} size={110} />
        </div>
        {matchedEntry && (
          <p className="text-center text-xs text-white/30 -mt-3 mb-4">{matchedEntry.label}</p>
        )}

        {/* Competition input */}
        <div className="relative mb-3">
          <label className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-1.5 block">
            Competição
          </label>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            placeholder="Champions League, Série A…"
            className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white placeholder-white/20 outline-none"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
            autoComplete="off"
          />

          {showDropdown && filtered.length > 0 && (
            <div
              className="absolute left-0 right-0 rounded-xl mt-1 z-10 overflow-y-auto"
              style={{
                top: "100%",
                maxHeight: 200,
                background: "#0f0f1a",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              {filtered.map((entry) => (
                <button
                  key={entry.label}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(entry.label); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-3"
                >
                  <span className="text-base flex-shrink-0">
                    {entry.photo ? (
                      <img
                        src={entry.photo}
                        alt=""
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        style={{ width: 22, height: 22, objectFit: "contain" }}
                      />
                    ) : (
                      "🏆"
                    )}
                  </span>
                  <span className="font-medium">{entry.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Season input */}
        <div className="mb-6">
          <label className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-1.5 block">
            Temporada
          </label>
          <input
            type="text"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="ex: 2024/25"
            className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white placeholder-white/20 outline-none"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!competitionName || !season.trim()}
          className="w-full py-3.5 rounded-2xl text-sm font-bold transition-opacity"
          style={{
            background: competitionName && season.trim() ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.08)",
            color: competitionName && season.trim() ? "#1a1a2e" : "rgba(255,255,255,0.25)",
          }}
        >
          Adicionar troféu
        </button>
      </div>
    </div>
  );
}

function TrophyCard({ trophy, onRemove }: { trophy: Trophy; onRemove: () => void }) {
  const photo = findTrophyPhoto(trophy.competitionName);

  return (
    <div
      className="relative rounded-2xl flex flex-col items-center px-3 pt-5 pb-4 gap-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(251,191,36,0.22)",
      }}
    >
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-white/20 hover:text-white/60 hover:bg-white/10 text-sm font-bold leading-none transition-colors"
        title="Remover troféu"
      >
        ×
      </button>

      <div className="flex items-center justify-center" style={{ height: 96 }}>
        <TrophyImage url={photo} size={90} />
      </div>

      <div className="text-center space-y-1 w-full">
        <p className="text-white/85 text-xs font-bold leading-tight line-clamp-2">
          {trophy.competitionName}
        </p>
        <span
          className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
        >
          {trophy.seasonLabel}
        </span>
      </div>
    </div>
  );
}

export function TrophyCabinetView({ careerId }: Props) {
  const [trophies, setTrophies] = useState<Trophy[]>(() => getTrophies(careerId));
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setTrophies(getTrophies(careerId));
  }, [careerId]);

  function refresh() {
    setTrophies(getTrophies(careerId));
  }

  function handleRemove(id: string) {
    removeTrophy(careerId, id);
    refresh();
  }

  const byCompetition = useMemo(() => {
    const map = new Map<string, Trophy[]>();
    for (const t of trophies) {
      if (!map.has(t.competitionName)) map.set(t.competitionName, []);
      map.get(t.competitionName)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [trophies]);

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-black text-lg">
            {trophies.length > 0 ? (
              <>
                <span style={{ color: "#fbbf24" }}>{trophies.length}</span>{" "}
                <span className="text-white/60 font-semibold text-sm">
                  troféu{trophies.length !== 1 ? "s" : ""}
                </span>
              </>
            ) : (
              <span className="text-white/30 font-medium text-sm">Sem troféus</span>
            )}
          </p>
          {trophies.length > 0 && (
            <p className="text-white/25 text-xs">
              {byCompetition.length} competição{byCompetition.length !== 1 ? "ões" : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-colors"
          style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}
        >
          <span className="text-base leading-none">+</span>
          Adicionar troféu
        </button>
      </div>

      {/* Empty state */}
      {trophies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <span className="text-6xl opacity-20">🏆</span>
          <p className="text-white/30 text-sm font-medium">Nenhum troféu ainda</p>
          <p className="text-white/20 text-xs max-w-xs">
            Clica em "Adicionar troféu" para registar as tuas conquistas
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-2 px-6 py-3 rounded-2xl text-sm font-bold"
            style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}
          >
            + Adicionar troféu
          </button>
        </div>
      )}

      {/* Trophy grid */}
      {trophies.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {trophies.map((t) => (
            <TrophyCard key={t.id} trophy={t} onRemove={() => handleRemove(t.id)} />
          ))}
        </div>
      )}

      {/* By competition summary */}
      {byCompetition.length > 0 && (
        <div>
          <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3">
            Por competição
          </p>
          <div className="space-y-2">
            {byCompetition.map(([comp, wins]) => {
              const photo = findTrophyPhoto(comp);
              return (
                <div
                  key={comp}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <TrophyImage url={photo} size={32} />
                  </div>
                  <p className="flex-1 text-sm font-semibold text-white/75 leading-tight">{comp}</p>
                  <span
                    className="text-base font-black flex-shrink-0"
                    style={{ color: "#fbbf24" }}
                  >
                    ×{wins.length}
                  </span>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[100px]">
                    {wins.slice(0, 3).map((w) => (
                      <span
                        key={w.id}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}
                      >
                        {w.seasonLabel}
                      </span>
                    ))}
                    {wins.length > 3 && (
                      <span className="text-[10px] text-white/25 font-semibold px-1">
                        +{wins.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Histórico completo */}
      {trophies.length > 0 && (
        <div>
          <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3">
            Histórico
          </p>
          <div className="space-y-2">
            {trophies.map((t, idx) => {
              const photo = findTrophyPhoto(t.competitionName);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <span
                    className="w-6 text-center text-xs font-black tabular-nums flex-shrink-0"
                    style={{ color: idx === 0 ? "#fbbf24" : "rgba(255,255,255,0.2)" }}
                  >
                    #{idx + 1}
                  </span>
                  <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                    <TrophyImage url={photo} size={28} />
                  </div>
                  <p className="flex-1 text-sm font-semibold text-white/80 leading-tight">{t.competitionName}</p>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}
                  >
                    {t.seasonLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showModal && (
        <AddTrophyModal
          careerId={careerId}
          onClose={() => setShowModal(false)}
          onAdded={refresh}
        />
      )}
    </div>
  );
}
