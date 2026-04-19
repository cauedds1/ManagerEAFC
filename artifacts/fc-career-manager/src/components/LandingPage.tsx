import { useState, useEffect, useRef } from "react";
import barcelonaImg from "@assets/image_1776619244345.png";
import cercleImg    from "@assets/image_1776619246601.png";
import watfordImg   from "@assets/image_1776619248678.png";
import mancityImg   from "@assets/image_1776619250259.png";

/* ─── Types ─────────────────────────────────────────────── */
interface LandingPageProps { onStart: () => void; onLogin: () => void; }

/* ─── Club data ──────────────────────────────────────────── */
const CLUBS = [
  {
    id: "barca", name: "Barcelona", league: "La Liga",
    img: barcelonaImg, bg: "#1a0a12", accent: "#c8102e", accentRgb: "200,16,46",
    textDark: false, glowAnim: "glowBarca 2.5s ease-in-out infinite",
    badge: "Animada", partidas: 6, temporada: "2026/27", elenco: 33, transfers: 0,
    matches: [
      { comp: "La Liga", h: "Atlético", hs: 0, a: "Barcelona", as: 3, r: "V" },
      { comp: "La Liga", h: "Barcelona", hs: 2, a: "Elche",    as: 0, r: "V" },
      { comp: "La Liga", h: "Valencia", hs: 2, a: "Barcelona", as: 3, r: "V" },
    ],
  },
  {
    id: "cercle", name: "Cercle Brugge", league: "Belgian Pro League",
    img: cercleImg, bg: "#071a0e", accent: "#00b050", accentRgb: "0,176,80",
    textDark: false, glowAnim: "glowCercle 2.5s ease-in-out infinite",
    badge: "Neutra", partidas: 3, temporada: "2026/27", elenco: 27, transfers: 0,
    matches: [
      { comp: "UCL",    h: "Zulte W.", hs: 0, a: "Cercle B.", as: 2, r: "V" },
      { comp: "UCL",    h: "Cercle B.", hs: 0, a: "PSV",      as: 2, r: "D" },
      { comp: "Nacional", h: "Cercle B.", hs: 4, a: "Union St.", as: 0, r: "V" },
    ],
  },
  {
    id: "watford", name: "Watford", league: "Championship",
    img: watfordImg, bg: "#1a1500", accent: "#fbee23", accentRgb: "251,238,35",
    textDark: true, glowAnim: "glowWatford 2.5s ease-in-out infinite",
    badge: "Eufórica", partidas: 40, temporada: "2025/26", elenco: 34, transfers: 7,
    matches: [
      { comp: "Championship", h: "Watford",  hs: 1, a: "Ipswich", as: 1, r: "E" },
      { comp: "Championship", h: "Watford",  hs: 5, a: "Derby",   as: 0, r: "V" },
      { comp: "Championship", h: "Preston",  hs: 2, a: "Watford", as: 7, r: "V" },
    ],
  },
  {
    id: "mancity", name: "Manchester City", league: "Premier League",
    img: mancityImg, bg: "#060d1a", accent: "#6cabdd", accentRgb: "108,171,221",
    textDark: false, glowAnim: "glowMancity 2.5s ease-in-out infinite",
    badge: "Animada", partidas: 3, temporada: "2026/27", elenco: 31, transfers: 0,
    matches: [
      { comp: "Premier League", h: "Man. City", hs: 0, a: "Leeds",    as: 1, r: "D" },
      { comp: "Premier League", h: "Man. Utd",  hs: 0, a: "Man. City",as: 3, r: "V" },
      { comp: "Premier League", h: "Everton",   hs: 0, a: "Man. City",as: 4, r: "V" },
    ],
  },
] as const;

/* ─── Features ───────────────────────────────────────────── */
const FEATURES = [
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h.008v.008h-.008v-.008Zm0 3.75h.008v.008h-.008v-.008Z" /></svg>,
    title: "Elenco Tático",
    desc: "Visualize seu time em campo. Formações reais, posições precisas, evolução jogador a jogador.",
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>,
    title: "Estatísticas Completas",
    desc: "Cada gol, assistência e cartão registrado. Histórico completo por temporada e jogador.",
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>,
    title: "Notícias por IA",
    desc: "A imprensa virtual cobre cada partida. Hat-tricks viram manchetes. Viradas se tornam lendas.",
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" /></svg>,
    title: "Gestão Financeira",
    desc: "Controle transferências, salários e orçamento como um diretor esportivo de verdade.",
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" /></svg>,
    title: "Armário de Troféus",
    desc: "Cada conquista preservada com imagens reais de competições do mundo inteiro.",
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" /></svg>,
    title: "Tema do Clube",
    desc: "O app se transforma com as cores do seu escudo. Cada carreira tem sua identidade visual.",
  },
];

/* ─── AI Typing texts ────────────────────────────────────── */
const AI_TEXTS = [
  {
    headline: "VIRADA ÉPICA: TÉCNICO TRANSFORMA DERROTA EM TRIUNFO NOS ACRÉSCIMOS",
    body: "Em um jogo que parecia perdido, o Barcelona protagonizou uma das maiores viradas da temporada. Atrás no placar até os 88 minutos, dois gols em sequência reescreveram a história e enviaram a torcida ao delírio total.",
  },
  {
    headline: "HAT-TRICK HISTÓRICO CONSOLIDA POSIÇÃO NA LIDERANÇA DA TABELA",
    body: "O maestro do ataque voltou a brilhar com três gols de alta qualidade. A atuação individual elevou a equipe ao primeiro lugar com folga e acendeu o debate sobre a melhor campanha da era moderna do clube.",
  },
  {
    headline: "DIRETORIA REFORÇA CONFIANÇA APÓS SEQUÊNCIA DE 10 JOGOS INVICTO",
    body: "A reunião desta semana com o conselho foi marcada por elogios. O presidente sinalizou recursos para a próxima janela. A torcida vibra com o melhor momento da temporada e os titulares chegam em forma máxima.",
  },
];

/* ─── Steps ──────────────────────────────────────────────── */
const STEPS = [
  { n: "01", icon: "👤", title: "Crie seu perfil", desc: "Escolha seu clube e defina a temporada inicial da sua carreira." },
  { n: "02", icon: "⚽", title: "Monte seu elenco", desc: "Importe ou cadastre jogadores com posição e valor de mercado." },
  { n: "03", icon: "📋", title: "Registre as partidas", desc: "Placar, gols, destaques e estatísticas de cada jogo." },
  { n: "04", icon: "🏆", title: "Escreva sua história", desc: "Stats, notícias geradas por IA e troféus conquistados." },
];

/* ─── Testimonials ───────────────────────────────────────── */
const TESTIMONIALS = [
  { initials: "CF", color: "#7c5cfc", name: "CarreiraFC", handle: "@carreira_fc", text: "Finalmente um app que trata o modo carreira com seriedade. As notícias geradas por IA são surreais — parece um jornal de verdade." },
  { initials: "TV", color: "#3d9cf5", name: "TécnicoVirtual", handle: "@tecnico_virtual", text: "Estou na temporada 6 com o Grêmio e tenho histórico de cada transferência. Isso mudou completamente minha experiência no jogo." },
  { initials: "MC", color: "#00e5a0", name: "ModoCarreira BR", handle: "@modocarreira_br", text: "O tema muda de acordo com o clube. Quando fui pro Barcelona, ficou azul e grená automaticamente. Detalhe incrível e imersivo." },
];

/* ─── Particles (generated once) ────────────────────────── */
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  left: `${5 + Math.floor(i * 3.7) % 90}%`,
  top: `${10 + Math.floor(i * 7.3) % 80}%`,
  size: 1 + (i % 3),
  delay: `${(i * 0.4) % 8}s`,
  duration: `${6 + (i % 6)}s`,
}));

/* ─── Mini hero mockup ───────────────────────────────────── */
function HeroMockup() {
  const matches = [
    { comp: "La Liga", h: "Atlético", hs: 0, a: "Barcelona", as: 3, r: "V", color: "#00e5a0" },
    { comp: "La Liga", h: "Barcelona", hs: 2, a: "Elche",    as: 0, r: "V", color: "#00e5a0" },
    { comp: "La Liga", h: "Valencia", hs: 2, a: "Barcelona", as: 3, r: "V", color: "#00e5a0" },
  ];
  return (
    <div style={{ background: "#1a0a12", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(200,16,46,0.2)", boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(200,16,46,0.12)" }}>
      {/* Header */}
      <div style={{ background: "#220d17", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(200,16,46,0.15)" }}>
        <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#c8102e,#8b0a26)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.5} style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></svg>
        </div>
        <div>
          <div style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 12, fontFamily: "DM Sans, Inter, sans-serif" }}>Barcelona</div>
          <div style={{ color: "#8888aa", fontSize: 10 }}>La Liga</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ background: "rgba(200,16,46,0.15)", border: "1px solid rgba(200,16,46,0.3)", color: "#c8102e", borderRadius: 20, padding: "2px 8px", fontSize: 9, fontFamily: "DM Sans, sans-serif" }}>● Animada</span>
          <span style={{ color: "#8888aa", fontSize: 9 }}>2026/27</span>
        </div>
      </div>
      {/* Nav tabs */}
      <div style={{ display: "flex", gap: 0, padding: "0 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", overflowX: "hidden" }}>
        {["Painel", "Partidas", "Clube", "Notícias", "Diretoria"].map((tab, i) => (
          <div key={tab} style={{ padding: "8px 10px", fontSize: 9, whiteSpace: "nowrap", color: i === 0 ? "#c8102e" : "#666688", borderBottom: i === 0 ? "2px solid #c8102e" : "2px solid transparent", fontFamily: "DM Sans, sans-serif" }}>{tab}</div>
        ))}
      </div>
      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, padding: "10px 12px" }}>
        {[{ l: "Partidas", v: "6" }, { l: "Temporada", v: "2026/27" }, { l: "Elenco", v: "33" }, { l: "Transf.", v: "0" }].map(c => (
          <div key={c.l} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 7, padding: "7px 8px", border: "1px solid rgba(200,16,46,0.1)" }}>
            <div style={{ color: "#666688", fontSize: 8, marginBottom: 3 }}>{c.l}</div>
            <div style={{ color: "#f0f0ff", fontWeight: 700, fontSize: c.l === "Temporada" ? 9 : 13, fontFamily: "JetBrains Mono, monospace" }}>{c.v}</div>
          </div>
        ))}
      </div>
      {/* Recent matches */}
      <div style={{ padding: "0 12px 12px" }}>
        <div style={{ color: "#555577", fontSize: 8, letterSpacing: "0.1em", marginBottom: 7 }}>ÚLTIMAS PARTIDAS</div>
        <div style={{ display: "flex", gap: 5 }}>
          {matches.map((m, i) => (
            <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "6px 7px", borderTop: `2px solid ${m.color}` }}>
              <div style={{ color: "#555577", fontSize: 7, marginBottom: 4 }}>{m.comp}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>{m.hs}</span>
                <span style={{ color: "#444466", fontSize: 7 }}>v</span>
                <span style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>{m.as}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                <span style={{ color: "#555577", fontSize: 7, maxWidth: 40, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{m.h}</span>
                <span style={{ color: "#555577", fontSize: 7, maxWidth: 40, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", textAlign: "right" }}>{m.a}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Stat Counter ───────────────────────────────────────── */
function StatCounter({ target, suffix = "", label, decimals = 0 }: { target: number; suffix?: string; label: string; decimals?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        let startTime: number;
        const duration = 2200;
        const animate = (ts: number) => {
          if (!startTime) startTime = ts;
          const progress = Math.min((ts - startTime) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const raw = eased * target;
          setCount(decimals > 0 ? Math.round(raw * 10 ** decimals) / 10 ** decimals : Math.round(raw));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, decimals]);

  return (
    <div ref={ref} className="text-center">
      <div className="font-bebas font-dm" style={{ fontSize: "clamp(2.5rem,5vw,4rem)", color: "#f0f0ff", lineHeight: 1, letterSpacing: "0.02em" }}>
        <span className="font-mono-j">{decimals > 0 ? count.toFixed(decimals) : count.toLocaleString("pt-BR")}</span>
        <span style={{ color: "#7c5cfc" }}>{suffix}</span>
      </div>
      <div className="font-dm" style={{ color: "#8888aa", fontSize: 13, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export function LandingPage({ onStart, onLogin }: LandingPageProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const cursor1Ref    = useRef<HTMLDivElement>(null);
  const cursor2Ref    = useRef<HTMLDivElement>(null);
  const heroGridRef   = useRef<HTMLDivElement>(null);
  const navbarRef     = useRef<HTMLDivElement>(null);
  const stepLineRef   = useRef<HTMLDivElement>(null);

  const [activeClub, setActiveClub]   = useState(0);
  const [imgVisible, setImgVisible]   = useState(true);
  const [typedText, setTypedText]     = useState("");
  const [typingDone, setTypingDone]   = useState(false);
  const [aiTextIdx, setAiTextIdx]     = useState(0);

  const club = CLUBS[activeClub];

  /* ── Custom cursor ─── */
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
      if (cursor1Ref.current) cursor1Ref.current.style.transform = `translate(${p1.x - 6}px,${p1.y - 6}px)`;
      if (cursor2Ref.current) cursor2Ref.current.style.transform = `translate(${p2.x - 20}px,${p2.y - 20}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const targets = document.querySelectorAll("button,a,[data-hover]");
    const enter = () => { cursor1Ref.current?.classList.add("lp-cursor-hover"); cursor2Ref.current?.classList.add("lp-cursor-hover"); };
    const leave = () => { cursor1Ref.current?.classList.remove("lp-cursor-hover"); cursor2Ref.current?.classList.remove("lp-cursor-hover"); };
    targets.forEach(t => { t.addEventListener("mouseenter", enter); t.addEventListener("mouseleave", leave); });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      targets.forEach(t => { t.removeEventListener("mouseenter", enter); t.removeEventListener("mouseleave", leave); });
    };
  }, []);

  /* ── Scroll: navbar blur + parallax grid ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      const y = container.scrollTop;
      if (navbarRef.current) {
        if (y > 20) { navbarRef.current.style.backdropFilter = "blur(20px)"; navbarRef.current.style.borderBottomColor = "rgba(124,92,252,0.2)"; }
        else         { navbarRef.current.style.backdropFilter = "blur(0px)";  navbarRef.current.style.borderBottomColor = "transparent"; }
      }
      if (heroGridRef.current) {
        heroGridRef.current.style.transform = `translateY(${y * 0.35}px)`;
      }
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Scroll reveal (IntersectionObserver) ─── */
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("lp-visible"); obs.unobserve(e.target); } });
    }, { threshold: 0.12 });
    const els = containerRef.current?.querySelectorAll(".lp-reveal,.lp-reveal-left,.lp-reveal-right");
    els?.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  /* ── Step line animation ─── */
  useEffect(() => {
    const el = stepLineRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.style.transition = "width 1.8s cubic-bezier(0.25,1,0.5,1)";
        el.style.width = "100%";
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── AI typing effect ─── */
  useEffect(() => {
    const text = AI_TEXTS[aiTextIdx];
    const full = text.headline + "\n\n" + text.body;
    setTypedText("");
    setTypingDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTypedText(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(interval);
        setTypingDone(true);
        setTimeout(() => {
          setAiTextIdx(prev => (prev + 1) % AI_TEXTS.length);
        }, 3200);
      }
    }, 40);
    return () => clearInterval(interval);
  }, [aiTextIdx]);

  /* ── Club switch with fade ─── */
  const switchClub = (idx: number) => {
    if (idx === activeClub) return;
    setImgVisible(false);
    setTimeout(() => { setActiveClub(idx); setImgVisible(true); }, 200);
  };

  const resultColor = (r: string) => r === "V" ? "#00e5a0" : r === "D" ? "#ef4444" : "#555577";

  return (
    <div ref={containerRef} className="font-dm" style={{ background: "#09090f", height: "100%", overflowY: "auto", overflowX: "hidden", scrollBehavior: "smooth", cursor: "none" }}>

      {/* ── Custom cursors ─── */}
      <div ref={cursor1Ref} className="lp-cursor-dot" />
      <div ref={cursor2Ref} className="lp-cursor-ring" />

      {/* ════════════════ NAVBAR ════════════════ */}
      <nav ref={navbarRef} style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", borderBottom: "1px solid transparent", transition: "backdrop-filter 0.3s, border-color 0.3s", background: "rgba(9,9,15,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#7c5cfc,#3d9cf5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(124,92,252,0.4)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.5} style={{ width: 16, height: 16 }}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" /></svg>
          </div>
          <span style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>FC Career Manager</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {[
            { label: "Funcionalidades", href: "#features" },
            { label: "IA", href: "#ia" },
            { label: "Clube", href: "#clube" },
            { label: "Como funciona", href: "#como-funciona" },
          ].map(({ label, href }) => (
            <a key={label} href={href} onClick={e => { e.preventDefault(); const id = href.slice(1); const el = containerRef.current?.querySelector(`#${id}`); el?.scrollIntoView({ behavior: "smooth" }); }} style={{ color: "#8888aa", fontSize: 13, textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "#f0f0ff")} onMouseLeave={e => (e.currentTarget.style.color = "#8888aa")} className="hidden md:block">{label}</a>
          ))}
          <button onClick={onLogin} style={{ background: "linear-gradient(135deg,#7c5cfc,#5b3fd1)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "none", transition: "all 0.25s", boxShadow: "0 4px 20px rgba(124,92,252,0.3)" }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 30px rgba(124,92,252,0.6), 0 4px 20px rgba(124,92,252,0.4)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px) scale(1.03)"; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(124,92,252,0.3)"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
            Entrar no jogo
          </button>
        </div>
      </nav>

      {/* ════════════════ HERO ════════════════ */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", overflow: "hidden", padding: "80px 40px" }}>
        {/* Animated field grid bg */}
        <div ref={heroGridRef} style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "60px 60px", animation: "heroGridMove 12s linear infinite", willChange: "transform" }} />
        {/* Radial glow */}
        <div style={{ position: "absolute", top: "30%", left: "30%", width: 500, height: 500, background: "radial-gradient(circle, rgba(124,92,252,0.12) 0%, transparent 70%)", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "60%", right: "10%", width: 400, height: 400, background: "radial-gradient(circle, rgba(61,156,245,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Particles */}
        {PARTICLES.map(p => (
          <div key={p.id} style={{ position: "absolute", left: p.left, top: p.top, width: p.size, height: p.size, borderRadius: "50%", background: "#fff", opacity: 0.3, animation: `particleFloat ${p.duration} ${p.delay} ease-in-out infinite`, pointerEvents: "none" }} />
        ))}

        {/* Hero content */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 1200, margin: "0 auto", gap: 60 }}>
          {/* Left */}
          <div style={{ flex: 1 }}>
            {/* Badge */}
            <div style={{ display: "inline-flex", marginBottom: 36, position: "relative", padding: 1.5, borderRadius: 100, overflow: "hidden" }}>
              <div style={{ position: "absolute", width: "300%", height: "300%", top: "-100%", left: "-100%", background: "conic-gradient(from 0deg, #7c5cfc, #3d9cf5, #00e5a0, #7c5cfc)", animation: "rotateBadge 3s linear infinite", transformOrigin: "center" }} />
              <div style={{ position: "relative", background: "#0f0f1a", borderRadius: 100, padding: "7px 22px", display: "flex", alignItems: "center", gap: 8, zIndex: 1 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: "#7c5cfc", display: "inline-block" }} />
                <span style={{ color: "#a0a0cc", fontSize: 11, letterSpacing: "0.15em", fontWeight: 600 }}>CAREER MODE REIMAGINADO</span>
              </div>
            </div>

            {/* Headline */}
            <div className="font-bebas" style={{ lineHeight: 0.9, marginBottom: 28 }}>
              <div style={{ fontSize: "clamp(3.5rem,7vw,6.5rem)", color: "#f0f0ff", animation: "landingSlideUp 0.9s ease 0.1s both" }}>Sua carreira.</div>
              <div style={{ fontSize: "clamp(3.5rem,7vw,6.5rem)", color: "#f0f0ff", animation: "landingSlideUp 0.9s ease 0.25s both" }}>Sua história.</div>
              <div style={{ fontSize: "clamp(3.5rem,7vw,6.5rem)", background: "linear-gradient(135deg,#7c5cfc,#3d9cf5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "landingSlideUp 0.9s ease 0.4s both" }}>Seus dados.</div>
            </div>

            {/* Subtitle */}
            <p style={{ color: "#8888aa", fontSize: 16, lineHeight: 1.7, maxWidth: 500, marginBottom: 40, animation: "landingFadeIn 1s ease 0.6s both" }}>
              Registre partidas, acompanhe estatísticas, leia notícias geradas por IA e gerencie seu clube com a imersão que o modo carreira merece.
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", animation: "landingFadeIn 1s ease 0.8s both" }}>
              <button onClick={onStart} style={{ background: "linear-gradient(135deg,#7c5cfc,#5b3fd1)", color: "#fff", border: "none", borderRadius: 14, padding: "16px 36px", fontSize: 15, fontWeight: 700, cursor: "none", boxShadow: "0 8px 32px rgba(124,92,252,0.4)", transition: "all 0.25s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 40px rgba(124,92,252,0.7), 0 8px 32px rgba(124,92,252,0.5)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px) scale(1.03)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 32px rgba(124,92,252,0.4)"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
                Criar carreira grátis
              </button>
              <button onClick={onLogin} style={{ background: "rgba(255,255,255,0.05)", color: "#c0c0e0", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "16px 32px", fontSize: 15, fontWeight: 600, cursor: "none", display: "flex", alignItems: "center", gap: 10, transition: "all 0.25s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,92,252,0.4)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,92,252,0.08)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}>
                <span>▶</span> Ver demonstração
              </button>
            </div>

            {/* Mini stat pills */}
            <div style={{ display: "flex", gap: 16, marginTop: 36, animation: "landingFadeIn 1s ease 1s both" }}>
              {[{ v: "12k+", l: "Técnicos" }, { v: "340k+", l: "Partidas" }, { v: "700+", l: "Clubes" }].map(s => (
                <div key={s.l} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
                  <div className="font-mono-j" style={{ color: "#7c5cfc", fontWeight: 700, fontSize: 15 }}>{s.v}</div>
                  <div style={{ color: "#555577", fontSize: 10 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: floating mockup */}
          <div style={{ flex: "0 0 auto", display: "none" }} className="lg-mockup">
            <div style={{ animation: "floatMockup 6s ease-in-out infinite", willChange: "transform", width: 380 }}>
              <HeroMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ STATS BAR ════════════════ */}
      <section style={{ background: "#0f0f1a", borderTop: "1px solid rgba(124,92,252,0.15)", borderBottom: "1px solid rgba(124,92,252,0.15)", padding: "52px 40px" }}>
        <div className="lp-stats-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 40 }}>
          <StatCounter target={12000} suffix="+" label="Técnicos ativos" />
          <StatCounter target={340000} suffix="+" label="Partidas registradas" />
          <StatCounter target={89} label="Países" />
          <StatCounter target={4.8} suffix="★" label="Avaliação" decimals={1} />
        </div>
      </section>

      {/* ════════════════ FEATURES ════════════════ */}
      <section id="features" style={{ padding: "100px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="text-center lp-reveal" style={{ marginBottom: 64 }}>
          <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Funcionalidades</p>
          <h2 className="font-bebas" style={{ fontSize: "clamp(2.5rem,5vw,4rem)", color: "#f0f0ff" }}>Tudo que um técnico de verdade precisa</h2>
        </div>
        <div className="lp-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`lp-reveal lp-delay-${Math.min(i + 1, 5)}`}
              style={{ background: "#14141f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "28px 28px", transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)", cursor: "default" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(-6px)"; el.style.borderColor = "rgba(124,92,252,0.4)"; el.style.background = "#1a1a28"; el.style.boxShadow = "0 20px 60px rgba(124,92,252,0.1)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "none"; el.style.borderColor = "rgba(255,255,255,0.06)"; el.style.background = "#14141f"; el.style.boxShadow = "none"; }}>
              <div style={{ width: 44, height: 44, background: "rgba(124,92,252,0.1)", border: "1px solid rgba(124,92,252,0.2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#7c5cfc", marginBottom: 18 }}>{f.icon}</div>
              <h3 style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: "#8888aa", fontSize: 13, lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════ AI SECTION ════════════════ */}
      <section id="ia" style={{ background: "#06060e", position: "relative", overflow: "hidden", padding: "100px 40px" }}>
        {/* Scan lines */}
        {[0, 1, 2].map(i => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(61,156,245,0.15),transparent)", animation: `scanLine ${8 + i * 3}s ${i * 3}s linear infinite`, pointerEvents: "none" }} />
        ))}
        <div className="lp-ai-grid" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          {/* Left text */}
          <div className="lp-reveal-left">
            <p style={{ color: "#3d9cf5", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Inteligência Artificial</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2.2rem,4vw,3.6rem)", color: "#f0f0ff", lineHeight: 1.05, marginBottom: 28 }}>A imprensa que sua carreira merece</h2>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                "Notícias automáticas baseadas em eventos reais da sua carreira",
                "Reuniões com a diretoria que cobram metas e comentam o desempenho",
                "Medidor de humor da torcida influenciando a narrativa",
                "Tom que muda conforme você vence ou perde — épico, dramático, irônico",
              ].map(item => (
                <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(61,156,245,0.15)", border: "1px solid rgba(61,156,245,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    <svg viewBox="0 0 10 10" fill="#3d9cf5" style={{ width: 8, height: 8 }}><path d="M1 5l3 3 5-6" stroke="#3d9cf5" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span style={{ color: "#8888aa", fontSize: 14, lineHeight: 1.6 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Right: AI News card */}
          <div className="lp-reveal-right">
            <div style={{ background: "#0f0f1a", border: "1px solid rgba(61,156,245,0.2)", borderRadius: 18, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 40px rgba(61,156,245,0.08)" }}>
              {/* Card header */}
              <div style={{ background: "#14141f", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3d9cf5" strokeWidth={1.5} style={{ width: 16, height: 16 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" /></svg>
                  <span style={{ color: "#3d9cf5", fontSize: 12, fontWeight: 600 }}>FC Press · Gerado por IA</span>
                </div>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5a0", animation: "pulse 1.5s ease-in-out infinite" }} />
                  <span style={{ color: "#00e5a0", fontSize: 10 }}>ao vivo</span>
                </div>
              </div>
              {/* Typed content */}
              <div style={{ padding: "24px 24px", minHeight: 200 }}>
                {typedText.split("\n\n").map((block, bi) => (
                  <p key={bi} style={{ color: bi === 0 ? "#f0f0ff" : "#8888aa", fontSize: bi === 0 ? 15 : 13, fontWeight: bi === 0 ? 700 : 400, lineHeight: bi === 0 ? 1.4 : 1.7, marginBottom: 16, textTransform: bi === 0 ? "uppercase" : "none", letterSpacing: bi === 0 ? "0.03em" : 0, fontFamily: bi === 0 ? '"Bebas Neue", sans-serif' : '"DM Sans", sans-serif' }}>{block}</p>
                ))}
                {!typingDone && (
                  <span style={{ display: "inline-block", width: 2, height: 16, background: "#3d9cf5", animation: "typewriterBlink 0.8s ease-in-out infinite", verticalAlign: "middle" }} />
                )}
              </div>
              <div style={{ padding: "12px 24px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 8 }}>
                {AI_TEXTS.map((_, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i === aiTextIdx ? "#3d9cf5" : "rgba(255,255,255,0.12)", transition: "background 0.3s" }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ CLUB THEMES (STAR) ════════════════ */}
      <section id="clube" style={{ background: club.bg, transition: "background-color 0.6s ease", padding: "60px 0 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 28 }}>
            <p style={{ color: club.accent, fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10, transition: "color 0.5s" }}>Personalização</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2rem,4vw,3.2rem)", color: "#f0f0ff", lineHeight: 1 }}>O app se transforma com o seu clube</h2>
          </div>

          {/* Club tabs */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            {CLUBS.map((c, i) => {
              const isActive = i === activeClub;
              return (
                <button key={c.id} onClick={() => switchClub(i)}
                  style={{
                    padding: "10px 24px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "none", transition: "all 0.3s",
                    background: isActive ? `rgba(${c.accentRgb},0.15)` : "rgba(255,255,255,0.05)",
                    border: isActive ? `1px solid rgba(${c.accentRgb},0.5)` : "1px solid rgba(255,255,255,0.1)",
                    color: isActive ? (c.textDark ? "#111" : c.accent) : "#8888aa",
                    boxShadow: isActive ? `0 0 20px rgba(${c.accentRgb},0.2)` : "none",
                    transform: isActive ? "scale(1.05)" : "scale(1)",
                  }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.accent, marginRight: 8, verticalAlign: "middle", boxShadow: isActive ? `0 0 8px ${c.accent}` : "none" }} />
                  {c.name}
                </button>
              );
            })}
          </div>

          {/* Screenshot with glow border */}
          <div style={{ position: "relative", maxWidth: 880, margin: "0 auto" }}>
            {/* Hover scale wrapper */}
            <div
              style={{ transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.02)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}>
            {/* Outer glow wrapper */}
            <div style={{ borderRadius: 20, overflow: "hidden", animation: club.glowAnim, transition: "box-shadow 0.5s" }}>
              {/* Browser chrome */}
              <div style={{ background: "#0a0a0a", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid rgba(${club.accentRgb},0.15)` }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#2a2a2a" }} />
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#2a2a2a" }} />
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#2a2a2a" }} />
                <div style={{ flex: 1, height: 24, borderRadius: 6, background: "#111118", margin: "0 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#444466", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>fc-career-manager.replit.app</span>
                </div>
                <div style={{ background: `rgba(${club.accentRgb},0.15)`, border: `1px solid rgba(${club.accentRgb},0.3)`, borderRadius: 6, padding: "3px 12px", display: "flex", alignItems: "center", gap: 6, transition: "all 0.5s" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: club.accent, transition: "background 0.5s" }} />
                  <span style={{ color: club.accent, fontSize: 11, fontWeight: 600, transition: "color 0.5s" }}>{club.league}</span>
                </div>
              </div>
              {/* Screenshot image — natural proportions, no crop */}
              <div style={{ position: "relative", lineHeight: 0, background: club.bg }}>
                <img
                  key={activeClub}
                  src={club.img}
                  alt={`Tema ${club.name}`}
                  style={{ width: "100%", height: "auto", display: "block", opacity: imgVisible ? 1 : 0, transition: "opacity 0.3s ease" }}
                />
                {/* Hover overlay */}
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, rgba(${club.accentRgb},0.06) 0%, transparent 40%)`, transition: "all 0.5s", pointerEvents: "none" }} />
              </div>
              {/* Bottom info bar */}
              <div style={{ background: "#0a0a0a", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid rgba(${club.accentRgb},0.12)` }}>
                <span style={{ color: "#444466", fontSize: 11 }}>Tema automático ativo</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: club.accent, boxShadow: `0 0 8px ${club.accent}` }} />
                  <span style={{ color: club.accent, fontSize: 12, fontWeight: 600, transition: "color 0.5s" }}>{club.name}</span>
                </div>
              </div>
            </div>
            </div> {/* end hover scale wrapper */}

            {/* Color swatches */}
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 20 }}>
              {CLUBS.map((c, i) => (
                <button key={c.id} onClick={() => switchClub(i)}
                  style={{ width: 14, height: 14, borderRadius: "50%", background: c.accent, cursor: "none", border: i === activeClub ? `2px solid ${c.accent}` : "2px solid transparent", outline: i === activeClub ? `3px solid rgba(${c.accentRgb},0.35)` : "none", transform: i === activeClub ? "scale(1.4)" : "scale(1)", transition: "all 0.3s", boxShadow: i === activeClub ? `0 0 16px rgba(${c.accentRgb},0.7)` : "none" }}
                  title={c.name} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ HOW IT WORKS ════════════════ */}
      <section id="como-funciona" style={{ padding: "100px 40px", background: "#09090f" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 64 }}>
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Como funciona</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2.5rem,5vw,4rem)", color: "#f0f0ff" }}>Quatro passos para começar</h2>
          </div>
          {/* Steps */}
          <div style={{ position: "relative" }}>
            {/* Connecting line track */}
            <div style={{ position: "absolute", top: 32, left: "12.5%", right: "12.5%", height: 1, background: "rgba(255,255,255,0.06)", overflow: "hidden", display: "flex" }}>
              <div ref={stepLineRef} style={{ height: "100%", background: "linear-gradient(90deg,#7c5cfc,#3d9cf5)", width: "0%", transition: "width 0s" }} />
            </div>
            <div className="lp-steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, position: "relative" }}>
              {STEPS.map((step, i) => (
                <div key={step.n} className={`lp-reveal lp-delay-${i + 1}`} style={{ textAlign: "center", padding: "0 16px" }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#0f0f1a", border: "1px solid rgba(124,92,252,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", position: "relative", boxShadow: "0 0 24px rgba(124,92,252,0.1)" }}>
                    <span style={{ fontSize: 24 }}>{step.icon}</span>
                    <div className="font-mono-j" style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, background: "linear-gradient(135deg,#7c5cfc,#3d9cf5)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700 }}>{i + 1}</div>
                  </div>
                  <div className="font-bebas" style={{ fontSize: 22, color: "#f0f0ff", marginBottom: 8 }}>{step.title}</div>
                  <p style={{ color: "#8888aa", fontSize: 13, lineHeight: 1.6 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ TESTIMONIALS ════════════════ */}
      <section style={{ padding: "80px 40px 100px", background: "#0f0f1a" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 56 }}>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2rem,4vw,3.2rem)", color: "#f0f0ff" }}>O que a comunidade diz</h2>
          </div>
          <div className="lp-testimonials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={t.handle} className={`lp-reveal lp-delay-${i + 1}`}
                style={{ background: "#14141f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "28px 28px", transition: "all 0.3s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(-4px)"; el.style.borderColor = "rgba(124,92,252,0.3)"; el.style.boxShadow = "0 16px 48px rgba(0,0,0,0.4)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "none"; el.style.borderColor = "rgba(255,255,255,0.06)"; el.style.boxShadow = "none"; }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                  {"★★★★★".split("").map((s, j) => <span key={j} style={{ color: "#7c5cfc", fontSize: 14 }}>{s}</span>)}
                </div>
                <p style={{ color: "#c8c8e8", fontSize: 14, lineHeight: 1.75, marginBottom: 20, fontStyle: "italic" }}>"{t.text}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>{t.initials}</div>
                  <div>
                    <div style={{ color: "#f0f0ff", fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                    <div style={{ color: "#8888aa", fontSize: 11 }}>{t.handle}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ CTA FINAL ════════════════ */}
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(160deg,#09090f 0%,#0d0820 100%)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 40px", textAlign: "center" }}>
        {/* Stadium SVG silhouette */}
        <svg viewBox="0 0 1200 400" style={{ position: "absolute", bottom: 0, left: 0, right: 0, width: "100%", opacity: 0.06, pointerEvents: "none" }} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 400 L0 280 Q100 220 200 240 Q300 260 400 200 Q500 140 600 130 Q700 140 800 200 Q900 260 1000 240 Q1100 220 1200 280 L1200 400 Z" fill="white"/>
          <path d="M100 400 L100 300 Q200 260 300 270 Q400 280 500 220 Q550 190 600 180 Q650 190 700 220 Q800 280 900 270 Q1000 260 1100 300 L1100 400 Z" fill="white" opacity="0.5"/>
          <rect x="540" y="120" width="120" height="8" rx="4" fill="white" />
          <rect x="580" y="100" width="40" height="24" rx="2" fill="white" opacity="0.6" />
          <rect x="560" y="128" width="80" height="100" fill="white" opacity="0.08" />
        </svg>

        {/* Glow */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, background: "radial-gradient(circle,rgba(124,92,252,0.1) 0%,transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative" }}>
          <p className="lp-reveal" style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 20 }}>Comece agora</p>
          <h2 className="font-bebas lp-reveal lp-delay-1" style={{ fontSize: "clamp(3rem,7vw,6rem)", color: "#f0f0ff", lineHeight: 0.95, marginBottom: 24 }}>
            Pronto para escrever<br />sua história?
          </h2>
          <p className="lp-reveal lp-delay-2" style={{ color: "#8888aa", fontSize: 16, maxWidth: 480, margin: "0 auto 48px", lineHeight: 1.7 }}>
            Mais de 12.000 técnicos já começaram. Grátis para sempre no plano base.
          </p>
          <button onClick={onStart} className="lp-reveal lp-delay-3"
            style={{ background: "linear-gradient(135deg,#7c5cfc,#5b3fd1)", color: "#fff", border: "none", borderRadius: 16, padding: "20px 52px", fontSize: 17, fontWeight: 700, cursor: "none", letterSpacing: "0.04em", boxShadow: "0 8px 40px rgba(124,92,252,0.45)", transition: "all 0.3s" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.boxShadow = "0 0 60px rgba(124,92,252,0.8),0 8px 40px rgba(124,92,252,0.5)"; el.style.transform = "translateY(-4px) scale(1.04)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.boxShadow = "0 8px 40px rgba(124,92,252,0.45)"; el.style.transform = "none"; }}>
            Criar minha carreira agora
          </button>
        </div>
      </section>

      {/* ════════════════ FOOTER ════════════════ */}
      <footer style={{ background: "#06060e", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "36px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#7c5cfc,#3d9cf5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.5} style={{ width: 14, height: 14 }}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" /></svg>
          </div>
          <span style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 13 }}>FC Career Manager</span>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          {["Termos", "Privacidade", "Contato"].map(l => (
            <a key={l} href="#" onClick={e => e.preventDefault()} style={{ color: "#555577", fontSize: 12, textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "#8888aa")} onMouseLeave={e => (e.currentTarget.style.color = "#555577")}>{l}</a>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {/* Twitter/X */}
          <a href="#" onClick={e => e.preventDefault()} style={{ color: "#555577", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "#f0f0ff")} onMouseLeave={e => (e.currentTarget.style.color = "#555577")}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18 }}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.258 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          {/* Instagram */}
          <a href="#" onClick={e => e.preventDefault()} style={{ color: "#555577", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "#f0f0ff")} onMouseLeave={e => (e.currentTarget.style.color = "#555577")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 18, height: 18 }}><rect width="14" height="14" x="5" y="5" rx="3.5"/><circle cx="12" cy="12" r="3"/><circle cx="16.25" cy="7.75" r="0.5" fill="currentColor"/></svg>
          </a>
          {/* Discord */}
          <a href="#" onClick={e => e.preventDefault()} style={{ color: "#555577", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "#f0f0ff")} onMouseLeave={e => (e.currentTarget.style.color = "#555577")}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18 }}><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
          </a>
        </div>
        <p style={{ color: "#333355", fontSize: 11, width: "100%", textAlign: "center" }}>© 2025 FC Career Manager. Não afiliado à EA Sports.</p>
      </footer>

    </div>
  );
}
