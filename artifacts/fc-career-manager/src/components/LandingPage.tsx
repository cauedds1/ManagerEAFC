import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from "react";
import { ClubDemoMockup } from "./ClubDemoMockup";
import { LangToggle } from "./LangToggle";
import { LP, getAiTexts, getHeadlineTemplates, getBodyTemplates, getSteps, getFaqItems, getFeaturesExplorer, getTestimonials, type Lang } from "@/lib/i18n";

/* ─── Types ─────────────────────────────────────────────── */
interface LandingPageProps {
  onStart: () => void;
  onLogin: () => void;
  onStartWithPlan: (plan: "pro" | "ultra") => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

/* ─── Club data ──────────────────────────────────────────── */
const CLUBS = [
  { id: "barca",   name: "Barcelona",       league: "La Liga",           accent: "#c8102e", accentRgb: "200,16,46",   textDark: false },
  { id: "cercle",  name: "Cercle Brugge",   league: "Belgian Pro League",accent: "#00b050", accentRgb: "0,176,80",    textDark: false },
  { id: "watford", name: "Watford",          league: "Championship",      accent: "#fbee23", accentRgb: "251,238,35",  textDark: true  },
  { id: "mancity", name: "Manchester City",  league: "Premier League",    accent: "#6cabdd", accentRgb: "108,171,221", textDark: false },
] as const;

/* ─── Clubs database for color picker ───────────────────── */
const CLUBS_DB: Record<string, { primary: string; secondary: string; accentRgb: string }> = {
  "barcelona":          { primary: "#c8102e", secondary: "#004d98", accentRgb: "200,16,46" },
  "real madrid":        { primary: "#c0a853", secondary: "#ffffff", accentRgb: "192,168,83" },
  "manchester city":    { primary: "#6cabdd", secondary: "#1c2c5b", accentRgb: "108,171,221" },
  "manchester united":  { primary: "#da020a", secondary: "#ffe500", accentRgb: "218,2,10" },
  "liverpool":          { primary: "#c8102e", secondary: "#00b2a9", accentRgb: "200,16,46" },
  "chelsea":            { primary: "#034694", secondary: "#dba111", accentRgb: "3,70,148" },
  "arsenal":            { primary: "#ef0107", secondary: "#ffffff", accentRgb: "239,1,7" },
  "tottenham":          { primary: "#132257", secondary: "#ffffff", accentRgb: "19,34,87" },
  "aston villa":        { primary: "#95bfe5", secondary: "#670e36", accentRgb: "149,191,229" },
  "newcastle":          { primary: "#241f20", secondary: "#ffffff", accentRgb: "36,31,32" },
  "juventus":           { primary: "#000000", secondary: "#ffffff", accentRgb: "60,60,60" },
  "inter milan":        { primary: "#010e80", secondary: "#000000", accentRgb: "1,14,128" },
  "ac milan":           { primary: "#c30016", secondary: "#000000", accentRgb: "195,0,22" },
  "roma":               { primary: "#8e1f2f", secondary: "#f0bc42", accentRgb: "142,31,47" },
  "napoli":             { primary: "#0067b1", secondary: "#00a4e0", accentRgb: "0,103,177" },
  "lazio":              { primary: "#87ceeb", secondary: "#ffffff", accentRgb: "135,206,235" },
  "psg":                { primary: "#004170", secondary: "#da291c", accentRgb: "0,65,112" },
  "lyon":               { primary: "#0d3278", secondary: "#e1251b", accentRgb: "13,50,120" },
  "marseille":          { primary: "#2faee0", secondary: "#ffffff", accentRgb: "47,174,224" },
  "monaco":             { primary: "#d01f3c", secondary: "#ffffff", accentRgb: "208,31,60" },
  "bayern":             { primary: "#dc052d", secondary: "#006ab2", accentRgb: "220,5,45" },
  "dortmund":           { primary: "#fde100", secondary: "#000000", accentRgb: "253,225,0" },
  "leverkusen":         { primary: "#e32221", secondary: "#000000", accentRgb: "227,34,33" },
  "atletico madrid":    { primary: "#d01f24", secondary: "#272e61", accentRgb: "208,31,36" },
  "sevilla":            { primary: "#d91a2a", secondary: "#ffffff", accentRgb: "217,26,42" },
  "valencia":           { primary: "#000000", secondary: "#ff7700", accentRgb: "60,60,60" },
  "villarreal":         { primary: "#ffd700", secondary: "#000000", accentRgb: "255,215,0" },
  "porto":              { primary: "#0057a6", secondary: "#ffdd00", accentRgb: "0,87,166" },
  "benfica":            { primary: "#e2221c", secondary: "#ffffff", accentRgb: "226,34,28" },
  "sporting":           { primary: "#006600", secondary: "#ffff00", accentRgb: "0,102,0" },
  "ajax":               { primary: "#d2122e", secondary: "#ffffff", accentRgb: "210,18,46" },
  "feyenoord":          { primary: "#d00c15", secondary: "#ffffff", accentRgb: "208,12,21" },
  "psv":                { primary: "#c1282d", secondary: "#ffffff", accentRgb: "193,40,45" },
  "celtic":             { primary: "#16a24a", secondary: "#ffffff", accentRgb: "22,162,74" },
  "rangers":            { primary: "#1b458f", secondary: "#ffffff", accentRgb: "27,69,143" },
  "boca juniors":       { primary: "#f5d100", secondary: "#003399", accentRgb: "245,209,0" },
  "river plate":        { primary: "#e40c0c", secondary: "#ffffff", accentRgb: "228,12,12" },
  "flamengo":           { primary: "#cc0000", secondary: "#000000", accentRgb: "204,0,0" },
  "palmeiras":          { primary: "#006437", secondary: "#ffffff", accentRgb: "0,100,55" },
  "corinthians":        { primary: "#1e1e1e", secondary: "#ffffff", accentRgb: "50,50,50" },
  "sao paulo":          { primary: "#cc0000", secondary: "#ffffff", accentRgb: "204,0,0" },
  "gremio":             { primary: "#5b9ddb", secondary: "#000000", accentRgb: "91,157,219" },
  "internacional":      { primary: "#d01f24", secondary: "#ffffff", accentRgb: "208,31,36" },
  "atletico mineiro":   { primary: "#000000", secondary: "#8b2335", accentRgb: "80,0,20" },
  "santos":             { primary: "#1e1e1e", secondary: "#ffffff", accentRgb: "50,50,50" },
  "fluminense":         { primary: "#6e1f7c", secondary: "#b22222", accentRgb: "110,31,124" },
  "vasco":              { primary: "#1e1e1e", secondary: "#ffffff", accentRgb: "50,50,50" },
  "botafogo":           { primary: "#1e1e1e", secondary: "#ffffff", accentRgb: "50,50,50" },
  "cruzeiro":           { primary: "#003087", secondary: "#ffffff", accentRgb: "0,48,135" },
  "watford":            { primary: "#fbee23", secondary: "#c20000", accentRgb: "251,238,35" },
  "cercle brugge":      { primary: "#00b050", secondary: "#000000", accentRgb: "0,176,80" },
  "club america":       { primary: "#ffb300", secondary: "#00479c", accentRgb: "255,179,0" },
  "chivas":             { primary: "#c8102e", secondary: "#002776", accentRgb: "200,16,46" },
  "zenit":              { primary: "#0080c8", secondary: "#ffffff", accentRgb: "0,128,200" },
  "galatasaray":        { primary: "#c8102e", secondary: "#f5a623", accentRgb: "200,16,46" },
  "fenerbahce":         { primary: "#f5c518", secondary: "#003399", accentRgb: "245,197,24" },
  "besiktas":           { primary: "#000000", secondary: "#ffffff", accentRgb: "50,50,50" },
};

/* ─── Hash-based fallback accent for unknown clubs ───────── */
function hashAccent(name: string): { accent: string; accentRgb: string; secondary: string } {
  let n = 0;
  const s = name.toLowerCase().trim();
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) | 0;
  n = Math.abs(n);
  const palette: Array<[number, number, number, number, number, number]> = [
    [200, 50,  50,  255, 100, 100],
    [50,  130, 220, 100, 200, 255],
    [40,  170, 80,  120, 255, 150],
    [220, 175, 50,  255, 220, 100],
    [160, 60,  210, 220, 120, 255],
    [220, 110, 40,  255, 170, 100],
    [0,   160, 160, 80,  230, 230],
    [180, 40,  100, 255, 100, 160],
  ];
  const [r, g, b, sr, sg, sb] = palette[n % palette.length];
  return {
    accent:    `rgb(${r},${g},${b})`,
    accentRgb: `${r},${g},${b}`,
    secondary: `rgb(${sr},${sg},${sb})`,
  };
}

/* ─── Features Explorer ──────────────────────────────────── */
type FeatureColor = "tactical" | "financial" | "trophies" | "ai";

const FEATURE_PANEL_BG: Record<FeatureColor, string> = {
  tactical:  "radial-gradient(ellipse 500px 350px at 50% 20%, rgba(124,92,252,0.07) 0%, transparent 70%)",
  financial: "radial-gradient(ellipse 500px 350px at 50% 20%, rgba(61,156,245,0.07) 0%, transparent 70%)",
  trophies:  "radial-gradient(ellipse 500px 350px at 50% 20%, rgba(245,158,11,0.07) 0%, transparent 70%)",
  ai:        "radial-gradient(ellipse 500px 350px at 50% 20%, rgba(0,229,160,0.06) 0%, transparent 70%)",
};

/* ─── Leagues marquee ────────────────────────────────────── */
const LEAGUES = [
  { name: "Premier League", color: "#3d0064" },
  { name: "La Liga", color: "#003087" },
  { name: "Bundesliga", color: "#d20515" },
  { name: "Serie A", color: "#003087" },
  { name: "Ligue 1", color: "#003090" },
  { name: "Brasileirão", color: "#009c3b" },
  { name: "Champions League", color: "#001489" },
  { name: "Eredivisie", color: "#d20515" },
  { name: "Liga Portugal", color: "#006600" },
  { name: "Championship", color: "#0000cd" },
  { name: "Belgian Pro League", color: "#000000" },
  { name: "Scottish Prem", color: "#003087" },
  { name: "MLS", color: "#002868" },
  { name: "Süper Lig", color: "#e30a17" },
  { name: "Argentine Primera", color: "#003087" },
];

/* ─── Live coaches counter (deterministic simulation) ──── */
function getLiveCoaches(): number {
  const now = Date.now();
  const s1 = Math.sin(now / 200000);
  const s2 = Math.cos(now / 80000);
  return 12675 + Math.round(s1 * 200 + s2 * 75);
}

/* ─── SplitFlap component ────────────────────────────────── */
function SplitFlapDigit({ digit }: { digit: string }) {
  const [displayed, setDisplayed] = useState(digit);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (digit === displayed) return;
    setFlipping(true);
    const t = setTimeout(() => { setDisplayed(digit); setFlipping(false); }, 130);
    return () => clearTimeout(t);
  }, [digit, displayed]);

  if (digit === "." || digit === ",") {
    return <div className="sf-sep">{digit}</div>;
  }

  return (
    <div className="sf-digit">
      <div className={`sf-digit-inner${flipping ? " sf-flipping" : ""}`}>{displayed}</div>
      <div className="sf-line" />
    </div>
  );
}

function SplitFlap({ value, lang }: { value: number; lang: Lang }) {
  const str = value.toLocaleString(lang === "en" ? "en-US" : "pt-BR");
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {str.split("").map((ch, i) => <SplitFlapDigit key={i} digit={ch} />)}
    </div>
  );
}

/* ─── Particle Canvas ────────────────────────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const N = 45;
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r:  1.2 + Math.random() * 1.3,
      gold: Math.random() > 0.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      particles.forEach(p => {
        const dx = p.x - mx, dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 90) {
          const force = (90 - dist) / 90 * 0.6;
          p.vx += dx / dist * force;
          p.vy += dy / dist * force;
        }
        p.vx *= 0.98; p.vy *= 0.98;
        p.x += p.vx; p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold ? "rgba(245,158,11,0.65)" : "rgba(124,92,252,0.55)";
        ctx.fill();
      });

      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 135) {
            const alpha = (1 - d / 135) * 0.25;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const bothGold = particles[i].gold && particles[j].gold;
            ctx.strokeStyle = bothGold
              ? `rgba(245,158,11,${alpha})`
              : `rgba(124,92,252,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.parentElement?.addEventListener("mousemove", onMove);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.parentElement?.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}

/* ─── Hero Reels Phone Mockup ───────────────────────────── */
const REELS_CLIPS = [
  { src: "/reels/v1.mp4", club: "Chelsea FC", desc: "Belo gol de fora da área",  likes: "4.2K", comments: "312",  shares: "1.1K" },
  { src: "/reels/v2.mp4", club: "West Ham",   desc: "Golaço no ângulo de fora", likes: "6.8K", comments: "487",  shares: "2.3K" },
  { src: "/reels/v3.mp4", club: "Mowatt",     desc: "Pancada de fora — gol",    likes: "3.1K", comments: "204",  shares: "890"  },
];

function HeroReelsMockup({ lang }: { lang: Lang }) {
  const t = LP[lang];

  const [idx, setIdx]           = useState(0);
  const [prevIdx, setPrevIdx]   = useState<number | null>(null);
  const [phase, setPhase]       = useState<"idle" | "prepare" | "animate">("idle");
  const [progress, setProgress] = useState(0);

  const v0Ref = useRef<HTMLVideoElement>(null);
  const v1Ref = useRef<HTMLVideoElement>(null);
  const v2Ref = useRef<HTMLVideoElement>(null);
  const videoRefs = useMemo(() => [v0Ref, v1Ref, v2Ref], []);

  const rafRef   = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    if (phase !== "idle") return;
    const next = (idx + 1) % REELS_CLIPS.length;
    setPrevIdx(idx);
    setIdx(next);
    setPhase("prepare");
    setProgress(0);
  }, [idx, phase]);

  useEffect(() => {
    if (phase !== "prepare") return;
    rafRef.current = requestAnimationFrame(() => {
      setPhase("animate");
      timerRef.current = setTimeout(() => {
        setPrevIdx(null);
        setPhase("idle");
      }, 700);
    });
  }, [phase]);

  useEffect(() => {
    const v = videoRefs[idx].current;
    if (!v) return;
    v.currentTime = 0;
    setProgress(0);
    v.play().catch(() => {});

    const onTimeUpdate = () => {
      if (v.duration && v.duration > 0) setProgress(v.currentTime / v.duration);
    };
    const onEnded = () => advance();
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);

    REELS_CLIPS.forEach((_, i) => {
      if (i !== idx) videoRefs[i].current?.pause();
    });

    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
    };
  }, [idx, advance, videoRefs]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const ease = "transform 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

  const screenW = 210;
  const screenH = 360;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, animation: "floatMockup 6s ease-in-out infinite" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#7c5cfc", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>
          {t.heroReelsLabel}
        </p>
        <p style={{ color: "#555577", fontSize: 12, lineHeight: 1.5 }}>
          {t.heroReelsSub}
        </p>
      </div>

      <div style={{
        width: screenW + 16,
        background: "#0a0a14",
        borderRadius: 40,
        border: "1.5px solid rgba(255,255,255,0.12)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.04), 0 40px 80px rgba(0,0,0,0.9), 0 0 40px rgba(124,92,252,0.12)",
        padding: "14px 8px 12px",
        position: "relative",
      }}>
        <div style={{ width: 80, height: 24, background: "#0a0a14", borderRadius: 20, border: "1.5px solid rgba(255,255,255,0.1)", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.06)" }} />
          <div style={{ width: 32, height: 6, borderRadius: 4, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.06)" }} />
        </div>

        <div style={{ width: screenW, height: screenH, borderRadius: 20, overflow: "hidden", position: "relative", background: "#000" }}>
          {REELS_CLIPS.map((clip, i) => {
            const isCurrent = i === idx;
            const isPrev    = i === prevIdx;
            let transform: string;
            let transition: string;
            let zIndex: number;
            if (isCurrent) {
              transform  = phase === "prepare" ? "translateY(100%)" : "translateY(0%)";
              transition = phase === "animate" ? ease : "none";
              zIndex     = 2;
            } else if (isPrev) {
              transform  = phase === "animate" ? "translateY(-100%)" : "translateY(0%)";
              transition = phase === "animate" ? ease : "none";
              zIndex     = 1;
            } else {
              transform  = "translateY(100%)";
              transition = "none";
              zIndex     = 0;
            }
            return (
              <div key={i} style={{ position: "absolute", inset: 0, transform, transition, zIndex }}>
                <video
                  ref={videoRefs[i]}
                  src={clip.src}
                  muted
                  playsInline
                  preload="auto"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                <ClipOverlay clip={clip} />
              </div>
            );
          })}
        </div>

        {/* ── Progress indicator dots ── */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", margin: "8px auto 4px" }}>
          {REELS_CLIPS.map((_, i) => {
            const isActive = i === idx;
            const isPast   = i < idx;
            return (
              <div
                key={i}
                style={{
                  width: isActive ? 48 : 8,
                  height: 3,
                  borderRadius: 2,
                  background: isPast ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)",
                  overflow: "hidden",
                  transition: "width 0.35s ease, background 0.35s ease",
                  position: "relative",
                }}
              >
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(90deg, #7c5cfc, #a78bfa)",
                      transformOrigin: "left center",
                      transform: `scaleX(${progress})`,
                      transition: "transform 0.15s linear",
                      borderRadius: 2,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div style={{ width: 100, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)", margin: "4px auto 0" }} />
      </div>
    </div>
  );
}

function ClipOverlay({ clip }: { clip: typeof REELS_CLIPS[number] }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* Bottom-left: club + description */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 48, padding: "40px 12px 14px", background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{clip.club}</div>
        <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, lineHeight: 1.3 }}>{clip.desc}</div>
      </div>

      {/* Right-center: engagement column (likes → comments → shares) */}
      <div style={{
        position: "absolute",
        right: 8,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}>
        {[
          { icon: "❤️", value: clip.likes },
          { icon: "💬", value: clip.comments },
          { icon: "↗️", value: clip.shares },
        ].map(({ icon, value }) => (
          <div key={icon} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
            <span style={{ color: "#fff", fontSize: 10, fontWeight: 600, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Feature mockups ────────────────────────────────────── */
function PainelMockup({ t }: { t: Record<string, string> }) {
  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(124,92,252,0.2)", fontSize: 0 }}>
      <div style={{ background: "#13131f", padding: "8px 14px", display: "flex", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {[t.mockupPainelTabPainel, t.mockupPainelTabPartidas, t.mockupPainelTabElenco].map((tb, i) => (
          <span key={tb} style={{ fontSize: 9, color: i===0?"#7c5cfc":"#444466", borderBottom: i===0?"1px solid #7c5cfc":"none", paddingBottom: 4 }}>{tb}</span>
        ))}
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
          {[{l:t.mockupPainelStatPartidas,v:"22",c:"#7c5cfc"},{l:t.mockupPainelStatVitorias,v:"14",c:"#00e5a0"},{l:t.mockupPainelStatGols,v:"38",c:"#f59e0b"}].map(s => (
            <div key={s.l} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 10px", border: `1px solid rgba(${s.c==="#7c5cfc"?"124,92,252":s.c==="#00e5a0"?"0,229,160":"245,158,11"},0.15)` }}>
              <div style={{ color: "#444466", fontSize: 8 }}>{s.l}</div>
              <div style={{ color: s.c, fontWeight: 700, fontSize: 16, fontFamily: "JetBrains Mono, monospace" }}>{s.v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(124,92,252,0.06)", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(124,92,252,0.12)" }}>
          <div style={{ color: "#444466", fontSize: 8, marginBottom: 6 }}>{t.mockupPainelForma}</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[t.mockupResultW,t.mockupResultW,t.mockupResultD,t.mockupResultW,t.mockupResultW,t.mockupResultL,t.mockupResultW].map((r,i) => (
              <div key={i} style={{ width: 22, height: 22, borderRadius: 4, background: r===t.mockupResultW?"rgba(0,229,160,0.2)":r===t.mockupResultL?"rgba(239,68,68,0.2)":"rgba(85,85,119,0.3)", border: `1px solid ${r===t.mockupResultW?"rgba(0,229,160,0.4)":r===t.mockupResultL?"rgba(239,68,68,0.4)":"rgba(85,85,119,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 9, color: r===t.mockupResultW?"#00e5a0":r===t.mockupResultL?"#ef4444":"#555577", fontWeight: 700 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PartidaMockup({ homeScore, awayScore, onChangeHome, onChangeAway, t }: { homeScore: number; awayScore: number; onChangeHome: (d: number) => void; onChangeAway: (d: number) => void; t: Record<string, string> }) {
  const diff = homeScore - awayScore;
  const headline = diff >= 2 ? t.mockupMatchBig : diff === 1 ? t.mockupMatchWin : diff === 0 ? t.mockupMatchDraw : diff <= -2 ? t.mockupMatchBigLoss : t.mockupMatchLoss;

  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(124,92,252,0.2)" }}>
      <div style={{ background: "#13131f", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "#444466" }}>{t.mockupMatchLabel}</span>
        <span style={{ fontSize: 9, color: "#7c5cfc" }}>La Liga</span>
      </div>
      <div style={{ padding: "16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#f0f0ff", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Barcelona</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <button onClick={() => onChangeHome(1)} style={{ background: "rgba(124,92,252,0.2)", border: "1px solid rgba(124,92,252,0.3)", borderRadius: 4, color: "#7c5cfc", fontSize: 10, padding: "2px 8px", cursor: "pointer" }}>▲</button>
              <div style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 28, fontFamily: "JetBrains Mono, monospace", lineHeight: 1 }}>{homeScore}</div>
              <button onClick={() => onChangeHome(-1)} style={{ background: "rgba(124,92,252,0.1)", border: "1px solid rgba(124,92,252,0.2)", borderRadius: 4, color: "#555577", fontSize: 10, padding: "2px 8px", cursor: "pointer" }}>▼</button>
            </div>
          </div>
          <div style={{ color: "#333355", fontSize: 16, fontWeight: 700, alignSelf: "center", paddingTop: 16 }}>–</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#f0f0ff", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Lyon</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <button onClick={() => onChangeAway(1)} style={{ background: "rgba(124,92,252,0.2)", border: "1px solid rgba(124,92,252,0.3)", borderRadius: 4, color: "#7c5cfc", fontSize: 10, padding: "2px 8px", cursor: "pointer" }}>▲</button>
              <div style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 28, fontFamily: "JetBrains Mono, monospace", lineHeight: 1 }}>{awayScore}</div>
              <button onClick={() => onChangeAway(-1)} style={{ background: "rgba(124,92,252,0.1)", border: "1px solid rgba(124,92,252,0.2)", borderRadius: 4, color: "#555577", fontSize: 10, padding: "2px 8px", cursor: "pointer" }}>▼</button>
            </div>
          </div>
        </div>
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 12px", borderLeft: "2px solid rgba(245,158,11,0.4)", transition: "all 0.3s" }}>
          <div style={{ color: "#444466", fontSize: 8, marginBottom: 4 }}>{t.mockupMatchNewspaper}</div>
          <p style={{ color: "#c0c0d0", fontSize: 10, lineHeight: 1.5, fontWeight: 600 }}>{headline}</p>
        </div>
      </div>
    </div>
  );
}

function ElencoMockup({ t }: { t: Record<string, string> }) {
  const players = [
    { pos: "GK", name: "T. Courtois", ovr: 87, age: 32 },
    { pos: "CB", name: "R. Araújo",   ovr: 84, age: 25 },
    { pos: "CM", name: "P. Gavi",     ovr: 85, age: 24 },
    { pos: "ST", name: "R. Lewandowski", ovr: 89, age: 36 },
    { pos: "LW", name: "L. Yamal",    ovr: 83, age: 17 },
  ];
  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(124,92,252,0.2)" }}>
      <div style={{ background: "#13131f", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "#444466" }}>{t.mockupElencoLabel}</span>
        <span style={{ fontSize: 9, color: "#7c5cfc" }}>{t.mockupElencoAdd}</span>
      </div>
      <div style={{ padding: "8px 12px" }}>
        {players.map(p => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: 8, color: "#7c5cfc", fontWeight: 700, width: 22, textAlign: "center", background: "rgba(124,92,252,0.1)", borderRadius: 3, padding: "2px 3px" }}>{p.pos}</span>
            <span style={{ flex: 1, fontSize: 10, color: "#e0e0f0", fontWeight: 600 }}>{p.name}</span>
            <span style={{ fontSize: 9, color: "#888" }}>{p.age}</span>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: p.ovr >= 87 ? "#00e5a0" : p.ovr >= 84 ? "#f59e0b" : "#8888aa" }}>{p.ovr}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TranfMockup({ t }: { t: Record<string, string> }) {
  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(61,156,245,0.2)" }}>
      <div style={{ background: "#13131f", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 9, color: "#3d9cf5" }}>{t.mockupTransfLabel}</span>
      </div>
      <div style={{ padding: "10px 12px" }}>
        {[
          { name: "K. De Bruyne",   from: "Man. City",  fee: "€32M", dir: "in"  },
          { name: "A. Griezmann",   from: "Atl. Madrid", fee: "€18M", dir: "in"  },
          { name: "F. Torres",      from: "Barcelona",  fee: "€15M", dir: "out" },
        ].map(tr => (
          <div key={tr.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: 14 }}>{tr.dir === "in" ? "↙" : "↗"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#e0e0f0", fontWeight: 600 }}>{tr.name}</div>
              <div style={{ fontSize: 9, color: "#555577" }}>{tr.dir === "in" ? t.mockupTransfFrom : t.mockupTransfTo} {tr.from}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: tr.dir === "in" ? "#ef4444" : "#00e5a0", fontFamily: "JetBrains Mono, monospace" }}>{tr.fee}</span>
          </div>
        ))}
        <div style={{ marginTop: 10, background: "rgba(61,156,245,0.06)", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, color: "#555577" }}>{t.mockupTransfBalance}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", fontFamily: "JetBrains Mono, monospace" }}>−€29M</span>
        </div>
      </div>
    </div>
  );
}

function FinMockup({ t }: { t: Record<string, string> }) {
  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(61,156,245,0.2)" }}>
      <div style={{ background: "#13131f", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 9, color: "#3d9cf5" }}>{t.mockupFinLabel}</span>
      </div>
      <div style={{ padding: "10px 12px" }}>
        {[
          { l: t.mockupFinBudget,   v: "€180M",    c: "#f0f0ff" },
          { l: t.mockupFinSalary,   v: "€62M/ano", c: "#f59e0b" },
          { l: t.mockupFinRevenue,  v: "+€24M",    c: "#00e5a0" },
          { l: t.mockupFinMarket,   v: "€1.2B",    c: "#7c5cfc" },
        ].map(r => (
          <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: 10, color: "#555577" }}>{r.l}</span>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: r.c }}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrofeusMockup({ t }: { t: Record<string, string> }) {
  const trophies = [
    { name: "La Liga", year: "2026", img: "🏆", color: "#f59e0b" },
    { name: "Copa del Rey", year: "2025", img: "🥇", color: "#f59e0b" },
    { name: "Champions League", year: "2024", img: "⭐", color: "#f59e0b" },
  ];
  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(245,158,11,0.2)" }}>
      <div style={{ background: "#13131f", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 9, color: "#f59e0b" }}>{t.mockupTrophiesLabel}</span>
      </div>
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {trophies.map(tr => (
          <div key={tr.name} style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>{tr.img}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f0f0ff" }}>{tr.name}</div>
              <div style={{ fontSize: 9, color: "#f59e0b" }}>{t.mockupTrophiesSeason} {tr.year}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIMockup({ t }: { t: Record<string, string> }) {
  return (
    <div style={{ background: "#0a0a10", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,229,160,0.2)" }}>
      <div style={{ background: "#111119", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#00e5a0", fontFamily: "JetBrains Mono, monospace" }}>{t.aiNewsMastheadTitle}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00e5a0", display: "inline-block", animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 8, color: "#00e5a0" }}>{t.mockupAILive}</span>
        </span>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#f0f0ff", textTransform: "uppercase", letterSpacing: "0.02em", lineHeight: 1.3, marginBottom: 8 }}>
          {t.mockupAIHeadline}
        </div>
        <p style={{ fontSize: 10, color: "#8888aa", lineHeight: 1.6 }}>{t.mockupAIBody}</p>
        <div style={{ marginTop: 10, display: "flex", gap: 4 }}>
          {["#Barcelona","#LaLiga","#Lewandowski"].map(tag => (
            <span key={tag} style={{ fontSize: 8, color: "#00e5a0", background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)", borderRadius: 20, padding: "2px 8px" }}>{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiretoriaMockup({ t }: { t: Record<string, string> }) {
  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(124,92,252,0.2)" }}>
      <div style={{ background: "#13131f", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 9, color: "#7c5cfc" }}>{t.mockupDirLabel}</span>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(124,92,252,0.15)", border: "1px solid rgba(124,92,252,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 16 }}>👔</span>
          </div>
          <div style={{ background: "rgba(124,92,252,0.07)", borderRadius: "0 12px 12px 12px", padding: "8px 12px", border: "1px solid rgba(124,92,252,0.12)" }}>
            <p style={{ fontSize: 10, color: "#c0c0d0", lineHeight: 1.5 }}>{t.mockupDirQuote}</p>
          </div>
        </div>
        <div style={{ background: "rgba(0,229,160,0.06)", borderRadius: 8, padding: "8px 10px", border: "1px solid rgba(0,229,160,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#555577" }}>{t.mockupDirConfidence}</span>
          <div style={{ display: "flex", gap: 2 }}>
            {[1,2,3,4,5].map(s => <div key={s} style={{ width: 14, height: 6, borderRadius: 2, background: s <= 4 ? "#00e5a0" : "rgba(255,255,255,0.08)" }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Interactive Demo Section ───────────────────────────── */
const DEMO_TABS: { tab: string; label: { pt: string; en: string }; icon: string }[] = [
  { tab: "painel",    label: { pt: "Painel",    en: "Dashboard" }, icon: "📊" },
  { tab: "noticias",  label: { pt: "Notícias",  en: "News"      }, icon: "📰" },
  { tab: "diretoria", label: { pt: "Diretoria", en: "Board"     }, icon: "🤝" },
];

const DEMO_COPY = {
  pt: {
    eyebrow:   "DEMO INTERATIVA",
    title:     "Experimente sem cadastro",
    sub:       "Carreira real do Watford FC na Championship — acesse cada seção e veja o app em ação.",
    loadLabel: "Carregar demo",
    loading:   "Carregando…",
    notice:    "Modo somente leitura · Dados reais do fundador",
  },
  en: {
    eyebrow:   "INTERACTIVE DEMO",
    title:     "Try it without signing up",
    sub:       "Real Watford FC career in the Championship — explore every section and see the app in action.",
    loadLabel: "Load demo",
    loading:   "Loading…",
    notice:    "Read-only mode · Founder's real data",
  },
};

function InteractiveDemoSection({ lang }: { lang: Lang }) {
  const c = DEMO_COPY[lang];
  const [activeTab, setActiveTab] = useState("painel");
  const [loaded,    setLoaded]    = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const iframeRef  = useRef<HTMLIFrameElement>(null);

  const buildSrc = useCallback((tab: string) =>
    `${window.location.origin}/?demo=true&tab=${tab}`, []);

  const handleTabClick = useCallback((tab: string) => {
    setActiveTab(tab);
    if (loaded && iframeRef.current) {
      iframeRef.current.src = buildSrc(tab);
      setLoaded(false);
    }
  }, [loaded, buildSrc]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  const triggerLoad = useCallback(() => {
    if (!iframeSrc) {
      setIframeSrc(buildSrc(activeTab));
    }
  }, [iframeSrc, activeTab, buildSrc]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        triggerLoad();
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [triggerLoad]);

  return (
    <section
      ref={sectionRef}
      id="demo"
      style={{ background: "linear-gradient(180deg,#09090f 0%,#0b0c1a 100%)", padding: "90px 0 80px", position: "relative", overflow: "hidden" }}
    >
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 55% at 50% 30%, rgba(124,92,252,0.07) 0%, transparent 70%)" }} />
      <div className="lp-section-inner" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 40px", position: "relative" }}>
        <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(245,158,11,0.75)", marginBottom: 12 }}>{c.eyebrow}</div>
          <h2 style={{ fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, color: "#ffffff", lineHeight: 1.15, margin: "0 0 14px", letterSpacing: "-0.02em" }}>
            {c.title}
          </h2>
          <p style={{ fontSize: "clamp(13px,1.6vw,16px)", color: "rgba(255,255,255,0.45)", maxWidth: 540, margin: "0 auto 28px" }}>{c.sub}</p>

          {/* Tab buttons */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            {DEMO_TABS.map(({ tab, label, icon }) => {
              const active = tab === activeTab;
              return (
                <button
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "9px 20px", borderRadius: 30,
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    border: active ? "1px solid rgba(124,92,252,0.5)" : "1px solid rgba(255,255,255,0.1)",
                    background: active ? "rgba(124,92,252,0.18)" : "rgba(255,255,255,0.04)",
                    color: active ? "#c4b5fd" : "rgba(255,255,255,0.45)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span style={{ fontSize: 15 }}>{icon}</span>
                  {label[lang]}
                </button>
              );
            })}
          </div>
        </div>

        {/* iframe wrapper */}
        <div
          style={{
            position: "relative",
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid rgba(124,92,252,0.18)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
            background: "#09090f",
          }}
        >
          {/* Browser chrome bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["#ff5f57","#ffbd2e","#28c840"].map(c2 => (
                <div key={c2} style={{ width: 10, height: 10, borderRadius: "50%", background: c2 }} />
              ))}
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 22, display: "flex", alignItems: "center", paddingLeft: 10 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.02em" }}>
                fc-career-manager.app · Demo
              </span>
            </div>
          </div>

          {/* iframe area */}
          <div style={{ position: "relative", width: "100%", height: "clamp(420px,56vw,640px)" }}>
            {!iframeSrc ? (
              <div
                style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, cursor: "pointer" }}
                onClick={triggerLoad}
              >
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(124,92,252,0.15)", border: "2px solid rgba(124,92,252,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(124,92,252,0.9)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{c.loadLabel}</span>
              </div>
            ) : (
              <>
                {!loaded && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, background: "#09090f" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(124,92,252,0.8)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{c.loading}</span>
                    </div>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  src={iframeSrc}
                  onLoad={handleLoad}
                  title="FC Career Manager Demo"
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    display: "block",
                    opacity: loaded ? 1 : 0,
                    transition: "opacity 0.4s ease",
                  }}
                  allow="autoplay"
                />
              </>
            )}
          </div>
        </div>

        {/* Notice */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em" }}>{c.notice}</span>
        </div>
      </div>
    </section>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export function LandingPage({ onStart, onLogin, onStartWithPlan, lang, setLang }: LandingPageProps) {
  const t = LP[lang];
  const AI_TEXTS_DATA = getAiTexts(lang);
  const steps = getSteps(lang);
  const faqItems = getFaqItems(lang);
  const featuresExplorer = getFeaturesExplorer(lang);
  const testimonials = getTestimonials(lang);

  const containerRef  = useRef<HTMLDivElement>(null);
  const cursor1Ref    = useRef<HTMLDivElement>(null);
  const cursor2Ref    = useRef<HTMLDivElement>(null);
  const navbarRef     = useRef<HTMLDivElement>(null);
  const stepLineRef   = useRef<HTMLDivElement>(null);
  const audioRef      = useRef<HTMLAudioElement | null>(null);

  const [activeClub, setActiveClub]           = useState(0);
  const [isMobile, setIsMobile]               = useState(() => typeof window !== "undefined" && window.innerWidth < 900);
  const [typedText, setTypedText]             = useState("");
  const [typingDone, setTypingDone]           = useState(false);
  const [aiTextIdx, setAiTextIdx]             = useState(0);
  const [activeFeature, setActiveFeature]     = useState(0);
  const [faqOpen, setFaqOpen]                 = useState<number | null>(null);
  const [soundOn, setSoundOn]                 = useState(false);
  const [liveCount, setLiveCount]             = useState(getLiveCoaches);
  const [customClubInput, setCustomClubInput] = useState("");
  const [customClub, setCustomClub]           = useState<{ primary: string; secondary: string; accentRgb: string } | null>(null);
  const [customClubName, setCustomClubName]   = useState("");
  const [clubNotFound, setClubNotFound]       = useState(false);
  const [userClub, setUserClub]               = useState("");
  const [userResult, setUserResult]           = useState("");
  const [generatedNews, setGeneratedNews]     = useState<{ headline: string; body: string } | null>(null);
  const [homeScore, setHomeScore]             = useState(2);
  const [awayScore, setAwayScore]             = useState(1);

  const inputText = customClubInput.trim();
  const club = (() => {
    if (inputText.length >= 2) {
      if (customClub && customClubName) {
        return { ...CLUBS[activeClub], accent: customClub.primary, accentRgb: customClub.accentRgb, secondary: customClub.secondary, name: customClubName, league: "" };
      }
      const fb = hashAccent(inputText);
      return { ...CLUBS[activeClub], accent: fb.accent, accentRgb: fb.accentRgb, secondary: fb.secondary, name: inputText, league: "" };
    }
    return { ...CLUBS[activeClub], secondary: "#888899" };
  })();

  /* ── Live coaches counter ─── */
  useEffect(() => {
    const tmr = setInterval(() => setLiveCount(getLiveCoaches()), 45000);
    return () => clearInterval(tmr);
  }, []);

  /* ── Mobile detection ─── */
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ── Context-aware cursor ─── */
  useEffect(() => {
    const m  = { x: 0, y: 0 };
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => { m.x = e.clientX; m.y = e.clientY; };
    window.addEventListener("mousemove", onMove, { passive: true });

    let raf: number;
    const tick = () => {
      p1.x += (m.x - p1.x) * 0.18; p1.y += (m.y - p1.y) * 0.18;
      p2.x += (m.x - p2.x) * 0.08; p2.y += (m.y - p2.y) * 0.08;
      if (cursor1Ref.current) cursor1Ref.current.style.transform = `translate(${p1.x - 8}px,${p1.y - 8}px)`;
      if (cursor2Ref.current) cursor2Ref.current.style.transform = `translate(${p2.x - 22}px,${p2.y - 22}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  /* ── Scroll-reveal intersection observer ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const els = container.querySelectorAll<HTMLElement>(".lp-reveal, .lp-reveal-left, .lp-reveal-right");
    if (!els.length) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).classList.add("lp-visible");
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0, rootMargin: "0px 0px -40px 0px" });
    els.forEach(el => {
      if (!el.classList.contains("lp-visible")) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [lang]);

  /* ── Step line animation on scroll ─── */
  useEffect(() => {
    const line = stepLineRef.current;
    if (!line) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        line.style.transition = "width 1.4s cubic-bezier(0.4,0,0.2,1)";
        line.style.width = "100%";
        obs.disconnect();
      }
    }, { threshold: 0.4 });
    obs.observe(line);
    return () => obs.disconnect();
  }, []);

  /* ── Parallax ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      const y = container.scrollTop;
      const l1 = container.querySelector<HTMLElement>("#parallax-layer-1");
      const l2 = container.querySelector<HTMLElement>("#parallax-layer-2");
      if (l1) l1.style.transform = `translateY(${y * 0.18}px)`;
      if (l2) l2.style.transform = `translateY(${y * 0.09}px)`;
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Typing effect (AI texts) ─── */
  useEffect(() => {
    const full = AI_TEXTS_DATA[aiTextIdx].headline + "\n\n" + AI_TEXTS_DATA[aiTextIdx].body;
    let i = 0;
    setTypedText("");
    setTypingDone(false);
    const interval = setInterval(() => {
      i++;
      setTypedText(full.slice(0, i));
      if (i >= full.length) { setTypingDone(true); clearInterval(interval); }
    }, 38);
    const rotateTimer = setTimeout(() => {
      setAiTextIdx(prev => (prev + 1) % AI_TEXTS_DATA.length);
    }, full.length * 38 + 3200);
    return () => { clearInterval(interval); clearTimeout(rotateTimer); };
  }, [aiTextIdx, lang]);

  /* ── Club color picker (400ms debounce) ─── */
  useEffect(() => {
    if (!customClubInput.trim()) { setCustomClub(null); setCustomClubName(""); setClubNotFound(false); return; }
    const timer = setTimeout(() => {
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const key = normalize(customClubInput.trim());
      const entry = Object.entries(CLUBS_DB).find(([name]) => normalize(name).includes(key));
      if (entry) {
        setCustomClub(entry[1]);
        setCustomClubName(entry[0].replace(/\b\w/g, c => c.toUpperCase()));
        setClubNotFound(false);
      } else {
        setCustomClub(null);
        setCustomClubName("");
        setClubNotFound(true);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [customClubInput]);

  /* ── Sound toggle ─── */
  const toggleSound = useCallback(() => {
    if (!audioRef.current) {
      const a = new Audio("/sounds/crowd.mp3");
      a.loop   = true;
      a.volume = 0.45;
      audioRef.current = a;
    }
    if (!soundOn) {
      audioRef.current.volume = 0.45;
      audioRef.current.play()
        .then(() => setSoundOn(true))
        .catch((err) => {
          console.warn("Audio play failed:", err);
          setSoundOn(false);
        });
    } else {
      audioRef.current.pause();
      setSoundOn(false);
    }
  }, [soundOn]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  /* ── Generate news ─── */
  const generateNews = () => {
    const c = userClub.trim() || (lang === "en" ? "your club" : "seu clube");
    const s = userResult.trim() || "2–1";
    const headlineTemplates = getHeadlineTemplates(lang);
    const bodyTemplates = getBodyTemplates(lang);
    const hi = Math.floor(Math.random() * headlineTemplates.length);
    const bi = Math.floor(Math.random() * bodyTemplates.length);
    setGeneratedNews({ headline: headlineTemplates[hi](c, s), body: bodyTemplates[bi](c) });
  };

  const scrollTo = (id: string) => {
    const el = containerRef.current?.querySelector(`#${id}`);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  /* ── Feature mockup renderer ─── */
  const renderMockup = (id: string) => {
    switch (id) {
      case "painel":    return <PainelMockup t={t} />;
      case "partidas":  return <PartidaMockup homeScore={homeScore} awayScore={awayScore} onChangeHome={d => setHomeScore(p => Math.max(0, p + d))} onChangeAway={d => setAwayScore(p => Math.max(0, p + d))} t={t} />;
      case "elenco":    return <ElencoMockup t={t} />;
      case "transferencias": return <TranfMockup t={t} />;
      case "financeiro": return <FinMockup t={t} />;
      case "trofeus":   return <TrofeusMockup t={t} />;
      case "noticias":  return <AIMockup t={t} />;
      case "diretoria": return <DiretoriaMockup t={t} />;
      default:          return null;
    }
  };

  const activeF = featuresExplorer[Math.max(0, activeFeature)];

  return (
    <div ref={containerRef} className="font-dm" style={{ background: "#09090f", height: "100%", overflowY: "auto", overflowX: "hidden", scrollBehavior: "smooth", cursor: isMobile ? "auto" : "none" }}>

      {/* ── Custom cursors (desktop only) ─── */}
      {!isMobile && (
        <>
          <div ref={cursor1Ref} className="lp-cursor-dot" style={{ transform: "translate(-99px,-99px)" }}>
            <span className="lp-ball-icon">⚽</span>
            <span className="lp-ball-default" />
          </div>
          <div ref={cursor2Ref} className="lp-cursor-ring" style={{ transform: "translate(-99px,-99px)" }} />
        </>
      )}

      {/* ── Sound button (fixed) ─── */}
      <button
        onClick={toggleSound}
        title={soundOn ? t.soundOn : t.soundOff}
        style={{ position: "fixed", bottom: 28, right: 28, zIndex: 200, width: 44, height: 44, borderRadius: "50%", background: "rgba(9,9,15,0.85)", border: `1px solid ${soundOn ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.12)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "none", backdropFilter: "blur(10px)", boxShadow: soundOn ? "0 0 20px rgba(245,158,11,0.25)" : "0 4px 20px rgba(0,0,0,0.4)", transition: "all 0.3s" }}
      >
        {soundOn ? "🔊" : "🔇"}
      </button>

      {/* ════════════════ NAVBAR ════════════════ */}
      <nav ref={navbarRef} className="lp-navbar" style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", borderBottom: "1px solid transparent", transition: "backdrop-filter 0.3s, border-color 0.3s", background: "rgba(9,9,15,0.8)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="FC Career Manager" style={{ width: 34, height: 34, objectFit: "contain" }} />
          <span style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>FC Career Manager</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {[{ label: t.navFeatures, id: "features" }, { label: t.navAI, id: "ia" }, { label: t.navClub, id: "clube" }, { label: t.navHowItWorks, id: "como-funciona" }].map(({ label, id }) => (
            <a key={id} href={`#${id}`} onClick={e => { e.preventDefault(); scrollTo(id); }} className="hidden md:block" style={{ color: "#666688", fontSize: 13, textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "#f0f0ff")} onMouseLeave={e => (e.currentTarget.style.color = "#666688")}>{label}</a>
          ))}

          {/* ── Language toggle ─── */}
          <LangToggle lang={lang} setLang={setLang} />

          <button data-cursor="ball" onClick={onLogin} style={{ background: "linear-gradient(135deg,#7c5cfc,#5b3fd1)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", minHeight: 44, fontSize: 13, fontWeight: 600, cursor: "none", transition: "all 0.25s", boxShadow: "0 4px 20px rgba(124,92,252,0.3)" }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 30px rgba(124,92,252,0.6)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px) scale(1.03)"; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(124,92,252,0.3)"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
            {t.navCta}
          </button>
        </div>
      </nav>

      {/* ════════════════ HERO ════════════════ */}
      <section className="lp-hero-section" style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", overflow: "hidden", padding: "60px 40px" }}>
        <div id="parallax-layer-1" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.035 }}>
          <svg viewBox="0 0 1200 700" fill="none" stroke="white" strokeWidth={1} preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%" }}>
            <rect x="100" y="50" width="1000" height="600" />
            <line x1="600" y1="50" x2="600" y2="650" />
            <circle cx="600" cy="350" r="90" />
            <circle cx="600" cy="350" r="4" fill="white" />
            <rect x="100" y="230" width="160" height="240" />
            <rect x="940" y="230" width="160" height="240" />
          </svg>
        </div>
        <div id="parallax-layer-2" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.028 }}>
          <svg viewBox="0 0 1200 700" fill="none" stroke="rgba(245,158,11,1)" strokeWidth={1.5} preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%" }}>
            <line x1="600" y1="200" x2="600" y2="500" />
            <circle cx="600" cy="350" r="60" />
          </svg>
        </div>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 700px 550px at 65% 40%, rgba(124,92,252,0.09) 0%, transparent 70%), radial-gradient(ellipse 400px 300px at 22% 65%, rgba(245,158,11,0.04) 0%, transparent 60%)", pointerEvents: "none" }} />
        <ParticleCanvas />

        <div className="lp-hero-split lp-hero-gap" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 60 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-bebas" style={{ lineHeight: 0.9, marginBottom: 24, animation: "heroGlitch 0.35s ease 0.4s 1 both" }}>
              <div style={{ fontSize: "clamp(2.4rem,4.5vw,4.2rem)", color: "#f0f0ff", animation: "landingSlideUp 0.9s ease 0.1s both" }}>{t.heroLine1}</div>
              <div style={{ fontSize: "clamp(2.4rem,4.5vw,4.2rem)", background: "linear-gradient(135deg,#7c5cfc,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "landingSlideUp 0.9s ease 0.35s both" }}>{t.heroLine2}</div>
            </div>

            <p style={{ color: "#8888aa", fontSize: 15, lineHeight: 1.75, maxWidth: 440, marginBottom: 32, animation: "landingFadeIn 1s ease 0.7s both" }}>
              {t.heroDesc}
            </p>

            <div className="lp-hero-ctas" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 40, animation: "landingFadeIn 1s ease 0.9s both" }}>
              <button data-cursor="ball" onClick={onLogin}
                style={{ background: "linear-gradient(135deg,#7c5cfc,#5b3fd1)", color: "#fff", border: "none", borderRadius: 14, padding: "15px 56px", fontSize: 15, fontWeight: 700, cursor: "none", boxShadow: "0 8px 32px rgba(124,92,252,0.45)", transition: "all 0.25s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 50px rgba(124,92,252,0.7), 0 8px 32px rgba(124,92,252,0.5)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px) scale(1.03)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 32px rgba(124,92,252,0.45)"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
                {t.heroCta}
              </button>
            </div>

            <div style={{ animation: "landingFadeIn 1s ease 1.1s both" }}>
              <div className="lp-hero-counter" style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 12, padding: "14px 20px", maxWidth: 340 }}>
                <div>
                  <SplitFlap value={liveCount} lang={lang} />
                </div>
                <div>
                  <div style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>{t.heroCoachesLabel}</div>
                  <div style={{ color: "#444466", fontSize: 10 }}>{t.heroCoachesSub}</div>
                </div>
                <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "#00e5a0", boxShadow: "0 0 8px #00e5a0", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
              </div>
            </div>
          </div>

          <div className="lg-mockup" style={{ width: 380, flexShrink: 0, display: "flex", justifyContent: "center" }}>
            <HeroReelsMockup lang={lang} />
          </div>
        </div>
      </section>

      {/* ════════════════ INTERACTIVE DEMO ════════════════ */}
      <InteractiveDemoSection lang={lang} />

      {/* ════════════════ LEAGUE MARQUEE ════════════════ */}
      <div style={{ background: "#0d0820", borderTop: "1px solid rgba(245,158,11,0.2)", borderBottom: "1px solid rgba(245,158,11,0.2)", padding: "14px 0", overflow: "hidden", position: "relative" }}>
        <div style={{ display: "flex", animation: "marqueeScroll 28s linear infinite", width: "max-content" }}>
          {[...LEAGUES, ...LEAGUES].map((lg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 32px", whiteSpace: "nowrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(245,158,11,0.5)", display: "inline-block" }} />
              <span style={{ color: "#555577", fontSize: 12, fontWeight: 500, letterSpacing: "0.04em" }}>{lg.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════ FEATURE EXPLORER ════════════════ */}
      <section id="features" className="lp-section-v" style={{ padding: "100px 0", background: "#09090f" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
          <div className="lp-reveal" style={{ marginBottom: 56, textAlign: "center" }}>
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>{t.featuresLabel}</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2.5rem,5vw,4rem)", color: "#f0f0ff", lineHeight: 1 }}>{t.featuresTitle}</h2>
          </div>

          {isMobile ? (
            <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden" }}>
              {featuresExplorer.map((f, i) => {
                const open = activeFeature === i;
                const accentRaw = f.colorType === "tactical" ? "124,92,252" : f.colorType === "financial" ? "61,156,245" : f.colorType === "trophies" ? "245,158,11" : "0,229,160";
                return (
                  <div key={f.id} style={{ borderBottom: i < featuresExplorer.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                    <button
                      onClick={() => setActiveFeature(open ? -1 : i)}
                      style={{ width: "100%", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: open ? `rgba(${accentRaw},0.07)` : "transparent", border: "none", cursor: "pointer", transition: "background 0.25s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: open ? f.accentColor : "rgba(255,255,255,0.2)", transition: "background 0.2s" }} />
                        <span style={{ fontSize: 13, fontWeight: open ? 600 : 400, color: open ? "#f0f0ff" : "#666688", transition: "color 0.2s" }}>{f.label}</span>
                      </div>
                      <span style={{ color: open ? f.accentColor : "#444466", fontSize: 20, fontWeight: 300, lineHeight: 1, transition: "transform 0.3s, color 0.2s", transform: open ? "rotate(45deg)" : "rotate(0deg)", display: "inline-block" }}>+</span>
                    </button>
                    <div style={{ maxHeight: open ? 620 : 0, overflow: "hidden", transition: "max-height 0.45s cubic-bezier(0.4,0,0.2,1)" }}>
                      <div style={{ padding: "4px 20px 20px" }}>
                        <p style={{ color: "#8888aa", fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>{f.desc}</p>
                        {renderMockup(f.id)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 0, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden", minHeight: 420 }}>
              <div style={{ width: 200, flexShrink: 0, background: "#0d0d1a", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {featuresExplorer.map((f, i) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFeature(i)}
                    className={`lp-explorer-sidebar-item${i === activeFeature ? " active" : ""}`}
                    style={{
                      padding: "14px 18px", textAlign: "left", border: "none", background: "transparent",
                      borderLeft: `3px solid ${i === activeFeature ? f.accentColor : "transparent"}`,
                      cursor: "none", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 10,
                      color: i === activeFeature ? "#f0f0ff" : "#555577",
                      backgroundColor: i === activeFeature ? `rgba(${f.colorType === "tactical" ? "124,92,252" : f.colorType === "financial" ? "61,156,245" : f.colorType === "trophies" ? "245,158,11" : "0,229,160"},0.06)` : "transparent",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: i === activeFeature ? f.accentColor : "rgba(255,255,255,0.15)", flexShrink: 0, transition: "all 0.2s" }} />
                    <span style={{ fontSize: 12, fontWeight: i === activeFeature ? 600 : 400 }}>{f.label}</span>
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, padding: "36px 40px", background: "transparent", display: "flex", gap: 40, alignItems: "flex-start", overflow: "hidden" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: activeF.accentColor }}>
                      {activeF.label}
                    </span>
                  </div>
                  <h3 style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 22, marginBottom: 14, lineHeight: 1.3 }}>{activeF.title}</h3>
                  <p style={{ color: "#8888aa", fontSize: 14, lineHeight: 1.75, maxWidth: 340 }}>{activeF.desc}</p>

                  <div style={{ display: "flex", gap: 6, marginTop: 32 }}>
                    {featuresExplorer.map((_, i) => (
                      <button key={i} onClick={() => setActiveFeature(i)} style={{ width: i === activeFeature ? 20 : 6, height: 6, borderRadius: 3, background: i === activeFeature ? activeF.accentColor : "rgba(255,255,255,0.12)", border: "none", cursor: "none", transition: "all 0.3s", padding: 0 }} />
                    ))}
                  </div>
                </div>

                <div style={{ width: 300, flexShrink: 0 }}>
                  {renderMockup(activeF.id)}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════ CLUB THEME ════════════════ */}
      <section id="clube" className="lp-section-v" style={{ position: "relative", overflow: "hidden", padding: "80px 0 64px", transition: "background 0.8s ease", background: `radial-gradient(ellipse 120% 100% at 50% 60%, rgba(${club.accentRgb},0.09) 0%, #09090f 55%)` }}>
        <div className="lp-section-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 32 }}>
            <p style={{ color: club.accent, fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12, transition: "color 0.5s" }}>{t.customizationLabel}</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2rem,4vw,3.2rem)", color: "#f0f0ff", lineHeight: 1 }}>{t.customizationTitle}</h2>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            {CLUBS.map((c, i) => {
              const isActive = i === activeClub && !customClub;
              return (
                <button key={c.id} onClick={() => { setActiveClub(i); setCustomClub(null); setCustomClubName(""); setCustomClubInput(""); }}
                  style={{ padding: "10px 22px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "none", transition: "all 0.3s", background: isActive ? `rgba(${c.accentRgb},0.15)` : "rgba(255,255,255,0.05)", border: isActive ? `1px solid rgba(${c.accentRgb},0.5)` : "1px solid rgba(255,255,255,0.08)", color: isActive ? (c.textDark ? "#111" : c.accent) : "#666688", transform: isActive ? "scale(1.05)" : "scale(1)" }}>
                  <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: c.accent, marginRight: 7, verticalAlign: "middle" }} />
                  {c.name}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <div style={{ position: "relative", width: 280 }}>
              <input
                placeholder={t.clubInputPlaceholder}
                value={customClubInput}
                onChange={e => setCustomClubInput(e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${customClub ? `rgba(${customClub.accentRgb},0.4)` : clubNotFound ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 100, padding: "10px 20px", color: "#f0f0ff", fontSize: 13, outline: "none", fontFamily: "DM Sans, sans-serif", transition: "all 0.3s", cursor: "text" }}
              />
              {customClub && (
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: customClub.primary, boxShadow: `0 0 8px ${customClub.primary}` }} />
              )}
              {clubNotFound && customClubInput.length > 2 && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#1a1a2e", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 11, color: "#666688" }}>
                  {t.clubNotFound}
                </div>
              )}
            </div>
          </div>

          <div style={{ position: "relative", maxWidth: 900, margin: "0 auto" }}>
            <div style={{ transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)" }} onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.015)"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}>
              <div className="mockup-glow-pulse" style={{ '--mg-rgb': club.accentRgb, borderRadius: 20, overflow: "hidden", transition: "box-shadow 0.6s ease" } as CSSProperties}>
                <div style={{ background: "#080810", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid rgba(${club.accentRgb},0.12)` }}>
                  {[1,2,3].map(d => <span key={d} style={{ width: 12, height: 12, borderRadius: "50%", background: "#1a1a1a" }} />)}
                  <div style={{ flex: 1, height: 24, borderRadius: 6, background: "#111118", margin: "0 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#333355", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>fc-career-manager.replit.app</span>
                  </div>
                  <div style={{ background: `rgba(${club.accentRgb},0.12)`, border: `1px solid rgba(${club.accentRgb},0.28)`, borderRadius: 6, padding: "3px 12px", display: "flex", alignItems: "center", gap: 6, transition: "all 0.5s" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: club.accent, transition: "background 0.5s" }} />
                    <span style={{ color: club.accent, fontSize: 11, fontWeight: 600, transition: "color 0.5s" }}>{club.league || club.name}</span>
                  </div>
                </div>
                <ClubDemoMockup
                  clubName={club.name}
                  leagueName={club.league}
                  accent={club.accent}
                  accentRgb={club.accentRgb}
                  secondary={club.secondary}
                  lang={lang}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 20 }}>
              {CLUBS.map((c, i) => (
                <button key={c.id} onClick={() => { setActiveClub(i); setCustomClub(null); setCustomClubName(""); setCustomClubInput(""); }}
                  style={{ width: 12, height: 12, borderRadius: "50%", background: c.accent, cursor: "none", border: i === activeClub && !customClub ? `2px solid ${c.accent}` : "2px solid transparent", outline: i === activeClub && !customClub ? `3px solid rgba(${c.accentRgb},0.35)` : "none", transform: i === activeClub && !customClub ? "scale(1.4)" : "scale(1)", transition: "all 0.3s" }}
                  title={c.name} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ AI SECTION ════════════════ */}
      <section id="ia" className="lp-section" style={{ position: "relative", overflow: "hidden", padding: "100px 40px", background: "#0f0e0a" }}>
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <filter id="paper-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>
        <div style={{ position: "absolute", inset: 0, filter: "url(#paper-noise)", opacity: 0.04, pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 900px 280px at 50% -8%, rgba(255,210,80,0.07) 0%, transparent 60%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "flex-start" }} className="lp-ai-grid">
          <div className="lp-reveal-left">
            <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>{t.aiLabel}</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2.2rem,4vw,3.6rem)", color: "#f0f0ff", lineHeight: 1.05, marginBottom: 28 }}>{t.aiTitle}</h2>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 16, marginBottom: 36 }}>
              {[t.aiPoint1, t.aiPoint2, t.aiPoint3, t.aiPoint4].map(item => (
                <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    <svg viewBox="0 0 10 10" style={{ width: 8, height: 8 }}><path d="M1 5l3 3 5-6" stroke="#f59e0b" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span style={{ color: "#888899", fontSize: 14, lineHeight: 1.65 }}>{item}</span>
                </li>
              ))}
            </ul>

            <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 14, padding: "20px 22px" }}>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>{t.aiGenLabel}</p>
              <div className="lp-ai-inputs" style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <input placeholder={t.aiGenClubPlaceholder} value={userClub} onChange={e => setUserClub(e.target.value)} style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#f0f0ff", fontSize: 12, outline: "none", fontFamily: "DM Sans, sans-serif", cursor: "text", transition: "border-color 0.2s" }} onFocus={e => (e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)")} onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")} />
                <input placeholder={t.aiGenResultPlaceholder} value={userResult} onChange={e => setUserResult(e.target.value)} style={{ width: 130, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#f0f0ff", fontSize: 12, outline: "none", fontFamily: "JetBrains Mono, monospace", cursor: "text", transition: "border-color 0.2s" }} onFocus={e => (e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)")} onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")} />
              </div>
              <button data-cursor="ball" onClick={generateNews} style={{ width: "100%", background: "linear-gradient(135deg,rgba(245,158,11,0.85),rgba(200,110,0,0.8))", border: "none", borderRadius: 8, padding: "10px 0", color: "#09090f", fontSize: 13, fontWeight: 700, cursor: "none", transition: "opacity 0.2s" }} onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")} onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}>
                {t.aiGenBtn}
              </button>
              {generatedNews && (
                <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(0,0,0,0.4)", borderRadius: 10, borderLeft: "2px solid rgba(245,158,11,0.6)" }}>
                  <p style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8, lineHeight: 1.4 }}>{generatedNews.headline}</p>
                  <p style={{ color: "#777788", fontSize: 11, lineHeight: 1.65 }}>{generatedNews.body}</p>
                </div>
              )}
            </div>
          </div>

          <div className="lp-reveal-right">
            <div style={{ background: "#0a0a10", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 18, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(245,158,11,0.05)" }}>
              <div style={{ background: "#111119", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={1.5} style={{ width: 15, height: 15 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" /></svg>
                  <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>{t.aiNewsMastheadTitle}</span>
                </div>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5a0", animation: "pulse 1.5s ease-in-out infinite" }} />
                  <span style={{ color: "#00e5a0", fontSize: 10 }}>{t.aiNewsLive}</span>
                </div>
              </div>
              <div style={{ padding: "24px 24px", minHeight: 220 }}>
                {typedText.split("\n\n").map((block, bi) => (
                  <p key={bi} style={{ color: bi === 0 ? "#f0f0ff" : "#777788", fontSize: bi === 0 ? 14 : 13, fontWeight: bi === 0 ? 700 : 400, lineHeight: bi === 0 ? 1.4 : 1.72, marginBottom: 14, textTransform: bi === 0 ? "uppercase" : "none", letterSpacing: bi === 0 ? "0.02em" : 0, fontFamily: bi === 0 ? '"Bebas Neue", Impact, sans-serif' : '"DM Sans", sans-serif' }}>{block}</p>
                ))}
                {!typingDone && <span style={{ display: "inline-block", width: 2, height: 15, background: "#f59e0b", animation: "typewriterBlink 0.8s ease-in-out infinite", verticalAlign: "middle" }} />}
              </div>
              <div style={{ padding: "12px 24px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 8 }}>
                {AI_TEXTS_DATA.map((_, i) => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i === aiTextIdx ? "#f59e0b" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ HOW IT WORKS ════════════════ */}
      <section id="como-funciona" className="lp-section" style={{ padding: "100px 40px", background: "#09090f" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 72 }}>
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>{t.howLabel}</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2.5rem,5vw,4rem)", color: "#f0f0ff" }}>{t.howTitle}</h2>
          </div>
          <div style={{ position: "relative" }}>
            <div className="lp-steps-line" style={{ position: "absolute", top: 36, left: "12.5%", right: "12.5%", height: 1, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
              <div ref={stepLineRef} style={{ height: "100%", background: "linear-gradient(90deg,#7c5cfc,#f59e0b)", width: "0%", transition: "width 0s" }} />
            </div>
            <div className="lp-steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, position: "relative" }}>
              {steps.map((step, i) => (
                <div key={i} className={`lp-reveal lp-delay-${i + 1}`} style={{ textAlign: "center", padding: "0 12px" }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#0f0f1a", border: `1px solid ${i < 2 ? "rgba(124,92,252,0.25)" : i === 2 ? "rgba(61,156,245,0.25)" : "rgba(245,158,11,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", boxShadow: `0 0 28px ${i < 2 ? "rgba(124,92,252,0.08)" : i === 2 ? "rgba(61,156,245,0.08)" : "rgba(245,158,11,0.08)"}` }}>
                    {/* Icon */}
                    {i === 0 && (
                      <svg viewBox="0 0 40 40" fill="none" style={{ width: 32, height: 32 }}>
                        <path d="M20 4 L36 13 L36 27 L20 36 L4 27 L4 13 Z" stroke="#7c5cfc" strokeWidth={1.5} fill="rgba(124,92,252,0.12)" style={{ animation: "shieldPulse 2s ease-in-out infinite" }} />
                        <path d="M13 20 L18 25 L27 16" stroke="#7c5cfc" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {i === 1 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: "JetBrains Mono, monospace", fontSize: 16, fontWeight: 700 }}>
                        <span style={{ color: "#f0f0ff" }}>2</span>
                        <div style={{ width: 1, height: 24, background: "rgba(245,158,11,0.5)", margin: "0 2px" }} />
                        <span style={{ color: "#f0f0ff" }}>1</span>
                      </div>
                    )}
                    {i === 2 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(61,156,245,0.2)", border: "1px solid rgba(61,156,245,0.5)", animation: "swapLeft 2s ease-in-out infinite" }} />
                        <svg viewBox="0 0 16 8" fill="none" style={{ width: 16 }}><path d="M1 4 L15 4 M11 1 L15 4 L11 7" stroke="#3d9cf5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(61,156,245,0.2)", border: "1px solid rgba(61,156,245,0.5)", animation: "swapRight 2s ease-in-out infinite" }} />
                      </div>
                    )}
                    {i === 3 && (
                      <svg viewBox="0 0 40 40" fill="none" style={{ width: 32, height: 32 }}>
                        <rect x="6" y="5" width="28" height="30" rx="2" stroke="#f59e0b" strokeWidth={1.2} fill="rgba(245,158,11,0.07)" />
                        <rect x="9" y="9" width="22" height="3" rx="1" fill="rgba(245,158,11,0.45)" />
                        <rect x="9" y="15" width="22" height="2" rx="0.5" fill="rgba(245,158,11,0.28)" />
                        <rect x="9" y="20" width="16" height="1.5" rx="0.5" fill="rgba(245,158,11,0.18)" />
                        <rect x="9" y="23" width="20" height="1.5" rx="0.5" fill="rgba(245,158,11,0.18)" />
                        <rect x="9" y="26" width="13" height="1.5" rx="0.5" fill="rgba(245,158,11,0.18)" />
                        <rect x="9" y="29.5" width="3" height="2.5" rx="0.4" fill="#f59e0b" style={{ animation: "typewriterBlink 0.8s infinite" }} />
                      </svg>
                    )}
                  </div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: i < 2 ? "#7c5cfc" : i === 2 ? "#3d9cf5" : "#f59e0b", fontWeight: 700, marginBottom: 12, letterSpacing: "0.1em" }}>0{i+1}</div>
                  <h3 style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 13, marginBottom: 10, lineHeight: 1.4 }}>{step.title}</h3>
                  <p style={{ color: "#666688", fontSize: 12, lineHeight: 1.7 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ PRICING ════════════════ */}
      <section id="planos" className="lp-section" style={{ padding: "100px 40px", background: "#09090f" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 64 }}>
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>{t.pricingLabel}</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2.5rem,5vw,4rem)", color: "#f0f0ff" }}>{t.pricingTitle}</h2>
          </div>
          <div className="lp-pricing-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
            {/* Free */}
            <div className="lp-reveal lp-delay-1 lp-pricing-card" style={{ background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "36px 32px" }}>
              <p style={{ color: "#666688", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>{t.pricingFreeForever}</p>
              <div className="font-bebas" style={{ fontSize: 48, color: "#f0f0ff", lineHeight: 1 }}>{t.pricingFreePriceWhole}</div>
              <p style={{ color: "#555577", fontSize: 13, marginTop: 8, marginBottom: 28 }}>{t.pricingFreeForWho}</p>
              <button onClick={onLogin} style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 14, color: "#888", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", cursor: "none", transition: "all 0.2s" }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#f0f0ff"; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "#888"; }}>
                {t.pricingFreeBtn}
              </button>
              <ul style={{ marginTop: 28, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {[t.freeFeat1, t.freeFeat2, t.freeFeat3, t.freeFeat4].map(f => (
                  <li key={f} style={{ display: "flex", gap: 10, fontSize: 13, color: "#888899" }}>
                    <span style={{ color: "#00e5a0", marginTop: 2 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro — levitating */}
            <div className="lp-reveal lp-delay-2 lp-pricing-card lp-pricing-pro" style={{ background: "#111120", border: "1px solid rgba(124,92,252,0.35)", borderRadius: 20, padding: "36px 32px", position: "relative", boxShadow: "0 24px 80px rgba(124,92,252,0.22), 0 0 0 1px rgba(124,92,252,0.15), inset 0 -1px 0 rgba(124,92,252,0.1)", transform: "translateY(-8px)" }}>
              <div style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: "60%", background: "linear-gradient(to top, rgba(124,92,252,0.1) 0%, transparent 100%)", borderRadius: "0 0 20px 20px", pointerEvents: "none" }} />
              <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#7c5cfc,#5b3fd1)", borderRadius: 20, padding: "4px 16px", fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{t.pricingProBadge}</div>
              <p style={{ color: "#7c5cfc", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>{t.pricingProForWho}</p>
              <div className="font-bebas" style={{ fontSize: 48, color: "#f0f0ff", lineHeight: 1 }}>{t.pricingProPriceWhole}<span style={{ fontSize: 24 }}>{t.pricingProPriceDec}</span></div>
              <p style={{ color: "#555577", fontSize: 13, marginTop: 8, marginBottom: 28 }}>{t.pricingPerMonth}</p>
              <button data-cursor="ball" onClick={() => onStartWithPlan("pro")} style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 14, color: "#fff", background: "linear-gradient(135deg,rgba(124,92,252,0.9),rgba(91,63,209,0.85))", border: "none", cursor: "none", boxShadow: "0 4px 24px rgba(124,92,252,0.4)", transition: "all 0.2s" }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 40px rgba(124,92,252,0.6), 0 4px 24px rgba(124,92,252,0.4)"; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 24px rgba(124,92,252,0.4)"; }}>
                {t.pricingProBtn}
              </button>
              <ul style={{ marginTop: 28, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {[t.proFeat1, t.proFeat2, t.proFeat3, t.proFeat4].map(f => (
                  <li key={f} style={{ display: "flex", gap: 10, fontSize: 13, color: "#c0c0d8" }}>
                    <span style={{ color: "#7c5cfc", marginTop: 2 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Ultra */}
            <div className="lp-reveal lp-delay-3 lp-pricing-card" style={{ background: "#0d0d1a", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 20, padding: "36px 32px" }}>
              <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>{t.pricingUltraForWho}</p>
              <div className="font-bebas" style={{ fontSize: 48, color: "#f0f0ff", lineHeight: 1 }}>{t.pricingUltraPriceWhole}<span style={{ fontSize: 24 }}>{t.pricingUltraPriceDec}</span></div>
              <p style={{ color: "#555577", fontSize: 13, marginTop: 8, marginBottom: 28 }}>{t.pricingPerMonth}</p>
              <button data-cursor="ball" onClick={() => onStartWithPlan("ultra")} style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 14, color: "#fff", background: "linear-gradient(135deg,rgba(245,158,11,0.85),rgba(200,110,0,0.8))", border: "none", cursor: "none", boxShadow: "0 4px 24px rgba(245,158,11,0.3)", transition: "all 0.2s" }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 40px rgba(245,158,11,0.5), 0 4px 24px rgba(245,158,11,0.3)"; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 24px rgba(245,158,11,0.3)"; }}>
                {t.pricingUltraBtn}
              </button>
              <ul style={{ marginTop: 28, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {[t.ultraFeat1, t.ultraFeat2, t.ultraFeat3, t.ultraFeat4, t.ultraFeat5, t.ultraFeat6].map(f => (
                  <li key={f} style={{ display: "flex", gap: 10, fontSize: 13, color: "#888899" }}>
                    <span style={{ color: "#f59e0b", marginTop: 2 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ TESTIMONIALS ════════════════ */}
      <section className="lp-section" style={{ padding: "80px 40px", background: "#0d0820", borderTop: "1px solid rgba(245,158,11,0.1)", borderBottom: "1px solid rgba(245,158,11,0.1)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 56 }}>
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>{t.testimonialsLabel}</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2rem,4vw,3.2rem)", color: "#f0f0ff" }}>{t.testimonialsTitle}</h2>
          </div>
          <div className="lp-testimonials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, alignItems: "start" }}>
            {testimonials.map((tm, i) => (
              <div key={i} className={`lp-reveal lp-delay-${i + 1}${i === 1 ? " lp-testimonial-mid" : ""}`}
                style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "28px 28px", transform: i === 1 ? "translateY(32px)" : "none" }}>
                <p style={{ color: "#c0c0d8", fontSize: 14, lineHeight: 1.72, marginBottom: 24 }}>"{tm.text}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: `rgba(${tm.color.replace("#","").match(/.{2}/g)?.map(x=>parseInt(x,16)).join(",")},0.2)`, border: `1px solid ${tm.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: tm.color }}>{tm.initials}</div>
                  <div>
                    <div style={{ color: "#f0f0ff", fontWeight: 600, fontSize: 13 }}>{tm.name}</div>
                    <div style={{ color: "#444466", fontSize: 12 }}>{tm.handle}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ FAQ ════════════════ */}
      <section className="lp-section" style={{ padding: "100px 40px", background: "#09090f" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 56 }}>
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>{t.faqLabel}</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2.5rem,5vw,4rem)", color: "#f0f0ff" }}>{t.faqTitle}</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {faqItems.map((item, i) => {
              const open = faqOpen === i;
              return (
                <div key={i} className="lp-reveal" style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden", transition: "border-color 0.3s", borderColor: open ? "rgba(124,92,252,0.25)" : "rgba(255,255,255,0.07)" }}>
                  <button
                    onClick={() => setFaqOpen(open ? null : i)}
                    style={{ width: "100%", padding: "20px 24px", background: open ? "rgba(124,92,252,0.06)" : "transparent", border: "none", cursor: "none", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.3s" }}>
                    <span style={{ color: "#f0f0ff", fontSize: 14, fontWeight: 600, textAlign: "left" }}>{item.q}</span>
                    <span style={{ color: "#7c5cfc", fontSize: 18, fontWeight: 300, transition: "transform 0.3s", transform: open ? "rotate(45deg)" : "none", flexShrink: 0, marginLeft: 16 }}>+</span>
                  </button>
                  <div style={{ maxHeight: open ? 200 : 0, overflow: "hidden", transition: "max-height 0.35s ease" }}>
                    <p style={{ padding: "0 24px 20px", color: "#777788", fontSize: 14, lineHeight: 1.75 }}>{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════ CTA FINAL ════════════════ */}
      <section className="lp-cta-section" style={{ position: "relative", overflow: "hidden", padding: "120px 40px", textAlign: "center", background: "#09090f" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", animation: "stadiumZoom 22s ease-in-out infinite alternate", opacity: 0.15 }}>
            <ellipse cx="600" cy="380" rx="560" ry="220" fill="none" stroke="rgba(124,92,252,0.4)" strokeWidth={2} />
            <ellipse cx="600" cy="380" rx="420" ry="165" fill="none" stroke="rgba(124,92,252,0.3)" strokeWidth={1.5} />
            <rect x="200" y="240" width="800" height="280" rx="20" fill="none" stroke="rgba(124,92,252,0.2)" strokeWidth={1} />
            <rect x="260" y="280" width="680" height="200" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <line x1="600" y1="280" x2="600" y2="480" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <circle cx="600" cy="380" r="55" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <circle cx="600" cy="380" r="3" fill="rgba(255,255,255,0.15)" />
            {Array.from({ length: 18 }, (_, i) => (
              <line key={i} x1={220 + i * 42} y1="240" x2={200 + i * 46} y2="180" stroke="rgba(124,92,252,0.1)" strokeWidth={0.8} />
            ))}
            {Array.from({ length: 18 }, (_, i) => (
              <line key={i} x1={220 + i * 42} y1="520" x2={200 + i * 46} y2="560" stroke="rgba(124,92,252,0.1)" strokeWidth={0.8} />
            ))}
            <ellipse cx="600" cy="380" rx="450" ry="180" fill="url(#stadiumGlow)" />
            <defs>
              <radialGradient id="stadiumGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(124,92,252,0.04)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>
          </svg>
        </div>
        <div style={{ position: "absolute", inset: 0, background: "rgba(9,9,15,0.78)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 600px 400px at 50% 60%, rgba(124,92,252,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="lp-reveal">
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 24 }}>{t.ctaLabel}</p>
            <h2 className="font-bebas lp-reveal" style={{ fontSize: "clamp(3rem,7vw,6rem)", color: "#f0f0ff", lineHeight: 0.92, marginBottom: 16 }}>
              {t.ctaLine1}
            </h2>
            <h2 className="font-bebas" style={{ fontSize: "clamp(3rem,7vw,6rem)", background: "linear-gradient(135deg,#7c5cfc,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 0.92, marginBottom: 40 }}>
              {t.ctaLine2}
            </h2>
            <button data-cursor="ball" onClick={onLogin}
              style={{ background: "linear-gradient(135deg,#7c5cfc,#5b3fd1)", color: "#fff", border: "none", borderRadius: 16, padding: "18px 48px", fontSize: 16, fontWeight: 700, cursor: "none", boxShadow: "0 12px 48px rgba(124,92,252,0.45)", transition: "all 0.25s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 60px rgba(124,92,252,0.7), 0 12px 48px rgba(124,92,252,0.5)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-4px) scale(1.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 12px 48px rgba(124,92,252,0.45)"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
              {t.ctaBtn}
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════ FOOTER ════════════════ */}
      <footer className="lp-footer" style={{ background: "#09090f", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo.png" alt="FC Career Manager" style={{ width: 22, height: 22, objectFit: "contain", opacity: 0.7 }} />
          <span style={{ color: "#444466", fontSize: 13, fontWeight: 600 }}>FC Career Manager</span>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          {[t.footerTerms, t.footerPrivacy, t.footerSupport].map(l => (
            <a key={l} href="#" style={{ color: "#444466", fontSize: 12, textDecoration: "none" }} onMouseEnter={e => (e.currentTarget.style.color = "#888899")} onMouseLeave={e => (e.currentTarget.style.color = "#444466")}>{l}</a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <img src="/logo.png" alt="" style={{ width: 16, height: 16, objectFit: "contain", opacity: 0.5 }} />
          <p style={{ color: "#333355", fontSize: 12, margin: 0 }}>© {new Date().getFullYear()} FC Career Manager. {t.footerRights}</p>
        </div>
      </footer>
    </div>
  );
}
