import { useState } from "react";

type Plan = "free" | "pro" | "ultra";

interface AuthPageProps {
  onBack: () => void;
  onAuthSuccess: (token: string, user: { id: number; email: string; name: string; plan?: Plan }) => void;
  initialPlan?: Plan;
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
    features: ["1 carreira ativa", "3 gerações de IA por dia", "Partidas ilimitadas", "Sem diretoria"],
  },
  {
    plan: "pro",
    label: "Pro",
    price: "R$ 14,90",
    period: "por mês",
    accentRgb: "124,92,252",
    accentColor: "#7c5cfc",
    features: ["Até 5 carreiras ativas", "20 gerações de IA por dia", "Diretoria com até 4 membros", "Notícias geradas em segundos"],
  },
  {
    plan: "ultra",
    label: "Ultra",
    price: "R$ 39,90",
    period: "por mês",
    accentRgb: "245,158,11",
    accentColor: "#f59e0b",
    features: ["Boatos no vestiário", "Até 3 portais de notícias personalizados", "Carreiras ilimitadas", "Diretoria ilimitada", "IA com notícias mais detalhadas e dramáticas", "Notícias automáticas"],
  },
];

/* ── AI News Card ── */
function AiNewsCard() {
  return (
    <div style={{ borderRadius: 20, overflow: "hidden", background: "rgba(10,10,20,0.85)", border: "1px solid rgba(124,92,252,0.2)", boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(124,92,252,0.08)", backdropFilter: "blur(12px)" }}>

      {/* ── Masthead ── */}
      <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 16, letterSpacing: "0.18em", color: "#f0f0ff" }}>FC PRESS</span>
          <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)", display: "inline-block" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg viewBox="0 0 16 16" fill="#7c5cfc" style={{ width: 11, height: 11 }}>
              <path d="M8 0l1.6 4.8H14l-3.6 2.6 1.4 4.6L8 9.4l-3.8 2.6 1.4-4.6L2 4.8h4.4z" />
            </svg>
            <span style={{ fontSize: 10, color: "#7c5cfc", fontWeight: 700, letterSpacing: "0.1em" }}>IA</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)", borderRadius: 100, padding: "4px 10px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5a0", boxShadow: "0 0 6px #00e5a0", animation: "pulse 2s ease-in-out infinite", display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: "#00e5a0", fontWeight: 600 }}>Gerado agora</span>
        </div>
      </div>

      {/* ── Category + date ── */}
      <div style={{ padding: "14px 24px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7c5cfc", background: "rgba(124,92,252,0.1)", border: "1px solid rgba(124,92,252,0.25)", borderRadius: 6, padding: "3px 8px" }}>La Liga</span>
        <span style={{ color: "#333355", fontSize: 11 }}>·</span>
        <span style={{ color: "#444466", fontSize: 11 }}>Abr 2026</span>
      </div>

      {/* ── Headline ── */}
      <div style={{ padding: "12px 24px 0" }}>
        <h3 style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: "clamp(1.55rem, 2.4vw, 2rem)", lineHeight: 1.1, letterSpacing: "0.02em", margin: 0, color: "#f0f0ff" }}>
          Barcelona vira nos{" "}
          <span style={{ color: "#f59e0b" }}>acréscimos</span>
          {" "}e mantém liderança isolada
        </h3>
      </div>

      {/* ── Lead ── */}
      <div style={{ padding: "12px 24px 20px" }}>
        <p style={{ color: "#888899", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
          Em jogo tenso no Camp Nou, o técnico Martínez apostou no sistema 4-3-3 para superar o Atlético de Madrid. Dois gols nos últimos cinco minutos garantiram a virada histórica e abriram oito pontos de vantagem na tabela.
        </p>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 24px" }} />

      {/* ── Footer ── */}
      <div style={{ padding: "14px 24px", display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/logo.png" alt="" style={{ width: 20, height: 20, objectFit: "contain", opacity: 0.6, flexShrink: 0 }} />
        <span style={{ color: "#444466", fontSize: 12 }}>Gerado pela IA do <span style={{ color: "#7c5cfc" }}>FC Career Manager</span> · há 2 min</span>
      </div>
    </div>
  );
}

/* ── Shared input style helper ── */
const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 10,
  fontSize: 14,
  color: "#f0f0ff",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
  fontFamily: "DM Sans, sans-serif",
};

function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...INPUT_STYLE, ...props.style }}
      onFocus={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.55)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,92,252,0.12), 0 0 0 1px rgba(245,158,11,0.18)"; props.onFocus?.(e); }}
      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; props.onBlur?.(e); }}
    />
  );
}

/* ── Field SVG background ── */
function FieldLines() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <svg viewBox="0 0 1200 700" fill="none" stroke="white" strokeWidth={1} preserveAspectRatio="xMidYMid slice"
        style={{ width: "100%", height: "100%", opacity: 0.03 }}>
        <rect x="100" y="50" width="1000" height="600" />
        <line x1="600" y1="50" x2="600" y2="650" />
        <circle cx="600" cy="350" r="90" />
        <circle cx="600" cy="350" r="4" fill="white" />
        <rect x="420" y="50" width="360" height="130" />
        <rect x="480" y="50" width="240" height="55" />
        <rect x="420" y="520" width="360" height="130" />
        <rect x="480" y="595" width="240" height="55" />
        <circle cx="600" cy="155" r="45" />
        <circle cx="600" cy="545" r="45" />
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 80% at 70% 50%, rgba(124,92,252,0.08) 0%, transparent 65%)" }} />
    </div>
  );
}

/* ── Main component ── */
export function AuthPage({ onBack, onAuthSuccess, initialPlan }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupStep, setSignupStep] = useState<"plan" | "form">(initialPlan && initialPlan !== "free" ? "form" : "plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan>(initialPlan ?? "free");
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
    setName(""); setEmail(""); setPassword(""); setError("");
  };

  const switchMode = () => { setMode(isLogin ? "signup" : "login"); resetSignup(); };

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
      const data = await res.json() as { token?: string; user?: { id: number; email: string; name: string; plan?: Plan }; error?: string; };
      if (!res.ok) { setError(data.error ?? "Ocorreu um erro. Tente novamente."); return; }
      if (!data.token || !data.user) { setError("Resposta inválida do servidor."); return; }
      localStorage.setItem("fc_auth_token", data.token);
      localStorage.setItem("fc_auth_user", JSON.stringify(data.user));
      if (selectedPlan !== "free") {
        await handlePaidSignup(selectedPlan, data.token, data.user);
      } else {
        onAuthSuccess(data.token, data.user);
      }
    } catch { setError("Não foi possível conectar ao servidor."); }
    finally { setLoading(false); }
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
      const data = await res.json() as { token?: string; user?: { id: number; email: string; name: string; plan?: Plan }; error?: string; };
      if (!res.ok) { setError(data.error ?? "Ocorreu um erro. Tente novamente."); return; }
      if (!data.token || !data.user) { setError("Resposta inválida do servidor."); return; }
      localStorage.setItem("fc_auth_token", data.token);
      localStorage.setItem("fc_auth_user", JSON.stringify(data.user));
      onAuthSuccess(data.token, data.user);
    } catch { setError("Não foi possível conectar ao servidor."); }
    finally { setLoading(false); }
  };

  /* ── Shared form header (logo + title) ── */
  const FormHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32, textAlign: "center" }}>
      <img src="/logo.png" alt="FC Career Manager" style={{ width: 60, height: 60, objectFit: "contain", marginBottom: 16, filter: "drop-shadow(0 0 16px rgba(124,92,252,0.35))" }} />
      <h1 style={{ color: "#f0f0ff", fontWeight: 800, fontSize: 22, margin: 0, fontFamily: "DM Sans, sans-serif" }}>{title}</h1>
      <p style={{ color: "#555577", fontSize: 14, margin: "6px 0 0", fontFamily: "DM Sans, sans-serif" }}>{subtitle}</p>
    </div>
  );

  /* ── Error block ── */
  const ErrorBlock = () => error ? (
    <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
      {error}
    </div>
  ) : null;

  /* ── Primary button ── */
  const PrimaryBtn = ({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
    <button
      onClick={onClick} disabled={disabled}
      style={{ width: "100%", padding: "13px 0", borderRadius: 12, fontWeight: 700, fontSize: 14, color: "#fff", background: "linear-gradient(135deg,#7c5cfc,#5b3fd1)", border: "none", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, boxShadow: "0 4px 20px rgba(124,92,252,0.35)", transition: "all 0.2s", fontFamily: "DM Sans, sans-serif" }}
      onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 32px rgba(124,92,252,0.6)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(124,92,252,0.35)"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
      {children}
    </button>
  );

  /* ─── REDIRECTING ─── */
  if (redirecting) {
    return (
      <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090f", fontFamily: "DM Sans, sans-serif", overflow: "hidden" }}>
        <FieldLines />
        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <img src="/logo.png" alt="FC Career Manager" style={{ width: 64, height: 64, objectFit: "contain", marginBottom: 24, filter: "drop-shadow(0 0 20px rgba(124,92,252,0.5))" }} />
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(124,92,252,0.2)", borderTopColor: "#7c5cfc", animation: "spin 0.8s linear infinite", margin: "0 auto 20px" }} />
          <h2 style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Redirecionando para o pagamento...</h2>
          <p style={{ color: "#555577", fontSize: 14, margin: 0 }}>Você será levado ao Stripe para concluir a assinatura.</p>
        </div>
      </div>
    );
  }

  const contentKey = `${mode}-${signupStep}`;

  /* ─── MAIN SPLIT-SCREEN LAYOUT ─── */
  return (
    <div style={{ display: "flex", height: "100%", background: "#09090f", fontFamily: "DM Sans, sans-serif", position: "relative", overflow: "hidden" }}>
      <FieldLines />

      {/* ════ LEFT: FORM COLUMN ════ */}
      <div className="auth-form-col" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 480, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 48px", overflowY: "auto", borderRight: "1px solid rgba(255,255,255,0.05)", animation: "authFormEnter 0.45s cubic-bezier(0.25,0.46,0.45,0.94) both" }}>

        {/* Back button */}
        <button
          onClick={onBack}
          style={{ position: "absolute", top: 24, left: 28, display: "flex", alignItems: "center", gap: 6, color: "#444466", fontSize: 13, background: "none", border: "none", cursor: "pointer", transition: "color 0.2s", padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = "#8888aa")}
          onMouseLeave={e => (e.currentTarget.style.color = "#444466")}>
          <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          Voltar
        </button>

        {/* ── FORM CONTENT (animated on mode switch) ── */}
        <div key={contentKey} className="auth-content-enter">

        {/* ── LOGIN ── */}
        {isLogin && (
          <div>
            <FormHeader title="Sua carreira continua aqui." subtitle="Entre na sua conta para retomar onde parou" />
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 4 }}>
              <div>
                <label style={{ display: "block", color: "#555577", fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>E-mail</label>
                <AuthInput type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLoginSubmit()} placeholder="seu@email.com" autoComplete="email" />
              </div>
              <div>
                <label style={{ display: "block", color: "#555577", fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Senha</label>
                <AuthInput type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLoginSubmit()} placeholder="Sua senha" autoComplete="current-password" />
              </div>
            </div>
            <ErrorBlock />
            <div style={{ marginTop: 20 }}>
              <PrimaryBtn onClick={handleLoginSubmit} disabled={loading}>
                {loading ? "Aguarde..." : "Entrar no jogo"}
              </PrimaryBtn>
            </div>
            <p style={{ textAlign: "center", color: "#444466", fontSize: 13, marginTop: 20 }}>
              Novo por aqui?{" "}
              <button onClick={switchMode} style={{ color: "#7c5cfc", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0, transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#a78bfa")}
                onMouseLeave={e => (e.currentTarget.style.color = "#7c5cfc")}>
                Criar conta
              </button>
            </p>
          </div>
        )}

        {/* ── SIGNUP: PLAN SELECTION ── */}
        {!isLogin && signupStep === "plan" && (
          <div>
            <FormHeader title="Escolha o nível da sua carreira." subtitle="Você pode mudar ou cancelar quando quiser" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {PLAN_CARDS.map(card => {
                const sel = selectedPlan === card.plan;
                return (
                  <button key={card.plan} onClick={() => setSelectedPlan(card.plan)}
                    style={{ textAlign: "left", borderRadius: 14, padding: "14px 16px", cursor: "pointer", transition: "all 0.2s", background: sel ? `rgba(${card.accentRgb},0.08)` : "rgba(255,255,255,0.03)", border: sel ? `1px solid rgba(${card.accentRgb},0.45)` : "1px solid rgba(255,255,255,0.07)", boxShadow: sel ? `0 0 20px rgba(${card.accentRgb},0.1)` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: sel ? card.accentColor : "rgba(255,255,255,0.2)", transition: "background 0.2s" }} />
                        <span style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 15 }}>{card.label}</span>
                      </div>
                      <div>
                        <span style={{ color: sel ? card.accentColor : "#888899", fontWeight: 700, fontSize: 15 }}>{card.price}</span>
                        <span style={{ color: "#444466", fontSize: 12, marginLeft: 4 }}>{card.period}</span>
                      </div>
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4, paddingLeft: 18 }}>
                      {card.features.map(f => (
                        <li key={f} style={{ color: "#555577", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                          <svg style={{ width: 12, height: 12, flexShrink: 0, color: sel ? card.accentColor : "rgba(255,255,255,0.2)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
            <PrimaryBtn onClick={() => setSignupStep("form")}>
              Continuar com o plano {PLAN_CARDS.find(c => c.plan === selectedPlan)?.label}
            </PrimaryBtn>
            <p style={{ textAlign: "center", color: "#444466", fontSize: 13, marginTop: 16 }}>
              Já tem conta?{" "}
              <button onClick={switchMode} style={{ color: "#7c5cfc", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0 }}>Entrar</button>
            </p>
          </div>
        )}

        {/* ── SIGNUP: FORM ── */}
        {!isLogin && signupStep === "form" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
              <button onClick={() => setSignupStep("plan")} style={{ color: "#444466", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0, transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#8888aa")}
                onMouseLeave={e => (e.currentTarget.style.color = "#444466")}>
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 18, height: 18 }}>
                  <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                </svg>
              </button>
              {(() => {
                const card = PLAN_CARDS.find(c => c.plan === selectedPlan)!;
                return (
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: `rgba(${card.accentRgb},0.12)`, color: card.accentColor, border: `1px solid rgba(${card.accentRgb},0.3)` }}>
                    Plano {card.label}{selectedPlan !== "free" && ` — ${card.price}/mês`}
                  </span>
                );
              })()}
            </div>

            <FormHeader title="Comece sua história no futebol." subtitle={selectedPlan === "free" ? "De graça, sem cartão de crédito" : "Preencha seus dados para continuar"} />

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 4 }}>
              <div>
                <label style={{ display: "block", color: "#555577", fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Nome</label>
                <AuthInput type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFormSubmit()} placeholder="Seu nome" autoComplete="name" />
              </div>
              <div>
                <label style={{ display: "block", color: "#555577", fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>E-mail</label>
                <AuthInput type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFormSubmit()} placeholder="seu@email.com" autoComplete="email" />
              </div>
              <div>
                <label style={{ display: "block", color: "#555577", fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Senha</label>
                <AuthInput type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFormSubmit()} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
              </div>
            </div>
            <ErrorBlock />
            <div style={{ marginTop: 20 }}>
              <PrimaryBtn onClick={handleFormSubmit} disabled={loading}>
                {loading ? "Aguarde..." : selectedPlan === "free" ? "Criar conta" : "Criar conta e pagar"}
              </PrimaryBtn>
            </div>
            <p style={{ textAlign: "center", color: "#444466", fontSize: 13, marginTop: 20 }}>
              Já tem conta?{" "}
              <button onClick={switchMode} style={{ color: "#7c5cfc", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0 }}>Entrar</button>
            </p>
          </div>
        )}

        </div>{/* end animated content wrapper */}
      </div>

      {/* ════ RIGHT: SHOWCASE COLUMN (desktop only) ════ */}
      <div className="auth-showcase" style={{ flex: 1, position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 64px", animation: "authShowcaseEnter 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.1s both" }}>
        <div style={{ background: "radial-gradient(ellipse 600px 500px at 50% 50%, rgba(124,92,252,0.09) 0%, transparent 65%)", position: "absolute", inset: 0, pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}>

          {/* Masthead logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
            <img src="/logo.png" alt="FC Career Manager" style={{ width: 48, height: 48, objectFit: "contain", filter: "drop-shadow(0 2px 12px rgba(124,92,252,0.4))" }} />
            <p style={{ color: "#7c5cfc", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", margin: 0 }}>FC Career Manager</p>
          </div>

          {/* News card */}
          <AiNewsCard />
        </div>
      </div>
    </div>
  );
}
