import { useState, useEffect } from "react";
import { ClubEntry } from "@/types/club";
import { getSquad, SquadPlayer } from "@/lib/squadCache";
import { FootballPitch, pickBestElevenIds } from "./FootballPitch";

interface TeamPreviewProps {
  club: ClubEntry;
  season: string;
  onConfirm: () => void;
  onBack: () => void;
  confirming?: boolean;
}

const POS_COLOR: Record<string, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)", color: "#f59e0b" },
  ZAG: { bg: "rgba(59,130,246,0.18)", color: "#60a5fa" },
  VOL: { bg: "rgba(16,185,129,0.18)", color: "#34d399" },
  ATA: { bg: "rgba(239,68,68,0.18)", color: "#f87171" },
};

function BenchPlayerRow({ player, index }: { player: SquadPlayer; index: number }) {
  const [imgErr, setImgErr] = useState(false);
  const pos = POS_COLOR[player.positionPtBr] ?? POS_COLOR.VOL;

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl animate-slide-up glass"
      style={{ animationDelay: `${Math.min(index * 30, 500)}ms`, animationFillMode: "both" }}
    >
      <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.06)" }}>
        {player.photo && !imgErr ? (
          <img src={player.photo} alt={player.name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <svg viewBox="0 0 40 40" className="w-4 h-4" style={{ color: "rgba(255,255,255,0.2)" }} fill="currentColor">
            <circle cx="20" cy="14" r="7" />
            <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-semibold truncate leading-tight">{player.name}</p>
        {player.age > 0 && <p className="text-white/25 text-[10px] mt-0.5">{player.age} anos</p>}
      </div>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: pos.bg, color: pos.color }}>
        {player.positionPtBr}
      </span>
    </div>
  );
}

function ClubLogoHero({ logo, name }: { logo: string; name: string }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{ background: "rgba(var(--club-primary-rgb),0.1)", border: "2px solid rgba(var(--club-primary-rgb),0.2)", boxShadow: "0 0 30px rgba(var(--club-primary-rgb),0.15)" }}>
      {logo && !err ? (
        <img
          src={logo}
          alt={name}
          className={`w-14 h-14 object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
        />
      ) : (
        <span className="text-2xl font-black text-white/40">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

export function TeamPreview({ club, season, onConfirm, onBack, confirming }: TeamPreviewProps) {
  const [players, setPlayers] = useState<SquadPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPlayers([]);
    getSquad(club.id, club.name)
      .then((result) => {
        if (!cancelled) { setPlayers(result.players); setLoading(false); }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [club.id, club.name]);

  const starterIds = pickBestElevenIds(players);
  const bench = players.filter((p) => !starterIds.has(p.id));

  return (
    <div className="flex flex-col animate-fade-up">
      <div className="text-center mb-3">
        <p className="text-xs font-bold tracking-widest uppercase mb-1.5" style={{ color: "var(--club-primary)" }}>
          Etapa 3 de 3
        </p>
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">Seu clube</h2>
        <p className="text-white/40 text-sm">Confirme e inicie sua carreira</p>
      </div>

      <div className="rounded-2xl p-3.5 mb-3 relative overflow-hidden glass"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 20% 50%, rgba(var(--club-primary-rgb),0.08), transparent 70%)" }} />
        <div className="relative flex items-center gap-4">
          <ClubLogoHero logo={club.logo} name={club.name} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--club-primary)" }}>
              {club.league}
            </p>
            <h3 className="text-xl font-black text-white leading-tight">{club.name}</h3>
            {club.country && <p className="text-white/40 text-xs mt-0.5">{club.country}</p>}
            <div className="flex flex-wrap gap-2 mt-1.5">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: "rgba(var(--club-primary-rgb),0.12)", color: "var(--club-primary)" }}>
                Temporada {season}
              </span>
              {!loading && players.length > 0 && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                  {players.length} jogadores
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3 mb-3">
        <div className="flex flex-col min-w-0">
          <h4 className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-1.5">
            Titulares {!loading && players.length > 0 && <span className="text-white/25">({Math.min(players.length, 11)})</span>}
          </h4>
          <div className="rounded-2xl overflow-hidden" style={{ minHeight: 220 }}>
            <FootballPitch players={players} loading={loading} className="h-full" />
          </div>
        </div>

        {(loading || bench.length > 0) && (
          <div className="flex flex-col">
            <h4 className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-1.5">
              Reservas {!loading && bench.length > 0 && <span className="text-white/25">({bench.length})</span>}
            </h4>
            <div className="flex flex-col gap-1 overflow-y-auto flex-1" style={{ maxHeight: 320 }}>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl glass">
                    <div className="w-7 h-7 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                    <div className="flex-1 space-y-1">
                      <div className="h-2.5 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)", width: "70%" }} />
                      <div className="h-2 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)", width: "40%" }} />
                    </div>
                  </div>
                ))
              ) : (
                bench.map((player, i) => <BenchPlayerRow key={player.id} player={player} index={i} />)
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={confirming}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-white/50 hover:text-white transition-all duration-200 disabled:opacity-40 glass glass-hover"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: "var(--club-gradient)", boxShadow: "0 4px 20px rgba(var(--club-primary-rgb),0.25)" }}
        >
          {confirming ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Iniciando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Iniciar Carreira
            </>
          )}
        </button>
      </div>
    </div>
  );
}
