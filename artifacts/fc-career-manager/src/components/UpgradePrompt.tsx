import { useState } from "react";
import { Plan, getPlanLabel } from "@/lib/userPlan";

interface UpgradePromptProps {
  currentPlan: Plan;
  requiredPlan: "pro" | "ultra";
  featureName: string;
  description?: string;
  compact?: boolean;
  onUpgrade?: () => void;
}

const API_BASE = "/api";
const AUTH_TOKEN_KEY = "fc_auth_token";

function readEffectiveLang(): "pt" | "en" {
  try {
    const s = localStorage.getItem("fc_lang");
    if (s === "pt" || s === "en") return s;
    return navigator.language?.startsWith("pt") ? "pt" : "en";
  } catch { return "pt"; }
}

async function startStripeCheckout(requiredPlan: "pro" | "ultra"): Promise<void> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) { return; }

  const pricesRes = await fetch(`${API_BASE}/stripe/products-with-plan`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!pricesRes.ok) { throw new Error("Não foi possível obter os planos disponíveis."); }

  const prices = await pricesRes.json() as Array<{ planTier: string; priceId: string; currency: string }>;
  const targetCurrency = readEffectiveLang() === "en" ? "usd" : "brl";
  const exactMatch = prices.find((p) => p.planTier === requiredPlan && p.currency === targetCurrency);
  if (!exactMatch && targetCurrency === "usd") {
    console.warn(`[UpgradePrompt] No USD price found for ${requiredPlan}, falling back to BRL`);
  }
  const match = exactMatch ?? prices.find((p) => p.planTier === requiredPlan);
  if (!match?.priceId) { throw new Error("Plano não encontrado. Verifique sua conexão."); }

  const checkoutRes = await fetch(`${API_BASE}/stripe/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ priceId: match.priceId }),
  });

  if (!checkoutRes.ok) { throw new Error("Erro ao criar sessão de pagamento."); }

  const { url } = await checkoutRes.json() as { url?: string };
  if (!url) { throw new Error("URL de pagamento inválida."); }

  window.location.href = url;
}

function UpgradeButton({ accentColor, accentRgb, requiredPlan, requiredLabel, onUpgrade }: {
  accentColor: string;
  accentRgb: string;
  requiredPlan: "pro" | "ultra";
  requiredLabel: string;
  onUpgrade?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    if (onUpgrade) { onUpgrade(); return; }
    setError("");
    setLoading(true);
    try {
      await startStripeCheckout(requiredPlan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
        style={{
          background: `linear-gradient(135deg, rgba(${accentRgb},0.9), rgba(${accentRgb},0.7))`,
          color: "#fff",
          boxShadow: `0 4px 20px rgba(${accentRgb},0.35)`,
        }}
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Aguarde...
          </>
        ) : (
          <>
            Fazer upgrade para {requiredLabel}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </>
        )}
      </button>
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
    </div>
  );
}

export function UpgradePrompt({ currentPlan, requiredPlan, featureName, description, compact = false, onUpgrade }: UpgradePromptProps) {
  const [compactLoading, setCompactLoading] = useState(false);
  const [compactError, setCompactError] = useState("");
  const requiredLabel = getPlanLabel(requiredPlan);
  const accentColor = requiredPlan === "ultra" ? "#f59e0b" : "#7c5cfc";
  const accentRgb = requiredPlan === "ultra" ? "245,158,11" : "124,92,252";

  const handleCompactClick = async () => {
    if (onUpgrade) { onUpgrade(); return; }
    setCompactError("");
    setCompactLoading(true);
    try {
      await startStripeCheckout(requiredPlan);
    } catch (e) {
      setCompactError(e instanceof Error ? e.message : "Erro. Tente novamente.");
      setCompactLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5">
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
          <button
            onClick={handleCompactClick}
            disabled={compactLoading}
            className="text-xs font-bold px-2.5 py-1.5 rounded-lg flex-shrink-0 transition-all duration-150 hover:opacity-80 active:scale-95 disabled:opacity-50"
            style={{ background: `rgba(${accentRgb},0.2)`, color: accentColor, border: `1px solid rgba(${accentRgb},0.3)` }}
          >
            {compactLoading ? "..." : "Upgrade →"}
          </button>
        </div>
        {compactError && <p className="text-red-400 text-xs px-1">{compactError}</p>}
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

      <UpgradeButton accentColor={accentColor} accentRgb={accentRgb} requiredPlan={requiredPlan} requiredLabel={requiredLabel} onUpgrade={onUpgrade} />

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
