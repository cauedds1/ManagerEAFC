import { useState, useEffect, useRef } from "react";
import { clearClubCache } from "@/lib/clubListCache";
import {
  getPortalPhotos,
  setPortalPhoto,
  clearPortalPhoto,
  PORTAL_PHOTOS_EVENT,
  type PortalPhotos,
  type PortalSource,
} from "@/lib/portalPhotosStorage";
import { useLang } from "@/hooks/useLang";
import { SETTINGS } from "@/lib/i18n";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onReloadClubs: () => void;
}

type SyncState = "idle" | "running" | "done" | "error";

interface SeedProgress {
  processed: number;
  total: number;
  playersSaved: number;
  clubName: string;
  message: string;
  phase?: number;
}

interface ReenrichProgress {
  processed: number;
  total: number;
  teamsEnriched: number;
  playersUpdated: number;
  clubName: string;
  message: string;
}

const PORTAL_META: { source: PortalSource; label: string; color: string; bgColor: string }[] = [
  { source: "tnt",     label: "TNT Sports",       color: "#E8002D",                       bgColor: "rgba(232,0,45,0.15)" },
  { source: "espn",    label: "ESPN",              color: "#E67E22",                       bgColor: "rgba(230,126,34,0.15)" },
  { source: "fanpage", label: "FanPage do Clube",  color: "var(--club-primary)",           bgColor: "rgba(var(--club-primary-rgb),0.15)" },
];

export function Settings({ isOpen, onClose, onReloadClubs }: SettingsProps) {
  const [lang] = useLang();
  const t = SETTINGS[lang];

  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncMsg, setSyncMsg] = useState("");
  const [syncRemaining, setSyncRemaining] = useState(0);

  const [setupState, setSetupState] = useState<SyncState>("idle");
  const [setupProgress, setSetupProgress] = useState<SeedProgress | null>(null);
  const [setupMsg, setSetupMsg] = useState("");
  const esRef = useRef<EventSource | null>(null);
  const setupFinishedRef = useRef(false);

  const [reenrichState, setReenrichState] = useState<SyncState>("idle");
  const [reenrichProgress, setReenrichProgress] = useState<ReenrichProgress | null>(null);
  const [reenrichMsg, setReenrichMsg] = useState("");
  const reenrichEsRef = useRef<EventSource | null>(null);
  const reenrichFinishedRef = useRef(false);

  const [portalPhotos, setPortalPhotosState] = useState<PortalPhotos>(() => getPortalPhotos());
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pendingSourceRef = useRef<PortalSource | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSyncState("idle");
      setSyncMsg("");
      setPortalPhotosState(getPortalPhotos());
      if (setupState !== "running") {
        setSetupState("idle");
        setSetupMsg("");
        setSetupProgress(null);
      }
    }
  }, [isOpen, setupState]);

  const handlePortalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const src = pendingSourceRef.current;
    e.target.value = "";
    pendingSourceRef.current = null;
    if (!file || !src) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPortalPhoto(src, dataUrl);
      setPortalPhotosState(getPortalPhotos());
      window.dispatchEvent(new CustomEvent(PORTAL_PHOTOS_EVENT));
    };
    reader.readAsDataURL(file);
  };

  const handleClearPortalPhoto = (src: PortalSource) => {
    clearPortalPhoto(src);
    setPortalPhotosState(getPortalPhotos());
    window.dispatchEvent(new CustomEvent(PORTAL_PHOTOS_EVENT));
  };

  useEffect(() => () => {
    esRef.current?.close();
    reenrichEsRef.current?.close();
  }, []);

  if (!isOpen) return null;

  const handleReloadClubs = () => {
    clearClubCache();
    onClose();
    onReloadClubs();
  };

  const handleSyncPlayers = async () => {
    setSyncState("running");
    setSyncMsg(t.syncingPlayers);
    try {
      const res = await fetch("/api/players/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json() as { message?: string; remaining?: number; error?: string };
      if (!res.ok) { setSyncMsg(data.error ?? t.syncError); setSyncState("error"); }
      else { setSyncMsg(data.message ?? t.doneSingle); setSyncRemaining(data.remaining ?? 0); setSyncState("done"); }
    } catch { setSyncMsg(t.connectionError); setSyncState("error"); }
  };

  const handleFullSetup = () => {
    setSetupState("running");
    setSetupMsg(t.connectingMsg);
    setSetupProgress(null);
    setupFinishedRef.current = false;

    esRef.current?.close();
    const es = new EventSource("/api/admin/seed");
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as Record<string, unknown>;
        const type = ev.type as string;

        if (type === "phase") {
          setSetupMsg(String(ev.message ?? ""));
        } else if (type === "phase1_done") {
          setSetupMsg(String(ev.message ?? ""));
        } else if (type === "squads_start") {
          setSetupProgress({ processed: 0, total: Number(ev.total ?? 0), playersSaved: 0, clubName: "", message: String(ev.message ?? "") });
        } else if (type === "progress") {
          setSetupProgress({
            processed: Number(ev.processed ?? 0),
            total: Number(ev.total ?? 0),
            playersSaved: Number(ev.playersSaved ?? 0),
            clubName: String(ev.clubName ?? ""),
            message: String(ev.message ?? ""),
            phase: 2,
          });
        } else if (type === "rate_limit") {
          setupFinishedRef.current = true;
          setSetupMsg(String(ev.message ?? t.rateLimitReached));
          setSetupState("error");
          es.close();
        } else if (type === "done") {
          setupFinishedRef.current = true;
          setSetupMsg(String(ev.message ?? t.doneExclaim));
          setSetupState("done");
          setSetupProgress(null);
          es.close();
        } else if (type === "error") {
          setupFinishedRef.current = true;
          setSetupMsg(String(ev.message ?? t.errorFallback));
          setSetupState("error");
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      if (!setupFinishedRef.current) {
        setSetupMsg(t.connectionLost);
        setSetupState("error");
      }
      es.close();
    };
  };

  const handleReenrich = () => {
    setReenrichState("running");
    setReenrichMsg(t.connectingMsg);
    setReenrichProgress(null);
    reenrichFinishedRef.current = false;

    reenrichEsRef.current?.close();
    const es = new EventSource("/api/admin/reenrich-positions");
    reenrichEsRef.current = es;

    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as Record<string, unknown>;
        const type = ev.type as string;

        if (type === "start") {
          setReenrichMsg(String(ev.message ?? ""));
        } else if (type === "progress") {
          setReenrichProgress({
            processed: Number(ev.processed ?? 0),
            total: Number(ev.total ?? 0),
            teamsEnriched: Number(ev.teamsEnriched ?? 0),
            playersUpdated: Number(ev.playersUpdated ?? 0),
            clubName: String(ev.clubName ?? ""),
            message: String(ev.message ?? ""),
          });
        } else if (type === "done") {
          reenrichFinishedRef.current = true;
          setReenrichMsg(String(ev.message ?? t.doneExclaim));
          setReenrichState("done");
          setReenrichProgress(null);
          es.close();
        } else if (type === "error") {
          reenrichFinishedRef.current = true;
          setReenrichMsg(String(ev.message ?? t.errorFallback));
          setReenrichState("error");
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      if (!reenrichFinishedRef.current) {
        setReenrichMsg(t.connectionLostSimple);
        setReenrichState("error");
      }
      es.close();
    };
  };

  const syncColor = (s: SyncState) =>
    s === "done" ? "rgba(16,185,129,0.9)" : s === "error" ? "rgba(239,68,68,0.85)" : "rgba(255,255,255,0.06)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden animate-slide-up"
        style={{ background: "var(--app-bg-lighter, #141414)", border: "1px solid var(--surface-border)", boxShadow: "0 25px 50px rgba(0,0,0,0.6)" }}>

        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(var(--club-primary-rgb),0.12)" }}>
              <svg className="w-4 h-4" style={{ color: "var(--club-primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-white font-bold text-base">{t.settingsHeader}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all duration-150">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[72vh] overflow-y-auto">

          {/* ── Setup inicial ── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-white/50 text-xs font-semibold tracking-widest uppercase">{t.sysSetupLabel}</p>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }}>ADMIN</span>
            </div>
            <p className="text-white/30 text-xs leading-relaxed mb-3">
              {t.sysSetupDesc}
            </p>

            <button
              onClick={handleFullSetup}
              disabled={setupState === "running"}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: setupState === "done" ? "rgba(16,185,129,0.15)" : "rgba(var(--club-primary-rgb),0.12)", border: `1px solid ${setupState === "done" ? "rgba(16,185,129,0.3)" : "rgba(var(--club-primary-rgb),0.2)"}`, color: setupState === "done" ? "rgba(16,185,129,1)" : "var(--club-primary)" }}
            >
              <span className="flex items-center justify-center gap-2">
                {setupState === "running" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                    <span>{t.importing}</span>
                  </>
                ) : setupState === "done" ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span>{t.importDone}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span>{t.importAllNow}</span>
                  </>
                )}
              </span>
            </button>

            {setupState === "running" && (
              <div className="mt-3 rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-white/60 text-xs">{setupMsg}</p>
                {setupProgress && (
                  <>
                    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${setupProgress.total > 0 ? Math.round((setupProgress.processed / setupProgress.total) * 100) : 0}%`, background: "var(--club-primary)" }}
                      />
                    </div>
                    <p className="text-white/40 text-xs">
                      {t.progressTeamsPlayers
                        .replace("{processed}", String(setupProgress.processed))
                        .replace("{total}", String(setupProgress.total))
                        .replace("{players}", setupProgress.playersSaved.toLocaleString())}
                    </p>
                    {setupProgress.clubName && <p className="text-white/25 text-xs truncate">↳ {setupProgress.clubName}</p>}
                  </>
                )}
              </div>
            )}

            {(setupState === "done" || setupState === "error") && setupMsg && (
              <div className="mt-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed" style={{ background: syncColor(setupState), color: "#fff" }}>
                {setupMsg}
              </div>
            )}
          </div>

          <div style={{ height: "1px", background: "var(--surface-border)" }} />

          {/* ── Corrigir posições ── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-white/50 text-xs font-semibold tracking-widest uppercase">{t.fixPositionsLabel}</p>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }}>ADMIN</span>
            </div>
            <p className="text-white/30 text-xs leading-relaxed mb-3">
              {t.fixPositionsDesc}
            </p>

            <button
              onClick={handleReenrich}
              disabled={reenrichState === "running"}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: reenrichState === "done" ? "rgba(16,185,129,0.15)" : "rgba(var(--club-primary-rgb),0.12)", border: `1px solid ${reenrichState === "done" ? "rgba(16,185,129,0.3)" : "rgba(var(--club-primary-rgb),0.2)"}`, color: reenrichState === "done" ? "rgba(16,185,129,1)" : "var(--club-primary)" }}
            >
              <span className="flex items-center justify-center gap-2">
                {reenrichState === "running" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                    <span>{t.fixingPositions}</span>
                  </>
                ) : reenrichState === "done" ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span>{t.positionsUpdated}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span>{t.fixPositionsNow}</span>
                  </>
                )}
              </span>
            </button>

            {reenrichState === "running" && (
              <div className="mt-3 rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-white/60 text-xs">{reenrichMsg}</p>
                {reenrichProgress && (
                  <>
                    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${reenrichProgress.total > 0 ? Math.round((reenrichProgress.processed / reenrichProgress.total) * 100) : 0}%`, background: "var(--club-primary)" }}
                      />
                    </div>
                    <p className="text-white/40 text-xs">
                      {t.progressTeamsPositions
                        .replace("{processed}", String(reenrichProgress.processed))
                        .replace("{total}", String(reenrichProgress.total))
                        .replace("{positions}", reenrichProgress.playersUpdated.toLocaleString())}
                    </p>
                    {reenrichProgress.clubName && <p className="text-white/25 text-xs truncate">↳ {reenrichProgress.clubName}</p>}
                  </>
                )}
              </div>
            )}

            {(reenrichState === "done" || reenrichState === "error") && reenrichMsg && (
              <div className="mt-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed" style={{ background: syncColor(reenrichState), color: "#fff" }}>
                {reenrichMsg}
              </div>
            )}
          </div>

          <div style={{ height: "1px", background: "var(--surface-border)" }} />

          {/* ── Dados de Jogadores ── */}
          <div>
            <p className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-1">{t.playerDataLabel}</p>
            <p className="text-white/30 text-xs leading-relaxed mb-3">
              {t.playerDataDesc}
            </p>
            <button
              onClick={handleSyncPlayers}
              disabled={syncState === "running"}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 glass glass-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-2">
                {syncState === "running" ? (
                  <><div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" /><span className="text-white/70">{t.syncing}</span></>
                ) : (
                  <><svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <span className="text-white/70">{syncState === "done" && syncRemaining > 0 ? t.syncContinue2.replace("{n}", String(syncRemaining)) : t.syncPlayersBtn}</span></>
                )}
              </span>
            </button>
            {syncMsg && (
              <div className="mt-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed" style={{ background: syncColor(syncState), color: "#fff" }}>
                {syncMsg}
              </div>
            )}
          </div>

          <div style={{ height: "1px", background: "var(--surface-border)" }} />

          {/* ── Lista de Clubes ── */}
          <div>
            <p className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-1">{t.clubListLabel}</p>
            <p className="text-white/30 text-xs leading-relaxed mb-3">{t.clubListDesc}</p>
            <button onClick={handleReloadClubs} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white/70 hover:text-white transition-all duration-200 glass glass-hover">
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {t.updateClubList}
              </span>
            </button>
          </div>

          <div style={{ height: "1px", background: "var(--surface-border)" }} />

          {/* ── Fotos dos Portais ── */}
          <div>
            <p className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-1">{t.portalPhotosLabel}</p>
            <p className="text-white/30 text-xs leading-relaxed mb-4">
              {t.portalPhotosDesc}
            </p>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePortalFileChange}
            />

            <div className="space-y-3">
              {PORTAL_META.map(({ source, label, color, bgColor }) => {
                const photo = portalPhotos[source];
                const displayLabel = source === "fanpage" ? t.fanPageLabel : label;
                const initial = displayLabel.charAt(0).toUpperCase();
                return (
                  <div key={source} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div
                      className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-black"
                      style={{ width: 44, height: 44, background: photo ? "transparent" : bgColor, border: `2px solid ${color}`, color, fontSize: 17 }}
                    >
                      {photo ? (
                        <img src={photo} alt={displayLabel} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : (
                        initial
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm font-semibold truncate">{displayLabel}</p>
                      <p className="text-white/30 text-xs">{photo ? t.customPhoto : t.usingInitial}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => { pendingSourceRef.current = source; photoInputRef.current?.click(); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 hover:opacity-90 active:scale-95"
                        style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`, color }}
                      >
                        {photo ? t.changeBtn : t.addBtn2}
                      </button>
                      {photo && (
                        <button
                          onClick={() => handleClearPortalPhoto(source)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 hover:bg-white/[0.08] active:scale-95"
                          style={{ color: "rgba(255,255,255,0.35)" }}
                          title={t.removePhotoTitle}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4" style={{ borderTop: "1px solid var(--surface-border)" }}>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white/50 hover:text-white transition-all duration-200">{t.closeBtn}</button>
        </div>
      </div>
    </div>
  );
}
