import { useState, useEffect } from "react";
import { Club } from "@/types/club";

interface DashboardProps {
  club: Club;
  season: string;
  onSeasonChange: (season: string) => void;
  onChangeClub: () => void;
}

interface StatCard {
  label: string;
  value: number;
  icon: React.ReactNode;
  description: string;
}

function BallIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 0110 10M12 2C6.477 2 2 6.477 2 12m10-10l2 6H10l2-6zM2 12l4.5-3 3 5-3 5L2 12zm20 0l-4.5-3-3 5 3 5L22 12z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

interface RoadmapItem {
  fase: string;
  titulo: string;
  descricao: string;
  accentOpacity: string;
}

const ROADMAP: RoadmapItem[] = [
  {
    fase: "Fase 2",
    titulo: "Registro de Partidas",
    descricao: "Registre resultados, gols, assistências e estatísticas de cada partida",
    accentOpacity: "18",
  },
  {
    fase: "Fase 3",
    titulo: "Gestão do Elenco",
    descricao: "Acompanhe cada jogador — evolução, desempenho e potencial ao longo da temporada",
    accentOpacity: "12",
  },
  {
    fase: "Fase 4",
    titulo: "Mercado de Transferências",
    descricao: "Registre chegadas e saídas, controle investimentos e o valor do seu elenco",
    accentOpacity: "16",
  },
  {
    fase: "Fase 5",
    titulo: "Estatísticas da Temporada",
    descricao: "Gráficos, artilheiros, sequências, médias e análise completa do desempenho",
    accentOpacity: "10",
  },
];

function useClubLogo(club: Club): string | null {
  const [src, setSrc] = useState<string | null>(() => {
    if (club.logo) return club.logo;
    if (club.apiFootballId) return `https://media.api-sports.io/football/teams/${club.apiFootballId}.png`;
    return null;
  });

  useEffect(() => {
    if (club.logo) { setSrc(club.logo); return; }
    if (club.apiFootballId) {
      setSrc(`https://media.api-sports.io/football/teams/${club.apiFootballId}.png`);
      return;
    }
    setSrc(null);
  }, [club.name, club.logo, club.apiFootballId]);

  return src;
}

export function Dashboard({ club, season, onSeasonChange, onChangeClub }: DashboardProps) {
  const logoUrl = useClubLogo(club);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [editingSeason, setEditingSeason] = useState(false);
  const [seasonDraft, setSeasonDraft] = useState(season);

  useEffect(() => {
    setSeasonDraft(season);
  }, [season]);

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [logoUrl]);

  const statCards: StatCard[] = [
    { label: "Partidas",       value: 0, icon: <BallIcon />,    description: "partidas registradas" },
    { label: "Elenco",         value: 0, icon: <PeopleIcon />,  description: "jogadores cadastrados" },
    { label: "Transferências", value: 0, icon: <TransferIcon />, description: "movimentações registradas" },
  ];

  const commitSeason = () => {
    const trimmed = seasonDraft.trim();
    if (trimmed) onSeasonChange(trimmed);
    setEditingSeason(false);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--app-bg, #0a0a0a)" }}>
      {/* Header */}
      <header className="relative w-full overflow-hidden" style={{ background: "var(--club-gradient)" }}>
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, var(--club-primary) 0%, transparent 60%), radial-gradient(circle at 80% 50%, var(--club-secondary) 0%, transparent 60%)`,
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                {logoUrl && !imgError ? (
                  <img
                    src={logoUrl}
                    alt={club.name}
                    className={`w-16 h-16 object-contain transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className="text-3xl font-black text-white/40">
                    {club.name.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <p className="text-[var(--club-primary)] text-xs font-semibold tracking-widest uppercase mb-1">
                  Gerenciador de Carreira
                </p>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {club.name}
                </h1>
                <p className="text-white/50 text-sm mt-1">{club.league}</p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-3">
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs">Temporada atual:</span>
                {editingSeason ? (
                  <input
                    autoFocus
                    value={seasonDraft}
                    onChange={(e) => setSeasonDraft(e.target.value)}
                    onBlur={commitSeason}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitSeason();
                      if (e.key === "Escape") { setSeasonDraft(season); setEditingSeason(false); }
                    }}
                    className="px-3 py-1 rounded-lg text-white font-bold text-sm focus:outline-none focus:ring-1 focus:ring-[var(--club-primary)]"
                    style={{
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      minWidth: "80px",
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingSeason(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-sm text-white hover:bg-white/10 transition-colors duration-200 group"
                    style={{ border: "1px solid rgba(255,255,255,0.15)" }}
                    title="Clique para editar a temporada"
                  >
                    {season}
                    <svg className="w-3 h-3 text-white/40 group-hover:text-white/70 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>

              <button
                onClick={onChangeClub}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:opacity-80 active:scale-95"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Trocar de clube
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        <h2 className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-5">Visão Geral</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="relative flex flex-col gap-4 p-6 rounded-2xl overflow-hidden group"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: "linear-gradient(135deg, var(--club-primary)08, transparent)" }}
              />
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-sm font-medium">{card.label}</span>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--club-primary)]"
                  style={{ background: "var(--club-primary)18" }}
                >
                  {card.icon}
                </div>
              </div>
              <div>
                <p className="text-4xl font-black text-white tabular-nums">{card.value}</p>
                <p className="text-white/30 text-xs mt-1">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-12">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-white/40 text-xs font-semibold tracking-widest uppercase">
            Próximas funcionalidades
          </h2>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "var(--club-primary)20", color: "var(--club-primary)" }}
          >
            Em breve
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ROADMAP.map((item) => (
            <div
              key={item.fase}
              className="relative flex gap-4 p-5 rounded-2xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, var(--club-primary)${item.accentOpacity}, var(--club-secondary)0a)`,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex-shrink-0">
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
                >
                  {item.fase}
                </span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">{item.titulo}</p>
                <p className="text-white/40 text-xs mt-1.5 leading-relaxed">{item.descricao}</p>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-white/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
