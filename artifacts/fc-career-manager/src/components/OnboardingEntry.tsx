import { useState } from "react";
import { useLang } from "@/hooks/useLang";
import { ONBOARDING } from "@/lib/i18n";
import type { Plan } from "@/lib/userPlan";
import { getPlanLabel, getPlanColor } from "@/lib/userPlan";
import { getMissionsForPlan } from "@/lib/missionStorage";

interface OnboardingEntryProps {
  plan: Plan;
  clubName: string;
  clubLogoUrl: string | null;
  onDone: () => void;
}

export function OnboardingEntry({ plan, clubName, clubLogoUrl, onDone }: OnboardingEntryProps) {
  const [lang] = useLang();
  const t = ONBOARDING[lang];
  const [slide, setSlide] = useState(0);
  const missions = getMissionsForPlan(plan);
  const firstMission = missions[0];

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        style={{ background: "rgba(14,12,24,0.99)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {slide === 0 && (
          <div className="flex flex-col items-center gap-5 p-8 text-center">
            {clubLogoUrl ? (
              <img
                src={clubLogoUrl}
                alt={clubName}
                className="w-16 h-16 object-contain"
                style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.5))" }}
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black"
                style={{ background: "rgba(var(--club-primary-rgb),0.18)", color: "var(--club-primary)" }}
              >
                {clubName.charAt(0)}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h2 className="text-white font-black text-xl leading-tight">{t.welcomeTitle}</h2>
              <p className="text-white/50 text-sm leading-relaxed">{t.welcomeSub}</p>
            </div>

            <span
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: getPlanColor(plan) }}
            >
              {getPlanLabel(plan)}
            </span>

            <div className="flex items-center gap-2 mt-2 w-full">
              <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(var(--club-primary-rgb),0.5)" }} />
              <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
            </div>

            <button
              onClick={() => setSlide(1)}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-98"
              style={{ background: "var(--club-primary)", color: "#fff" }}
            >
              {t.welcomeCta}
            </button>
          </div>
        )}

        {slide === 1 && (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-white font-bold text-base">{t.missionsPanelTitle}</h3>
              <p className="text-white/40 text-xs">
                {lang === "pt" ? "Complete as missões para descobrir o app." : "Complete missions to discover the app."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {missions.map((mission, i) => (
                <div
                  key={mission.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: i === 0 ? "rgba(var(--club-primary-rgb),0.08)" : "rgba(255,255,255,0.03)",
                    border: i === 0 ? "1px solid rgba(var(--club-primary-rgb),0.2)" : "1px solid rgba(255,255,255,0.06)",
                    opacity: i === 0 ? 1 : 0.45,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: i === 0 ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.06)",
                      border: i === 0 ? "1px solid rgba(var(--club-primary-rgb),0.4)" : "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <span className="text-[9px] font-black" style={{ color: i === 0 ? "var(--club-primary)" : "rgba(255,255,255,0.25)" }}>
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/80 leading-tight">{t[mission.titleKey]}</p>
                    {i === 0 && (
                      <p className="text-white/30 text-[10px] mt-0.5 leading-snug">{t[mission.descKey]}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(var(--club-primary-rgb),0.3)" }} />
              <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(var(--club-primary-rgb),0.8)" }} />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSlide(0)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white/40 hover:text-white/60 transition-colors"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                {lang === "pt" ? "Voltar" : "Back"}
              </button>
              <button
                onClick={onDone}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-98"
                style={{ background: "var(--club-primary)", color: "#fff" }}
              >
                {lang === "pt" ? "Vamos começar!" : "Let's go!"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Plan upgrade card ─────────────────────────────────────────────────────

interface PlanUpgradeEntryProps {
  oldPlan: Plan;
  newPlan: Plan;
  onDone: () => void;
}

const PLAN_DELTA_FEATURES: Record<string, { pt: string; en: string }[]> = {
  "free→pro": [
    { pt: "Diretoria com até 2 membros", en: "Board with up to 2 members" },
    { pt: "Até 25 Momentos (vídeos)", en: "Up to 25 Moments (videos)" },
    { pt: "20 notícias por dia", en: "20 news posts per day" },
    { pt: "Até 5 carreiras simultâneas", en: "Up to 5 simultaneous careers" },
  ],
  "free→ultra": [
    { pt: "Motor automático de notícias", en: "Automatic news engine" },
    { pt: "Rumores de transferência", en: "Transfer rumours" },
    { pt: "Portais personalizados (3)", en: "Custom portals (3)" },
    { pt: "60 Momentos + Vídeo-notícias", en: "60 Moments + Video-news" },
    { pt: "Carreiras ilimitadas", en: "Unlimited careers" },
  ],
  "pro→ultra": [
    { pt: "Motor automático de notícias", en: "Automatic news engine" },
    { pt: "Rumores de transferência", en: "Transfer rumours" },
    { pt: "Portais personalizados (3)", en: "Custom portals (3)" },
    { pt: "60 Momentos + Vídeo-notícias", en: "Video-news for Moments" },
    { pt: "Carreiras ilimitadas", en: "Unlimited careers" },
  ],
};

export function PlanUpgradeEntry({ oldPlan, newPlan, onDone }: PlanUpgradeEntryProps) {
  const [lang] = useLang();
  const t = ONBOARDING[lang];
  const [slide, setSlide] = useState(0);
  const deltaKey = `${oldPlan}→${newPlan}`;
  const features = PLAN_DELTA_FEATURES[deltaKey] ?? [];
  const newMissions = getMissionsForPlan(newPlan);

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        style={{ background: "rgba(14,12,24,0.99)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {slide === 0 && (
          <div className="flex flex-col items-center gap-5 p-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ background: "rgba(var(--club-primary-rgb),0.15)", border: "2px solid rgba(var(--club-primary-rgb),0.3)" }}
            >
              🎉
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-white font-black text-lg leading-tight">{t.upgradeTitle}</h2>
              <p className="text-white/45 text-sm">{t.upgradeSub}</p>
            </div>

            <div className="w-full flex flex-col gap-2">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left"
                  style={{ background: "rgba(var(--club-primary-rgb),0.07)", border: "1px solid rgba(var(--club-primary-rgb),0.15)" }}
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} style={{ color: "var(--club-primary)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white/75 text-xs">{lang === "pt" ? f.pt : f.en}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(var(--club-primary-rgb),0.6)" }} />
              <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
            </div>

            <button
              onClick={() => setSlide(1)}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-98"
              style={{ background: "var(--club-primary)", color: "#fff" }}
            >
              {t.upgradeCta}
            </button>
          </div>
        )}

        {slide === 1 && (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-white font-bold text-base">{t.missionsPanelTitle} — {getPlanLabel(newPlan)}</h3>
              <p className="text-white/40 text-xs">
                {lang === "pt" ? "Suas novas missões para explorar os recursos desbloqueados." : "Your new missions to explore unlocked features."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {newMissions.map((mission, i) => (
                <div
                  key={mission.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: i === 0 ? "rgba(var(--club-primary-rgb),0.08)" : "rgba(255,255,255,0.03)",
                    border: i === 0 ? "1px solid rgba(var(--club-primary-rgb),0.2)" : "1px solid rgba(255,255,255,0.06)",
                    opacity: i === 0 ? 1 : 0.45,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: i === 0 ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <span className="text-[9px] font-black" style={{ color: i === 0 ? "var(--club-primary)" : "rgba(255,255,255,0.25)" }}>
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/80 leading-tight">{t[mission.titleKey]}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(var(--club-primary-rgb),0.4)" }} />
              <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(var(--club-primary-rgb),0.9)" }} />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSlide(0)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white/40 hover:text-white/60 transition-colors"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                {lang === "pt" ? "Voltar" : "Back"}
              </button>
              <button
                onClick={onDone}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-98"
                style={{ background: "var(--club-primary)", color: "#fff" }}
              >
                {lang === "pt" ? "Vamos lá!" : "Let's go!"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
