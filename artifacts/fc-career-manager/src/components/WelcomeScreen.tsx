import { useEffect, useState } from "react";

type Plan = "free" | "pro" | "ultra";

interface WelcomeScreenProps {
  userName: string;
  plan: Plan;
  onContinue: () => void;
}

const PLAN_CONFIG: Record<Plan, {
  badge: string;
  color: string;
  rgb: string;
  gradient: string;
  label: string;
  icon: React.ReactNode;
}> = {
  free: {
    badge: "Plano Gratuito",
    color: "#a0a0c0",
    rgb: "160,160,192",
    gradient: "linear-gradient(135deg,#a0a0c0,#6060a0)",
    label: "Gratuito",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  pro: {
    badge: "FC Career Pro",
    color: "#7c5cfc",
    rgb: "124,92,252",
    gradient: "linear-gradient(135deg,#7c5cfc,#5b3fd1)",
    label: "Pro",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  ultra: {
    badge: "FC Career Ultra",
    color: "#f59e0b",
    rgb: "245,158,11",
    gradient: "linear-gradient(135deg,#f59e0b,#c87000)",
    label: "Ultra",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
};

const BASE_FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    title: "Crie seu técnico",
    desc: "Personalize seu perfil com foto, nacionalidade e identidade",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
    title: "Escolha um clube",
    desc: "Mais de 700 clubes de todo o mundo para você comandar",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Registre partidas",
    desc: "Placar, formações, artilheiros e análise tática completa",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: "Inteligência Artificial",
    desc: plan => plan === "free"
      ? "Gere notícias e análises táticas com IA"
      : plan === "pro"
      ? "50 gerações de IA por mês — notícias, análises e mais"
      : "Gerações ilimitadas de IA para cada detalhe da sua carreira",
  },
];

const PLAN_EXTRAS: Record<Plan, { icon: React.ReactNode; text: string } | null> = {
  free: null,
  pro: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    ),
    text: "Até 3 carreiras simultâneas + diretoria e elenco completos",
  },
  ultra: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
    text: "Carreiras ilimitadas + todos os recursos premium desbloqueados",
  },
};

export function WelcomeScreen({ userName, plan, onContinue }: WelcomeScreenProps) {
  const cfg = PLAN_CONFIG[plan];
  const [visible, setVisible] = useState(false);
  const [featuresVisible, setFeaturesVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 60);
    const t2 = setTimeout(() => setFeaturesVisible(true), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleContinue = () => {
    setLeaving(true);
    setTimeout(onContinue, 500);
  };

  const firstName = userName.trim().split(" ")[0];

  const extra = PLAN_EXTRAS[plan];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#07070f",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        opacity: leaving ? 0 : visible ? 1 : 0,
        transform: leaving ? "scale(1.03)" : "scale(1)",
        transition: leaving ? "opacity 0.5s ease, transform 0.5s ease" : "opacity 0.6s ease",
        overflow: "hidden",
      }}
    >
      {/* ── Pitch SVG background ── */}
      <svg
        viewBox="0 0 1200 700"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.05, pointerEvents: "none" }}
        preserveAspectRatio="xMidYMid slice"
      >
        <rect x="60" y="40" width="1080" height="620" rx="18" fill="none" stroke="white" strokeWidth="2" />
        <line x1="600" y1="40" x2="600" y2="660" stroke="white" strokeWidth="1.5" />
        <circle cx="600" cy="350" r="90" fill="none" stroke="white" strokeWidth="1.5" />
        <circle cx="600" cy="350" r="5" fill="white" />
        <rect x="60" y="255" width="140" height="190" rx="4" fill="none" stroke="white" strokeWidth="1.5" />
        <rect x="1000" y="255" width="140" height="190" rx="4" fill="none" stroke="white" strokeWidth="1.5" />
        <rect x="60" y="300" width="60" height="100" rx="4" fill="none" stroke="white" strokeWidth="1" />
        <rect x="1080" y="300" width="60" height="100" rx="4" fill="none" stroke="white" strokeWidth="1" />
        <path d="M200 40 A160 160 0 0 1 200 160" fill="none" stroke="white" strokeWidth="1.2" />
        <path d="M1000 40 A160 160 0 0 0 1000 160" fill="none" stroke="white" strokeWidth="1.2" />
        <path d="M200 540 A160 160 0 0 0 200 660" fill="none" stroke="white" strokeWidth="1.2" />
        <path d="M1000 540 A160 160 0 0 1 1000 660" fill="none" stroke="white" strokeWidth="1.2" />
      </svg>

      {/* ── Ambient glows ── */}
      <div style={{ position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(ellipse, rgba(${cfg.rgb},0.12) 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(ellipse, rgba(${cfg.rgb},0.07) 0%, transparent 70%)`, pointerEvents: "none" }} />

      {/* ── Main card ── */}
      <div
        style={{
          position: "relative", zIndex: 1,
          maxWidth: 560, width: "90%",
          transform: visible ? "translateY(0)" : "translateY(32px)",
          transition: "transform 0.7s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* Plan badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: `linear-gradient(135deg, rgba(${cfg.rgb},0.2), rgba(${cfg.rgb},0.08))`,
            border: `1px solid rgba(${cfg.rgb},0.35)`,
            borderRadius: 24, padding: "7px 18px",
            color: cfg.color, fontSize: 13, fontWeight: 700,
            boxShadow: `0 0 24px rgba(${cfg.rgb},0.2)`,
            animation: "pulse-glow 3s ease-in-out infinite",
          }}>
            {cfg.icon}
            {cfg.badge}
          </div>
        </div>

        {/* Headline */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p style={{ color: `rgba(${cfg.rgb},0.7)`, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
            Bem-vindo ao FC Career Manager
          </p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.4rem,5vw,3.8rem)", color: "#f0f0ff", lineHeight: 1.05, marginBottom: 16 }}>
            Pronto para escrever<br />
            <span style={{ background: cfg.gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              sua história, {firstName}?
            </span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, lineHeight: 1.65, maxWidth: 420, margin: "0 auto" }}>
            Seu sistema de gestão de carreira no EA FC 26 está pronto. Aqui está tudo que você pode fazer:
          </p>
        </div>

        {/* Feature grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          {BASE_FEATURES.map((feat, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 14, padding: "14px 16px",
                display: "flex", gap: 12, alignItems: "flex-start",
                opacity: featuresVisible ? 1 : 0,
                transform: featuresVisible ? "translateY(0)" : "translateY(12px)",
                transition: `opacity 0.4s ease ${i * 80}ms, transform 0.4s ease ${i * 80}ms`,
              }}
            >
              <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: `rgba(${cfg.rgb},0.12)`, border: `1px solid rgba(${cfg.rgb},0.2)`, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color }}>
                {feat.icon}
              </div>
              <div>
                <p style={{ color: "#e0e0f0", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{feat.title}</p>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, lineHeight: 1.5 }}>
                  {typeof feat.desc === "function" ? feat.desc(plan) : feat.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Plan extra feature */}
        {extra && (
          <div
            style={{
              background: `linear-gradient(135deg, rgba(${cfg.rgb},0.08), rgba(${cfg.rgb},0.04))`,
              border: `1px solid rgba(${cfg.rgb},0.2)`,
              borderRadius: 14, padding: "14px 16px",
              display: "flex", gap: 12, alignItems: "center",
              marginBottom: 12,
              opacity: featuresVisible ? 1 : 0,
              transform: featuresVisible ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.4s ease 360ms, transform 0.4s ease 360ms",
            }}
          >
            <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: `rgba(${cfg.rgb},0.15)`, border: `1px solid rgba(${cfg.rgb},0.3)`, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color }}>
              {extra.icon}
            </div>
            <p style={{ color: cfg.color, fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{extra.text}</p>
          </div>
        )}

        {/* CTA */}
        <div
          style={{
            marginTop: 28, textAlign: "center",
            opacity: featuresVisible ? 1 : 0,
            transform: featuresVisible ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.4s ease 440ms, transform 0.4s ease 440ms",
          }}
        >
          <button
            onClick={handleContinue}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "14px 36px", borderRadius: 14,
              background: cfg.gradient,
              border: "none", color: plan === "free" ? "#09090f" : "#fff",
              fontSize: 15, fontWeight: 800, cursor: "pointer",
              boxShadow: `0 4px 32px rgba(${cfg.rgb},0.35), 0 1px 0 rgba(255,255,255,0.1) inset`,
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.03)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 48px rgba(${cfg.rgb},0.5), 0 1px 0 rgba(255,255,255,0.1) inset`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 32px rgba(${cfg.rgb},0.35), 0 1px 0 rgba(255,255,255,0.1) inset`;
            }}
          >
            Começar minha jornada
            <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 24px rgba(${cfg.rgb},0.2); }
          50%       { box-shadow: 0 0 40px rgba(${cfg.rgb},0.4); }
        }
      `}</style>
    </div>
  );
}
