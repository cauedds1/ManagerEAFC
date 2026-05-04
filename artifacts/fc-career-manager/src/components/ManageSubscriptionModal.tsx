import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLang } from "@/hooks/useLang";
import { getEffectiveToken } from "@/lib/authToken";
import { getPlanLabel, type Plan } from "@/lib/userPlan";

const API_BASE = "/api";

interface PlanEntry {
  planTier: string;
  priceId: string;
  unitAmount: number;
  currency: string;
}

interface Props {
  currentPlan: Plan;
  onClose: () => void;
}

const PLAN_FEATURES: Record<"pt" | "en", Record<Plan, string[]>> = {
  pt: {
    free: [
      "3 gerações de IA por dia",
      "Modelo Gemini Flash",
      "1 carreira simultânea",
      "Sem Diretoria",
      "Sem portais personalizados",
    ],
    pro: [
      "20 gerações de IA por dia",
      "Modelo Gemini Flash",
      "Até 5 carreiras simultâneas",
      "Diretoria (até 2 membros)",
      "25 vídeos de momentos (200 MB)",
    ],
    ultra: [
      "Gerações de IA ilimitadas",
      "Modelo GPT-4.1",
      "Carreiras ilimitadas",
      "Diretoria ilimitada",
      "3 portais de notícias personalizados",
      "Notícias automáticas",
      "60 vídeos de momentos (500 MB)",
    ],
  },
  en: {
    free: [
      "3 AI generations per day",
      "Gemini Flash model",
      "1 career at a time",
      "No Board",
      "No custom portals",
    ],
    pro: [
      "20 AI generations per day",
      "Gemini Flash model",
      "Up to 5 careers",
      "Board (up to 2 members)",
      "25 video moments (200 MB)",
    ],
    ultra: [
      "Unlimited AI generations",
      "GPT-4.1 model",
      "Unlimited careers",
      "Unlimited Board",
      "3 custom news portals",
      "Automatic news",
      "60 video moments (500 MB)",
    ],
  },
};

const PLAN_META: Array<{ tier: Plan; color: string; rgb: string }> = [
  { tier: "free",  color: "rgba(255,255,255,0.45)", rgb: "255,255,255" },
  { tier: "pro",   color: "#7c5cfc",                rgb: "124,92,252" },
  { tier: "ultra", color: "#f59e0b",                rgb: "245,158,11" },
];

export function ManageSubscriptionModal({ currentPlan, onClose }: Props) {
  const [lang] = useLang();
  const [plans, setPlans] = useState<PlanEntry[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState("");

  const features = PLAN_FEATURES[lang];

  useEffect(() => {
    const token = getEffectiveToken();
    setLoadingPlans(true);
    fetch(`${API_BASE}/stripe/products-with-plan`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data: PlanEntry[]) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, []);

  const getPrice = (tier: string) => {
    const targetCurrency = lang === "en" ? "usd" : "brl";
    const match =
      plans.find((p) => p.planTier === tier && p.currency === targetCurrency) ??
      plans.find((p) => p.planTier === tier);
    if (!match) return null;
    const amount = (match.unitAmount / 100).toFixed(2).replace(".", ",");
    return { amount, currency: match.currency.toUpperCase(), priceId: match.priceId };
  };

  const handleCheckout = async (priceId: string, tier: string) => {
    setError("");
    setActionLoading(tier);
    try {
      const token = getEffectiveToken();
      const res = await fetch(`${API_BASE}/stripe/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? (lang === "pt" ? "Erro ao criar sessão." : "Error creating session."));
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : (lang === "pt" ? "Erro inesperado." : "Unexpected error."));
      setActionLoading(null);
    }
  };

  const handleOpenPortal = async () => {
    setError("");
    setPortalLoading(true);
    try {
      const token = getEffectiveToken();
      const res = await fetch(`${API_BASE}/stripe/portal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? (lang === "pt" ? "Erro ao abrir portal." : "Error opening portal."));
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : (lang === "pt" ? "Erro inesperado." : "Unexpected error."));
    } finally {
      setPortalLoading(false);
    }
  };

  const tierOrder: Plan[] = ["free", "pro", "ultra"];
  const currentTierIndex = tierOrder.indexOf(currentPlan);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl"
        style={{
          background: "rgba(10,10,16,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-5">
          <div>
            <h2 className="text-white font-black text-lg">
              {lang === "pt" ? "Gerenciar Assinatura" : "Manage Subscription"}
            </h2>
            <p className="text-white/35 text-sm mt-0.5">
              {lang === "pt" ? "Escolha o plano ideal para você" : "Choose the plan that's right for you"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/08 transition-colors flex-shrink-0 mt-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Plan cards */}
          {loadingPlans ? (
            <div className="flex items-center justify-center gap-2 py-14 text-white/30 text-sm">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {lang === "pt" ? "Carregando planos..." : "Loading plans..."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PLAN_META.map(({ tier, color, rgb }) => {
                const isCurrent = tier === currentPlan;
                const priceData = tier === "free" ? null : getPrice(tier);
                const planFeats = features[tier];
                const tierIndex = tierOrder.indexOf(tier);
                const isUpgrade = tierIndex > currentTierIndex && tier !== "free";
                const isDowngrade = tierIndex < currentTierIndex;

                return (
                  <div
                    key={tier}
                    className="rounded-2xl p-4 flex flex-col gap-3 transition-all"
                    style={{
                      background: isCurrent ? `rgba(${rgb},0.07)` : "rgba(255,255,255,0.02)",
                      border: isCurrent
                        ? `1.5px solid rgba(${rgb},0.45)`
                        : "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    {/* Name + price */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-black" style={{ color }}>
                          {getPlanLabel(tier)}
                        </span>
                        {isCurrent && (
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `rgba(${rgb},0.15)`, color }}
                          >
                            {lang === "pt" ? "Atual" : "Current"}
                          </span>
                        )}
                      </div>
                      {tier === "free" ? (
                        <p className="text-white/40 text-xs">
                          {lang === "pt" ? "Grátis para sempre" : "Free forever"}
                        </p>
                      ) : priceData ? (
                        <p className="text-white font-bold text-xl leading-none">
                          {priceData.currency === "BRL" ? "R$" : "$"}{" "}
                          {priceData.amount}
                          <span className="text-white/30 text-xs font-normal ml-1">
                            {lang === "pt" ? "/mês" : "/mo"}
                          </span>
                        </p>
                      ) : (
                        <p className="text-white/30 text-xs">
                          {lang === "pt" ? "Preço não disponível" : "Price unavailable"}
                        </p>
                      )}
                    </div>

                    {/* Features list */}
                    <ul className="flex flex-col gap-1.5 flex-1">
                      {planFeats.map((feat) => (
                        <li key={feat} className="flex items-start gap-1.5">
                          <svg
                            className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            style={{ color }}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-white/55 text-xs leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA button */}
                    {isCurrent ? (
                      <div
                        className="rounded-xl py-2 text-center text-xs font-bold"
                        style={{ background: `rgba(${rgb},0.12)`, color }}
                      >
                        {lang === "pt" ? "Plano atual" : "Current plan"}
                      </div>
                    ) : isUpgrade && priceData ? (
                      <button
                        onClick={() => handleCheckout(priceData.priceId, tier)}
                        disabled={!!actionLoading || portalLoading}
                        className="rounded-xl py-2 text-center text-xs font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                        style={{ background: color, color: tier === "free" ? "#000" : "#fff" }}
                      >
                        {actionLoading === tier ? (
                          <svg className="w-3.5 h-3.5 animate-spin mx-auto" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : lang === "pt" ? (
                          `Assinar ${getPlanLabel(tier)}`
                        ) : (
                          `Subscribe to ${getPlanLabel(tier)}`
                        )}
                      </button>
                    ) : isDowngrade ? (
                      <button
                        onClick={handleOpenPortal}
                        disabled={portalLoading || currentPlan === "free"}
                        className="rounded-xl py-2 text-center text-xs font-semibold transition-all hover:opacity-80 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          color: "rgba(255,255,255,0.35)",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        {lang === "pt" ? "Fazer downgrade via portal" : "Downgrade via portal"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-red-400 text-xs text-center px-2">{error}</p>
          )}

          {/* Cancel / manage payment (for paid users) */}
          {currentPlan !== "free" && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
              <button
                onClick={handleOpenPortal}
                disabled={portalLoading}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80 active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {portalLoading ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {lang === "pt" ? "Abrindo portal..." : "Opening portal..."}
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                    {lang === "pt" ? "Cancelar ou gerenciar pagamento" : "Cancel or manage payment"}
                  </>
                )}
              </button>
              <p className="text-white/20 text-xs text-center">
                {lang === "pt"
                  ? "Você será redirecionado ao portal seguro do Stripe para gerenciar ou cancelar sua assinatura."
                  : "You'll be redirected to the secure Stripe portal to manage or cancel your subscription."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
