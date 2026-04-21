import { useState, useEffect, useRef, useCallback } from "react";
import { ClubDemoMockup } from "./ClubDemoMockup";

/* ─── Types ─────────────────────────────────────────────── */
interface LandingPageProps { onStart: () => void; onLogin: () => void; onStartWithPlan: (plan: "pro" | "ultra") => void; }

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

/* ─── AI Texts (auto-typing) ─────────────────────────────── */
const AI_TEXTS = [
  {
    headline: "VIRADA ÉPICA: TÉCNICO TRANSFORMA DERROTA EM TRIUNFO NOS ACRÉSCIMOS",
    body: "Em um jogo que parecia perdido, o Barcelona protagonizou uma das maiores viradas da temporada. Atrás no placar até os 88 minutos, dois gols em sequência reescreveram a história e enviaram a torcida ao delírio.",
  },
  {
    headline: "HAT-TRICK HISTÓRICO DE YAMAL CONSOLIDA POSIÇÃO NA LIDERANÇA DA LA LIGA",
    body: "O jovem astro voltou a brilhar com três gols de qualidade técnica excepcional. A atuação individual elevou o Barcelona ao primeiro lugar com folga e acendeu o debate sobre o melhor momento da carreira do atleta.",
  },
  {
    headline: "LAPORTA REFORÇA CONFIANÇA APÓS SEQUÊNCIA DE 9 JOGOS INVICTO",
    body: "A reunião desta semana com o conselho foi marcada por elogios ao trabalho tático. O presidente sinalizou recursos para a janela de inverno. A torcida vibra com o melhor futebol da temporada.",
  },
];

/* ─── News generator templates ──────────────────────────── */
const HEADLINE_TEMPLATES = [
  (c: string, s: string) => `${c.toUpperCase()} DOMINA COM ${s} E DISPARA NA LIDERANÇA DA TABELA`,
  (c: string, s: string) => `VIRADA HISTÓRICA: ${c.toUpperCase()} BUSCA ${s} NOS ACRÉSCIMOS`,
  (c: string, s: string) => `${c.toUpperCase()} CONFIRMA FASE EXCEPCIONAL COM RESULTADO DE ${s}`,
  (c: string, s: string) => `MAESTRO TÉCNICO: ${c.toUpperCase()} EXECUTA PLANO PERFEITO — ${s}`,
  (c: string, s: string) => `${c.toUpperCase()} SOBE AO TOPO COM PLACAR DE ${s} — TEMPORADA HISTÓRICA`,
];

const BODY_TEMPLATES = [
  (c: string) => `Em uma atuação que ficará na memória da torcida, o ${c} demonstrou maturidade tática e qualidade técnica acima da média. O técnico foi ovacionado ao deixar o campo, com a imprensa especializada já falando em título.`,
  (c: string) => `A partida de ontem deixou clara a evolução do trabalho do treinador. O ${c} pressionou desde o primeiro minuto e construiu o resultado com inteligência. Nos corredores, já se fala abertamente em conquista.`,
  (c: string) => `Os números impressionam: o ${c} mantém uma das defesas mais sólidas da competição. A diretoria está satisfeita, e a renovação de contrato do técnico não é mais segredo. A torcida sonha. E com razão.`,
  (c: string) => `Mais do que o placar, o que chamou atenção foi a forma. O ${c} exibiu futebol de alto nível, combinando intensidade com refinamento técnico. Os adversários terão trabalho para parar essa máquina azeitada.`,
];

/* ─── Features Explorer ──────────────────────────────────── */
type FeatureColor = "tactical" | "financial" | "trophies" | "ai";

const FEATURE_PANEL_BG: Record<FeatureColor, string> = {
  tactical:  "radial-gradient(ellipse 500px 350px at 50% 20%, rgba(124,92,252,0.07) 0%, transparent 70%)",
  financial: "radial-gradient(ellipse 500px 350px at 50% 20%, rgba(61,156,245,0.07) 0%, transparent 70%)",
  trophies:  "radial-gradient(ellipse 500px 350px at 50% 20%, rgba(245,158,11,0.07) 0%, transparent 70%)",
  ai:        "radial-gradient(ellipse 500px 350px at 50% 20%, rgba(0,229,160,0.06) 0%, transparent 70%)",
};

/* ─── Steps ──────────────────────────────────────────────── */
const STEPS = [
  {
    n: "01",
    colorType: "tactical" as FeatureColor,
    iconEl: (
      <svg viewBox="0 0 40 40" fill="none" style={{ width: 32, height: 32 }}>
        <path d="M20 4 L36 13 L36 27 L20 36 L4 27 L4 13 Z" stroke="#7c5cfc" strokeWidth={1.5} fill="rgba(124,92,252,0.12)" style={{ animation: "shieldPulse 2s ease-in-out infinite" }} />
        <path d="M13 20 L18 25 L27 16" stroke="#7c5cfc" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Escolha seu clube. Configure seu sistema.",
    desc: "Defina a prancheta, os objetivos da temporada e o perfil do seu elenco antes do primeiro apito.",
  },
  {
    n: "02",
    colorType: "tactical" as FeatureColor,
    iconEl: (
      <div style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: "JetBrains Mono, monospace", fontSize: 16, fontWeight: 700 }}>
        <span style={{ color: "#f0f0ff" }}>2</span>
        <div style={{ width: 1, height: 24, background: "rgba(245,158,11,0.5)", margin: "0 2px" }} />
        <span style={{ color: "#f0f0ff" }}>1</span>
      </div>
    ),
    title: "Registre. Analise. Evolua.",
    desc: "Cada vitória, derrota e empate vira dado. Formação, finalizações, posse — o histórico que o FM te dá, aqui com seus dados reais.",
  },
  {
    n: "03",
    colorType: "financial" as FeatureColor,
    iconEl: (
      <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(61,156,245,0.2)", border: "1px solid rgba(61,156,245,0.5)", animation: "swapLeft 2s ease-in-out infinite" }} />
        <svg viewBox="0 0 16 8" fill="none" style={{ width: 16 }}><path d="M1 4 L15 4 M11 1 L15 4 L11 7" stroke="#3d9cf5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/></svg>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(61,156,245,0.2)", border: "1px solid rgba(61,156,245,0.5)", animation: "swapRight 2s ease-in-out infinite" }} />
      </div>
    ),
    title: "Janela aberta. Quem fica, quem vai?",
    desc: "Controle o orçamento, negocie transferências e mantenha o elenco no nível que sua ambição exige.",
  },
  {
    n: "04",
    colorType: "trophies" as FeatureColor,
    iconEl: (
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#888", lineHeight: 1.4, textAlign: "left" }}>
        <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: 12 }}>A GAZETA DO TÉCNICO</div>
        <div style={{ color: "#888", fontSize: 9, marginTop: 2 }}>TÍTULO|<span style={{ animation: "typewriterBlink 0.8s infinite", display: "inline-block", width: 5, height: 9, background: "#f59e0b", verticalAlign: "middle", marginLeft: 1 }} /></div>
      </div>
    ),
    title: "A notícia que só você pode escrever.",
    desc: "A IA gera a cobertura jornalística da sua conquista. Compartilhe. Salve. Lembre-se de cada detalhe daqui a 10 anos.",
  },
];

/* ─── Testimonials ───────────────────────────────────────── */
const TESTIMONIALS = [
  { initials: "CF", color: "#7c5cfc", name: "CarreiraFC", handle: "@carreira_fc", text: "Finalmente um app que trata o modo carreira com seriedade. As notícias geradas por IA são surreais — parece um jornal de verdade." },
  { initials: "TV", color: "#3d9cf5", name: "TécnicoVirtual", handle: "@tecnico_virtual", text: "Estou na temporada 6 com o Grêmio e tenho histórico de cada transferência. Isso mudou completamente minha experiência no jogo." },
  { initials: "MC", color: "#00e5a0", name: "ModoCarreira BR", handle: "@modocarreira_br", text: "O tema muda de acordo com o clube. Quando fui pro Barcelona, ficou azul e grená automaticamente. Detalhe incrível e imersivo." },
];

/* ─── FAQ ────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "É gratuito para sempre?",
    a: "Sim. O plano Grátis não tem expiração nem cartão de crédito. Você registra carreiras, partidas e consulta estatísticas sem pagar nada. Os planos pagos desbloqueiam funcionalidades avançadas como IA ilimitada e múltiplas carreiras simultâneas.",
  },
  {
    q: "Precisa conectar com o jogo original?",
    a: "Não. O FC Career Manager é totalmente independente. Você insere os dados manualmente — exatamente como faria num caderno, só que com uma plataforma feita para isso. Funciona com qualquer simulador de futebol.",
  },
  {
    q: "Como funciona a IA para as notícias?",
    a: "Nossa IA analisa os dados da sua carreira — resultados, gols, transferências, forma — e cria cobertura jornalística contextual. Hat-tricks viram manchetes. Derrotas têm o tom certo de drama. Títulos se tornam editoriais históricos.",
  },
  {
    q: "Posso usar em dispositivos móveis?",
    a: "Sim. A plataforma é totalmente responsiva. Funciona em qualquer navegador moderno, seja no celular após a partida ou no computador para análises mais detalhadas.",
  },
  {
    q: "O que diferencia Pro de Ultra?",
    a: "Pro adiciona carreiras ilimitadas, IA de notícias sem limite diário e relatórios avançados. Ultra inclui tudo do Pro mais análises preditivas, exportação de dados, histórico completo exportável e suporte prioritário.",
  },
];

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

function SplitFlap({ value }: { value: number }) {
  const str = value.toLocaleString("pt-BR");
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
        // Mouse repulsion
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

        // Draw dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold ? "rgba(245,158,11,0.65)" : "rgba(124,92,252,0.55)";
        ctx.fill();
      });

      // Draw connections
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

/* ─── Hero Mockup ────────────────────────────────────────── */
function HeroMockup() {
  const matches = [
    { comp: "La Liga",  h: "Atlético",  hs: 0, a: "Barcelona", as: 3, r: "V", color: "#00e5a0" },
    { comp: "La Liga",  h: "Barcelona", hs: 2, a: "Elche",     as: 0, r: "V", color: "#00e5a0" },
    { comp: "UCL",      h: "Barcelona", hs: 3, a: "PSG",       as: 1, r: "V", color: "#00e5a0" },
  ];
  return (
    <div style={{ background: "#1a0a12", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(200,16,46,0.25)", boxShadow: "0 40px 100px rgba(0,0,0,0.8), 0 0 50px rgba(200,16,46,0.15)", animation: "floatMockup 6s ease-in-out infinite" }}>
      <div style={{ background: "#220d17", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(200,16,46,0.15)" }}>
        <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#c8102e,#8b0a26)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.5} style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></svg>
        </div>
        <div>
          <div style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 12 }}>Barcelona</div>
          <div style={{ color: "#8888aa", fontSize: 10 }}>La Liga · 2026/27</div>
        </div>
        <span style={{ marginLeft: "auto", background: "rgba(200,16,46,0.15)", border: "1px solid rgba(200,16,46,0.3)", color: "#c8102e", borderRadius: 20, padding: "2px 8px", fontSize: 9 }}>● Animada</span>
      </div>
      <div style={{ display: "flex", gap: 0, padding: "0 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {["Painel", "Partidas", "Clube", "Notícias", "Diretoria"].map((tab, i) => (
          <div key={tab} style={{ padding: "7px 10px", fontSize: 9, whiteSpace: "nowrap", color: i === 0 ? "#c8102e" : "#555577", borderBottom: i === 0 ? "2px solid #c8102e" : "2px solid transparent" }}>{tab}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, padding: "10px 12px" }}>
        {[{ l: "Partidas", v: "18" }, { l: "Pos", v: "1º" }, { l: "Elenco", v: "33" }, { l: "Pontos", v: "51" }].map(c => (
          <div key={c.l} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 7, padding: "6px 8px", border: "1px solid rgba(200,16,46,0.1)" }}>
            <div style={{ color: "#555577", fontSize: 8, marginBottom: 2 }}>{c.l}</div>
            <div style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>{c.v}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "0 12px 12px" }}>
        <div style={{ color: "#444466", fontSize: 8, letterSpacing: "0.1em", marginBottom: 6 }}>ÚLTIMAS PARTIDAS</div>
        <div style={{ display: "flex", gap: 4 }}>
          {matches.map((m, i) => (
            <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "5px 6px", borderTop: `2px solid ${m.color}` }}>
              <div style={{ color: "#444466", fontSize: 7, marginBottom: 3 }}>{m.comp}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>{m.hs}</span>
                <span style={{ color: "#333355", fontSize: 7 }}>–</span>
                <span style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>{m.as}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Feature mockups ────────────────────────────────────── */
function PainelMockup() {
  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(124,92,252,0.2)", fontSize: 0 }}>
      <div style={{ background: "#13131f", padding: "8px 14px", display: "flex", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {["Painel","Partidas","Elenco"].map((t,i) => (
          <span key={t} style={{ fontSize: 9, color: i===0?"#7c5cfc":"#444466", borderBottom: i===0?"1px solid #7c5cfc":"none", paddingBottom: 4 }}>{t}</span>
        ))}
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
          {[{l:"Partidas",v:"22",c:"#7c5cfc"},{l:"Vitórias",v:"14",c:"#00e5a0"},{l:"Gols",v:"38",c:"#f59e0b"}].map(s => (
            <div key={s.l} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 10px", border: `1px solid rgba(${s.c==="#7c5cfc"?"124,92,252":s.c==="#00e5a0"?"0,229,160":"245,158,11"},0.15)` }}>
              <div style={{ color: "#444466", fontSize: 8 }}>{s.l}</div>
              <div style={{ color: s.c, fontWeight: 700, fontSize: 16, fontFamily: "JetBrains Mono, monospace" }}>{s.v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(124,92,252,0.06)", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(124,92,252,0.12)" }}>
          <div style={{ color: "#444466", fontSize: 8, marginBottom: 6 }}>FORMA RECENTE</div>
          <div style={{ display: "flex", gap: 4 }}>
            {["V","V","E","V","V","D","V"].map((r,i) => (
              <div key={i} style={{ width: 22, height: 22, borderRadius: 4, background: r==="V"?"rgba(0,229,160,0.2)":r==="D"?"rgba(239,68,68,0.2)":"rgba(85,85,119,0.3)", border: `1px solid ${r==="V"?"rgba(0,229,160,0.4)":r==="D"?"rgba(239,68,68,0.4)":"rgba(85,85,119,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 9, color: r==="V"?"#00e5a0":r==="D"?"#ef4444":"#555577", fontWeight: 700 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PartidaMockup({ homeScore, awayScore, onChangeHome, onChangeAway }: { homeScore: number; awayScore: number; onChangeHome: (d: number) => void; onChangeAway: (d: number) => void }) {
  const diff = homeScore - awayScore;
  const headline = diff > 2 ? "GOLEADA HISTÓRICA — TORCIDA VAI AO DELÍRIO NO CAMP NOU" : diff === 1 ? "VITÓRIA SUADA: BARCELONA SEGURA A PRESSÃO E LEVA OS 3 PONTOS" : diff === 0 ? "EMPATE FRUSTRANTE: BARCELONA NÃO CONVERTE E DIVIDE OS PONTOS" : diff < -1 ? "DERROTA PESADA — TÉCNICO TEM MUITO A ANALISAR" : "DERROTA AMARGA — BARCELONA PRECISA REAGIR";

  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(124,92,252,0.2)" }}>
      <div style={{ background: "#13131f", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "#444466" }}>REGISTRAR PARTIDA</span>
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
          <div style={{ color: "#444466", fontSize: 8, marginBottom: 4 }}>A GAZETA DO TÉCNICO</div>
          <p style={{ color: "#c0c0d0", fontSize: 10, lineHeight: 1.5, fontWeight: 600 }}>{headline}</p>
        </div>
      </div>
    </div>
  );
}

function ElencoMockup() {
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
        <span style={{ fontSize: 9, color: "#444466" }}>ELENCO · 33 JOGADORES</span>
        <span style={{ fontSize: 9, color: "#7c5cfc" }}>+ Adicionar</span>
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

function TranfMockup() {
  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(61,156,245,0.2)" }}>
      <div style={{ background: "#13131f", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 9, color: "#3d9cf5" }}>JANELA DE TRANSFERÊNCIAS</span>
      </div>
      <div style={{ padding: "10px 12px" }}>
        {[
          { name: "K. De Bruyne",   from: "Man. City",  fee: "€32M", dir: "in"  },
          { name: "A. Griezmann",   from: "Atl. Madrid", fee: "€18M", dir: "in"  },
          { name: "F. Torres",      from: "Barcelona",  fee: "€15M", dir: "out" },
        ].map(t => (
          <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: 14 }}>{t.dir === "in" ? "↙" : "↗"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#e0e0f0", fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 9, color: "#555577" }}>{t.dir === "in" ? "de" : "para"} {t.from}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: t.dir === "in" ? "#ef4444" : "#00e5a0", fontFamily: "JetBrains Mono, monospace" }}>{t.fee}</span>
          </div>
        ))}
        <div style={{ marginTop: 10, background: "rgba(61,156,245,0.06)", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, color: "#555577" }}>Saldo da janela</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", fontFamily: "JetBrains Mono, monospace" }}>−€29M</span>
        </div>
      </div>
    </div>
  );
}

function FinMockup() {
  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(61,156,245,0.2)" }}>
      <div style={{ background: "#13131f", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 9, color: "#3d9cf5" }}>GESTÃO FINANCEIRA</span>
      </div>
      <div style={{ padding: "10px 12px" }}>
        {[
          { l: "Orçamento total",   v: "€180M",  c: "#f0f0ff" },
          { l: "Folha salarial",    v: "€62M/ano", c: "#f59e0b" },
          { l: "Receita (bilheteria)", v: "+€24M", c: "#00e5a0" },
          { l: "Valor de mercado",  v: "€1.2B",  c: "#7c5cfc" },
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

function TrofeusMockup() {
  const trophies = [
    { name: "La Liga", year: "2026", img: "🏆", color: "#f59e0b" },
    { name: "Copa del Rey", year: "2025", img: "🥇", color: "#f59e0b" },
    { name: "Champions League", year: "2024", img: "⭐", color: "#f59e0b" },
  ];
  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(245,158,11,0.2)" }}>
      <div style={{ background: "#13131f", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 9, color: "#f59e0b" }}>ARMÁRIO DE TROFÉUS · 3 CONQUISTAS</span>
      </div>
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {trophies.map(t => (
          <div key={t.name} style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>{t.img}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f0f0ff" }}>{t.name}</div>
              <div style={{ fontSize: 9, color: "#f59e0b" }}>Temporada {t.year}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIMockup() {
  return (
    <div style={{ background: "#0a0a10", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,229,160,0.2)" }}>
      <div style={{ background: "#111119", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#00e5a0", fontFamily: "JetBrains Mono, monospace" }}>A GAZETA DO TÉCNICO</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00e5a0", display: "inline-block", animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 8, color: "#00e5a0" }}>ao vivo</span>
        </span>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#f0f0ff", textTransform: "uppercase", letterSpacing: "0.02em", lineHeight: 1.3, marginBottom: 8 }}>
          LEWANDOWSKI MARCA HAT-TRICK E BARCELONA GOLEIA POR 4–0
        </div>
        <p style={{ fontSize: 10, color: "#8888aa", lineHeight: 1.6 }}>Em noite histórica no Camp Nou, o atacante polaco atingiu a marca de 30 gols na temporada. Torcida canta seu nome até depois do apito final.</p>
        <div style={{ marginTop: 10, display: "flex", gap: 4 }}>
          {["#Barcelona","#LaLiga","#Lewandowski"].map(tag => (
            <span key={tag} style={{ fontSize: 8, color: "#00e5a0", background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)", borderRadius: 20, padding: "2px 8px" }}>{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiretoriaMockup() {
  return (
    <div style={{ background: "#0d0d1a", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(124,92,252,0.2)" }}>
      <div style={{ background: "#13131f", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 9, color: "#7c5cfc" }}>REUNIÃO — JOAN LAPORTA</span>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(124,92,252,0.15)", border: "1px solid rgba(124,92,252,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 16 }}>👔</span>
          </div>
          <div style={{ background: "rgba(124,92,252,0.07)", borderRadius: "0 12px 12px 12px", padding: "8px 12px", border: "1px solid rgba(124,92,252,0.12)" }}>
            <p style={{ fontSize: 10, color: "#c0c0d0", lineHeight: 1.5 }}>"Impressionante. Cinco vitórias seguidas e o melhor ataque da liga. A diretoria está muito satisfeita com o seu trabalho, mister."</p>
          </div>
        </div>
        <div style={{ background: "rgba(0,229,160,0.06)", borderRadius: 8, padding: "8px 10px", border: "1px solid rgba(0,229,160,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#555577" }}>Confiança da diretoria</span>
          <div style={{ display: "flex", gap: 2 }}>
            {[1,2,3,4,5].map(s => <div key={s} style={{ width: 14, height: 6, borderRadius: 2, background: s <= 4 ? "#00e5a0" : "rgba(255,255,255,0.08)" }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Feature data with mockup refs ─────────────────────── */
interface Feature {
  id: string;
  title: string;
  label: string;
  colorType: FeatureColor;
  accentColor: string;
  desc: string;
}

const FEATURES_EXPLORER: Feature[] = [
  { id: "painel",      title: "Painel Tático",      label: "Visão Geral",   colorType: "tactical",  accentColor: "#7c5cfc", desc: "Inteligência sobre cada aspecto da sua carreira em um único lugar. Forma, estatísticas, próximas partidas e alertas do clube." },
  { id: "partidas",    title: "Registrar Partidas",  label: "Partidas",      colorType: "tactical",  accentColor: "#7c5cfc", desc: "Placar, formação, gols, cartões e destaques. Cada partida vira memória permanente. Clique nos números do placar acima para testar." },
  { id: "elenco",      title: "Gestão de Elenco",   label: "Elenco",        colorType: "tactical",  accentColor: "#7c5cfc", desc: "33 jogadores com posição, OVR, idade e valor de mercado. Evolução acompanhada temporada por temporada." },
  { id: "transferencias", title: "Transferências",  label: "Mercado",       colorType: "financial", accentColor: "#3d9cf5", desc: "Registre entradas e saídas, negocie valores e mantenha o histórico completo de cada janela. O seu livro-caixa do mercado." },
  { id: "financeiro",  title: "Gestão Financeira",  label: "Finanças",      colorType: "financial", accentColor: "#3d9cf5", desc: "Orçamento, folha salarial, receitas e valor de mercado do elenco. Dirija o clube como um verdadeiro diretor esportivo." },
  { id: "trofeus",     title: "Armário de Troféus", label: "Conquistas",    colorType: "trophies",  accentColor: "#f59e0b", desc: "Cada título conquista sua vaga permanente no armário. Data, competição, destaques — a história que você construiu." },
  { id: "noticias",    title: "Notícias por IA",    label: "Imprensa",      colorType: "ai",        accentColor: "#00e5a0", desc: "A Gazeta do Técnico cobre cada partida com qualidade jornalística real. Hat-tricks viram manchetes. Títulos se tornam editoriais históricos." },
  { id: "diretoria",   title: "Diretoria",          label: "Diretoria",     colorType: "tactical",  accentColor: "#7c5cfc", desc: "Reuniões com o presidente, metas de temporada e negociações de contrato. O lado de bastidores da sua carreira." },
];

/* ─── Main component ─────────────────────────────────────── */
export function LandingPage({ onStart, onLogin, onStartWithPlan }: LandingPageProps) {
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

  const club = customClub && customClubName
    ? { ...CLUBS[activeClub], bg: "#09090f", accent: customClub.primary, accentRgb: customClub.accentRgb, name: customClubName }
    : CLUBS[activeClub];

  /* ── Live coaches counter ─── */
  useEffect(() => {
    const t = setInterval(() => setLiveCount(getLiveCoaches()), 45000);
    return () => clearInterval(t);
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
      if (cursor1Ref.current) cursor1Ref.current.style.transform = `translate(${p1.x - 12}px,${p1.y - 12}px)`;
      if (cursor2Ref.current) cursor2Ref.current.style.transform = `translate(${p2.x - 20}px,${p2.y - 20}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onOver = (e: MouseEvent) => {
      const target = e.target;
      const isBall = target instanceof Element && !!target.closest("[data-cursor='ball']");
      if (isBall) {
        cursor1Ref.current?.classList.add("lp-cursor-ball");
        cursor2Ref.current?.classList.add("lp-cursor-ball");
      } else {
        cursor1Ref.current?.classList.remove("lp-cursor-ball");
        cursor2Ref.current?.classList.remove("lp-cursor-ball");
      }
    };
    window.addEventListener("mouseover", onOver);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
    };
  }, []);

  /* ── Scroll: navbar blur + parallax ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const p1El = document.getElementById("parallax-layer-1");
    const p2El = document.getElementById("parallax-layer-2");
    const onScroll = () => {
      const y = container.scrollTop;
      if (navbarRef.current) {
        navbarRef.current.style.backdropFilter = y > 20 ? "blur(20px)" : "blur(0px)";
        navbarRef.current.style.borderBottomColor = y > 20 ? "rgba(124,92,252,0.2)" : "transparent";
      }
      if (p1El) p1El.style.transform = `translateY(${y * 0.12}px)`;
      if (p2El) p2El.style.transform = `translateY(${y * 0.28}px)`;
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Scroll reveal ─── */
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("lp-visible"); obs.unobserve(e.target); } });
    }, { threshold: 0.1 });
    const els = containerRef.current?.querySelectorAll(".lp-reveal,.lp-reveal-left,.lp-reveal-right");
    els?.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  /* ── Step line ─── */
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

  /* ── AI typing ─── */
  useEffect(() => {
    const text = AI_TEXTS[aiTextIdx];
    const full = text.headline + "\n\n" + text.body;
    setTypedText(""); setTypingDone(false);
    let i = 0;
    let rotateTimer: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      i++;
      setTypedText(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(interval);
        setTypingDone(true);
        rotateTimer = setTimeout(() => setAiTextIdx(p => (p + 1) % AI_TEXTS.length), 3200);
      }
    }, 38);
    return () => { clearInterval(interval); clearTimeout(rotateTimer); };
  }, [aiTextIdx]);

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
      a.volume = 0.12;
      audioRef.current = a;
    }
    if (!soundOn) {
      audioRef.current.play().then(() => setSoundOn(true)).catch(() => {});
    } else {
      audioRef.current.pause();
      setSoundOn(false);
    }
  }, [soundOn]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  /* ── Generate news ─── */
  const generateNews = () => {
    const c = userClub.trim() || "seu clube";
    const s = userResult.trim() || "2–1";
    const hi = Math.floor(Math.random() * HEADLINE_TEMPLATES.length);
    const bi = Math.floor(Math.random() * BODY_TEMPLATES.length);
    setGeneratedNews({ headline: HEADLINE_TEMPLATES[hi](c, s), body: BODY_TEMPLATES[bi](c) });
  };

  const scrollTo = (id: string) => {
    const el = containerRef.current?.querySelector(`#${id}`);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  const rc = (r: string) => r === "V" ? "#00e5a0" : r === "D" ? "#ef4444" : "#555577";

  /* ── Feature mockup renderer ─── */
  const renderMockup = (id: string) => {
    switch (id) {
      case "painel":    return <PainelMockup />;
      case "partidas":  return <PartidaMockup homeScore={homeScore} awayScore={awayScore} onChangeHome={d => setHomeScore(p => Math.max(0, p + d))} onChangeAway={d => setAwayScore(p => Math.max(0, p + d))} />;
      case "elenco":    return <ElencoMockup />;
      case "transferencias": return <TranfMockup />;
      case "financeiro": return <FinMockup />;
      case "trofeus":   return <TrofeusMockup />;
      case "noticias":  return <AIMockup />;
      case "diretoria": return <DiretoriaMockup />;
      default:          return null;
    }
  };

  const activeF = FEATURES_EXPLORER[Math.max(0, activeFeature)];

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
        title={soundOn ? "Silenciar estádio" : "Som do estádio"}
        style={{ position: "fixed", bottom: 28, right: 28, zIndex: 200, width: 44, height: 44, borderRadius: "50%", background: "rgba(9,9,15,0.85)", border: `1px solid ${soundOn ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.12)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "none", backdropFilter: "blur(10px)", boxShadow: soundOn ? "0 0 20px rgba(245,158,11,0.25)" : "0 4px 20px rgba(0,0,0,0.4)", transition: "all 0.3s" }}
      >
        {soundOn ? "🔊" : "🔇"}
      </button>

      {/* ════════════════ NAVBAR ════════════════ */}
      <nav ref={navbarRef} style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", borderBottom: "1px solid transparent", transition: "backdrop-filter 0.3s, border-color 0.3s", background: "rgba(9,9,15,0.8)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="FC Career Manager" style={{ width: 34, height: 34, objectFit: "contain" }} />
          <span style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>FC Career Manager</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {[{ label: "Funcionalidades", id: "features" }, { label: "IA", id: "ia" }, { label: "Clube", id: "clube" }, { label: "Como funciona", id: "como-funciona" }].map(({ label, id }) => (
            <a key={id} href={`#${id}`} onClick={e => { e.preventDefault(); scrollTo(id); }} className="hidden md:block" style={{ color: "#666688", fontSize: 13, textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "#f0f0ff")} onMouseLeave={e => (e.currentTarget.style.color = "#666688")}>{label}</a>
          ))}
          <button data-cursor="ball" onClick={onLogin} style={{ background: "linear-gradient(135deg,#7c5cfc,#5b3fd1)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "none", transition: "all 0.25s", boxShadow: "0 4px 20px rgba(124,92,252,0.3)" }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 30px rgba(124,92,252,0.6)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px) scale(1.03)"; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(124,92,252,0.3)"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
            Entrar no jogo
          </button>
        </div>
      </nav>

      {/* ════════════════ HERO ════════════════ */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", overflow: "hidden", padding: "60px 40px" }}>
        {/* Layer 1: Field lines (far) — 2-layer parallax */}
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
        {/* Layer 2: Center line + circle (near) */}
        <div id="parallax-layer-2" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.028 }}>
          <svg viewBox="0 0 1200 700" fill="none" stroke="rgba(245,158,11,1)" strokeWidth={1.5} preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%" }}>
            <line x1="600" y1="200" x2="600" y2="500" />
            <circle cx="600" cy="350" r="60" />
          </svg>
        </div>

        {/* Radial glow — offset to right (where mockup is) */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 700px 550px at 65% 40%, rgba(124,92,252,0.09) 0%, transparent 70%), radial-gradient(ellipse 400px 300px at 22% 65%, rgba(245,158,11,0.04) 0%, transparent 60%)", pointerEvents: "none" }} />

        {/* Particle canvas */}
        <ParticleCanvas />

        {/* Hero content — split layout */}
        <div className="lp-hero-split" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 60 }}>

          {/* Left: text + CTAs */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Tagline with glitch */}
            <div className="font-bebas" style={{ lineHeight: 0.9, marginBottom: 24, animation: "heroGlitch 0.35s ease 0.4s 1 both" }}>
              <div style={{ fontSize: "clamp(2.4rem,4.5vw,4.2rem)", color: "#f0f0ff", animation: "landingSlideUp 0.9s ease 0.1s both" }}>Você lembra do título</div>
              <div style={{ fontSize: "clamp(2.4rem,4.5vw,4.2rem)", color: "#f0f0ff", animation: "landingSlideUp 0.9s ease 0.2s both" }}>que ganhou às 2 da manhã.</div>
              <div style={{ fontSize: "clamp(2.4rem,4.5vw,4.2rem)", background: "linear-gradient(135deg,#7c5cfc,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "landingSlideUp 0.9s ease 0.35s both" }}>A gente também.</div>
            </div>

            <p style={{ color: "#8888aa", fontSize: 15, lineHeight: 1.75, maxWidth: 440, marginBottom: 32, animation: "landingFadeIn 1s ease 0.7s both" }}>
              Registre partidas, acompanhe estatísticas, leia notícias geradas por IA e gerencie seu clube com a imersão que o modo carreira merece.
            </p>

            {/* CTAs */}
            <div className="lp-hero-ctas" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 40, animation: "landingFadeIn 1s ease 0.9s both" }}>
              <button data-cursor="ball" onClick={onStart}
                style={{ background: "linear-gradient(135deg,#7c5cfc,#5b3fd1)", color: "#fff", border: "none", borderRadius: 14, padding: "15px 36px", fontSize: 15, fontWeight: 700, cursor: "none", boxShadow: "0 8px 32px rgba(124,92,252,0.45)", transition: "all 0.25s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 50px rgba(124,92,252,0.7), 0 8px 32px rgba(124,92,252,0.5)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px) scale(1.03)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 32px rgba(124,92,252,0.45)"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
                Iniciar Carreira
              </button>
              <button onClick={onLogin}
                style={{ background: "rgba(255,255,255,0.04)", color: "#c0c0e0", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "15px 30px", fontSize: 15, fontWeight: 600, cursor: "none", display: "flex", alignItems: "center", gap: 10, transition: "all 0.25s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,92,252,0.45)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,92,252,0.08)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}>
                <span style={{ opacity: 0.7 }}>▶</span> Ver demonstração
              </button>
            </div>

            {/* Split-flap live counter */}
            <div style={{ animation: "landingFadeIn 1s ease 1.1s both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 12, padding: "14px 20px", maxWidth: 340 }}>
                <div>
                  <SplitFlap value={liveCount} />
                </div>
                <div>
                  <div style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>técnicos</div>
                  <div style={{ color: "#444466", fontSize: 10 }}>jogando neste momento</div>
                </div>
                <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "#00e5a0", boxShadow: "0 0 8px #00e5a0", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
              </div>
            </div>
          </div>

          {/* Right: HeroMockup */}
          <div className="lg-mockup" style={{ width: 380, flexShrink: 0 }}>
            <HeroMockup />
          </div>
        </div>
      </section>

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
      <section id="features" style={{ padding: "100px 0", background: "#09090f" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
          <div className="lp-reveal" style={{ marginBottom: 56, textAlign: "center" }}>
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Funcionalidades</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2.5rem,5vw,4rem)", color: "#f0f0ff", lineHeight: 1 }}>Tudo que um técnico de verdade precisa</h2>
          </div>

          {isMobile ? (
            /* ── Mobile: true accordion ── */
            <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden" }}>
              {FEATURES_EXPLORER.map((f, i) => {
                const open = activeFeature === i;
                const accentRaw = f.colorType === "tactical" ? "124,92,252" : f.colorType === "financial" ? "61,156,245" : f.colorType === "trophies" ? "245,158,11" : "0,229,160";
                return (
                  <div key={f.id} style={{ borderBottom: i < FEATURES_EXPLORER.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
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
            /* ── Desktop: sidebar + panel ── */
            <div style={{ display: "flex", gap: 0, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden", minHeight: 420 }}>
              {/* Sidebar */}
              <div style={{ width: 200, flexShrink: 0, background: "#0d0d1a", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {FEATURES_EXPLORER.map((f, i) => (
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

              {/* Content panel */}
              <div style={{ flex: 1, padding: "36px 40px", background: "transparent", display: "flex", gap: 40, alignItems: "flex-start", overflow: "hidden" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: activeF.accentColor }}>
                      {activeF.label}
                    </span>
                  </div>
                  <h3 style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 22, marginBottom: 14, lineHeight: 1.3 }}>{activeF.title}</h3>
                  <p style={{ color: "#8888aa", fontSize: 14, lineHeight: 1.75, maxWidth: 340 }}>{activeF.desc}</p>

                  {/* Progress dots */}
                  <div style={{ display: "flex", gap: 6, marginTop: 32 }}>
                    {FEATURES_EXPLORER.map((_, i) => (
                      <button key={i} onClick={() => setActiveFeature(i)} style={{ width: i === activeFeature ? 20 : 6, height: 6, borderRadius: 3, background: i === activeFeature ? activeF.accentColor : "rgba(255,255,255,0.12)", border: "none", cursor: "none", transition: "all 0.3s", padding: 0 }} />
                    ))}
                  </div>
                </div>

                {/* Mockup */}
                <div style={{ width: 300, flexShrink: 0 }}>
                  {renderMockup(activeF.id)}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════ CLUB THEME ════════════════ */}
      <section id="clube" style={{ position: "relative", overflow: "hidden", padding: "80px 0 64px", transition: "background 0.8s ease", background: `radial-gradient(ellipse 120% 100% at 50% 60%, rgba(${club.accentRgb},0.09) 0%, #09090f 55%)` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 32 }}>
            <p style={{ color: club.accent, fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12, transition: "color 0.5s" }}>Personalização</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2rem,4vw,3.2rem)", color: "#f0f0ff", lineHeight: 1 }}>O app se transforma com o seu clube</h2>
          </div>

          {/* Club tabs */}
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

          {/* Custom club input */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <div style={{ position: "relative", width: 280 }}>
              <input
                placeholder="Ou digite outro clube..."
                value={customClubInput}
                onChange={e => setCustomClubInput(e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${customClub ? `rgba(${customClub.accentRgb},0.4)` : clubNotFound ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 100, padding: "10px 20px", color: "#f0f0ff", fontSize: 13, outline: "none", fontFamily: "DM Sans, sans-serif", transition: "all 0.3s", cursor: "text" }}
              />
              {customClub && (
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: customClub.primary, boxShadow: `0 0 8px ${customClub.primary}` }} />
              )}
              {clubNotFound && customClubInput.length > 2 && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#1a1a2e", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 11, color: "#666688" }}>
                  Clube não encontrado. Em breve!
                </div>
              )}
            </div>
          </div>

          {/* Screenshot */}
          <div style={{ position: "relative", maxWidth: 900, margin: "0 auto" }}>
            <div style={{ transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)" }} onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.015)"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}>
              <div style={{ borderRadius: 20, overflow: "hidden", boxShadow: `0 0 60px rgba(${club.accentRgb},0.18), 0 0 120px rgba(${club.accentRgb},0.08)`, transition: "box-shadow 0.6s ease" }}>
                {/* Browser chrome */}
                <div style={{ background: "#080810", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid rgba(${club.accentRgb},0.12)` }}>
                  {[1,2,3].map(d => <span key={d} style={{ width: 12, height: 12, borderRadius: "50%", background: "#1a1a1a" }} />)}
                  <div style={{ flex: 1, height: 24, borderRadius: 6, background: "#111118", margin: "0 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#333355", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>fc-career-manager.replit.app</span>
                  </div>
                  <div style={{ background: `rgba(${club.accentRgb},0.12)`, border: `1px solid rgba(${club.accentRgb},0.28)`, borderRadius: 6, padding: "3px 12px", display: "flex", alignItems: "center", gap: 6, transition: "all 0.5s" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: club.accent, transition: "background 0.5s" }} />
                    <span style={{ color: club.accent, fontSize: 11, fontWeight: 600, transition: "color 0.5s" }}>{customClubName || CLUBS[activeClub].league}</span>
                  </div>
                </div>
                {/* Live mockup */}
                <ClubDemoMockup
                  clubName={customClubName || CLUBS[activeClub].name}
                  leagueName={CLUBS[activeClub].league}
                  accent={club.accent}
                  accentRgb={club.accentRgb}
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
      <section id="ia" style={{ position: "relative", overflow: "hidden", padding: "100px 40px", background: "#0f0e0a" }}>
        {/* Paper grain texture via SVG filter */}
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <filter id="paper-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>
        <div style={{ position: "absolute", inset: 0, filter: "url(#paper-noise)", opacity: 0.04, pointerEvents: "none" }} />
        {/* Editorial lamp light from top */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 900px 280px at 50% -8%, rgba(255,210,80,0.07) 0%, transparent 60%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "flex-start" }} className="lp-ai-grid">
          {/* Left */}
          <div className="lp-reveal-left">
            <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Inteligência Artificial</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2.2rem,4vw,3.6rem)", color: "#f0f0ff", lineHeight: 1.05, marginBottom: 28 }}>A imprensa que sua carreira merece</h2>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 16, marginBottom: 36 }}>
              {[
                "Notícias automáticas baseadas em eventos reais da sua carreira",
                "Reuniões com a diretoria que cobram metas e comentam o desempenho",
                "Tom que muda conforme você vence ou perde — épico, dramático, irônico",
                "Hat-tricks viram manchetes. Viradas se tornam lendas.",
              ].map(item => (
                <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    <svg viewBox="0 0 10 10" style={{ width: 8, height: 8 }}><path d="M1 5l3 3 5-6" stroke="#f59e0b" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span style={{ color: "#888899", fontSize: 14, lineHeight: 1.65 }}>{item}</span>
                </li>
              ))}
            </ul>

            {/* Interactive news generator */}
            <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 14, padding: "20px 22px" }}>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Gere a sua notícia agora</p>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <input placeholder="Seu clube (ex: Grêmio)" value={userClub} onChange={e => setUserClub(e.target.value)} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#f0f0ff", fontSize: 12, outline: "none", fontFamily: "DM Sans, sans-serif", cursor: "text", transition: "border-color 0.2s" }} onFocus={e => (e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)")} onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")} />
                <input placeholder="Resultado (3-1)" value={userResult} onChange={e => setUserResult(e.target.value)} style={{ width: 130, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#f0f0ff", fontSize: 12, outline: "none", fontFamily: "JetBrains Mono, monospace", cursor: "text", transition: "border-color 0.2s" }} onFocus={e => (e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)")} onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")} />
              </div>
              <button data-cursor="ball" onClick={generateNews} style={{ width: "100%", background: "linear-gradient(135deg,rgba(245,158,11,0.85),rgba(200,110,0,0.8))", border: "none", borderRadius: 8, padding: "10px 0", color: "#09090f", fontSize: 13, fontWeight: 700, cursor: "none", transition: "opacity 0.2s" }} onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")} onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}>
                Gerar notícia →
              </button>
              {generatedNews && (
                <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(0,0,0,0.4)", borderRadius: 10, borderLeft: "2px solid rgba(245,158,11,0.6)" }}>
                  <p style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8, lineHeight: 1.4 }}>{generatedNews.headline}</p>
                  <p style={{ color: "#777788", fontSize: 11, lineHeight: 1.65 }}>{generatedNews.body}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: AI news card (auto-typing) */}
          <div className="lp-reveal-right">
            <div style={{ background: "#0a0a10", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 18, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(245,158,11,0.05)" }}>
              <div style={{ background: "#111119", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={1.5} style={{ width: 15, height: 15 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" /></svg>
                  <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>A GAZETA DO TÉCNICO</span>
                </div>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5a0", animation: "pulse 1.5s ease-in-out infinite" }} />
                  <span style={{ color: "#00e5a0", fontSize: 10 }}>ao vivo</span>
                </div>
              </div>
              <div style={{ padding: "24px 24px", minHeight: 220 }}>
                {typedText.split("\n\n").map((block, bi) => (
                  <p key={bi} style={{ color: bi === 0 ? "#f0f0ff" : "#777788", fontSize: bi === 0 ? 14 : 13, fontWeight: bi === 0 ? 700 : 400, lineHeight: bi === 0 ? 1.4 : 1.72, marginBottom: 14, textTransform: bi === 0 ? "uppercase" : "none", letterSpacing: bi === 0 ? "0.02em" : 0, fontFamily: bi === 0 ? '"Bebas Neue", Impact, sans-serif' : '"DM Sans", sans-serif' }}>{block}</p>
                ))}
                {!typingDone && <span style={{ display: "inline-block", width: 2, height: 15, background: "#f59e0b", animation: "typewriterBlink 0.8s ease-in-out infinite", verticalAlign: "middle" }} />}
              </div>
              <div style={{ padding: "12px 24px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 8 }}>
                {AI_TEXTS.map((_, i) => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i === aiTextIdx ? "#f59e0b" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ HOW IT WORKS ════════════════ */}
      <section id="como-funciona" style={{ padding: "100px 40px", background: "#09090f" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 72 }}>
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Como funciona</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2.5rem,5vw,4rem)", color: "#f0f0ff" }}>Quatro passos para começar</h2>
          </div>
          <div style={{ position: "relative" }}>
            {/* Connecting line */}
            <div style={{ position: "absolute", top: 36, left: "12.5%", right: "12.5%", height: 1, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
              <div ref={stepLineRef} style={{ height: "100%", background: "linear-gradient(90deg,#7c5cfc,#f59e0b)", width: "0%", transition: "width 0s" }} />
            </div>
            <div className="lp-steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, position: "relative" }}>
              {STEPS.map((step, i) => (
                <div key={step.n} className={`lp-reveal lp-delay-${i + 1}`} style={{ textAlign: "center", padding: "0 12px" }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#0f0f1a", border: `1px solid ${i < 2 ? "rgba(124,92,252,0.25)" : i === 2 ? "rgba(61,156,245,0.25)" : "rgba(245,158,11,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", boxShadow: `0 0 28px ${i < 2 ? "rgba(124,92,252,0.08)" : i === 2 ? "rgba(61,156,245,0.08)" : "rgba(245,158,11,0.08)"}` }}>
                    {step.iconEl}
                  </div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: i < 2 ? "#7c5cfc" : i === 2 ? "#3d9cf5" : "#f59e0b", fontWeight: 700, marginBottom: 12, letterSpacing: "0.1em" }}>{step.n}</div>
                  <h3 style={{ color: "#f0f0ff", fontWeight: 700, fontSize: 13, marginBottom: 10, lineHeight: 1.4 }}>{step.title}</h3>
                  <p style={{ color: "#666688", fontSize: 12, lineHeight: 1.7 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ PRICING ════════════════ */}
      <section id="planos" style={{ padding: "100px 40px", background: "#09090f" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 64 }}>
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Planos</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2.5rem,5vw,4rem)", color: "#f0f0ff" }}>Escolha o seu nível de obsessão</h2>
          </div>
          <div className="lp-pricing-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
            {/* Free */}
            <div className="lp-reveal lp-delay-1" style={{ background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "36px 32px" }}>
              <p style={{ color: "#666688", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Grátis para sempre</p>
              <div className="font-bebas" style={{ fontSize: 48, color: "#f0f0ff", lineHeight: 1 }}>R$0</div>
              <p style={{ color: "#555577", fontSize: 13, marginTop: 8, marginBottom: 28 }}>Para quem quer começar</p>
              <button onClick={onStart} style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 14, color: "#888", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", cursor: "none", transition: "all 0.2s" }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#f0f0ff"; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "#888"; }}>
                Começar grátis
              </button>
              <ul style={{ marginTop: 28, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {["1 carreira ativa", "3 gerações de IA por dia", "Partidas ilimitadas", "Sem diretoria"].map(f => (
                  <li key={f} style={{ display: "flex", gap: 10, fontSize: 13, color: "#888899" }}>
                    <span style={{ color: "#00e5a0", marginTop: 2 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro — levitating */}
            <div className="lp-reveal lp-delay-2" style={{ background: "#111120", border: "1px solid rgba(124,92,252,0.35)", borderRadius: 20, padding: "36px 32px", position: "relative", boxShadow: "0 24px 80px rgba(124,92,252,0.22), 0 0 0 1px rgba(124,92,252,0.15), inset 0 -1px 0 rgba(124,92,252,0.1)", transform: "translateY(-8px)" }}>
              {/* Pro glow from below */}
              <div style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: "60%", background: "linear-gradient(to top, rgba(124,92,252,0.1) 0%, transparent 100%)", borderRadius: "0 0 20px 20px", pointerEvents: "none" }} />
              <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#7c5cfc,#5b3fd1)", borderRadius: 20, padding: "4px 16px", fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>Mais popular</div>
              <p style={{ color: "#7c5cfc", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Para quem leva a sério</p>
              <div className="font-bebas" style={{ fontSize: 48, color: "#f0f0ff", lineHeight: 1 }}>R$14<span style={{ fontSize: 24 }}>,90</span></div>
              <p style={{ color: "#555577", fontSize: 13, marginTop: 8, marginBottom: 28 }}>por mês</p>
              <button data-cursor="ball" onClick={() => onStartWithPlan("pro")} style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 14, color: "#fff", background: "linear-gradient(135deg,rgba(124,92,252,0.9),rgba(91,63,209,0.85))", border: "none", cursor: "none", boxShadow: "0 4px 24px rgba(124,92,252,0.4)", transition: "all 0.2s" }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 40px rgba(124,92,252,0.6), 0 4px 24px rgba(124,92,252,0.4)"; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 24px rgba(124,92,252,0.4)"; }}>
                Assinar Pro
              </button>
              <ul style={{ marginTop: 28, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {["Até 5 carreiras ativas", "20 gerações de IA por dia", "Diretoria com até 4 membros", "Notícias geradas em segundos"].map(f => (
                  <li key={f} style={{ display: "flex", gap: 10, fontSize: 13, color: "#c0c0d8" }}>
                    <span style={{ color: "#7c5cfc", marginTop: 2 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Ultra */}
            <div className="lp-reveal lp-delay-3" style={{ background: "#0d0d1a", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 20, padding: "36px 32px" }}>
              <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Para os obcecados</p>
              <div className="font-bebas" style={{ fontSize: 48, color: "#f0f0ff", lineHeight: 1 }}>R$39<span style={{ fontSize: 24 }}>,90</span></div>
              <p style={{ color: "#555577", fontSize: 13, marginTop: 8, marginBottom: 28 }}>por mês</p>
              <button data-cursor="ball" onClick={() => onStartWithPlan("ultra")} style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 14, color: "#fff", background: "linear-gradient(135deg,rgba(245,158,11,0.85),rgba(200,110,0,0.8))", border: "none", cursor: "none", boxShadow: "0 4px 24px rgba(245,158,11,0.3)", transition: "all 0.2s" }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 40px rgba(245,158,11,0.5), 0 4px 24px rgba(245,158,11,0.3)"; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 24px rgba(245,158,11,0.3)"; }}>
                Assinar Ultra
              </button>
              <ul style={{ marginTop: 28, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {["Boatos no vestiário", "Até 3 portais de notícias personalizados", "Carreiras ilimitadas", "Diretoria ilimitada", "IA com notícias mais detalhadas e dramáticas", "Notícias automáticas"].map(f => (
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
      <section style={{ padding: "80px 40px", background: "#0d0820", borderTop: "1px solid rgba(245,158,11,0.1)", borderBottom: "1px solid rgba(245,158,11,0.1)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 56 }}>
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Depoimentos</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2rem,4vw,3.2rem)", color: "#f0f0ff" }}>O que os técnicos dizem</h2>
          </div>
          <div className="lp-testimonials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, alignItems: "start" }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={t.handle} className={`lp-reveal lp-delay-${i + 1}`}
                style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "28px 28px", transform: i === 1 ? "translateY(32px)" : "none" }}>
                <p style={{ color: "#c0c0d8", fontSize: 14, lineHeight: 1.72, marginBottom: 24 }}>"{t.text}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: `rgba(${t.color.replace("#","").match(/.{2}/g)?.map(x=>parseInt(x,16)).join(",")},0.2)`, border: `1px solid ${t.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: t.color }}>{t.initials}</div>
                  <div>
                    <div style={{ color: "#f0f0ff", fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                    <div style={{ color: "#444466", fontSize: 12 }}>{t.handle}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ FAQ ════════════════ */}
      <section style={{ padding: "100px 40px", background: "#09090f" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <div className="text-center lp-reveal" style={{ marginBottom: 56 }}>
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>FAQ</p>
            <h2 className="font-bebas" style={{ fontSize: "clamp(2.5rem,5vw,4rem)", color: "#f0f0ff" }}>Perguntas frequentes</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {FAQ_ITEMS.map((item, i) => {
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
      <section style={{ position: "relative", overflow: "hidden", padding: "120px 40px", textAlign: "center", background: "#09090f" }}>
        {/* Stadium SVG background with slow zoom */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", animation: "stadiumZoom 22s ease-in-out infinite alternate", opacity: 0.15 }}>
            {/* Stadium silhouette */}
            <ellipse cx="600" cy="380" rx="560" ry="220" fill="none" stroke="rgba(124,92,252,0.4)" strokeWidth={2} />
            <ellipse cx="600" cy="380" rx="420" ry="165" fill="none" stroke="rgba(124,92,252,0.3)" strokeWidth={1.5} />
            <rect x="200" y="240" width="800" height="280" rx="20" fill="none" stroke="rgba(124,92,252,0.2)" strokeWidth={1} />
            {/* Field lines */}
            <rect x="260" y="280" width="680" height="200" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <line x1="600" y1="280" x2="600" y2="480" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <circle cx="600" cy="380" r="55" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <circle cx="600" cy="380" r="3" fill="rgba(255,255,255,0.15)" />
            {/* Stands detail */}
            {Array.from({ length: 18 }, (_, i) => (
              <line key={i} x1={220 + i * 42} y1="240" x2={200 + i * 46} y2="180" stroke="rgba(124,92,252,0.1)" strokeWidth={0.8} />
            ))}
            {Array.from({ length: 18 }, (_, i) => (
              <line key={i} x1={220 + i * 42} y1="520" x2={200 + i * 46} y2="560" stroke="rgba(124,92,252,0.1)" strokeWidth={0.8} />
            ))}
            {/* Crowd glow */}
            <ellipse cx="600" cy="380" rx="450" ry="180" fill="url(#stadiumGlow)" />
            <defs>
              <radialGradient id="stadiumGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(124,92,252,0.04)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>
          </svg>
        </div>

        {/* Dark overlay */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(9,9,15,0.78)", pointerEvents: "none" }} />
        {/* Purple glow below text */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 600px 400px at 50% 60%, rgba(124,92,252,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="lp-reveal">
            <p style={{ color: "#7c5cfc", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 24 }}>Comece agora</p>
            <h2 className="font-bebas lp-reveal" style={{ fontSize: "clamp(3rem,7vw,6rem)", color: "#f0f0ff", lineHeight: 0.92, marginBottom: 16 }}>
              A próxima conquista
            </h2>
            <h2 className="font-bebas" style={{ fontSize: "clamp(3rem,7vw,6rem)", background: "linear-gradient(135deg,#7c5cfc,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 0.92, marginBottom: 40 }}>
              merece ser registrada.
            </h2>
            <button data-cursor="ball" onClick={onStart}
              style={{ background: "linear-gradient(135deg,#7c5cfc,#5b3fd1)", color: "#fff", border: "none", borderRadius: 16, padding: "18px 48px", fontSize: 16, fontWeight: 700, cursor: "none", boxShadow: "0 12px 48px rgba(124,92,252,0.45)", transition: "all 0.25s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 60px rgba(124,92,252,0.7), 0 12px 48px rgba(124,92,252,0.5)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-4px) scale(1.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 12px 48px rgba(124,92,252,0.45)"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
              Iniciar Carreira — É grátis
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════ FOOTER ════════════════ */}
      <footer style={{ background: "#09090f", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo.png" alt="FC Career Manager" style={{ width: 22, height: 22, objectFit: "contain", opacity: 0.7 }} />
          <span style={{ color: "#444466", fontSize: 13, fontWeight: 600 }}>FC Career Manager</span>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          {["Termos", "Privacidade", "Suporte"].map(l => (
            <a key={l} href="#" style={{ color: "#444466", fontSize: 12, textDecoration: "none" }} onMouseEnter={e => (e.currentTarget.style.color = "#888899")} onMouseLeave={e => (e.currentTarget.style.color = "#444466")}>{l}</a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <img src="/logo.png" alt="" style={{ width: 16, height: 16, objectFit: "contain", opacity: 0.5 }} />
          <p style={{ color: "#333355", fontSize: 12, margin: 0 }}>© {new Date().getFullYear()} FC Career Manager. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
