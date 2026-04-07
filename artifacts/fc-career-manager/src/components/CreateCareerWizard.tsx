import { useState } from "react";
import { CoachProfile } from "@/types/career";
import { Career } from "@/types/career";
import { ClubEntry } from "@/types/club";
import { CoachSetup } from "./CoachSetup";
import { ClubPicker } from "./ClubPicker";
import { TeamPreview } from "./TeamPreview";
import { createCareer } from "@/lib/careerStorage";
import { getCurrentSeason } from "@/lib/api";

interface CreateCareerWizardProps {
  allClubs: ClubEntry[];
  onComplete: (career: Career) => Promise<void>;
  onCancel: () => void;
  initialStep?: 0 | 1 | 2;
  initialCoach?: CoachProfile | null;
}

const STEPS = ["Técnico", "Clube", "Preview"];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{
                  background: done
                    ? "var(--club-primary, #6366f1)"
                    : active
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(255,255,255,0.06)",
                  border: active
                    ? "2px solid var(--club-primary, #6366f1)"
                    : done
                    ? "2px solid var(--club-primary, #6366f1)"
                    : "2px solid rgba(255,255,255,0.1)",
                  color: done || active ? "white" : "rgba(255,255,255,0.3)",
                  boxShadow: active ? "0 0 12px var(--club-primary, #6366f1)40" : "none",
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
                style={{
                  background: done
                    ? "var(--club-primary, #6366f1)"
                    : "rgba(255,255,255,0.08)",
                }}
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
  const [step, setStep] = useState<0 | 1 | 2>(initialStep);
  const [coach, setCoach] = useState<CoachProfile | null>(initialCoach ?? null);
  const [selectedClub, setSelectedClub] = useState<ClubEntry | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleCoachNext = (coachData: CoachProfile) => {
    setCoach(coachData);
    setStep(1);
  };

  const handleClubSelect = (club: ClubEntry) => {
    setSelectedClub(club);
    setStep(2);
  };

  const handleConfirm = async () => {
    if (!coach || !selectedClub) return;
    setConfirming(true);
    const career = createCareer(coach, selectedClub);
    try {
      await onComplete(career);
    } finally {
      setConfirming(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => (s - 1) as 0 | 1 | 2);
  };

  const season = getCurrentSeason();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--app-bg, #0a0a0a)" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
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

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-5 py-8">
            <ProgressBar step={step} />

            <div className="animate-fade-in" key={step}>
              {step === 0 && (
                <CoachSetup onNext={handleCoachNext} initial={coach} />
              )}
              {step === 1 && (
                <ClubPicker allClubs={allClubs} onSelectClub={handleClubSelect} />
              )}
              {step === 2 && selectedClub && (
                <TeamPreview
                  club={selectedClub}
                  season={season}
                  onConfirm={handleConfirm}
                  onBack={handleBack}
                  confirming={confirming}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
