import { useState, useRef } from "react";
import { CoachProfile } from "@/types/career";
import { Career } from "@/types/career";
import { ClubEntry } from "@/types/club";
import { CoachSetup } from "./CoachSetup";
import { ClubPicker } from "./ClubPicker";
import { TeamPreview } from "./TeamPreview";
import { CareerSetupStep } from "./CareerSetupStep";
import { createCareer } from "@/lib/careerStorage";
import { getCurrentSeason } from "@/lib/api";
import { applyTheme, resetTheme, extractColorsFromImage, getCurrentColors } from "@/lib/themeManager";
import { getClubColors } from "@/lib/clubColors";
import { APIFOOTBALL_TO_FC26_NAME, LeagueInfo } from "@/lib/footballApiMap";
import type { ClubTitle } from "@/types/career";
import { useLang } from "@/hooks/useLang";
import { WIZARD } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { getAuthHeaders } from "@/lib/careerStorage";

interface CreateCareerWizardProps {
  allClubs: ClubEntry[];
  onComplete: (career: Career) => Promise<void>;
  onCancel: () => void;
  initialStep?: 0 | 1 | 2;
  initialCoach?: CoachProfile | null;
}

interface ParsedCareerContext {
  boardMood: number;
  fanMood: number;
  currentSeason: string;
  projeto: string;
  narrativeSummary: string;
  confidence: string;
}

type PrePhase = "type-select" | "ongoing-input" | "ongoing-preview" | null;

function ProgressBar({ step, t }: { step: number; t: typeof WIZARD["pt"] }) {
  const steps = [t.stepCoach, t.stepClub, t.stepPreview, t.stepSetup];
  return (
    <div className="flex items-center gap-1.5 mb-5">
      {steps.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={label} className="flex items-center gap-1.5 flex-1">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{
                  background: done
                    ? "var(--club-primary)"
                    : active
                    ? "rgba(var(--club-primary-rgb),0.15)"
                    : "rgba(255,255,255,0.05)",
                  border: active
                    ? "2px solid var(--club-primary)"
                    : done
                    ? "2px solid var(--club-primary)"
                    : "2px solid rgba(255,255,255,0.08)",
                  color: done || active ? "white" : "rgba(255,255,255,0.3)",
                  boxShadow: active ? "0 0 16px rgba(var(--club-primary-rgb),0.3)" : "none",
                }}
              >
                {done ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className="text-xs font-semibold hidden sm:block"
                style={{ color: active ? "white" : done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)" }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-px transition-all duration-500"
                style={{ background: done ? "var(--club-primary)" : "rgba(255,255,255,0.06)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MoodBar({ value, label }: { value: number; label: string }) {
  const color = value >= 70 ? "#22c55e" : value >= 40 ? "#eab308" : "#ef4444";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-white/50 text-xs font-semibold uppercase tracking-wide">{label}</span>
        <span className="text-white font-bold text-sm">{value}/100</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function CreateCareerWizard({
  allClubs,
  onComplete,
  onCancel,
  initialStep = 0,
  initialCoach,
}: CreateCareerWizardProps) {
  const [lang, setLang] = useLang();
  const t = WIZARD[lang];

  const [prePhase, setPrePhase] = useState<PrePhase>(initialStep === 0 ? "type-select" : null);
  const [ongoingText, setOngoingText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [ongoingError, setOngoingError] = useState("");
  const [parsedContext, setParsedContext] = useState<ParsedCareerContext | null>(null);
  const isOngoing = useRef(false);

  const [step, setStep] = useState<0 | 1 | 2 | 3>(initialStep as 0 | 1 | 2 | 3);
  const [coach, setCoach] = useState<CoachProfile | null>(initialCoach ?? null);
  const [selectedClub, setSelectedClub] = useState<ClubEntry | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<LeagueInfo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resolvedColors, setResolvedColors] = useState<{ primary: string; secondary: string } | null>(null);
  const clubInfoRef = useRef<{ description?: string; titles?: ClubTitle[] }>({});

  const handleAnalyze = async () => {
    if (!ongoingText.trim()) return;
    setAnalyzing(true);
    setOngoingError("");
    try {
      const res = await fetch("/api/careers/parse-ongoing-context", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ description: ongoingText }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json() as ParsedCareerContext;
      setParsedContext(data);
      setPrePhase("ongoing-preview");
    } catch {
      setOngoingError(t.ongoingError);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCoachNext = (coachData: CoachProfile) => {
    setCoach(coachData);
    setStep(1);
  };

  const handleClubSelect = async (club: ClubEntry, league: LeagueInfo | null) => {
    setSelectedLeague(league);
    setSelectedClub(club);
    setResolvedColors(null);
    setStep(2);

    const directColors = getClubColors(club.name);
    if (directColors) { applyTheme(directColors); setResolvedColors(directColors); return; }

    const fc26Name = APIFOOTBALL_TO_FC26_NAME[club.name];
    if (fc26Name) {
      const mappedColors = getClubColors(fc26Name);
      if (mappedColors) { applyTheme(mappedColors); setResolvedColors(mappedColors); return; }
    }

    const logoUrl = club.logo || (club.id ? `https://media.api-sports.io/football/teams/${club.id}.png` : null);
    if (logoUrl) {
      const extracted = await extractColorsFromImage(logoUrl);
      applyTheme(extracted);
      setResolvedColors(extracted);
    }
  };

  const handlePreviewNext = () => {
    setStep(3);
  };

  const handleSetupConfirm = async (projeto: string, competitions: string[]) => {
    if (!coach || !selectedClub) return;
    setConfirming(true);
    const colors = resolvedColors || getCurrentColors();
    const career = {
      ...createCareer(coach, selectedClub, {
        projeto: projeto || undefined,
        competitions: competitions.length > 0 ? competitions : undefined,
        clubDescription: clubInfoRef.current.description || undefined,
        clubTitles: clubInfoRef.current.titles?.length ? clubInfoRef.current.titles : undefined,
        ...(isOngoing.current && parsedContext ? {
          backstory: parsedContext.narrativeSummary || undefined,
          initialBoardMood: parsedContext.boardMood,
          initialFanMood: parsedContext.fanMood,
        } : {}),
      }),
      clubPrimary: colors.primary,
      clubSecondary: colors.secondary,
    };
    try {
      await onComplete(career);
    } finally {
      setConfirming(false);
    }
  };

  const handleBack = () => {
    if (step === 2) resetTheme();
    if (step > 0) setStep((s) => (s - 1) as 0 | 1 | 2 | 3);
  };

  const season = getCurrentSeason();
  const isPreviewStep = step === 2;

  const headerTitle = prePhase === "type-select"
    ? t.careerTypeTitle
    : isOngoing.current
    ? t.careerTypeOngoing
    : t.newCareer;

  const confidenceLabel = parsedContext?.confidence === "low"
    ? t.previewConfidenceLow
    : parsedContext?.confidence === "high"
    ? t.previewConfidenceHigh
    : t.previewConfidenceMedium;

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <div
        className="flex items-center justify-between px-4 sm:px-6 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--surface-border)" }}
      >
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors duration-200 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          {t.cancel}
        </button>
        <span className="text-white/25 text-xs font-semibold tracking-widest uppercase">
          {headerTitle}
        </span>
        <div style={{ width: 80 }} className="flex justify-end">
          <LangToggle lang={lang} setLang={setLang} />
        </div>
      </div>

      {/* Pre-step: Career Type Selection */}
      {prePhase === "type-select" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-black text-white mb-2">{t.careerTypeTitle}</h2>
              <p className="text-white/40 text-sm">{t.careerTypeSubtitle}</p>
            </div>
            <div className="flex flex-col gap-4">
              <button
                onClick={() => {
                  isOngoing.current = false;
                  setPrePhase(null);
                }}
                className="flex flex-col gap-2 p-5 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: "rgba(var(--club-primary-rgb),0.08)", border: "1.5px solid rgba(var(--club-primary-rgb),0.2)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: "rgba(var(--club-primary-rgb),0.15)" }}>
                    ✨
                  </div>
                  <span className="text-white font-bold text-base">{t.careerTypeNew}</span>
                </div>
                <p className="text-white/45 text-sm leading-relaxed">{t.careerTypeNewDesc}</p>
              </button>

              <button
                onClick={() => {
                  isOngoing.current = true;
                  setPrePhase("ongoing-input");
                }}
                className="flex flex-col gap-2 p-5 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.10)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: "rgba(255,255,255,0.07)" }}>
                    📊
                  </div>
                  <span className="text-white font-bold text-base">{t.careerTypeOngoing}</span>
                </div>
                <p className="text-white/45 text-sm leading-relaxed">{t.careerTypeOngoingDesc}</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-step: Ongoing Career Input */}
      {prePhase === "ongoing-input" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-black text-white mb-1.5">{t.ongoingTitle}</h2>
              <p className="text-white/40 text-sm leading-relaxed">{t.ongoingSubtitle}</p>
            </div>

            <textarea
              value={ongoingText}
              onChange={(e) => setOngoingText(e.target.value)}
              placeholder={t.ongoingPlaceholder}
              rows={8}
              className="w-full px-4 py-3.5 rounded-xl text-white text-sm font-medium focus:outline-none resize-none transition-colors"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                lineHeight: "1.6",
              }}
              onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(var(--club-primary-rgb),0.5)"; }}
              onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)"; }}
            />

            {ongoingError && (
              <p className="text-red-400/80 text-xs font-medium">{ongoingError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setPrePhase("type-select")}
                className="px-5 py-3 rounded-xl text-sm font-semibold text-white/50 hover:text-white/80 transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {t.ongoingBack}
              </button>
              <button
                onClick={handleAnalyze}
                disabled={analyzing || !ongoingText.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: "var(--club-gradient)", boxShadow: "0 4px 16px rgba(var(--club-primary-rgb),0.25)" }}
              >
                {analyzing ? t.ongoingAnalyzing : t.ongoingAnalyze}
              </button>
            </div>

            <button
              onClick={() => {
                isOngoing.current = false;
                setPrePhase(null);
              }}
              className="text-white/25 hover:text-white/50 text-xs font-medium transition-colors text-center py-1"
            >
              {t.ongoingSkip}
            </button>
          </div>
        </div>
      )}

      {/* Pre-step: AI Parsed Context Preview */}
      {prePhase === "ongoing-preview" && parsedContext && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-black text-white mb-1.5">{t.previewTitle}</h2>
              <p className="text-white/40 text-sm">{t.previewSubtitle}</p>
            </div>

            <div
              className="flex flex-col gap-4 p-5 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <MoodBar value={parsedContext.boardMood} label={t.previewBoardMood} />
              <MoodBar value={parsedContext.fanMood} label={t.previewFanMood} />

              {parsedContext.currentSeason && (
                <div className="flex flex-col gap-1">
                  <span className="text-white/50 text-xs font-semibold uppercase tracking-wide">{t.previewSeason}</span>
                  <span className="text-white font-semibold text-sm">{parsedContext.currentSeason}</span>
                </div>
              )}

              {parsedContext.projeto && (
                <div className="flex flex-col gap-1">
                  <span className="text-white/50 text-xs font-semibold uppercase tracking-wide">{t.previewProject}</span>
                  <p className="text-white/80 text-sm leading-relaxed">{parsedContext.projeto}</p>
                </div>
              )}

              {parsedContext.narrativeSummary && (
                <div className="flex flex-col gap-1">
                  <span className="text-white/50 text-xs font-semibold uppercase tracking-wide">{t.previewNarrative}</span>
                  <p className="text-white/60 text-sm leading-relaxed italic">{parsedContext.narrativeSummary}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <span className="text-white/30 text-xs">{t.previewConfidence}:</span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                  style={{
                    background: parsedContext.confidence === "high"
                      ? "rgba(34,197,94,0.15)"
                      : parsedContext.confidence === "low"
                      ? "rgba(239,68,68,0.15)"
                      : "rgba(234,179,8,0.15)",
                    color: parsedContext.confidence === "high"
                      ? "#4ade80"
                      : parsedContext.confidence === "low"
                      ? "#f87171"
                      : "#facc15",
                  }}
                >
                  {confidenceLabel}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPrePhase("ongoing-input")}
                className="px-5 py-3 rounded-xl text-sm font-semibold text-white/50 hover:text-white/80 transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {t.previewEdit}
              </button>
              <button
                onClick={() => setPrePhase(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: "var(--club-gradient)", boxShadow: "0 4px 16px rgba(var(--club-primary-rgb),0.25)" }}
              >
                {t.previewContinue}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Normal wizard steps (when prePhase is null) */}
      {prePhase === null && (
        <>
          {isPreviewStep && selectedClub && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-4 pb-2">
                <ProgressBar step={step} t={t} />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-3">
                <TeamPreview
                  club={selectedClub}
                  season={season}
                  onNext={handlePreviewNext}
                  onBack={handleBack}
                  onClubInfoLoaded={(info) => { clubInfoRef.current = info; }}
                />
              </div>
            </div>
          )}

          {!isPreviewStep && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {step === 1 ? (
                <div className="flex-1 overflow-y-auto flex flex-col">
                  <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pt-5 pb-2 flex-shrink-0">
                    <ProgressBar step={step} t={t} />
                  </div>
                  <div key={step} className="flex-1 min-h-0 w-full px-3 pb-4 flex flex-col">
                    <ClubPicker allClubs={allClubs} onSelectClub={handleClubSelect} initialLeague={selectedLeague} />
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
                    <ProgressBar step={step} t={t} />
                    <div key={step}>
                      {step === 0 && <CoachSetup onNext={handleCoachNext} initial={coach} />}
                      {step === 3 && selectedClub && (
                        <CareerSetupStep
                          club={selectedClub}
                          season={season}
                          clubInfo={clubInfoRef.current}
                          onConfirm={handleSetupConfirm}
                          onBack={handleBack}
                          confirming={confirming}
                          initialProject={parsedContext?.projeto || undefined}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
