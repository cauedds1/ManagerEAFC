import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLang } from "@/hooks/useLang";
import { SECTION_HELP, ONBOARDING } from "@/lib/i18n";

interface SectionHelpProps {
  section: string;
  className?: string;
}

export function SectionHelp({ section, className = "" }: SectionHelpProps) {
  const [lang] = useLang();
  const t = ONBOARDING[lang];
  const content = SECTION_HELP[lang][section];
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const btn = (e.target as HTMLElement).closest("[data-section-help-btn]");
        if (!btn) setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  if (!content) return null;

  return (
    <>
      <button
        data-section-help-btn
        onClick={() => setOpen((v) => !v)}
        title={t.helpBtn}
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold transition-all hover:opacity-80 active:scale-95 flex-shrink-0 ${className}`}
        style={{
          background: open ? "rgba(var(--club-primary-rgb),0.25)" : "rgba(255,255,255,0.08)",
          color: open ? "var(--club-primary)" : "rgba(255,255,255,0.35)",
          border: open ? "1px solid rgba(var(--club-primary-rgb),0.4)" : "1px solid rgba(255,255,255,0.12)",
        }}
        aria-label={t.helpBtn}
      >
        ⓘ
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4 sm:pr-6"
          style={{ pointerEvents: "none" }}
        >
          <div
            ref={panelRef}
            className="w-full sm:w-80 rounded-t-2xl sm:rounded-2xl flex flex-col gap-4 p-5 animate-slide-up sm:animate-fade-up"
            style={{
              background: "rgba(14,12,24,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              backdropFilter: "blur(20px)",
              pointerEvents: "auto",
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base">{content.title}</h3>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/08 transition-all"
                aria-label={t.closeHelp}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-white/55 text-xs leading-relaxed">{content.desc}</p>

            <div className="flex flex-col gap-2">
              {content.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-base leading-none mt-0.5 flex-shrink-0">{step.icon}</span>
                  <p className="text-white/65 text-xs leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>

            <div
              className="rounded-xl px-3 py-2.5"
              style={{ background: "rgba(var(--club-primary-rgb),0.08)", border: "1px solid rgba(var(--club-primary-rgb),0.15)" }}
            >
              <p className="text-xs leading-relaxed" style={{ color: "rgba(var(--club-primary-rgb),0.9)" }}>
                {content.tip}
              </p>
            </div>

            {content.limit && (
              <p className="text-white/25 text-[10px] text-center leading-relaxed">{content.limit}</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
