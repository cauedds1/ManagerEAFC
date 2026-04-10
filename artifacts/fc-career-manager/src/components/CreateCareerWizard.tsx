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

interface CreateCareerWizardProps {
  allClubs: ClubEntry[];
  onComplete: (career: Career) => Promise<void>;
  onCancel: () => void;
  initialStep?: 0 | 1 | 2;
  initialCoach?: CoachProfile | null;
}

const STEPS = ["Técnico", "Clube", "Preview", "Configurar"];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-5">
      {STEPS.map((label, i) => {
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
            {i < STEPS.length - 1 && (
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

export function CreateCareerWizard({
  allClubs,
  onComplete,
  onCancel,
  initialStep = 0,
  initialCoach,
}: CreateCareerWizardProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(initialStep as 0 | 1 | 2 | 3);
  const [coach, setCoach] = useState<CoachProfile | null>(initialCoach ?? null);
  const [selectedClub, setSelectedClub] = useState<ClubEntry | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<LeagueInfo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resolvedColors, setResolvedColors] = useState<{ primary: string; secondary: string } | null>(null);
  const clubInfoRef = useRef<{ description?: string; titles?: ClubTitle[] }>({});

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
          Cancelar
        </button>
        <span className="text-white/25 text-xs font-semibold tracking-widest uppercase">
          Nova Carreira
        </span>
        <div style={{ width: 80 }} />
      </div>

      {/* Step 2 (Preview): full-height flex-fill — no page scroll */}
      {isPreviewStep && selectedClub && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-4">
            <ProgressBar step={step} />
          </div>
          <div className="flex-1 min-h-0 max-w-3xl w-full mx-auto px-4 sm:px-6 pb-4 flex flex-col overflow-hidden">
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

      {/* All other steps: normal scrollable layout */}
      {!isPreviewStep && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Club picker (step 1) gets full width, no max-w constraint */}
          {step === 1 ? (
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pt-5 pb-2 flex-shrink-0">
                <ProgressBar step={step} />
              </div>
              <div key={step} className="flex-1 min-h-0 w-full px-3 pb-4 flex flex-col">
                <ClubPicker allClubs={allClubs} onSelectClub={handleClubSelect} initialLeague={selectedLeague} />
              </div>
            </div>
          ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
              <ProgressBar step={step} />
              <div key={step}>
                {step === 0 && <CoachSetup onNext={handleCoachNext} initial={coach} />}
                {step === 1 && null /* handled above */}
                {step === 3 && selectedClub && (
                  <CareerSetupStep
                    club={selectedClub}
                    season={season}
                    clubInfo={clubInfoRef.current}
                    onConfirm={handleSetupConfirm}
                    onBack={handleBack}
                    confirming={confirming}
                  />
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
