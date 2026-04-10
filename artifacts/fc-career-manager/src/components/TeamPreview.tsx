import { useState, useEffect, useCallback } from "react";
import { ClubEntry } from "@/types/club";
import { getSquad, SquadPlayer } from "@/lib/squadCache";
import { getOpenAIKey } from "@/lib/openaiKeyStorage";

interface ClubTitle {
  name: string;
  count: number;
}

interface ClubInfo {
  description: string;
  titles: ClubTitle[];
}

interface TeamPreviewProps {
  club: ClubEntry;
  season: string;
  onNext: () => void;
  onBack: () => void;
  onClubInfoLoaded?: (info: ClubInfo) => void;
}

const POS_COLOR: Record<string, { bg: string; color: string }> = {
  GOL: { bg: "rgba(245,158,11,0.18)", color: "#f59e0b" },
  DEF: { bg: "rgba(59,130,246,0.18)", color: "#60a5fa" },
  MID: { bg: "rgba(16,185,129,0.18)", color: "#34d399" },
  ATA: { bg: "rgba(239,68,68,0.18)",  color: "#f87171" },
};

const POS_GROUP: Record<string, string> = {
  GOL: "Goleiros",
  DEF: "Defensores",
  MID: "Meio-Campistas",
  ATA: "Atacantes",
};

const GROUP_ORDER = ["Goleiros", "Defensores", "Meio-Campistas", "Atacantes"];

const TROPHY_COLORS: Array<[RegExp, string]> = [
  [/champions|liga dos campe/i, "#fbbf24"],
  [/copa do mundo de clubes|intercontinental|mundial/i, "#a78bfa"],
  [/europa league|liga europa/i, "#f97316"],
  [/conference/i, "#34d399"],
  [/premier league/i, "#7c3aed"],
  [/la liga|liga española/i, "#ef4444"],
  [/bundesliga/i, "#dc2626"],
  [/serie a|coppa italia/i, "#3b82f6"],
  [/ligue 1|coupe de france/i, "#60a5fa"],
  [/brasileiro|copa do brasil/i, "#34d399"],
  [/fa cup|copa da fa/i, "#93c5fd"],
  [/championship/i, "#38bdf8"],
  [/libertadores/i, "#4ade80"],
  [/sulamericana/i, "#fb923c"],
];

function getTrophyColor(name: string): string {
  for (const [pattern, color] of TROPHY_COLORS) {
    if (pattern.test(name)) return color;
  }
  return "#f59e0b";
}

function TrophyIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill={color}>
      <path d="M7 3H4v4c0 2.2 1.8 4 4 4h1c.5 1.4 1.5 2.5 2.7 3.1L11 16H8v2h8v-2h-3l-.7-1.9c1.2-.6 2.2-1.7 2.7-3.1h1c2.2 0 4-1.8 4-4V3h-3v2H7V3zM5 7V5h2v2c0 1.1-.9 2-2 2v-.5c0-.8.4-1.5.9-2H5zm14 0h-.9c.5.5.9 1.2.9 2V9c-1.1 0-2-.9-2-2V5h2v2z"/>
    </svg>
  );
}

function PlayerCard({ player }: { player: SquadPlayer }) {
  const [imgErr, setImgErr] = useState(false);
  const pos = POS_COLOR[player.positionPtBr] ?? POS_COLOR.MID;
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150 hover:bg-white/5">
      <div
        className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        {player.photo && !imgErr ? (
          <img src={player.photo} alt={player.name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <svg viewBox="0 0 40 40" className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.2)" }} fill="currentColor">
            <circle cx="20" cy="14" r="7" />
            <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14H6z" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-semibold truncate leading-tight">{player.name}</p>
        {player.age > 0 && <p className="text-white/25 text-[10px]">{player.age} anos</p>}
      </div>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: pos.bg, color: pos.color }}>
        {player.positionPtBr}
      </span>
    </div>
  );
}

function ClubLogo({ logo, name }: { logo: string; name: string }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        background: "rgba(var(--club-primary-rgb),0.12)",
        border: "2px solid rgba(var(--club-primary-rgb),0.25)",
        boxShadow: "0 0 30px rgba(var(--club-primary-rgb),0.2)",
      }}
    >
      {logo && !err ? (
        <img
          src={logo}
          alt={name}
          className={`w-11 h-11 object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
        />
      ) : (
        <span className="text-2xl font-black text-white/40">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

export function TeamPreview({ club, season, onNext, onBack, onClubInfoLoaded }: TeamPreviewProps) {
  const [players, setPlayers] = useState<SquadPlayer[]>([]);
  const [loadingSquad, setLoadingSquad] = useState(true);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingSquad(true);
    getSquad(club.id, club.name)
      .then((r) => { if (!cancelled) { setPlayers(r.players); setLoadingSquad(false); } })
      .catch(() => { if (!cancelled) setLoadingSquad(false); });
    return () => { cancelled = true; };
  }, [club.id, club.name]);

  const fetchClubInfo = useCallback(async () => {
    setLoadingInfo(true);
    try {
      const res = await fetch("/api/club-info", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-openai-key": getOpenAIKey() },
        body: JSON.stringify({ clubName: club.name, clubLeague: club.league, clubCountry: club.country }),
      });
      if (!res.ok) throw new Error("Falha");
      const data = await res.json() as ClubInfo;
      setClubInfo(data);
      onClubInfoLoaded?.(data);
    } catch {
      setClubInfo({ description: "", titles: [] });
    } finally {
      setLoadingInfo(false);
    }
  }, [club.name, club.league, club.country, onClubInfoLoaded]);

  useEffect(() => { fetchClubInfo(); }, [fetchClubInfo]);

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    players: players.filter((p) => (POS_GROUP[p.positionPtBr] ?? "Atacantes") === group),
  })).filter((g) => g.players.length > 0);

  return (
    /* Fill the flex parent — flex-1 so it stretches to fill the container */
    <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden animate-fade-up">

      {/* Header - flex-shrink-0 */}
      <div className="text-center flex-shrink-0">
        <p className="text-xs font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--club-primary)" }}>
          Etapa 3 de 4 · Revisão do Clube
        </p>
        <h2 className="text-xl font-black text-white">Seu clube</h2>
      </div>

      {/* Club Hero - flex-shrink-0 */}
      <div
        className="rounded-2xl p-3 relative overflow-hidden glass flex-shrink-0"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 10% 50%, rgba(var(--club-primary-rgb),0.08), transparent 65%)" }}
        />
        <div className="relative flex items-center gap-3">
          <ClubLogo logo={club.logo} name={club.name} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--club-primary)" }}>
              {club.league}
            </p>
            <h3 className="text-base font-black text-white leading-tight truncate">{club.name}</h3>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0 mt-0.5">
              {club.country && <span className="text-white/35 text-xs">{club.country}</span>}
              {club.stadium && (
                <span className="text-white/25 text-xs flex items-center gap-0.5">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {club.stadium}
                </span>
              )}
              {club.founded && <span className="text-white/20 text-xs">Est. {club.founded}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(var(--club-primary-rgb),0.12)", color: "var(--club-primary)" }}>
                Temporada {season}
              </span>
              {!loadingSquad && players.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>
                  {players.length} jogadores
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Club Info - flex-shrink-0 */}
      <div className="rounded-2xl px-3 py-2.5 glass flex-shrink-0">
        {loadingInfo ? (
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white/15 border-t-white/50 animate-spin flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              {[80, 55, 70].map((w, i) => (
                <div key={i} className="h-2 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.07)", width: `${w}%` }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {clubInfo?.description && (
              <p className="text-white/55 text-xs leading-relaxed">{clubInfo.description}</p>
            )}
            {clubInfo?.titles && clubInfo.titles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {clubInfo.titles.map((t, i) => {
                  const color = getTrophyColor(t.name);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                      style={{ background: `${color}15`, border: `1px solid ${color}28` }}
                    >
                      <TrophyIcon color={color} />
                      <span className="text-[10px] font-medium" style={{ color }}>{t.name}</span>
                      <span className="text-[10px] font-black" style={{ color }}>×{t.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {!clubInfo?.description && (!clubInfo?.titles || clubInfo.titles.length === 0) && (
              <p className="text-white/20 text-xs text-center">Informações não disponíveis</p>
            )}
          </div>
        )}
      </div>

      {/* Squad - flex-1 min-h-0 → fills remaining space, scrolls internally */}
      <div className="rounded-2xl p-2.5 glass flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-1.5 px-0.5 flex-shrink-0">
          <h4 className="text-white/35 text-[10px] font-bold tracking-widest uppercase">
            Elenco {!loadingSquad && players.length > 0 && <span className="text-white/20">({players.length})</span>}
          </h4>
          {!loadingSquad && players.length > 0 && (
            <p className="text-white/15 text-[10px]">scroll para ver todos</p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
          {loadingSquad ? (
            <div className="grid grid-cols-2 gap-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                  <div className="w-6 h-6 rounded-full animate-pulse flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }} />
                  <div className="flex-1 space-y-1">
                    <div className="h-2 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)", width: "65%" }} />
                    <div className="h-1.5 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.04)", width: "40%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : players.length === 0 ? (
            <p className="text-white/20 text-xs text-center py-4">Elenco não disponível</p>
          ) : (
            <div className="space-y-2">
              {grouped.map(({ group, players: gPlayers }) => (
                <div key={group}>
                  <p className="text-white/20 text-[10px] font-bold tracking-widest uppercase mb-0.5 px-1">
                    {group} <span className="text-white/12">({gPlayers.length})</span>
                  </p>
                  <div className="grid grid-cols-2 gap-0.5">
                    {gPlayers.map((p) => <PlayerCard key={p.id} player={p} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Buttons - flex-shrink-0 */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white/50 hover:text-white transition-all duration-200 glass glass-hover"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ background: "var(--club-gradient)", boxShadow: "0 4px 20px rgba(var(--club-primary-rgb),0.25)" }}
        >
          Configurar Carreira
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
