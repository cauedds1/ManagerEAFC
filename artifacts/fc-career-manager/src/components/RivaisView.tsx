import { useState, useEffect } from "react";
import {
  getSeasonRivals,
  setSeasonRivals,
  areRivalsLocked,
  lockRivals,
  MAX_RIVALS,
} from "@/lib/rivalsStorage";

interface RivaisViewProps {
  seasonId: string;
  isReadOnly?: boolean;
}

export function RivaisView({ seasonId, isReadOnly }: RivaisViewProps) {
  const [rivals, setRivals] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRivals(getSeasonRivals(seasonId));
    setLocked(areRivalsLocked(seasonId));
  }, [seasonId]);

  const handleAdd = async () => {
    const trimmed = input.trim();
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
    } else {
      setError("Rivais bloqueados — não é possível editar.");
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
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
              placeholder="Nome do time rival..."
              disabled={rivals.length >= MAX_RIVALS || saving}
              className="flex-1 rounded-xl px-3 py-2 text-sm bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-white/25 disabled:opacity-40"
            />
            <button
              onClick={() => void handleAdd()}
              disabled={!input.trim() || rivals.length >= MAX_RIVALS || saving}
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
