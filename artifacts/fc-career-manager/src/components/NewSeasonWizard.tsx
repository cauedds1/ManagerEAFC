import { useState } from "react";
import type { Season } from "@/types/career";
import { suggestNextSeasonLabel } from "@/lib/seasonStorage";
import { useLang } from "@/hooks/useLang";
import { NEW_SEASON_WIZARD } from "@/lib/i18n";

const COMPETITIONS = [
  "Campeonato Brasileiro",
  "Copa do Brasil",
  "Copa Libertadores",
  "Copa Sul-Americana",
  "Supercopa do Brasil",
  "Recopa Sul-Americana",
  "Premier League",
  "FA Cup",
  "Carabao Cup",
  "Champions League",
  "Europa League",
  "Conference League",
  "La Liga",
  "Copa del Rey",
  "Supercopa de España",
  "Serie A",
  "Coppa Italia",
  "Bundesliga",
  "DFB-Pokal",
  "Ligue 1",
  "Coupe de France",
  "Eredivisie",
  "Primeira Liga",
  "Liga Profesional",
];

interface NewSeasonWizardProps {
  existingSeasons: Season[];
  currentCompetitions?: string[];
  onConfirm: (label: string, competitions: string[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function NewSeasonWizard({
  existingSeasons,
  currentCompetitions,
  onConfirm,
  onCancel,
  isLoading,
}: NewSeasonWizardProps) {
  const [lang] = useLang();
  const t = NEW_SEASON_WIZARD[lang];

  const [step, setStep] = useState<1 | 2>(1);
  const suggestedLabel = suggestNextSeasonLabel(existingSeasons.map((s) => s.label));
  const [label, setLabel] = useState(suggestedLabel);
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");

  const toggleCompetition = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    );
  };

  const addCustom = () => {
    const trimmed = custom.trim();
    if (trimmed && !selected.includes(trimmed)) {
      setSelected((prev) => [...prev, trimmed]);
    }
    setCustom("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onCancel}
        style={{ backdropFilter: "blur(4px)" }}
      />
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "rgba(15,15,25,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }}
      >
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2 flex-1">
            {([1, 2] as const).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={
                    step === s
                      ? { background: "var(--club-primary)", color: "#fff" }
                      : step > s
                      ? { background: "rgba(var(--club-primary-rgb),0.2)", color: "var(--club-primary)" }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }
                  }
                >
                  {step > s ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : s}
                </div>
                {s === 1 && <div className="h-px w-4 bg-white/10" />}
              </div>
            ))}
          </div>
          <button onClick={onCancel} className="text-white/30 hover:text-white/70 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 1 && (
          <div className="p-6">
            <h2 className="text-white font-black text-lg mb-1">{t.step1Title}</h2>
            <p className="text-white/40 text-sm mb-5">{t.step1Desc}</p>

            <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
              {t.seasonLabelField}
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-white font-bold text-lg focus:outline-none mb-5"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              placeholder={t.labelPlaceholder}
            />

            <div
              className="rounded-xl p-4 mb-5 text-sm"
              style={{ background: "rgba(var(--club-primary-rgb),0.06)", border: "1px solid rgba(var(--club-primary-rgb),0.12)" }}
            >
              <p className="text-white/60 font-semibold mb-2">{t.resetTitle}</p>
              <ul className="space-y-1 text-white/45">
                <li className="flex items-center gap-2"><span className="text-red-400">✕</span> {t.resetItem1}</li>
                <li className="flex items-center gap-2"><span className="text-red-400">✕</span> {t.resetItem2}</li>
                <li className="flex items-center gap-2"><span className="text-red-400">✕</span> {t.resetItem3}</li>
                <li className="flex items-center gap-2"><span className="text-red-400">✕</span> {t.resetItem4}</li>
              </ul>
              <p className="text-white/60 font-semibold mt-3 mb-2">{t.keepTitle}</p>
              <ul className="space-y-1 text-white/45">
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> {t.keepItem1}</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> {t.keepItem2}</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> {t.keepItem3}</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> {t.keepItem4}</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white/50 hover:text-white glass glass-hover transition-all"
              >
                {t.btnCancel}
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!label.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                style={{ background: "var(--club-gradient)" }}
              >
                {t.btnNext}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-6">
            <h2 className="text-white font-black text-lg mb-1">{t.step2Title}</h2>
            <p className="text-white/40 text-sm mb-4">
              {t.step2Desc} <span className="text-white/70 font-semibold">{label}</span>.
            </p>

            <div className="flex flex-wrap gap-2 mb-4 max-h-52 overflow-y-auto pr-1">
              {COMPETITIONS.map((comp) => {
                const active = selected.includes(comp);
                return (
                  <button
                    key={comp}
                    onClick={() => toggleCompetition(comp)}
                    className="py-1.5 px-3 rounded-lg text-xs font-semibold transition-all duration-150"
                    style={{
                      background: active ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.04)",
                      color: active ? "var(--club-primary)" : "rgba(255,255,255,0.45)",
                      border: `1px solid ${active ? "rgba(var(--club-primary-rgb),0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {comp}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 mb-5">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                placeholder={t.customPlaceholder}
                className="flex-1 px-3 py-2 rounded-lg text-white text-sm focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
              <button
                onClick={addCustom}
                disabled={!custom.trim()}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-30 transition-all"
                style={{ background: "rgba(var(--club-primary-rgb),0.2)", border: "1px solid rgba(var(--club-primary-rgb),0.25)" }}
              >
                +
              </button>
            </div>

            {selected.length > 0 && (
              <p className="text-white/35 text-xs mb-4">
                {selected.length} {selected.length !== 1 ? t.selectedMany : t.selectedOne}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white/50 hover:text-white glass glass-hover transition-all"
              >
                {t.btnBack}
              </button>
              <button
                onClick={() => onConfirm(label.trim(), selected)}
                disabled={isLoading || !label.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "var(--club-gradient)" }}
              >
                {isLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : null}
                {t.btnStart}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
