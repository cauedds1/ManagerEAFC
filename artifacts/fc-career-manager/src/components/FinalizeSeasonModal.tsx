import { useState } from "react";
import { getLeaguePosition } from "@/lib/leagueStorage";
import { setSeasonSummary } from "@/lib/seasonSummaryStorage";
import { finalizeSeasonApi } from "@/lib/seasonStorage";
import type { SeasonSummaryLeague } from "@/lib/seasonSummaryStorage";

interface FinalizeSeasonModalProps {
  seasonId: string;
  seasonLabel: string;
  onFinalize: () => void;
  onCancel: () => void;
}

export function FinalizeSeasonModal({ seasonId, seasonLabel, onFinalize, onCancel }: FinalizeSeasonModalProps) {
  const existing = getLeaguePosition(seasonId);

  const [position, setPosition] = useState(existing?.position ?? 1);
  const [totalTeams, setTotalTeams] = useState(existing?.totalTeams ?? 20);
  const [wins, setWins] = useState(existing?.wins ?? 0);
  const [draws, setDraws] = useState(existing?.draws ?? 0);
  const [losses, setLosses] = useState(existing?.losses ?? 0);
  const [goalsFor, setGoalsFor] = useState<string>("");
  const [goalsAgainst, setGoalsAgainst] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const points = wins * 3 + draws;

  const handleFinalize = async () => {
    setApiError(null);
    setSaving(true);
    try {
      const league: SeasonSummaryLeague = {
        position,
        totalTeams,
        wins,
        draws,
        losses,
        points,
        goalsFor: goalsFor.trim() !== "" ? Number(goalsFor) : undefined,
        goalsAgainst: goalsAgainst.trim() !== "" ? Number(goalsAgainst) : undefined,
      };

      const ok = await finalizeSeasonApi(seasonId);
      if (!ok) {
        setApiError("Não foi possível finalizar a temporada. Verifique a conexão e tente novamente.");
        return;
      }

      setSeasonSummary(seasonId, {
        seasonId,
        seasonLabel,
        league,
        finalizedAt: Date.now(),
      });

      onFinalize();
    } catch {
      setApiError("Não foi possível finalizar a temporada. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const numInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    min = 0,
    max = 999,
  ) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-white/40 text-xs font-medium">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className="w-full px-3 py-2 rounded-xl text-white text-sm font-semibold focus:outline-none tabular-nums"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      />
    </div>
  );

  const optNumInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
  ) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-white/40 text-xs font-medium">{label} <span className="text-white/20">(opcional)</span></label>
      <input
        type="number"
        min={0}
        max={999}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl text-white text-sm font-semibold focus:outline-none tabular-nums"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        style={{
          background: "var(--app-bg)",
          border: "1px solid rgba(var(--club-primary-rgb),0.2)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <h2 className="text-white font-black text-base">Finalizar Temporada</h2>
            <p className="text-white/40 text-xs mt-0.5">{seasonLabel}</p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/08 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
          <div
            className="rounded-xl px-4 py-3 flex items-start gap-3 text-sm"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}
          >
            <svg className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-yellow-400/80 text-xs leading-relaxed">
              Após finalizar, um <strong>Resumo</strong> será criado e ficará disponível como a aba principal desta temporada.
            </span>
          </div>

          <div>
            <span className="text-white/70 text-sm font-semibold">Desempenho na liga</span>
            <p className="text-white/30 text-xs mt-0.5">Posição obrigatória — W/E/D e gols são opcionais</p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {numInput("Posição final", position, setPosition, 1, 40)}
              {numInput("Nº de times", totalTeams, setTotalTeams, 2, 40)}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {numInput("Vitórias", wins, setWins, 0, 99)}
              {numInput("Empates", draws, setDraws, 0, 99)}
              {numInput("Derrotas", losses, setLosses, 0, 99)}
            </div>
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
              style={{ background: "rgba(var(--club-primary-rgb),0.08)", border: "1px solid rgba(var(--club-primary-rgb),0.15)" }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--club-primary)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" />
              </svg>
              <span style={{ color: "var(--club-primary)" }}>
                Pontos calculados automaticamente: <strong>{points} pts</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {optNumInput("Gols feitos", goalsFor, setGoalsFor, "ex: 68")}
              {optNumInput("Gols sofridos", goalsAgainst, setGoalsAgainst, "ex: 32")}
            </div>
          </div>

          {apiError && (
            <div
              className="px-4 py-3 rounded-xl text-xs text-red-300"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              {apiError}
            </div>
          )}
        </div>

        <div
          className="px-6 py-4 flex gap-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/40 hover:text-white/70 hover:bg-white/06 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleFinalize}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: "var(--club-gradient)" }}
          >
            {saving ? "Finalizando..." : "Finalizar Temporada 🏁"}
          </button>
        </div>
      </div>
    </div>
  );
}
