import { useState } from "react";
import barcelonaImg from "@assets/image_1776617843810.png";
import cercleImg from "@assets/image_1776617935759.png";
import watfordImg from "@assets/image_1776617960332.png";
import mancityImg from "@assets/image_1776618081358.png";
import squadImg from "@assets/image_1775527949802.png";
import matchImg from "@assets/image_1775621037348.png";
import statsImg from "@assets/image_1776616401887.png";

interface LandingPageProps {
  onStart: () => void;
  onLogin: () => void;
}

const CLUBS = [
  {
    name: "Barcelona",
    league: "La Liga",
    img: barcelonaImg,
    accent: "#a50044",
    accentRgb: "165,0,68",
    textDark: false,
  },
  {
    name: "Cercle Brugge",
    league: "Belgian Pro League",
    img: cercleImg,
    accent: "#00a650",
    accentRgb: "0,166,80",
    textDark: false,
  },
  {
    name: "Watford",
    league: "Championship",
    img: watfordImg,
    accent: "#EDBB00",
    accentRgb: "237,187,0",
    textDark: true,
  },
  {
    name: "Manchester City",
    league: "Premier League",
    img: mancityImg,
    accent: "#6CABDD",
    accentRgb: "108,171,221",
    textDark: false,
  },
];

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    title: "Partidas & Estatísticas",
    desc: "Registre jogos com placar, gols, cartões e dados detalhados por partida.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
      </svg>
    ),
    title: "Notícias com IA",
    desc: "Reportagens geradas automaticamente com base nos seus resultados.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
    title: "Gestão de Elenco",
    desc: "Acompanhe cada jogador com posição, valor de mercado e evolução.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
    title: "Controle Financeiro",
    desc: "Receitas, despesas e balanço da temporada em um painel claro.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    title: "Transferências",
    desc: "Registre entradas e saídas, valores e janelas de transferência.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
      </svg>
    ),
    title: "Diretoria Interativa",
    desc: "Lide com exigências do conselho e objetivos da temporada.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
      </svg>
    ),
    title: "Conquistas & Troféus",
    desc: "Registre títulos nacionais, internacionais e recordes históricos.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
      </svg>
    ),
    title: "Tema por Clube",
    desc: "Interface que muda de cor automaticamente para refletir seu clube.",
  },
];

export function LandingPage({ onStart, onLogin }: LandingPageProps) {
  const [activeClub, setActiveClub] = useState(0);
  const club = CLUBS[activeClub];

  return (
    <div className="relative min-h-full overflow-y-auto overflow-x-hidden" style={{ scrollbarGutter: "stable" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 py-4"
        style={{ background: "rgba(11,7,20,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1)" }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z" />
              <path d="M12 5l1.8 3.6L17.4 9l-2.7 2.7.6 3.9L12 13.8l-3.3 1.8.6-3.9L6.6 9l3.6-.4L12 5z" />
            </svg>
          </div>
          <span className="font-black text-white text-base tracking-tight">FC Career Manager</span>
        </div>
        <button
          onClick={onLogin}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.1)" }}>
          Entrar
        </button>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center text-center px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 uppercase tracking-widest"
          style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Career Mode reimaginado
        </div>

        <h1 className="font-black text-white leading-tight mb-6 max-w-3xl"
          style={{ fontSize: "clamp(2.2rem,6vw,4rem)", letterSpacing: "-0.03em" }}>
          Sua carreira no{" "}
          <span style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            modo mais imersivo
          </span>
        </h1>

        <p className="text-white/50 max-w-xl mb-10 leading-relaxed" style={{ fontSize: "clamp(1rem,2.5vw,1.2rem)" }}>
          Registre partidas, acompanhe estatísticas, leia notícias geradas por IA e gerencie seu clube — com temas que se adaptam às cores do seu time.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <button
            onClick={onStart}
            className="px-8 py-3.5 rounded-2xl font-bold text-white text-base transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-2xl"
            style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1)", boxShadow: "0 8px 32px rgba(139,92,246,0.35)" }}>
            Criar carreira grátis
          </button>
          <button
            onClick={onLogin}
            className="px-8 py-3.5 rounded-2xl font-semibold text-base transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}>
            Já tenho uma conta
          </button>
        </div>

        {/* Gradient orbs */}
        <div className="absolute top-10 left-1/4 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-30"
          style={{ background: "rgba(139,92,246,0.3)" }} />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 rounded-full blur-[80px] pointer-events-none opacity-20"
          style={{ background: "rgba(99,102,241,0.4)" }} />
      </section>

      {/* Club Themes Section */}
      <section className="relative px-4 md:px-8 pb-24 transition-all duration-700"
        style={{ "--section-accent": club.accent, "--section-accent-rgb": club.accentRgb } as React.CSSProperties}>

        {/* Section bg glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl transition-all duration-700"
          style={{ background: `radial-gradient(ellipse 60% 60% at 50% 0%, rgba(${club.accentRgb},0.08) 0%, transparent 70%)` }} />

        <div className="relative max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest mb-3 transition-colors duration-700"
              style={{ color: club.accent }}>
              Personalização
            </p>
            <h2 className="font-black text-white text-2xl md:text-3xl mb-3" style={{ letterSpacing: "-0.02em" }}>
              Tema que acompanha seu clube
            </h2>
            <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
              A interface muda de cor automaticamente para refletir a identidade visual do seu time.
            </p>
          </div>

          {/* Club tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {CLUBS.map((c, i) => {
              const isActive = i === activeClub;
              return (
                <button
                  key={c.name}
                  onClick={() => setActiveClub(i)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
                  style={isActive ? {
                    background: `rgba(${c.accentRgb},0.18)`,
                    border: `1px solid rgba(${c.accentRgb},0.45)`,
                    color: c.accent,
                    boxShadow: `0 0 16px rgba(${c.accentRgb},0.15)`,
                  } : {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.45)",
                  }}>
                  <span className="w-2 h-2 rounded-full transition-all duration-300"
                    style={{ background: isActive ? c.accent : "rgba(255,255,255,0.2)" }} />
                  {c.name}
                </button>
              );
            })}
          </div>

          {/* Screenshot frame */}
          <div className="relative rounded-2xl overflow-hidden transition-all duration-500"
            style={{
              boxShadow: `0 0 0 1px rgba(${club.accentRgb},0.2), 0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(${club.accentRgb},0.08)`,
              background: "#0B0714",
            }}>
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-4 py-3"
              style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="w-3 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
              <div className="flex-1 mx-4 h-6 rounded-md flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                <span className="text-white/25 text-xs font-mono">fc-career-manager.replit.app</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors duration-500"
                style={{ background: `rgba(${club.accentRgb},0.15)`, color: club.accent }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: club.accent }} />
                {club.league}
              </div>
            </div>

            {/* Screenshot */}
            <div className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
              {CLUBS.map((c, i) => (
                <img
                  key={c.name}
                  src={c.img}
                  alt={`Tema ${c.name}`}
                  className="absolute inset-0 w-full h-full object-cover object-top transition-all duration-500"
                  style={{ opacity: i === activeClub ? 1 : 0, transform: i === activeClub ? "scale(1)" : "scale(1.02)" }}
                />
              ))}
            </div>

            {/* Bottom badge */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="text-white/30 text-xs">Tema automático ativo</span>
              <div className="flex items-center gap-2 text-xs font-semibold transition-colors duration-500"
                style={{ color: club.accent }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: club.accent }} />
                {club.name}
              </div>
            </div>
          </div>

          {/* Color swatches */}
          <div className="flex justify-center gap-3 mt-6">
            {CLUBS.map((c, i) => (
              <button key={c.name} onClick={() => setActiveClub(i)}
                className="w-6 h-6 rounded-full transition-all duration-300 hover:scale-125"
                style={{
                  background: c.accent,
                  opacity: i === activeClub ? 1 : 0.35,
                  boxShadow: i === activeClub ? `0 0 12px rgba(${c.accentRgb},0.6)` : "none",
                  transform: i === activeClub ? "scale(1.2)" : "scale(1)",
                }}
                title={c.name} />
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 md:px-10 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-violet-400">Funcionalidades</p>
            <h2 className="font-black text-white text-2xl md:text-3xl" style={{ letterSpacing: "-0.02em" }}>
              Tudo que um treinador precisa
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title}
                className="group p-5 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-default"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                  style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>
                  {f.icon}
                </div>
                <h3 className="text-white font-bold text-sm mb-1.5">{f.title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="px-6 md:px-10 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-violet-400">O app por dentro</p>
            <h2 className="font-black text-white text-2xl md:text-3xl" style={{ letterSpacing: "-0.02em" }}>
              Cada detalhe da sua carreira
            </h2>
            <p className="text-white/40 text-sm mt-3 max-w-md mx-auto leading-relaxed">
              Do elenco ao placar final — tudo registrado em uma interface feita para o Career Mode.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { img: squadImg, label: "Gestão de elenco", desc: "Jogadores, posições e valores de mercado" },
              { img: matchImg, label: "Registro de partidas", desc: "Gols, cartões e estatísticas por jogo" },
              { img: statsImg, label: "Estatísticas detalhadas", desc: "Performance individual por temporada" },
            ].map(({ img, label, desc }) => (
              <div key={label} className="rounded-2xl overflow-hidden"
                style={{ background: "#0B0714", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
                {/* Mini browser chrome */}
                <div className="flex items-center gap-1.5 px-3 py-2.5"
                  style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
                  <div className="flex-1 ml-2 h-4 rounded"
                    style={{ background: "rgba(255,255,255,0.04)" }} />
                </div>
                {/* Screenshot */}
                <div className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
                  <img src={img} alt={label} className="w-full h-full object-cover object-top" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 70%, rgba(11,7,20,0.8) 100%)" }} />
                </div>
                {/* Caption */}
                <div className="px-4 py-3">
                  <p className="text-white text-sm font-semibold">{label}</p>
                  <p className="text-white/35 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 md:px-10 py-20">
        <div className="max-w-2xl mx-auto text-center relative">
          <div className="absolute inset-0 rounded-3xl blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />
          <div className="relative p-10 md:p-14 rounded-3xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1)", boxShadow: "0 8px 32px rgba(139,92,246,0.4)" }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 5l1.8 3.6L17.4 9l-2.7 2.7.6 3.9L12 13.8l-3.3 1.8.6-3.9L6.6 9l3.6-.4L12 5z" />
              </svg>
            </div>
            <h2 className="font-black text-white text-2xl md:text-3xl mb-4" style={{ letterSpacing: "-0.02em" }}>
              Pronto para começar?
            </h2>
            <p className="text-white/45 mb-8 leading-relaxed">
              Crie sua carreira em segundos. Escolha seu clube, registre a primeira partida e mergulhe no Career Mode.
            </p>
            <button
              onClick={onStart}
              className="px-10 py-4 rounded-2xl font-bold text-white text-base transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1)", boxShadow: "0 8px 32px rgba(139,92,246,0.4)" }}>
              Criar carreira grátis
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-white/25 text-xs">
          FC Career Manager · Feito para fãs de Career Mode
        </p>
      </footer>
    </div>
  );
}
