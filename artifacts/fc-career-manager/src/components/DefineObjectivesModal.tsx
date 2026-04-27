import { useState } from "react";
import { useLang } from "@/hooks/useLang";
import { NEW_SEASON_WIZARD } from "@/lib/i18n";
import type { SeasonObjective, ObjectiveType, ObjectiveSeverity } from "@/lib/seasonObjectivesStorage";
import { generateObjectiveId } from "@/lib/seasonObjectivesStorage";

interface DraftObjective {
  id: string;
  type: ObjectiveType;
  competition: string;
  target: string;
  failSeverity: ObjectiveSeverity;
}

interface DefineObjectivesModalProps {
  seasonLabel: string;
  currentCompetitions?: string[];
  onConfirm: (objectives: SeasonObjective[]) => void;
  onSkip: () => void;
}

function makeDraft(type: ObjectiveType = "league_position", competition = ""): DraftObjective {
  return { id: generateObjectiveId(), type, competition, target: "", failSeverity: "moderate" };
}

export function DefineObjectivesModal({ seasonLabel, currentCompetitions, onConfirm, onSkip }: DefineObjectivesModalProps) {
  const [lang] = useLang();
  const t = NEW_SEASON_WIZARD[lang === "en" ? "en" : "pt"];
  const isEn = lang === "en";

  const initialDrafts: DraftObjective[] = currentCompetitions && currentCompetitions.length > 0
    ? currentCompetitions.slice(0, 3).map((comp) => makeDraft("cup_round", comp))
    : [makeDraft()];

  const [drafts, setDrafts] = useState<DraftObjective[]>(initialDrafts);

  function updateDraft(id: string, patch: Partial<DraftObjective>) {
    setDrafts((prev) => prev.map((d) => d.id === id ? { ...d, ...patch } : d));
  }

  function addDraft() {
    if (drafts.length < 3) setDrafts((prev) => [...prev, makeDraft()]);
  }

  function removeDraft(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }

  function handleConfirm() {
    const now = Date.now();
    const objectives: SeasonObjective[] = drafts
      .filter((d) => d.target.trim())
      .map((d, idx) => ({
        id: d.id,
        type: d.type,
        target: d.target.trim(),
        competition: d.competition.trim() || undefined,
        failSeverity: d.failSeverity,
        status: "pending" as const,
        createdAt: now + idx,
      }));
    onConfirm(objectives);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div
        className="w-full max-w-md mx-4 rounded-2xl overflow-hidden"
        style={{ background: "rgba(15,15,20,0.97)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="p-6 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🎯</span>
            <h2 className="text-white font-black text-lg">
              {isEn ? "Define Season Objectives" : "Definir Objetivos da Temporada"}
            </h2>
          </div>
          <p className="text-white/40 text-sm mb-4">
            {isEn
              ? `Set up to 3 objectives for ${seasonLabel}. The board will monitor your progress.`
              : `Defina até 3 objetivos para ${seasonLabel}. A diretoria vai acompanhar seu progresso.`}
          </p>

          <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
            {drafts.map((d, idx) => (
              <div
                key={d.id}
                className="rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                    {isEn ? `Objective ${idx + 1}` : `Objetivo ${idx + 1}`}
                  </span>
                  {drafts.length > 1 && (
                    <button
                      onClick={() => removeDraft(d.id)}
                      className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                    >
                      {t.btnRemoveObj}
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5 mb-2">
                  {(["league_position", "cup_round", "custom"] as ObjectiveType[]).map((tp) => (
                    <button
                      key={tp}
                      onClick={() => updateDraft(d.id, { type: tp, target: "", competition: "" })}
                      className="py-1 px-2 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: d.type === tp ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.04)",
                        color: d.type === tp ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                        border: `1px solid ${d.type === tp ? "rgba(var(--club-primary-rgb),0.3)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      {tp === "league_position" ? t.objTypeLeague : tp === "cup_round" ? t.objTypeCup : t.objTypeCustom}
                    </button>
                  ))}
                </div>

                {d.type === "cup_round" && (
                  <input
                    value={d.competition}
                    onChange={(e) => updateDraft(d.id, { competition: e.target.value })}
                    placeholder={t.objCompetitionPlaceholder}
                    className="w-full px-3 py-1.5 rounded-lg text-white text-xs focus:outline-none mb-1.5"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                )}

                <input
                  value={d.target}
                  onChange={(e) => updateDraft(d.id, { target: e.target.value })}
                  placeholder={
                    d.type === "league_position"
                      ? t.objTargetLeaguePlaceholder
                      : d.type === "cup_round"
                      ? t.objTargetCupPlaceholder
                      : t.objTargetCustomPlaceholder
                  }
                  className="w-full px-3 py-1.5 rounded-lg text-white text-xs focus:outline-none mb-2"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                />

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white/35 text-xs">{t.objSeverityLabel}</span>
                  {(["minor", "moderate", "major"] as ObjectiveSeverity[]).map((sv) => (
                    <button
                      key={sv}
                      onClick={() => updateDraft(d.id, { failSeverity: sv })}
                      className="py-0.5 px-2 rounded text-xs font-semibold transition-all"
                      style={{
                        background: d.failSeverity === sv
                          ? sv === "major" ? "rgba(239,68,68,0.2)" : sv === "moderate" ? "rgba(249,115,22,0.2)" : "rgba(234,179,8,0.2)"
                          : "rgba(255,255,255,0.04)",
                        color: d.failSeverity === sv
                          ? sv === "major" ? "#ef4444" : sv === "moderate" ? "#f97316" : "#eab308"
                          : "rgba(255,255,255,0.35)",
                        border: `1px solid ${d.failSeverity === sv
                          ? sv === "major" ? "rgba(239,68,68,0.3)" : sv === "moderate" ? "rgba(249,115,22,0.3)" : "rgba(234,179,8,0.3)"
                          : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      {sv === "minor" ? t.objSeverityMinor : sv === "moderate" ? t.objSeverityModerate : t.objSeverityMajor}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {drafts.length < 3 && (
            <button
              onClick={addDraft}
              className="w-full py-2 rounded-xl text-xs font-semibold text-white/40 hover:text-white/70 transition-colors mb-4"
              style={{ border: "1px dashed rgba(255,255,255,0.1)" }}
            >
              {t.btnAddObj}
            </button>
          )}
        </div>

        <div className="p-6 pt-2 flex gap-3">
          <button
            onClick={onSkip}
            className="py-3 px-4 rounded-xl font-semibold text-sm text-white/40 hover:text-white/70 glass glass-hover transition-all"
          >
            {t.objSkip}
          </button>
          <button
            onClick={handleConfirm}
            disabled={drafts.every((d) => !d.target.trim())}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
            style={{ background: "var(--club-gradient)" }}
          >
            {isEn ? "Save Objectives" : "Salvar Objetivos"}
          </button>
        </div>
      </div>
    </div>
  );
}
