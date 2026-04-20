import { useState } from "react";

type Plan = "free" | "pro" | "ultra";

interface AuthPageProps {
  onBack: () => void;
  onAuthSuccess: (token: string, user: { id: number; email: string; name: string; plan?: Plan }) => void;
}

const API_BASE = "/api";

const PLAN_CARDS: Array<{
  plan: Plan;
  label: string;
  price: string;
  period: string;
  accentRgb: string;
  accentColor: string;
  features: string[];
}> = [
  {
    plan: "free",
    label: "Free",
    price: "R$ 0",
    period: "para sempre",
    accentRgb: "255,255,255",
    accentColor: "rgba(255,255,255,0.6)",
    features: ["1 carreira", "3 gerações de IA por dia", "Partidas e transferências ilimitadas"],
  },
  {
    plan: "pro",
    label: "Pro",
    price: "R$ 14,90",
    period: "por mês",
    accentRgb: "124,92,252",
    accentColor: "#7c5cfc",
    features: ["Até 5 carreiras", "20 gerações de IA por dia", "Diretoria completa", "Modelos personalizados"],
  },
  {
    plan: "ultra",
    label: "Ultra",
    price: "R$ 39,90",
    period: "por mês",
    accentRgb: "245,158,11",
    accentColor: "#f59e0b",
    features: ["Carreiras ilimitadas", "IA ilimitada (GPT-4o)", "Notícias automáticas", "Portais personalizados"],
  },
];

export function AuthPage({ onBack, onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupStep, setSignupStep] = useState<"plan" | "form">("plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan>("free");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const isLogin = mode === "login";

  const resetSignup = () => {
    setSignupStep("plan");
    setSelectedPlan("free");
    setName("");
    setEmail("");
    setPassword("");
    setError("");
  };

  const switchMode = () => {
    setMode(isLogin ? "signup" : "login");
    resetSignup();
  };

  const handlePaidSignup = async (plan: Plan, token: string, user: { id: number; email: string; name: string; plan?: Plan }) => {
    setRedirecting(true);
    try {
      const priceRes = await fetch(`${API_BASE}/stripe/products-with-plan`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!priceRes.ok) throw new Error("Não foi possível obter os planos disponíveis.");
      const prices = await priceRes.json() as Array<{ planTier: string; priceId: string }>;
      const match = prices.find((p) => p.planTier === plan);
      if (!match?.priceId) throw new Error("Plano selecionado não encontrado.");
      const checkoutRes = await fetch(`${API_BASE}/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceId: match.priceId }),
      });
      if (!checkoutRes.ok) {
        const d = await checkoutRes.json() as { error?: string };
        throw new Error(d.error ?? "Erro ao iniciar pagamento.");
      }
      const { url } = await checkoutRes.json() as { url?: string };
      if (url) { window.location.href = url; return; }
      throw new Error("URL de pagamento inválida.");
    } catch (e) {
      setRedirecting(false);
      setError(e instanceof Error ? e.message : "Erro ao iniciar pagamento. Tente novamente.");
    }
  };

  const handleFormSubmit = async () => {
    setError("");
    if (!email.trim() || !password) { setError("Preencha e-mail e senha."); return; }
    if (!name.trim()) { setError("Informe seu nome."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
      });

      const data = await res.json() as {
        token?: string;
        user?: { id: number; email: string; name: string; plan?: Plan };
        error?: string;
      };

      if (!res.ok) { setError(data.error ?? "Ocorreu um erro. Tente novamente."); return; }
      if (!data.token || !data.user) { setError("Resposta inválida do servidor."); return; }

      localStorage.setItem("fc_auth_token", data.token);
      localStorage.setItem("fc_auth_user", JSON.stringify(data.user));

      if (selectedPlan !== "free") {
        await handlePaidSignup(selectedPlan, data.token, data.user);
      } else {
        onAuthSuccess(data.token, data.user);
      }
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async () => {
    setError("");
    if (!email.trim() || !password) { setError("Preencha e-mail e senha."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json() as {
        token?: string;
        user?: { id: number; email: string; name: string; plan?: Plan };
        error?: string;
      };

      if (!res.ok) { setError(data.error ?? "Ocorreu um erro. Tente novamente."); return; }
      if (!data.token || !data.user) { setError("Resposta inválida do servidor."); return; }

      localStorage.setItem("fc_auth_token", data.token);
      localStorage.setItem("fc_auth_user", JSON.stringify(data.user));
      onAuthSuccess(data.token, data.user);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (redirecting) {
    return (
      <div className="relative h-full flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
            <svg className="w-8 h-8 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 h4z" />
            </svg>
          </div>
          <h2 className="text-white font-bold text-lg mb-2">Redirecionando para o pagamento...</h2>
          <p className="text-white/40 text-sm">Você será levado ao Stripe para concluir a assinatura.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col items-center justify-center px-4 overflow-y-auto py-10">
      <button
        onClick={onBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-white/40 hover:text-white/70 text-sm font-medium transition-colors duration-200">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Voltar
      </button>

      {/* LOGIN FORM */}
      {isLogin && (
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1)", boxShadow: "0 8px 32px rgba(139,92,246,0.4)" }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 5l1.8 3.6L17.4 9l-2.7 2.7.6 3.9L12 13.8l-3.3 1.8.6-3.9L6.6 9l3.6-.4L12 5z" />
              </svg>
            </div>
            <h1 className="text-white font-black text-xl">Bem-vindo de volta</h1>
            <p className="text-white/40 text-sm mt-1">Entre na sua conta para continuar</p>
          </div>

          <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-white/50 text-xs font-medium mb-1.5">E-mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLoginSubmit()}
                  placeholder="seu@email.com" autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "inherit" }}
                  onFocus={e => { e.currentTarget.style.border = "1px solid rgba(139,92,246,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.1)"; }}
                  onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }} />
              </div>
              <div>
                <label className="block text-white/50 text-xs font-medium mb-1.5">Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLoginSubmit()}
                  placeholder="Sua senha" autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "inherit" }}
                  onFocus={e => { e.currentTarget.style.border = "1px solid rgba(139,92,246,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.1)"; }}
                  onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }} />
              </div>
            </div>
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-300"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </div>
            )}
            <button onClick={handleLoginSubmit} disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1)", boxShadow: "0 4px 20px rgba(139,92,246,0.35)" }}>
              {loading ? "Aguarde..." : "Entrar"}
            </button>
          </div>

          <p className="text-center text-white/35 text-sm mt-5">
            Não tem conta?{" "}
            <button onClick={switchMode} className="font-semibold transition-colors duration-200" style={{ color: "#a78bfa" }}
              onMouseEnter={e => e.currentTarget.style.color = "#c4b5fd"}
              onMouseLeave={e => e.currentTarget.style.color = "#a78bfa"}>
              Criar agora
            </button>
          </p>
        </div>
      )}

      {/* SIGNUP — STEP 1: PLAN SELECTION */}
      {!isLogin && signupStep === "plan" && (
        <div className="w-full max-w-lg">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1)", boxShadow: "0 8px 32px rgba(139,92,246,0.4)" }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 5l1.8 3.6L17.4 9l-2.7 2.7.6 3.9L12 13.8l-3.3 1.8.6-3.9L6.6 9l3.6-.4L12 5z" />
              </svg>
            </div>
            <h1 className="text-white font-black text-xl">Escolha seu plano</h1>
            <p className="text-white/40 text-sm mt-1">Você pode mudar ou cancelar quando quiser</p>
          </div>

          <div className="grid grid-cols-1 gap-3 mb-6">
            {PLAN_CARDS.map((card) => {
              const isSelected = selectedPlan === card.plan;
              return (
                <button
                  key={card.plan}
                  onClick={() => setSelectedPlan(card.plan)}
                  className="text-left rounded-2xl p-4 transition-all duration-200 hover:scale-[1.01]"
                  style={{
                    background: isSelected ? `rgba(${card.accentRgb},0.1)` : "rgba(255,255,255,0.03)",
                    border: isSelected ? `2px solid rgba(${card.accentRgb},0.5)` : "2px solid rgba(255,255,255,0.07)",
                    boxShadow: isSelected ? `0 0 24px rgba(${card.accentRgb},0.12)` : "none",
                  }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `rgba(${card.accentRgb},0.15)` }}>
                        <div className="w-3 h-3 rounded-full" style={{ background: card.accentColor }} />
                      </div>
                      <span className="text-white font-black text-base">{card.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-black text-base">{card.price}</span>
                      <span className="text-white/40 text-xs ml-1">{card.period}</span>
                    </div>
                  </div>
                  <ul className="flex flex-col gap-1 ml-11">
                    {card.features.map((f) => (
                      <li key={f} className="text-white/50 text-xs flex items-center gap-1.5">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                          style={{ color: isSelected ? card.accentColor : "rgba(255,255,255,0.25)" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setSignupStep("form")}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1)", boxShadow: "0 4px 20px rgba(139,92,246,0.35)" }}>
            Continuar com o plano {PLAN_CARDS.find(c => c.plan === selectedPlan)?.label}
          </button>

          <p className="text-center text-white/35 text-sm mt-4">
            Já tem conta?{" "}
            <button onClick={switchMode} className="font-semibold" style={{ color: "#a78bfa" }}>Entrar</button>
          </p>
        </div>
      )}

      {/* SIGNUP — STEP 2: FORM */}
      {!isLogin && signupStep === "form" && (
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setSignupStep("plan")} className="text-white/40 hover:text-white/70 transition-colors">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                {(() => {
                  const card = PLAN_CARDS.find(c => c.plan === selectedPlan)!;
                  return (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: `rgba(${card.accentRgb},0.15)`, color: card.accentColor, border: `1px solid rgba(${card.accentRgb},0.3)` }}>
                      Plano {card.label}
                      {selectedPlan !== "free" && ` — ${card.price}/mês`}
                    </span>
                  );
                })()}
              </div>
            </div>
            <h1 className="text-white font-black text-xl">Criar conta</h1>
            <p className="text-white/40 text-sm mt-1">
              {selectedPlan === "free" ? "Comece de graça, sem cartão" : "Preencha seus dados para continuar"}
            </p>
          </div>

          <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-white/50 text-xs font-medium mb-1.5">Nome</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFormSubmit()}
                  placeholder="Seu nome" autoComplete="name"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "inherit" }}
                  onFocus={e => { e.currentTarget.style.border = "1px solid rgba(139,92,246,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.1)"; }}
                  onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }} />
              </div>
              <div>
                <label className="block text-white/50 text-xs font-medium mb-1.5">E-mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFormSubmit()}
                  placeholder="seu@email.com" autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "inherit" }}
                  onFocus={e => { e.currentTarget.style.border = "1px solid rgba(139,92,246,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.1)"; }}
                  onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }} />
              </div>
              <div>
                <label className="block text-white/50 text-xs font-medium mb-1.5">Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFormSubmit()}
                  placeholder="Mínimo 6 caracteres" autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "inherit" }}
                  onFocus={e => { e.currentTarget.style.border = "1px solid rgba(139,92,246,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.1)"; }}
                  onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }} />
              </div>
            </div>
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-300"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </div>
            )}
            <button onClick={handleFormSubmit} disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1)", boxShadow: "0 4px 20px rgba(139,92,246,0.35)" }}>
              {loading ? "Aguarde..." : selectedPlan === "free" ? "Criar conta" : "Criar conta e pagar"}
            </button>
          </div>

          <p className="text-center text-white/35 text-sm mt-5">
            Já tem conta?{" "}
            <button onClick={switchMode} className="font-semibold" style={{ color: "#a78bfa" }}>Entrar</button>
          </p>
        </div>
      )}
    </div>
  );
}
