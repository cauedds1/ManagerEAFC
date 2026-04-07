import { useState, useEffect } from "react";
import { ClubEntry } from "@/types/club";
import { getSquad, SquadPlayer } from "@/lib/squadCache";
import { FootballPitch } from "./FootballPitch";

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
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl animate-slide-up"
      style={{
        animationDelay: `${Math.min(index * 30, 500)}ms`,
        animationFillMode: "both",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Photo or avatar */}
      <div
        className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        {player.photo && !imgErr ? (
          <img
            src={player.photo}
            alt={player.name}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <svg viewBox="0 0 40 40" className="w-6 h-6" style={{ color: "rgba(255,255,255,0.2)" }} fill="currentColor">
            <circle cx="20" cy="14" r="7" />
            <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate leading-tight">{player.name}</p>
        {player.age > 0 && (
          <p className="text-white/30 text-xs mt-0.5">{player.age} anos</p>
        )}
      </div>
      <span
        className="text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0"
        style={{ background: pos.bg, color: pos.color }}
      >
        {player.positionPtBr}
      </span>
      {player.number != null && (
        <span className="text-white/20 text-xs w-5 text-right tabular-nums flex-shrink-0">
          #{player.number}
        </span>
      )}
    </div>
  );
}

function ClubLogoHero({ logo, name }: { logo: string; name: string }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="w-28 h-28 rounded-3xl flex items-center justify-center"
      style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)", border: "2px solid rgba(255,255,255,0.2)" }}
    >
      {logo && !err ? (
        <img
          src={logo}
          alt={name}
          className={`w-20 h-20 object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
        />
      ) : (
        <span className="text-4xl font-black text-white/40">{name.slice(0, 2).toUpperCase()}</span>
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
        if (!cancelled) {
          setPlayers(result.players);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [club.id, club.name]);

  const starters = players.slice(0, 11);
  const bench = players.slice(11);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="text-center mb-5">
        <p
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: "var(--club-primary, #6366f1)" }}
        >
          Etapa 3 de 3
        </p>
        <h2 className="text-3xl font-black text-white mb-1">Seu clube</h2>
        <p className="text-white/40 text-sm">Confirme e inicie sua carreira</p>
      </div>

      {/* Club Hero */}
      <div
        className="rounded-3xl p-6 mb-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--club-primary, #1a1a2e)40, var(--club-secondary, #16213e)40)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 20% 50%, var(--club-primary, #6366f1)15, transparent 70%), radial-gradient(ellipse at 80% 50%, var(--club-secondary, #4f46e5)10, transparent 70%)",
          }}
        />
        <div className="relative flex items-center gap-5">
          <ClubLogoHero logo={club.logo} name={club.name} />
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-bold tracking-widest uppercase mb-1"
              style={{ color: "var(--club-primary, #6366f1)" }}
            >
              {club.league}
            </p>
            <h3 className="text-2xl font-black text-white leading-tight">{club.name}</h3>
            {club.country && (
              <p className="text-white/40 text-sm mt-1">{club.country}</p>
            )}
            {/* Stadium & founding year */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {club.stadium && (
                <span className="flex items-center gap-1 text-xs text-white/35">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {club.stadium}
                  {club.stadiumCapacity && (
                    <span className="text-white/20">· {club.stadiumCapacity.toLocaleString()} lug.</span>
                  )}
                </span>
              )}
              {club.founded && (
                <span className="flex items-center gap-1 text-xs text-white/35">
                  {club.stadium && <span className="text-white/15 mx-0.5">·</span>}
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Fundado em {club.founded}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
              >
                Temporada {season}
              </span>
              {!loading && players.length > 0 && (
                <span
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
                >
                  {players.length} jogadores
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pitch + Bench */}
      <div className="flex gap-4 flex-1 min-h-0 mb-5">
        {/* Pitch */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-white/50 text-xs font-semibold tracking-widest uppercase">
              Titulares
            </h4>
            {!loading && starters.length > 0 && (
              <span className="text-white/25 text-xs tabular-nums">({starters.length})</span>
            )}
          </div>
          <div className="flex-1 rounded-2xl overflow-hidden" style={{ minHeight: 280, maxHeight: 400 }}>
            <FootballPitch players={players} loading={loading} className="h-full" />
          </div>
        </div>

        {/* Bench */}
        {(loading || bench.length > 0) && (
          <div className="flex flex-col" style={{ width: 200 }}>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-white/50 text-xs font-semibold tracking-widest uppercase">
                Reservas
              </h4>
              {!loading && bench.length > 0 && (
                <span className="text-white/25 text-xs tabular-nums">({bench.length})</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="w-9 h-9 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)", width: "70%" }} />
                      <div className="h-2 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)", width: "40%" }} />
                    </div>
                  </div>
                ))
              ) : (
                bench.map((player, i) => (
                  <BenchPlayerRow key={player.id} player={player} index={i} />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={confirming}
          className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-semibold text-sm text-white/50 hover:text-white transition-all duration-200 disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="flex-1 py-4 rounded-2xl font-bold text-white text-base transition-all duration-200 hover:opacity-90 active:scale-98 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: "var(--club-primary, #6366f1)" }}
        >
          {confirming ? (
            <>
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Iniciando...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
