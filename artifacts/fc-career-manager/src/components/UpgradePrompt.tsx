import { Plan, getPlanLabel } from "@/lib/userPlan";

interface UpgradePromptProps {
  currentPlan: Plan;
  requiredPlan: "pro" | "ultra";
  featureName: string;
  description?: string;
  compact?: boolean;
}

export function UpgradePrompt({ currentPlan, requiredPlan, featureName, description, compact = false }: UpgradePromptProps) {
  const requiredLabel = getPlanLabel(requiredPlan);
  const accentColor = requiredPlan === "ultra" ? "#f59e0b" : "#7c5cfc";
  const accentRgb = requiredPlan === "ultra" ? "245,158,11" : "124,92,252";

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: `rgba(${accentRgb},0.06)`,
          border: `1px solid rgba(${accentRgb},0.18)`,
        }}
      >
        <div
          className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{ background: `rgba(${accentRgb},0.15)` }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: accentColor }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/80 text-sm font-semibold leading-tight">{featureName}</p>
          <p className="text-white/35 text-xs mt-0.5">Disponível no plano <span style={{ color: accentColor }} className="font-bold">{requiredLabel}</span></p>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0"
          style={{ background: `rgba(${accentRgb},0.15)`, color: accentColor }}
        >
          {requiredLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-5 h-full py-16 px-8 text-center animate-fade-up">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{
          background: `rgba(${accentRgb},0.1)`,
          border: `1px solid rgba(${accentRgb},0.2)`,
          boxShadow: `0 0 48px rgba(${accentRgb},0.12)`,
        }}
      >
        <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: accentColor }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>

      <div>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
          style={{ background: `rgba(${accentRgb},0.12)`, color: accentColor, border: `1px solid rgba(${accentRgb},0.25)` }}
        >
          Plano {requiredLabel}
        </div>
        <h3 className="text-white font-black text-xl mb-2">{featureName}</h3>
        <p className="text-white/35 text-sm leading-relaxed max-w-xs">
          {description ?? `Esta funcionalidade está disponível a partir do plano ${requiredLabel}.`}
        </p>
      </div>

      <div
        className="rounded-2xl px-5 py-4 text-left w-full max-w-sm"
        style={{ background: `rgba(${accentRgb},0.06)`, border: `1px solid rgba(${accentRgb},0.15)` }}
      >
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Seu plano atual</p>
        <p className="text-white font-bold text-sm">{getPlanLabel(currentPlan)}</p>
      </div>
    </div>
  );
}
