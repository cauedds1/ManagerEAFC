import { useState, useEffect } from "react";
import type { Career } from "@/types/career";
import { useLang } from "@/hooks/useLang";
import { WIZARD } from "@/lib/i18n";
import { isInitialContextHydrated } from "@/lib/initialContextHydration";

interface Props { career: Career }

const SEEN_KEY = (id: string) => `fc-initial-context-seen-${id}`;

export function InitialContextBanner({ career }: Props) {
  const [lang] = useLang();
  const t = WIZARD[lang];
  const [seen, setSeen] = useState<{ letter: boolean; sync: boolean; missions: boolean }>({ letter: true, sync: true, missions: true });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY(career.id));
      const parsed = raw ? JSON.parse(raw) : {};
      setSeen({ letter: !!parsed.letter, sync: !!parsed.sync, missions: !!parsed.missions });
    } catch { setSeen({ letter: false, sync: false, missions: false }); }
  }, [career.id]);

  const dismiss = (k: "letter" | "sync" | "missions") => {
    setSeen((s) => {
      const n = { ...s, [k]: true };
      try { localStorage.setItem(SEEN_KEY(career.id), JSON.stringify(n)); } catch {}
      return n;
    });
  };

  const ic = career.initialContext;
  if (!ic) return null;

  const hydrated = isInitialContextHydrated(career.id) && (
    (ic.transfersIn?.length ?? 0) > 0 ||
    (ic.transfersOut?.length ?? 0) > 0 ||
    (ic.recentMatches?.length ?? 0) > 0 ||
    (ic.rivals?.length ?? 0) > 0
  );

  const showLetter = !seen.letter && !!ic.boardLetter;
  const showSync = !seen.sync && (!!ic.squadSyncWarning || (ic.keyPlayers?.length ?? 0) > 0);
  const showMissions = !seen.missions && ic.missions?.length > 0;

  if (!showLetter && !showSync && !showMissions) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex flex-col gap-3">
      {showLetter && (
        <div
          className="rounded-2xl p-4 flex flex-col gap-2 animate-slide-up"
          style={{
            background: "linear-gradient(135deg, rgba(var(--club-primary-rgb),0.12), rgba(var(--club-primary-rgb),0.04))",
            border: "1px solid rgba(var(--club-primary-rgb),0.25)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--club-primary)" }}>
              ✉ {t.boardLetterTitle}
            </span>
            <div className="flex items-center gap-2">
              {hydrated && (
                <span
                  title={t.appliedToTabsTooltip}
                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ color: "#34d399", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}
                >
                  ✓ {t.appliedToTabs}
                </span>
              )}
              <button onClick={() => dismiss("letter")} className="text-white/40 hover:text-white text-xs">✕</button>
            </div>
          </div>
          <p className="text-white/85 text-sm leading-relaxed italic" style={{ fontFamily: "Georgia, serif" }}>"{ic.boardLetter}"</p>
          {ic.prediction?.endOfSeason && (
            <p className="text-white/50 text-xs mt-1"><span className="font-bold uppercase tracking-wider text-[9px]" style={{ color: "var(--club-primary)" }}>{t.predEndOfSeason}: </span>{ic.prediction.endOfSeason}</p>
          )}
        </div>
      )}

      {showMissions && (
        <div
          className="rounded-2xl p-4 flex flex-col gap-2"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">🎯 {t.extractedMissions}</span>
            <button onClick={() => dismiss("missions")} className="text-white/40 hover:text-white text-xs">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ic.missions.map((m, i) => (
              <div key={i} className="rounded-lg p-2.5 flex flex-col gap-0.5" style={{ background: "rgba(var(--club-primary-rgb),0.06)", border: "1px solid rgba(var(--club-primary-rgb),0.15)" }}>
                <div className="flex justify-between items-start gap-1">
                  <span className="text-white text-xs font-bold flex-1">{m.title}</span>
                  {m.deadline && <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded" style={{ color: "var(--club-primary)", background: "rgba(var(--club-primary-rgb),0.12)" }}>{m.deadline}</span>}
                </div>
                {m.description && <p className="text-white/55 text-[11px] leading-snug">{m.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showSync && (
        <div
          className="rounded-2xl p-3 flex items-start gap-3"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)" }}
        >
          <span className="text-lg flex-shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-amber-200 text-xs font-bold mb-0.5">{t.squadSyncTitle}</p>
            <p className="text-amber-100/70 text-[11px] leading-snug">{ic.squadSyncWarning || t.squadSyncFallback}</p>
          </div>
          <button onClick={() => dismiss("sync")} className="text-amber-200/60 hover:text-amber-100 text-xs flex-shrink-0">✕</button>
        </div>
      )}
    </div>
  );
}
