import { useState, useEffect, useRef } from "react";
import { LangToggle } from "./LangToggle";
import {
  LP,
  getSteps,
  getFaqItems,
  getFeaturesExplorer,
  getTestimonials,
  type Lang,
} from "@/lib/i18n";

/* ─── Types ─────────────────────────────────────────────── */
interface LandingPageMobileProps {
  onStart: () => void;
  onLogin: () => void;
  onStartWithPlan: (plan: "pro" | "ultra") => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

/* ─── Live coaches counter ───────────────────────────────── */
function getLiveCoaches(): number {
  const now = Date.now();
  const s1 = Math.sin(now / 200000);
  const s2 = Math.cos(now / 80000);
  return 12675 + Math.round(s1 * 200 + s2 * 75);
}

/* ─── Feature icons ──────────────────────────────────────── */
const FEATURE_ICONS: Record<string, string> = {
  painel:         "📊",
  partidas:       "⚽",
  elenco:         "👥",
  transferencias: "🔄",
  financeiro:     "💰",
  trofeus:        "🏆",
  noticias:       "📰",
  diretoria:      "🤝",
};

const FEATURE_COLORS: Record<string, string> = {
  tactical:  "#7c5cfc",
  financial: "#3d9cf5",
  trophies:  "#f59e0b",
  ai:        "#00e5a0",
};

/* ─── Step numbers ───────────────────────────────────────── */
const STEP_ICONS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
export function LandingPageMobile({
  onStart,
  onLogin,
  onStartWithPlan,
  lang,
  setLang,
}: LandingPageMobileProps) {
  const t            = LP[lang];
  const steps        = getSteps(lang);
  const faqItems     = getFaqItems(lang);
  const features     = getFeaturesExplorer(lang);
  const testimonials = getTestimonials(lang);

  const [menuOpen,  setMenuOpen]  = useState(false);
  const [faqOpen,   setFaqOpen]   = useState<number | null>(null);
  const [liveCount, setLiveCount] = useState(getLiveCoaches);
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  const touchStartX = useRef(0);

  /* ── Live coaches counter ─── */
  useEffect(() => {
    const tmr = setInterval(() => setLiveCount(getLiveCoaches()), 45000);
    return () => clearInterval(tmr);
  }, []);

  /* ── Auto-rotate testimonials ─── */
  useEffect(() => {
    const tmr = setInterval(() => {
      setTestimonialIdx(i => (i + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(tmr);
  }, [testimonials.length]);

  /* ── Close menu on outside click ─── */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    document.addEventListener("click", handler, { passive: true });
    return () => document.removeEventListener("click", handler);
  }, [menuOpen]);

  /* ── Testimonial swipe ─── */
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) setTestimonialIdx(i => (i + 1) % testimonials.length);
    else        setTestimonialIdx(i => (i - 1 + testimonials.length) % testimonials.length);
  }

  /* ── Scroll to section ─── */
  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  }

  /* ── Nav items ─── */
  const navItems = [
    { label: t.navFeatures,    id: "m-features" },
    { label: t.navAI,          id: "m-ai" },
    { label: t.navHowItWorks,  id: "m-how" },
    { label: t.pricingLabel,   id: "m-pricing" },
    { label: t.faqLabel,       id: "m-faq" },
  ];

  /* ── Styling helpers ─── */
  const BG = "#09090f";
  const CARD_BG = "rgba(255,255,255,0.035)";
  const BORDER = "rgba(255,255,255,0.07)";
  const PURPLE = "#7c5cfc";
  const TEXT_MAIN = "#f0f0ff";
  const TEXT_DIM  = "#888899";

  return (
    <div
      style={{
        background: BG,
        minHeight: "100dvh",
        overflowX: "hidden",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: TEXT_MAIN,
      }}
    >

      {/* ════════════ NAVBAR ════════════ */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 18px",
          background: "rgba(9,9,15,0.92)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo.png" alt="FC Career Manager" style={{ width: 30, height: 30, objectFit: "contain" }} />
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em" }}>FC Career Manager</span>
        </div>

        {/* Right side: lang toggle + login + hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LangToggle lang={lang} setLang={setLang} />
          <button
            onClick={onLogin}
            style={{
              background: `linear-gradient(135deg,${PURPLE},#5b3fd1)`,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 36,
              whiteSpace: "nowrap",
            }}
          >
            {t.navCta}
          </button>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            style={{
              background: "none",
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              width: 36,
              height: 36,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              cursor: "pointer",
              padding: 0,
            }}
            aria-label="Menu"
          >
            {[0, 1, 2].map(i => (
              <span
                key={i}
                style={{
                  display: "block",
                  width: 18,
                  height: 2,
                  background: TEXT_MAIN,
                  borderRadius: 2,
                  transition: "transform 0.2s, opacity 0.2s",
                  transform: menuOpen
                    ? i === 0 ? "rotate(45deg) translate(5px,5px)"
                    : i === 2 ? "rotate(-45deg) translate(5px,-5px)"
                    : "none"
                    : "none",
                  opacity: menuOpen && i === 1 ? 0 : 1,
                }}
              />
            ))}
          </button>
        </div>
      </nav>

      {/* ── Drawer ─── */}
      {menuOpen && (
        <div
          style={{
            position: "fixed",
            top: 57,
            left: 0,
            right: 0,
            zIndex: 99,
            background: "rgba(9,9,15,0.97)",
            backdropFilter: "blur(18px)",
            borderBottom: `1px solid ${BORDER}`,
            padding: "8px 0 16px",
          }}
          onClick={e => e.stopPropagation()}
        >
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                color: TEXT_DIM,
                fontSize: 15,
                fontWeight: 600,
                padding: "12px 24px",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* ════════════ HERO ════════════ */}
      <section
        style={{
          minHeight: "90dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 24px 40px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(124,92,252,0.18) 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(124,92,252,0.12)",
            border: "1px solid rgba(124,92,252,0.25)",
            borderRadius: 100,
            padding: "5px 14px",
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 10, color: PURPLE, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            EA Sports FC · Career Mode
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 38,
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            margin: "0 0 16px",
            maxWidth: 320,
          }}
        >
          {t.heroLine1}
          <br />
          <span style={{ color: PURPLE }}>{t.heroLine2}</span>
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: 15,
            color: TEXT_DIM,
            lineHeight: 1.6,
            maxWidth: 300,
            margin: "0 0 32px",
          }}
        >
          {t.heroDesc}
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 300 }}>
          <button
            onClick={onStart}
            style={{
              background: `linear-gradient(135deg,${PURPLE},#5b3fd1)`,
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "16px 0",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 30px rgba(124,92,252,0.4)",
              minHeight: 52,
            }}
          >
            {t.heroCta}
          </button>
          <button
            onClick={onLogin}
            style={{
              background: "rgba(255,255,255,0.05)",
              color: TEXT_DIM,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: "14px 0",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 48,
            }}
          >
            {t.navCta}
          </button>
        </div>

        {/* Live coaches counter */}
        <div
          style={{
            marginTop: 36,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: "10px 20px",
          }}
        >
          <span style={{ fontSize: 20 }}>⚽</span>
          <div>
            <span style={{ fontWeight: 800, fontSize: 18, color: TEXT_MAIN }}>
              {liveCount.toLocaleString()}
            </span>
            <span style={{ color: TEXT_DIM, fontSize: 13, marginLeft: 6 }}>
              {t.heroCoachesLabel}
            </span>
            <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 2 }}>
              {t.heroCoachesSub}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            animation: "mobileChevronBounce 1.8s ease-in-out infinite",
          }}
        >
          <span style={{ fontSize: 22, color: TEXT_DIM, opacity: 0.6 }}>⌄</span>
        </div>
      </section>

      {/* ════════════ FEATURES ════════════ */}
      <section id="m-features" style={{ padding: "56px 20px" }}>
        <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: PURPLE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          {t.featuresLabel}
        </p>
        <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 32, lineHeight: 1.2 }}>
          {t.featuresTitle}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {features.map(f => {
            const accent = FEATURE_COLORS[f.colorType] ?? PURPLE;
            return (
              <div
                key={f.id}
                style={{
                  background: CARD_BG,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 16,
                  padding: "18px 18px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `${accent}18`,
                    border: `1px solid ${accent}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {FEATURE_ICONS[f.id] ?? "⚡"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: TEXT_MAIN }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: TEXT_DIM, lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ════════════ AI SECTION ════════════ */}
      <section id="m-ai" style={{ padding: "56px 20px", background: "rgba(0,229,160,0.02)", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#00e5a0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          {t.aiLabel}
        </p>
        <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 20, lineHeight: 1.2 }}>
          {t.aiTitle}
        </h2>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {[t.aiPoint1, t.aiPoint2, t.aiPoint3, t.aiPoint4].map((pt, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                background: CARD_BG,
                border: `1px solid ${BORDER}`,
                borderRadius: 14,
                padding: "14px 16px",
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>✦</span>
              <span style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>{pt}</span>
            </li>
          ))}
        </ul>

        {/* Mock news card */}
        <div
          style={{
            marginTop: 28,
            background: "rgba(0,229,160,0.06)",
            border: "1px solid rgba(0,229,160,0.2)",
            borderRadius: 16,
            padding: "20px 18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#00e5a0", textTransform: "uppercase" }}>{t.aiNewsMastheadTitle}</span>
            <span style={{ background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "2px 6px", letterSpacing: "0.08em" }}>● {t.aiNewsLive}</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.3, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.02em" }}>
            {t.mockupAIHeadline}
          </div>
          <div style={{ fontSize: 12, color: TEXT_DIM, lineHeight: 1.6 }}>
            {t.mockupAIBody}
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "#00e5a0", fontWeight: 600 }}>
            ✦ {t.aiNewsCardGenerated}
          </div>
        </div>
      </section>

      {/* ════════════ HOW IT WORKS ════════════ */}
      <section id="m-how" style={{ padding: "56px 20px" }}>
        <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: PURPLE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          {t.howLabel}
        </p>
        <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 32, lineHeight: 1.2 }}>
          {t.howTitle}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                background: CARD_BG,
                border: `1px solid ${BORDER}`,
                borderRadius: 16,
                padding: "18px 18px",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `rgba(124,92,252,0.12)`,
                  border: `1px solid rgba(124,92,252,0.25)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontWeight: 800,
                  fontSize: 16,
                  color: PURPLE,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 5, lineHeight: 1.3 }}>{step.title}</div>
                <div style={{ fontSize: 12, color: TEXT_DIM, lineHeight: 1.5 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════ TESTIMONIALS ════════════ */}
      <section
        style={{ padding: "56px 20px", background: "rgba(124,92,252,0.02)", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: PURPLE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          {t.testimonialsLabel}
        </p>
        <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 28, lineHeight: 1.2 }}>
          {t.testimonialsTitle}
        </h2>

        {/* Testimonial card */}
        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: "24px 20px",
            position: "relative",
            overflow: "hidden",
            minHeight: 160,
          }}
        >
          {testimonials.map((tm, i) => (
            <div
              key={i}
              style={{
                position: i === testimonialIdx ? "relative" : "absolute",
                opacity: i === testimonialIdx ? 1 : 0,
                transition: "opacity 0.4s ease",
                top: i === testimonialIdx ? "auto" : 0,
                left: i === testimonialIdx ? "auto" : 0,
                right: i === testimonialIdx ? "auto" : 0,
                pointerEvents: i === testimonialIdx ? "auto" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: tm.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 14,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {tm.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{tm.name}</div>
                  <div style={{ fontSize: 11, color: TEXT_DIM }}>{tm.handle}</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "#ccccdd", lineHeight: 1.6, margin: 0 }}>"{tm.text}"</p>
            </div>
          ))}
        </div>

        {/* Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setTestimonialIdx(i)}
              style={{
                width: i === testimonialIdx ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === testimonialIdx ? PURPLE : "rgba(255,255,255,0.2)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "width 0.3s ease, background 0.3s ease",
              }}
            />
          ))}
        </div>
      </section>

      {/* ════════════ PRICING ════════════ */}
      <section id="m-pricing" style={{ padding: "56px 20px" }}>
        <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: PURPLE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          {t.pricingLabel}
        </p>
        <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 32, lineHeight: 1.2 }}>
          {t.pricingTitle}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Free */}
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              padding: "24px 20px",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Free</div>
            <div style={{ color: TEXT_DIM, fontSize: 12, marginBottom: 16 }}>{t.pricingFreeForWho}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 20 }}>
              <span style={{ fontSize: 36, fontWeight: 900 }}>{t.pricingFreePriceWhole}</span>
              <span style={{ color: TEXT_DIM, fontSize: 13 }}>{t.pricingFreeForever}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {[t.freeFeat1, t.freeFeat2, t.freeFeat3].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: TEXT_DIM }}>
                  <span style={{ color: "#22c55e", fontSize: 14 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
            <button
              onClick={onStart}
              style={{
                width: "100%",
                padding: "13px 0",
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${BORDER}`,
                color: TEXT_DIM,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                minHeight: 48,
              }}
            >
              {t.pricingFreeBtn}
            </button>
          </div>

          {/* Pro */}
          <div
            style={{
              background: `linear-gradient(160deg, rgba(124,92,252,0.12), rgba(91,63,209,0.06))`,
              border: "1px solid rgba(124,92,252,0.35)",
              borderRadius: 20,
              padding: "24px 20px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Popular badge */}
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: PURPLE,
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 6,
                padding: "3px 8px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {t.pricingProBadge}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: TEXT_MAIN }}>Pro</div>
            <div style={{ color: TEXT_DIM, fontSize: 12, marginBottom: 16 }}>{t.pricingProForWho}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 20 }}>
              <span style={{ fontSize: 36, fontWeight: 900 }}>{t.pricingProPriceWhole}</span>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{t.pricingProPriceDec}</span>
              <span style={{ color: TEXT_DIM, fontSize: 13, marginLeft: 4 }}>{t.pricingPerMonth}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {[t.proFeat1, t.proFeat2, t.proFeat3, t.proFeat4].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: TEXT_DIM }}>
                  <span style={{ color: PURPLE, fontSize: 14 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
            <button
              onClick={() => onStartWithPlan("pro")}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                background: `linear-gradient(135deg,${PURPLE},#5b3fd1)`,
                border: "none",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "0 6px 24px rgba(124,92,252,0.4)",
                minHeight: 52,
              }}
            >
              {t.pricingProBtn}
            </button>
          </div>

          {/* Ultra */}
          <div
            style={{
              background: `linear-gradient(160deg, rgba(245,158,11,0.08), rgba(200,110,0,0.04))`,
              border: "1px solid rgba(245,158,11,0.25)",
              borderRadius: 20,
              padding: "24px 20px",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: TEXT_MAIN }}>Ultra</div>
            <div style={{ color: TEXT_DIM, fontSize: 12, marginBottom: 16 }}>{t.pricingUltraForWho}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 20 }}>
              <span style={{ fontSize: 36, fontWeight: 900 }}>{t.pricingUltraPriceWhole}</span>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{t.pricingUltraPriceDec}</span>
              <span style={{ color: TEXT_DIM, fontSize: 13, marginLeft: 4 }}>{t.pricingPerMonth}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {[t.ultraFeat1, t.ultraFeat2, t.ultraFeat3, t.ultraFeat4, t.ultraFeat5, t.ultraFeat6].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: TEXT_DIM }}>
                  <span style={{ color: "#f59e0b", fontSize: 14 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
            <button
              onClick={() => onStartWithPlan("ultra")}
              style={{
                width: "100%",
                padding: "13px 0",
                borderRadius: 12,
                background: "linear-gradient(135deg,rgba(245,158,11,0.85),rgba(200,110,0,0.8))",
                border: "none",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "0 6px 24px rgba(245,158,11,0.3)",
                minHeight: 48,
              }}
            >
              {t.pricingUltraBtn}
            </button>
          </div>

        </div>
      </section>

      {/* ════════════ FAQ ════════════ */}
      <section id="m-faq" style={{ padding: "56px 20px", borderTop: `1px solid ${BORDER}` }}>
        <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: PURPLE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          {t.faqLabel}
        </p>
        <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 32, lineHeight: 1.2 }}>
          {t.faqTitle}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faqItems.map((item, i) => (
            <div
              key={i}
              style={{
                background: CARD_BG,
                border: `1px solid ${faqOpen === i ? "rgba(124,92,252,0.3)" : BORDER}`,
                borderRadius: 14,
                overflow: "hidden",
                transition: "border-color 0.2s",
              }}
            >
              <button
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  color: TEXT_MAIN,
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "16px 18px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  minHeight: 52,
                }}
              >
                <span style={{ flex: 1, lineHeight: 1.4 }}>{item.q}</span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 18,
                    color: PURPLE,
                    transition: "transform 0.25s",
                    transform: faqOpen === i ? "rotate(45deg)" : "none",
                  }}
                >
                  +
                </span>
              </button>
              {faqOpen === i && (
                <div style={{ padding: "0 18px 16px", fontSize: 13, color: TEXT_DIM, lineHeight: 1.65 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ════════════ FINAL CTA ════════════ */}
      <section
        style={{
          padding: "60px 24px",
          textAlign: "center",
          background: `radial-gradient(ellipse 300px 250px at 50% 40%, rgba(124,92,252,0.12) 0%, transparent 70%)`,
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, color: PURPLE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
          {t.ctaLabel}
        </p>
        <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 28 }}>
          {t.ctaLine1}
          <br />
          <span style={{ color: PURPLE }}>{t.ctaLine2}</span>
        </h2>
        <button
          onClick={onStart}
          style={{
            background: `linear-gradient(135deg,${PURPLE},#5b3fd1)`,
            color: "#fff",
            border: "none",
            borderRadius: 14,
            padding: "18px 28px",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            width: "100%",
            maxWidth: 320,
            boxShadow: "0 10px 40px rgba(124,92,252,0.45)",
            minHeight: 56,
          }}
        >
          {t.ctaBtn}
        </button>
      </section>

      {/* ════════════ FOOTER ════════════ */}
      <footer
        style={{
          background: BG,
          borderTop: `1px solid ${BORDER}`,
          padding: "28px 20px 36px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo.png" alt="FC Career Manager" style={{ width: 20, height: 20, objectFit: "contain", opacity: 0.7 }} />
          <span style={{ color: "#444466", fontSize: 13, fontWeight: 600 }}>FC Career Manager</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {[t.footerTerms, t.footerPrivacy, t.footerSupport].map(l => (
            <a key={l} href="#" style={{ color: "#444466", fontSize: 12, textDecoration: "none" }}>{l}</a>
          ))}
        </div>
        <p style={{ color: "#333355", fontSize: 11, margin: 0 }}>
          © {new Date().getFullYear()} FC Career Manager. {t.footerRights}
        </p>
      </footer>

      {/* ── CSS animation ─── */}
      <style>{`
        @keyframes mobileChevronBounce {
          0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.5; }
          50%       { transform: translateX(-50%) translateY(6px); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
