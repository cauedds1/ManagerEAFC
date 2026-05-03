import { useEffect, useMemo, useRef, useState } from "react";
import type { InitialContext } from "@/types/career";
import type { SquadPlayer } from "@/lib/squadCache";
import { fetchSquadFromBackend } from "@/lib/squadCache";
import type { ClubEntry } from "@/lib/footballApiMap";
import { useLang } from "@/hooks/useLang";

interface Props {
  context: InitialContext;
  club: ClubEntry | null;
  onComplete: () => void;
  onSkip: () => void;
}

const SCENES = [
  { key: "opening",   ms: 1800 },
  { key: "crest",     ms: 2200 },
  { key: "position",  ms: 2200 },
  { key: "moods",     ms: 3000 },
  { key: "players",   ms: 3000 },
  { key: "letter",    ms: 2200 },
  { key: "prediction",ms: 1600 },
] as const;

const TOTAL_MS = SCENES.reduce((a, s) => a + s.ms, 0);

const STRINGS = {
  pt: { skip: "Pular", season: "TEMPORADA", pos: "COLOCADO", pts: "PTS", board: "DIRETORIA", fans: "TORCIDA", room: "VESTIÁRIO", forecast: "PREVISÃO", soundOn: "🔊", soundOff: "🔇" },
  en: { skip: "Skip",  season: "SEASON",    pos: "PLACE",    pts: "PTS", board: "BOARD",     fans: "FANS",    room: "DRESSING ROOM", forecast: "FORECAST", soundOn: "🔊", soundOff: "🔇" },
};

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}
function matchPlayer(name: string, squad: SquadPlayer[]): SquadPlayer | null {
  if (!name || squad.length === 0) return null;
  const n = normalize(name);
  if (!n) return null;
  let exact = squad.find((p) => normalize(p.name) === n);
  if (exact) return exact;
  const last = name.trim().split(/\s+/).pop() || "";
  const ln = normalize(last);
  if (ln.length >= 3) {
    exact = squad.find((p) => normalize(p.name).endsWith(ln));
    if (exact) return exact;
  }
  return squad.find((p) => normalize(p.name).includes(n) || n.includes(normalize(p.name))) ?? null;
}

class SfxPlayer {
  private ctx: AudioContext | null = null;
  private muted = false;
  setMuted(v: boolean) { this.muted = v; }
  destroy() { try { this.ctx?.close(); } catch {} this.ctx = null; }
  private ensure() {
    if (this.muted) return null;
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
    }
    return this.ctx;
  }
  swoosh() {
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.42);
  }
  thud() {
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.27);
  }
  ding() {
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(freq, t + i * 0.08);
      g.gain.setValueAtTime(0.0001, t + i * 0.08); g.gain.exponentialRampToValueAtTime(0.10, t + i * 0.08 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.6);
      o.connect(g).connect(ctx.destination); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.62);
    });
  }
}

export function CareerRevealReel({ context, club, onComplete, onSkip }: Props) {
  const [lang] = useLang();
  const s = STRINGS[lang];
  const [sceneIdx, setSceneIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [squadLoaded, setSquadLoaded] = useState(false);
  const [extraPhotos, setExtraPhotos] = useState<Record<string, string>>({});
  const requestedNamesRef = useRef<Set<string>>(new Set());
  const sfxRef = useRef(new SfxPlayer());
  const startRef = useRef<number>(Date.now());

  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => { sfxRef.current.setMuted(muted); }, [muted]);

  useEffect(() => {
    if (!club || club.id <= 0) { setSquadLoaded(true); return; }
    let cancelled = false;
    fetchSquadFromBackend(club.id)
      .then((r) => { if (!cancelled && r) setSquad(r.players); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSquadLoaded(true); });
    return () => { cancelled = true; };
  }, [club]);

  useEffect(() => {
    if (reduced) { onComplete(); return; }
    let cumulative = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    SCENES.forEach((scene, i) => {
      cumulative += scene.ms;
      timeouts.push(setTimeout(() => {
        if (i + 1 < SCENES.length) {
          setSceneIdx(i + 1);
          if (scene.key === "crest" || scene.key === "letter") sfxRef.current.swoosh();
          if (scene.key === "position" || scene.key === "players") sfxRef.current.thud();
        } else {
          sfxRef.current.ding();
          timeouts.push(setTimeout(onComplete, 600));
        }
      }, cumulative));
    });
    sfxRef.current.swoosh();
    const sfx = sfxRef.current;
    return () => { timeouts.forEach(clearTimeout); sfx.destroy(); };
  }, [onComplete, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onSkip(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const matchedPlayers = useMemo(() => {
    return (context.keyPlayers || []).slice(0, 5).map((kp) => ({
      name: kp.name, role: kp.role, note: kp.note, squad: matchPlayer(kp.name, squad),
    }));
  }, [context.keyPlayers, squad]);

  useEffect(() => {
    if (!squadLoaded) return;
    const requested = requestedNamesRef.current;
    const missing = Array.from(new Set(
      matchedPlayers
        .filter((p) => !p.squad?.photo && !extraPhotos[p.name] && !requested.has(p.name))
        .map((p) => p.name)
    ));
    if (missing.length === 0) return;
    for (const name of missing) requested.add(name);
    const controller = new AbortController();
    (async () => {
      const entries = await Promise.all(missing.map(async (name) => {
        try {
          const res = await fetch(`/api/players/search?q=${encodeURIComponent(name)}`, { signal: controller.signal });
          if (!res.ok) return [name, ""] as const;
          const data = (await res.json()) as { players?: Array<{ photo?: string }> };
          const hit = (data.players ?? []).find((p) => !!p.photo);
          return [name, hit?.photo ?? ""] as const;
        } catch {
          return [name, ""] as const;
        }
      }));
      if (controller.signal.aborted) return;
      setExtraPhotos((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [name, photo] of entries) {
          if (photo && !next[name]) {
            next[name] = photo;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    })();
    return () => { controller.abort(); };
  }, [matchedPlayers, extraPhotos, squadLoaded]);

  const elapsed = Date.now() - startRef.current;
  const progress = Math.min(100, (elapsed / TOTAL_MS) * 100);

  const scene = SCENES[sceneIdx]?.key;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden flex items-center justify-center" style={{ background: "#000" }}>
      {/* Animated club-tinted backdrop */}
      <div className="absolute inset-0 transition-opacity duration-700" style={{
        background: `radial-gradient(circle at 50% 50%, rgba(var(--club-primary-rgb),0.35) 0%, rgba(0,0,0,0.95) 60%)`,
        opacity: scene === "opening" ? 0.3 : 1,
      }} />
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)" }} />

      {/* Top bar: progress + skip + sound */}
      <div className="absolute top-0 left-0 right-0 px-4 sm:px-6 pt-4 z-10 flex items-center gap-3">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
          <div className="h-full rounded-full transition-all duration-200" style={{ width: `${progress}%`, background: "var(--club-primary)" }} />
        </div>
        <button onClick={() => setMuted((m) => !m)} className="text-white/70 hover:text-white text-lg w-9 h-9 flex items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} aria-label="toggle sound">
          {muted ? s.soundOff : s.soundOn}
        </button>
        <button onClick={onSkip} className="text-white/80 hover:text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
          {s.skip} →
        </button>
      </div>

      {/* Scenes */}
      <div className="relative w-full h-full flex items-center justify-center px-6">
        {scene === "opening" && (
          <div key="op" className="text-center reveal-fade">
            <p className="text-white/60 text-sm font-bold uppercase tracking-[0.5em] mb-3">{s.season}</p>
            <p className="text-white text-5xl sm:text-7xl font-black tracking-tight" style={{ textShadow: "0 0 40px rgba(var(--club-primary-rgb),0.6)" }}>
              {context.season.label || "—"}
            </p>
          </div>
        )}

        {scene === "crest" && (
          <div key="cr" className="text-center reveal-zoom">
            {club?.logo ? (
              <img
                src={club.logo}
                alt={club.name}
                className="w-48 h-48 sm:w-64 sm:h-64 object-contain mx-auto mb-6 reveal-crest"
                style={{ filter: "drop-shadow(0 0 60px rgba(var(--club-primary-rgb),0.7))" }}
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = "none";
                  const fb = img.nextElementSibling as HTMLElement | null;
                  if (fb) fb.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className="w-48 h-48 mx-auto mb-6 rounded-full items-center justify-center text-7xl font-black reveal-crest"
              style={{ display: club?.logo ? "none" : "flex", background: "rgba(var(--club-primary-rgb),0.2)", color: "var(--club-primary)", border: "3px solid rgba(var(--club-primary-rgb),0.5)" }}
            >
              {(context.club.name || club?.name || "?").slice(0, 1).toUpperCase()}
            </div>
            <h2 className="text-white text-3xl sm:text-5xl font-black">{context.club.name || club?.name}</h2>
            {context.club.league && <p className="text-white/60 text-sm font-bold uppercase tracking-widest mt-2">{context.club.league}</p>}
          </div>
        )}

        {scene === "position" && (
          <div key="ps" className="text-center reveal-fade">
            {context.leaguePosition.rank != null ? (
              <>
                <p className="text-white text-[10rem] sm:text-[14rem] font-black leading-none" style={{ color: "var(--club-primary)", textShadow: "0 0 80px rgba(var(--club-primary-rgb),0.8)" }}>
                  {context.leaguePosition.rank}º
                </p>
                <p className="text-white/80 text-xl font-bold uppercase tracking-widest mt-2">{s.pos}</p>
                {context.leaguePosition.points != null && (
                  <p className="text-white/60 text-sm mt-4">{context.leaguePosition.points} {s.pts}{context.leaguePosition.gap ? ` · ${context.leaguePosition.gap}` : ""}</p>
                )}
                {context.leaguePosition.recentForm.length > 0 && (
                  <div className="flex gap-2 justify-center mt-5">
                    {context.leaguePosition.recentForm.slice(-5).map((f, i) => (
                      <div key={i} className="w-8 h-8 sm:w-10 sm:h-10 rounded-md flex items-center justify-center font-black text-white reveal-form" style={{ animationDelay: `${i * 100}ms`, background: f === "W" ? "#22c55e" : f === "D" ? "#eab308" : "#ef4444" }}>{f}</div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-white/40 text-2xl">···</p>
            )}
          </div>
        )}

        {scene === "moods" && (
          <div key="md" className="w-full max-w-xl flex flex-col gap-7 reveal-fade">
            {[
              { k: "board", label: s.board, m: context.moods.board },
              { k: "fans",  label: s.fans,  m: context.moods.fans  },
              { k: "room",  label: s.room,  m: context.moods.dressingRoom },
            ].map((row, i) => {
              const color = row.m.value >= 70 ? "#22c55e" : row.m.value >= 40 ? "#eab308" : "#ef4444";
              return (
                <div key={row.k} className="flex flex-col gap-2 reveal-slide" style={{ animationDelay: `${i * 250}ms` }}>
                  <div className="flex justify-between items-baseline">
                    <span className="text-white/80 text-xs font-black uppercase tracking-widest">{row.label}</span>
                    <span className="text-white font-black text-2xl tabular-nums">{row.m.value}</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full reveal-bar" style={{ animationDelay: `${i * 250 + 200}ms`, ["--bar-w" as string]: `${row.m.value}%`, background: color, boxShadow: `0 0 20px ${color}80` }} />
                  </div>
                  {row.m.reason && <p className="text-white/50 text-xs italic reveal-fade-late" style={{ animationDelay: `${i * 250 + 700}ms` }}>"{row.m.reason}"</p>}
                </div>
              );
            })}
          </div>
        )}

        {scene === "players" && (
          <div className="w-full max-w-3xl reveal-fade">
            {matchedPlayers.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {matchedPlayers.map((p, i) => {
                  const displayPhoto = p.squad?.photo || extraPhotos[p.name] || "";
                  return (
                  <div key={i} className="reveal-card flex flex-col items-center text-center" style={{ animationDelay: `${i * 180}ms` }}>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden mb-2 flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(var(--club-primary-rgb),0.35), rgba(0,0,0,0.5))", border: "2px solid rgba(var(--club-primary-rgb),0.6)", boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
                      {displayPhoto ? (
                        <img src={displayPhoto} alt={p.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : (
                        <span className="text-white font-black text-2xl">{p.name.split(/\s+/).map((s) => s[0]).slice(0,2).join("")}</span>
                      )}
                    </div>
                    <p className="text-white text-xs font-bold leading-tight line-clamp-2">{p.squad?.name || p.name}</p>
                    {p.role && <p className="text-white/50 text-[10px] uppercase tracking-wider mt-0.5">{p.role}</p>}
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white/40 text-center text-sm">···</p>
            )}
          </div>
        )}

        {scene === "letter" && (
          <div key="lt" className="max-w-2xl text-center reveal-fade px-4">
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-[0.4em] mb-4">✉ {lang === "pt" ? "Carta da Diretoria" : "Board Letter"}</p>
            <p className="text-white text-xl sm:text-2xl leading-relaxed italic reveal-letter" style={{ fontFamily: "Georgia, serif" }}>
              "{context.boardLetter || context.narrativeSummary || context.storyArc || (lang === "pt" ? "Bem-vindo ao clube." : "Welcome to the club.")}"
            </p>
          </div>
        )}

        {scene === "prediction" && (
          <div key="pr" className="text-center reveal-fade">
            <p className="text-white/60 text-sm font-bold uppercase tracking-[0.4em] mb-4">{s.forecast}</p>
            <p className="text-white text-3xl sm:text-5xl font-black tracking-tight max-w-3xl mx-auto" style={{ textShadow: "0 0 50px rgba(var(--club-primary-rgb),0.7)" }}>
              {context.prediction.endOfSeason || context.projeto || (lang === "pt" ? "O futuro está nas suas mãos." : "The future is in your hands.")}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes reveal-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes reveal-fade-late { 0%, 30% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes reveal-zoom-in { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
        @keyframes reveal-crest-spin { from { opacity: 0; transform: scale(0.4) rotate(-10deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
        @keyframes reveal-slide-in { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes reveal-bar-grow { from { width: 0%; } to { width: var(--bar-w); } }
        @keyframes reveal-card-in { from { opacity: 0; transform: translateY(40px) scale(0.85); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes reveal-form-pop { 0% { opacity: 0; transform: scale(0.3); } 60% { transform: scale(1.15); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes reveal-letter-in { from { opacity: 0; transform: translateY(20px); letter-spacing: 0.1em; } to { opacity: 1; transform: translateY(0); letter-spacing: normal; } }
        .reveal-fade { animation: reveal-fade-in 700ms ease-out both; }
        .reveal-fade-late { animation: reveal-fade-late 1200ms ease-out both; }
        .reveal-zoom { animation: reveal-zoom-in 900ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .reveal-crest { animation: reveal-crest-spin 1100ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .reveal-slide { animation: reveal-slide-in 600ms ease-out both; opacity: 0; }
        .reveal-bar { width: 0%; animation: reveal-bar-grow 900ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .reveal-card { animation: reveal-card-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both; opacity: 0; }
        .reveal-form { animation: reveal-form-pop 500ms cubic-bezier(0.22, 1, 0.36, 1) both; opacity: 0; }
        .reveal-letter { animation: reveal-letter-in 1100ms ease-out both; }
      `}</style>
    </div>
  );
}
