import { useState, useCallback, useEffect } from "react";
import { useLang } from "@/hooks/useLang";
import { ONBOARDING } from "@/lib/i18n";
import type { Plan } from "@/lib/userPlan";
import {
  getMissionsForPlan,
  isMissionComplete,
  allMissionsForPlanDone,
  FC_MISSION_COMPLETE_EVENT,
  type MissionDef,
  type MissionId,
} from "@/lib/missionStorage";

const CONFETTI_COLORS = ["#34d399","#6ee7b7","#a78bfa","#818cf8","#fbbf24","#fb923c","#f472b6"];
const CONFETTI_COUNT = 18;

function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" style={{ zIndex: 1 }}>
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
        const angle = (360 / CONFETTI_COUNT) * i;
        const distance = 40 + Math.random() * 30;
        const dx = Math.cos((angle * Math.PI) / 180) * distance;
        const dy = Math.sin((angle * Math.PI) / 180) * distance;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const size = 4 + Math.floor(Math.random() * 4);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: size,
              height: size,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              background: color,
              opacity: 0,
              animation: `confetti-particle 0.8s ease-out ${i * 18}ms forwards`,
              ["--dx" as string]: `${dx}px`,
              ["--dy" as string]: `${dy}px`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-particle {
          0%   { transform: translate(-50%,-50%) translate(0,0) scale(1); opacity: 1; }
          80%  { opacity: 0.8; }
          100% { transform: translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

interface MissionWidgetProps {
  careerId: string;
  plan: Plan;
  onNavigateTab: (tab: string) => void;
  onMissionComplete?: (missionId: string, rewardKey: string) => void;
  onCompletionCheck?: () => void;
}

function MissionIcon({ done, active }: { done: boolean; active: boolean }) {
  if (done) {
    return (
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.35)" }}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} style={{ color: "#34d399" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (active) {
    return (
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse"
        style={{ background: "rgba(var(--club-primary-rgb),0.18)", border: "1px solid rgba(var(--club-primary-rgb),0.4)" }}
      >
        <div className="w-2 h-2 rounded-full" style={{ background: "var(--club-primary)" }} />
      </div>
    );
  }
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
    </div>
  );
}

function MissionRow({
  mission,
  done,
  active,
  justCompleted,
  t,
  onGo,
}: {
  mission: MissionDef;
  done: boolean;
  active: boolean;
  justCompleted: boolean;
  t: Record<string, string>;
  onGo: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all"
      style={{
        background: justCompleted
          ? "rgba(52,211,153,0.14)"
          : done
          ? "rgba(52,211,153,0.05)"
          : active
          ? "rgba(var(--club-primary-rgb),0.07)"
          : "rgba(255,255,255,0.02)",
        border: justCompleted
          ? "1px solid rgba(52,211,153,0.45)"
          : done
          ? "1px solid rgba(52,211,153,0.12)"
          : active
          ? "1px solid rgba(var(--club-primary-rgb),0.18)"
          : "1px solid rgba(255,255,255,0.05)",
        opacity: !done && !active ? 0.45 : 1,
        transform: justCompleted ? "scale(1.02)" : "scale(1)",
        transition: "all 0.4s ease",
      }}
    >
      <MissionIcon done={done} active={active} />
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-semibold leading-tight"
          style={{ color: done ? "#34d399" : active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)" }}
        >
          {t[mission.titleKey]}
        </p>
        {!done && (
          <p className="text-white/30 text-[10px] mt-0.5 leading-snug">{t[mission.descKey]}</p>
        )}
      </div>
      {active && (
        <button
          onClick={onGo}
          className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80 active:scale-95"
          style={{
            background: "rgba(var(--club-primary-rgb),0.2)",
            color: "var(--club-primary)",
            border: "1px solid rgba(var(--club-primary-rgb),0.35)",
          }}
        >
          {t.missionGo}
        </button>
      )}
      {done && justCompleted && (
        <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md animate-pulse" style={{ background: "rgba(52,211,153,0.25)", color: "#34d399" }}>
          ✓ {t.missionDoneLabel}
        </span>
      )}
      {done && !justCompleted && (
        <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
          {t.missionDoneLabel}
        </span>
      )}
    </div>
  );
}

export function MissionWidget({
  careerId,
  plan,
  onNavigateTab,
  onMissionComplete,
}: MissionWidgetProps) {
  const [lang] = useLang();
  const t = ONBOARDING[lang];

  const collapsedKey = `fc_widget_collapsed_${careerId}`;
  const [collapsed, setCollapsedRaw] = useState<boolean>(() => {
    if (allMissionsForPlanDone(careerId, plan)) return true;
    return localStorage.getItem(collapsedKey) === "1";
  });
  const setCollapsed = useCallback((val: boolean) => {
    setCollapsedRaw(val);
    localStorage.setItem(collapsedKey, val ? "1" : "0");
  }, [collapsedKey]);

  const [, forceUpdate] = useState(0);
  const [lastCompletedId, setLastCompletedId] = useState<MissionId | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const missionId = (e as CustomEvent<{ missionId: MissionId }>).detail?.missionId;
      if (missionId) {
        setLastCompletedId(missionId);
        forceUpdate((n) => n + 1);
        if (collapsed) setCollapsed(false);
        setTimeout(() => {
          setLastCompletedId(null);
          forceUpdate((n) => n + 1);
          if (allMissionsForPlanDone(careerId, plan)) {
            setCollapsed(true);
          }
        }, 3000);
      }
    };
    window.addEventListener(FC_MISSION_COMPLETE_EVENT, handler);
    return () => window.removeEventListener(FC_MISSION_COMPLETE_EVENT, handler);
  }, [collapsed, careerId, plan, setCollapsed]);

  const missions = getMissionsForPlan(plan);
  const allDone = allMissionsForPlanDone(careerId, plan);

  const getFirstActiveMissionIndex = useCallback(() => {
    for (let i = 0; i < missions.length; i++) {
      if (!isMissionComplete(careerId, missions[i].id)) return i;
    }
    return -1;
  }, [missions, careerId]);

  const handleGo = useCallback((mission: MissionDef) => {
    onNavigateTab(mission.tab);
  }, [onNavigateTab]);

  const activeIndex = getFirstActiveMissionIndex();

  if (allDone && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-[72px] sm:bottom-6 right-4 z-[440] w-10 h-10 rounded-full flex items-center justify-center text-sm shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{
          background: "rgba(52,211,153,0.18)",
          border: "1px solid rgba(52,211,153,0.35)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}
        title={t.missionsPanelTitle}
      >
        ✓
      </button>
    );
  }

  if (!allDone && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-[72px] sm:bottom-6 right-4 z-[440] w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{
          background: "rgba(var(--club-primary-rgb),0.2)",
          border: "1px solid rgba(var(--club-primary-rgb),0.4)",
          color: "var(--club-primary)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}
        title={t.missionsPanelTitle}
      >
        🎯
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-[72px] sm:bottom-6 right-4 z-[440] w-72 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
      style={{
        background: "rgba(14,12,24,0.97)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(20px)",
        position: "fixed",
      }}
    >
      <div className="relative">
        <ConfettiBurst active={lastCompletedId !== null} />
      </div>
      <div
        className="flex items-center justify-between px-3.5 py-3 cursor-pointer"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        onClick={() => setCollapsed(true)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🎯</span>
          <span className="text-white/80 text-xs font-bold">{t.missionsPanelTitle}</span>
          {!allDone && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(var(--club-primary-rgb),0.18)", color: "var(--club-primary)" }}
            >
              {missions.filter((m) => isMissionComplete(careerId, m.id)).length}/{missions.length}
            </span>
          )}
        </div>
        <svg className="w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      <div className="flex flex-col gap-1.5 p-3">
        {allDone ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="text-3xl">🏆</span>
            <p className="text-white/70 text-xs font-semibold">{t.missionsDone}</p>
            <p className="text-white/30 text-[10px]">{t.missionsDoneSub}</p>
          </div>
        ) : (
          missions.map((mission, i) => {
            const done = isMissionComplete(careerId, mission.id);
            const active = i === activeIndex;
            const justCompleted = lastCompletedId === mission.id;
            return (
              <MissionRow
                key={mission.id}
                mission={mission}
                done={done}
                active={active}
                justCompleted={justCompleted}
                t={t}
                onGo={() => handleGo(mission)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
