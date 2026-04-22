import { useState, useEffect, useRef } from "react";
import { AUTH, getPlanCards, getPlanDetailData, getPlanWelcome, getNewsStories, type Lang } from "@/lib/i18n";
import { LangToggle } from "./LangToggle";

type Plan = "free" | "pro" | "ultra";

interface AuthPageProps {
  onBack: () => void;
  onAuthSuccess: (token: string, user: { id: number; email: string; name: string; plan?: Plan }) => void;
  initialPlan?: Plan;
  checkoutDraft?: { name: string; email: string; plan: "pro" | "ultra" } | null;
  onDraftConsumed?: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

const API_BASE = "/api";

/* ── AI News Card ── */
type NewsStory = {
  category: string;
  categoryColor: string;
  categoryBg: string;
  categoryBorder: string;
  date: string;
  headlineParts: string[];
  highlightColor: string;
  lead: string;
  timeAgo: string;
};

function AiNewsCard({ stories, generatedLabel }: { stories: NewsStory[]; generatedLabel: string }) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = (idx: number) => {
    setVisible(false);
    setTimeout(() => { setCurrent(idx); setVisible(true); }, 320);
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setCurrent(prev => (prev + 1) % stories.length); setVisible(true); }, 320);
    }, 4500);
  };

  useEffect(() => {
    if (!paused) startTimer();
    else if (timerRef.current) clearInterval(timerRef.current);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, stories.length]);

  const story = stories[current];
  if (!story) return null;

  return (
    <div
      style={{ borderRadius: 20, overflow: "hidden", background: "rgba(10,10,20,0.85)", border: "1px solid rgba(124,92,252,0.2)", boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(124,92,252,0.08)", backdropFilter: "blur(12px)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 16, letterSpacing: "0.18em", color: "#f0f0ff" }}>FC PRESS</span>
          <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)", display: "inline-block" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg viewBox="0 0 16 16" fill="#7c5cfc" style={{ width: 11, height: 11 }}>
              <path d="M8 0l1.6 4.8H14l-3.6 2.6 1.4 4.6L8 9.4l-3.8 2.6 1.4-4.6L2 4.8h4.4z" />
            </svg>
            <span style={{ fontSize: 10, color: "#7c5cfc", fontWeight: 700, letterSpacing: "0.1em" }}>AI</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)", borderRadius: 100, padding: "4px 10px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5a0", boxShadow: "0 0 6px #00e5a0", animation: "pulse 2s ease-in-out infinite", display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: "#00e5a0", fontWeight: 600 }}>{generatedLabel}</span>
        </div>
      </div>

      <div style={{ transition: "opacity 0.32s ease, transform 0.32s ease", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)" }}>
        <div style={{ padding: "14px 24px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: story.categoryColor, background: story.categoryBg, border: `1px solid ${story.categoryBorder}`, borderRadius: 6, padding: "3px 8px" }}>{story.category}</span>
          <span style={{ color: "#333355", fontSize: 11 }}>·</span>
          <span style={{ color: "#444466", fontSize: 11 }}>{story.date}</span>
        </div>
        <div style={{ padding: "12px 24px 0" }}>
          <h3 style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: "clamp(1.55rem, 2.4vw, 2rem)", lineHeight: 1.1, letterSpacing: "0.02em", margin: 0, color: "#f0f0ff" }}>
            {story.headlineParts[0]}
            <span style={{ color: story.highlightColor }}>{story.headlineParts[1]}</span>
            {story.headlineParts[2]}
          </h3>
        </div>
        <div style={{ padding: "12px 24px 20px" }}>
          <p style={{ color: "#888899", fontSize: 14, lineHeight: 1.65, margin: 0 }}>{story.lead}</p>
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 24px" }} />
      <div style={{ padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="" style={{ width: 20, height: 20, objectFit: "contain", opacity: 0.6, flexShrink: 0 }} />
          <span style={{ color: "#444466", fontSize: 12 }}>
            <span style={{ color: "#7c5cfc" }}>FC Career Manager</span> · {story.timeAgo}
          </span>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {stories.map((_, i) => (
            <button
              key={i}
              onClick={() => { setPaused(true); goTo(i); setTimeout(() => setPaused(false), 6000); }}
              style={{ width: i === current ? 18 : 6, height: 6, borderRadius: 3, border: "none", cursor: "pointer", padding: 0, transition: "width 0.3s ease, background 0.3s ease", background: i === current ? story.categoryColor : "rgba(255,255,255,0.15)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Types for plan data ── */
type PlanCard = {
  plan: Plan;
  label: string;
  price: string;
  period: string;
  accentRgb: string;
  accentColor: string;
  features: string[];
};

type PlanDetail = {
  tagline: string;
  features: string[];
  missing: Array<{ label: string; nextPlan: string }>;
  upsell: { plan: string; color: string; rgb: string; price: string; msg: string } | null;
};

type PlanWelcomeData = {
  headline: string;
  sub: string;
  accentColor: string;
  accentRgb: string;
  features: Array<{ emoji: string; text: string }>;
  footer: string;
};

const PLAN_ICONS: Record<Plan, React.ReactNode> = {
  free: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 44, height: 44 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  pro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 44, height: 44 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  ultra: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 44, height: 44 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
};

/* ── Plan detail panel ── */
function PlanDetailPanel({ selectedPlan, planCards, planDetailData, notIncludedLabel }: { selectedPlan: Plan; planCards: PlanCard[]; planDetailData: Record<Plan, PlanDetail>; notIncludedLabel: string }) {
  const card = planCards.find(c => c.plan === selectedPlan)!;
  const detail = planDetailData[selectedPlan];

  return (
    <div className="auth-content-enter" style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <img src="/logo.png" alt="FC Career Manager" style={{ width: 36, height: 36, objectFit: "contain", filter: "drop-shadow(0 2px 12px rgba(124,92,252,0.4))" }} />
        <p style={{ color: "#7c5cfc", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", margin: 0 }}>FC Career Manager</p>
      </div>

      <div style={{ background: `rgba(${card.accentRgb},0.06)`, border: `1px solid rgba(${card.accentRgb},0.22)`, borderRadius: 20, padding: "24px 24px 20px", boxShadow: `0 8px 32px rgba(${card.accentRgb},0.07)` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: card.accentColor, boxShadow: `0 0 10px ${card.accentColor}`, flexShrink: 0 }} />
            <span style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 26, letterSpacing: "0.08em", color: card.accentColor, lineHeight: 1 }}>{card.label}</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ color: card.accentColor, fontWeight: 800, fontSize: 18 }}>{card.price}</span>
            <span style={{ color: "#444466", fontSize: 11, marginLeft: 4 }}>{card.period}</span>
          </div>
        </div>
        <p style={{ color: "#666688", fontSize: 12, margin: "0 0 18px", fontStyle: "italic" }}>{detail.tagline}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {detail.features.map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: 7, background: `rgba(${card.accentRgb},0.12)`, border: `1px solid rgba(${card.accentRgb},0.2)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg style={{ width: 11, height: 11, color: card.accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span style={{ color: "#c0c0e0", fontSize: 13 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {detail.missing.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "18px 20px" }}>
          <p style={{ color: "#3a3a55", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 12px" }}>{notIncludedLabel}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {detail.missing.map(m => (
              <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg style={{ width: 11, height: 11, color: "#333355" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span style={{ color: "#3a3a55", fontSize: 13, flex: 1 }}>{m.label}</span>
                <span style={{ fontSize: 10, color: "#2a2a45", fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", whiteSpace: "nowrap" }}>{m.nextPlan}</span>
              </div>
            ))}
          </div>
          {detail.upsell && (
            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: `rgba(${detail.upsell.rgb},0.06)`, border: `1px solid rgba(${detail.upsell.rgb},0.18)`, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <svg style={{ width: 16, height: 16, color: detail.upsell.color, flexShrink: 0, marginTop: 1 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div>
                <p style={{ margin: 0, color: detail.upsell.color, fontWeight: 700, fontSize: 12 }}>{detail.upsell.msg}</p>
                <p style={{ margin: "3px 0 0", color: "#444466", fontSize: 11 }}>{detail.upsell.plan} — {detail.upsell.price}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedPlan === "ultra" && (
        <div style={{ padding: "16px 18px", borderRadius: 16, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", display: "flex", alignItems: "center", gap: 12 }}>
          <svg style={{ width: 20, height: 20, color: "#f59e0b", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <p style={{ margin: 0, color: "#c09040", fontSize: 13, fontWeight: 600 }}>{detail.tagline}</p>
        </div>
      )}
    </div>
  );
}

/* ── Plan Welcome Panel ── */
function PlanWelcomePanel({ plan, planWelcome }: { plan: Plan; planWelcome: Record<Plan, PlanWelcomeData> }) {
  const data = planWelcome[plan];
  const [visibleFeatures, setVisibleFeatures] = useState<number[]>([]);

  useEffect(() => {
    setVisibleFeatures([]);
    data.features.forEach((_, i) => {
      setTimeout(() => setVisibleFeatures(prev => [...prev, i]), 350 + i * 140);
    });
  }, [plan]);

  return (
    <div className="auth-content-enter" style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
        <div style={{ position: "absolute", width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle, rgba(${data.accentRgb},0.22) 0%, transparent 70%)`, top: "50%", left: "50%", transform: "translate(-50%, -50%)", animation: "pulse 3s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ color: data.accentColor, position: "relative", zIndex: 1, filter: `drop-shadow(0 0 18px rgba(${data.accentRgb},0.6))`, animation: "welcomeIconFloat 3.5s ease-in-out infinite" }}>
          {PLAN_ICONS[plan]}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "5px 16px", borderRadius: 100, background: `rgba(${data.accentRgb},0.12)`, color: data.accentColor, border: `1px solid rgba(${data.accentRgb},0.3)`, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {plan.charAt(0).toUpperCase() + plan.slice(1)}
        </span>
      </div>

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h2 style={{ color: "#f0f0ff", fontWeight: 800, fontSize: 20, margin: "0 0 8px", fontFamily: "DM Sans, sans-serif", lineHeight: 1.3 }}>{data.headline}</h2>
        <p style={{ color: "#555577", fontSize: 13, margin: 0, lineHeight: 1.6 }}>{data.sub}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {data.features.map((f, i) => (
          <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", borderRadius: 12, background: `rgba(${data.accentRgb},0.05)`, border: `1px solid rgba(${data.accentRgb},0.12)`, transition: "opacity 0.4s ease, transform 0.4s ease", opacity: visibleFeatures.includes(i) ? 1 : 0, transform: visibleFeatures.includes(i) ? "translateX(0)" : "translateX(-14px)" }}>
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{f.emoji}</span>
            <span style={{ color: "#b0b0cc", fontSize: 13, fontWeight: 500 }}>{f.text}</span>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <p style={{ color: "#444466", fontSize: 12, margin: 0, fontStyle: "italic" }}>{data.footer}</p>
      </div>
    </div>
  );
}

/* ── Shared input style ── */
const INPUT_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", borderRadius: 10, fontSize: 14, color: "#f0f0ff",
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  outline: "none", transition: "border-color 0.2s, box-shadow 0.2s", fontFamily: "DM Sans, sans-serif",
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
      <svg viewBox="0 0 1200 700" fill="none" stroke="white" strokeWidth={1} preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", opacity: 0.03 }}>
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
export function AuthPage({ onBack, onAuthSuccess, initialPlan, checkoutDraft, onDraftConsumed, lang, setLang }: AuthPageProps) {
  const t = AUTH[lang];
  const planCards = getPlanCards(lang);
  const planDetailData = getPlanDetailData(lang);
  const planWelcome = getPlanWelcome(lang);
  const newsStories = getNewsStories(lang);

  const hasDraft = !!checkoutDraft;
  const startsWithPlan = hasDraft || (!!initialPlan && initialPlan !== "free");
  const [mode, setMode] = useState<"login" | "signup">(startsWithPlan ? "signup" : "login");
  const [signupStep, setSignupStep] = useState<"plan" | "form">(
    hasDraft || (initialPlan && initialPlan !== "free") ? "form" : "plan"
  );
  const [selectedPlan, setSelectedPlan] = useState<Plan>(checkoutDraft?.plan ?? initialPlan ?? "free");
  const [name, setName] = useState(checkoutDraft?.name ?? "");
  const [email, setEmail] = useState(checkoutDraft?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (hasDraft) onDraftConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLogin = mode === "login";

  const resetSignup = () => {
    setSignupStep("plan");
    setSelectedPlan("free");
    setName(""); setEmail(""); setPassword(""); setError("");
  };

  const switchMode = () => { setMode(isLogin ? "signup" : "login"); resetSignup(); };

  const handleFormSubmit = async () => {
    setError("");
    if (!email.trim() || !password) { setError(t.errEmailPassword); return; }
    if (!name.trim()) { setError(t.errName); return; }
    if (password.length < 6) { setError(t.errPasswordLen); return; }
    setLoading(true);
    try {
      if (selectedPlan !== "free") {
        setLoading(false);
        setRedirecting(true);
        try {
          sessionStorage.setItem("fc_checkout_draft", JSON.stringify({ name: name.trim(), email: email.trim(), plan: selectedPlan }));
        } catch {}
        const priceRes = await fetch(`${API_BASE}/stripe/products-with-plan`);
        if (!priceRes.ok) throw new Error(t.errPlans);
        const prices = await priceRes.json() as Array<{ planTier: string; priceId: string; currency: string }>;
        const targetCurrency = lang === "pt" ? "brl" : "usd";
        const exactMatch = prices.find((p) => p.planTier === selectedPlan && p.currency === targetCurrency);
        if (!exactMatch && targetCurrency === "usd") {
          console.warn(`[AuthPage] No USD price found for ${selectedPlan}, falling back to BRL`);
        }
        const match = exactMatch ?? prices.find((p) => p.planTier === selectedPlan);
        if (!match?.priceId) throw new Error(t.errPlanNotFound);
        const res = await fetch(`${API_BASE}/stripe/checkout-register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), password, priceId: match.priceId }),
        });
        const data = await res.json() as { url?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? t.errPayment);
        if (!data.url) throw new Error(t.errPaymentUrl);
        window.location.href = data.url;
        return;
      }

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
      });
      const data = await res.json() as { token?: string; user?: { id: number; email: string; name: string; plan?: Plan }; error?: string; };
      if (!res.ok) { setError(data.error ?? t.errGeneric); return; }
      if (!data.token || !data.user) { setError(t.errInvalidResponse); return; }
      localStorage.setItem("fc_auth_token", data.token);
      localStorage.setItem("fc_auth_user", JSON.stringify(data.user));
      onAuthSuccess(data.token, data.user);
    } catch (e) {
      setRedirecting(false);
      setError(e instanceof Error ? e.message : t.errConnect);
    } finally { setLoading(false); }
  };

  const handleLoginSubmit = async () => {
    setError("");
    if (!email.trim() || !password) { setError(t.errEmailPassword); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json() as { token?: string; user?: { id: number; email: string; name: string; plan?: Plan }; error?: string; };
      if (!res.ok) { setError(data.error ?? t.errGeneric); return; }
      if (!data.token || !data.user) { setError(t.errInvalidResponse); return; }
      localStorage.setItem("fc_auth_token", data.token);
      localStorage.setItem("fc_auth_user", JSON.stringify(data.user));
      onAuthSuccess(data.token, data.user);
    } catch { setError(t.errConnect); }
    finally { setLoading(false); }
  };

  const FormHeader = ({ title, subtitle, compact }: { title: string; subtitle: string; compact?: boolean }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: compact ? 14 : 32, textAlign: "center" }}>
      <img src="/logo.png" alt="FC Career Manager" style={{ width: compact ? 44 : 60, height: compact ? 44 : 60, objectFit: "contain", marginBottom: compact ? 10 : 16, filter: "drop-shadow(0 0 16px rgba(124,92,252,0.35))" }} />
      <h1 style={{ color: "#f0f0ff", fontWeight: 800, fontSize: compact ? 19 : 22, margin: 0, fontFamily: "DM Sans, sans-serif" }}>{title}</h1>
      <p style={{ color: "#555577", fontSize: compact ? 13 : 14, margin: "5px 0 0", fontFamily: "DM Sans, sans-serif" }}>{subtitle}</p>
    </div>
  );

  const ErrorBlock = () => error ? (
    <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
      {error}
    </div>
  ) : null;

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
          <h2 style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>{t.redirectingTitle}</h2>
          <p style={{ color: "#555577", fontSize: 14, margin: 0 }}>{t.redirectingSub}</p>
        </div>
      </div>
    );
  }

  const contentKey = `${mode}-${signupStep}`;

  return (
    <div style={{ display: "flex", height: "100%", background: "#09090f", fontFamily: "DM Sans, sans-serif", position: "relative", overflow: "hidden" }}>
      <FieldLines />

      {/* ════ LEFT: FORM COLUMN ════ */}
      <div className="auth-form-col" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 480, flexShrink: 0, display: "flex", flexDirection: "column", overflowY: "auto", borderRight: "1px solid rgba(255,255,255,0.05)", animation: "authFormEnter 0.45s cubic-bezier(0.25,0.46,0.45,0.94) both" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px 8px" }}>
          <button
            onClick={() => {
              if (!isLogin && signupStep === "form") setSignupStep("plan");
              else onBack();
            }}
            style={{ display: "flex", alignItems: "center", gap: 6, color: "#444466", fontSize: 13, background: "none", border: "none", cursor: "pointer", transition: "color 0.2s", padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = "#8888aa")}
            onMouseLeave={e => (e.currentTarget.style.color = "#444466")}>
            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
              <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
            </svg>
            {t.back}
          </button>
          <LangToggle lang={lang} setLang={setLang} />
        </div>

        <div key={contentKey} className="auth-content-enter" style={{ margin: "auto 0", padding: "16px 40px 36px" }}>

          {/* ── LOGIN ── */}
          {isLogin && (
            <div>
              <FormHeader title={t.loginTitle} subtitle={t.loginSub} />
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 4 }}>
                <div>
                  <label style={{ display: "block", color: "#555577", fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.labelEmail}</label>
                  <AuthInput type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLoginSubmit()} placeholder={t.placeholderEmail} autoComplete="email" />
                </div>
                <div>
                  <label style={{ display: "block", color: "#555577", fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.labelPassword}</label>
                  <AuthInput type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLoginSubmit()} placeholder={t.placeholderPassword} autoComplete="current-password" />
                </div>
              </div>
              <ErrorBlock />
              <div style={{ marginTop: 20 }}>
                <PrimaryBtn onClick={handleLoginSubmit} disabled={loading}>
                  {loading ? t.loading : t.loginBtn}
                </PrimaryBtn>
              </div>
              <p style={{ textAlign: "center", color: "#444466", fontSize: 13, marginTop: 20 }}>
                {t.loginNewHere}{" "}
                <button onClick={switchMode} style={{ color: "#7c5cfc", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0, transition: "color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#a78bfa")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#7c5cfc")}>
                  {t.loginCreateAccount}
                </button>
              </p>
            </div>
          )}

          {/* ── SIGNUP: PLAN SELECTION ── */}
          {!isLogin && signupStep === "plan" && (
            <div>
              <FormHeader compact title={t.planSelectTitle} subtitle={t.planSelectSub} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {planCards.map(card => {
                  const sel = selectedPlan === card.plan;
                  return (
                    <button key={card.plan} onClick={() => setSelectedPlan(card.plan)}
                      style={{ textAlign: "left", borderRadius: 12, padding: "10px 14px", cursor: "pointer", transition: "all 0.2s", background: sel ? `rgba(${card.accentRgb},0.08)` : "rgba(255,255,255,0.03)", border: sel ? `1px solid rgba(${card.accentRgb},0.45)` : "1px solid rgba(255,255,255,0.07)", boxShadow: sel ? `0 0 20px rgba(${card.accentRgb},0.1)` : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: sel ? card.accentColor : "rgba(255,255,255,0.2)", transition: "background 0.2s" }} />
                          <span style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 14 }}>{card.label}</span>
                        </div>
                        <div>
                          <span style={{ color: sel ? card.accentColor : "#888899", fontWeight: 700, fontSize: 14 }}>{card.price}</span>
                          <span style={{ color: "#444466", fontSize: 11, marginLeft: 4 }}>{card.period}</span>
                        </div>
                      </div>
                      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3, paddingLeft: 15 }}>
                        {card.features.map(f => (
                          <li key={f} style={{ color: "#555577", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
                            <svg style={{ width: 11, height: 11, flexShrink: 0, color: sel ? card.accentColor : "rgba(255,255,255,0.2)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
                {t.planContinueBtn} {planCards.find(c => c.plan === selectedPlan)?.label}
              </PrimaryBtn>
              <p style={{ textAlign: "center", color: "#444466", fontSize: 13, marginTop: 16 }}>
                {t.planHasAccount}{" "}
                <button onClick={switchMode} style={{ color: "#7c5cfc", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0 }}>{t.planLogin}</button>
              </p>
            </div>
          )}

          {/* ── SIGNUP: FORM ── */}
          {!isLogin && signupStep === "form" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
                {(() => {
                  const card = planCards.find(c => c.plan === selectedPlan)!;
                  return (
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: `rgba(${card.accentRgb},0.12)`, color: card.accentColor, border: `1px solid rgba(${card.accentRgb},0.3)` }}>
                      {t.planBadge} {card.label}{selectedPlan !== "free" && ` — ${card.price}/${t.planBadgeMonth}`}
                    </span>
                  );
                })()}
              </div>

              <FormHeader title={t.signupTitle} subtitle={selectedPlan === "free" ? t.signupSubFree : t.signupSubPaid} />

              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 4 }}>
                <div>
                  <label style={{ display: "block", color: "#555577", fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.labelName}</label>
                  <AuthInput type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFormSubmit()} placeholder={t.placeholderName} autoComplete="name" />
                </div>
                <div>
                  <label style={{ display: "block", color: "#555577", fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.labelEmail}</label>
                  <AuthInput type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFormSubmit()} placeholder={t.placeholderEmail} autoComplete="email" />
                </div>
                <div>
                  <label style={{ display: "block", color: "#555577", fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.labelPassword}</label>
                  <AuthInput type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFormSubmit()} placeholder={t.placeholderPasswordNew} autoComplete="new-password" />
                </div>
              </div>
              <ErrorBlock />
              <div style={{ marginTop: 20 }}>
                <PrimaryBtn onClick={handleFormSubmit} disabled={loading}>
                  {loading ? t.loading : selectedPlan === "free" ? t.signupBtnFree : t.signupBtnPaid}
                </PrimaryBtn>
              </div>
              <p style={{ textAlign: "center", color: "#444466", fontSize: 13, marginTop: 20 }}>
                {t.signupHasAccount}{" "}
                <button onClick={switchMode} style={{ color: "#7c5cfc", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0 }}>{t.signupLogin}</button>
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ════ RIGHT: SHOWCASE COLUMN ════ */}
      <div className="auth-showcase" style={{ flex: 1, position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 64px", animation: "authShowcaseEnter 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.1s both" }}>
        <div style={{ background: "radial-gradient(ellipse 600px 500px at 50% 50%, rgba(124,92,252,0.09) 0%, transparent 65%)", position: "absolute", inset: 0, pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}>
          {!isLogin && signupStep === "plan" ? (
            <PlanDetailPanel key={selectedPlan} selectedPlan={selectedPlan} planCards={planCards} planDetailData={planDetailData} notIncludedLabel={t.notIncludedLabel} />
          ) : !isLogin && signupStep === "form" ? (
            <PlanWelcomePanel key={selectedPlan} plan={selectedPlan} planWelcome={planWelcome} />
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
                <img src="/logo.png" alt="FC Career Manager" style={{ width: 48, height: 48, objectFit: "contain", filter: "drop-shadow(0 2px 12px rgba(124,92,252,0.4))" }} />
                <p style={{ color: "#7c5cfc", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", margin: 0 }}>FC Career Manager</p>
              </div>
              <AiNewsCard stories={newsStories} generatedLabel={t.generatedNowLabel} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
