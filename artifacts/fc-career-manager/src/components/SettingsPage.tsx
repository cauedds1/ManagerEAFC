import { useState, useEffect, useRef, useCallback } from "react";
import { useLang } from "@/hooks/useLang";
import { SETTINGS } from "@/lib/i18n";
import { clearClubCache } from "@/lib/clubListCache";
import {
  fetchPortalPhotos,
  savePortalPhoto,
  clearPortalPhotoApi,
  PORTAL_PHOTOS_EVENT,
  type PortalPhotos,
  type PortalSource,
} from "@/lib/portalPhotosStorage";
import {
  fetchPortals,
  createPortal,
  updatePortal,
  deletePortal,
  PORTAL_TONES,
  CUSTOM_PORTALS_EVENT,
  type CustomPortal,
  type PortalTone,
} from "@/lib/customPortalStorage";
import { isSoundEnabled, setSoundEnabled, playNotificationSound } from "@/lib/notificationSound";
import { RivaisView } from "./RivaisView";
import { getUserPlan, getPlanLimits, getPlanLabel, getPlanColor, type Plan } from "@/lib/userPlan";
import { UpgradePrompt } from "@/components/UpgradePrompt";

interface SettingsPageProps {
  onReloadClubs: () => void;
  careerId?: string;
  seasonId?: string;
  onDeleteCareer?: () => void;
  userPlan?: Plan;
}

type SyncState = "idle" | "running" | "done" | "error";
type Section = "api" | "portais" | "ia" | "temporada" | "idioma";

interface SeedProgress {
  processed: number;
  total: number;
  playersSaved: number;
  clubName: string;
  message: string;
}

interface ReenrichProgress {
  processed: number;
  total: number;
  teamsEnriched: number;
  playersUpdated: number;
  clubName: string;
  message: string;
}

const PORTAL_META: { source: PortalSource; label: string; color: string; bgColor: string; defaultPhoto?: string }[] = [
  { source: "tnt",     label: "TNT Sports",      color: "#E8002D",              bgColor: "rgba(232,0,45,0.15)",               defaultPhoto: "/portals/tnt-sports.jpg" },
  { source: "espn",    label: "ESPN",             color: "#E67E22",              bgColor: "rgba(230,126,34,0.15)",             defaultPhoto: "/portals/espn.jpg" },
  { source: "fanpage", label: "FanPage do Clube", color: "var(--club-primary)",  bgColor: "rgba(var(--club-primary-rgb),0.15)" },
];

const NAV_ITEMS: { id: Section; icon: React.ReactNode }[] = [
  {
    id: "temporada",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "api",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
  },
  {
    id: "portais",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h2" />
      </svg>
    ),
  },
  {
    id: "ia",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
  {
    id: "idioma",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
];

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <h3 className="text-white font-bold text-sm">{title}</h3>
        {subtitle && <p className="text-white/35 text-xs mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function StatusMsg({ state, msg }: { state: SyncState; msg: string }) {
  if (!msg) return null;
  const bg =
    state === "done"  ? "rgba(16,185,129,0.12)"  :
    state === "error" ? "rgba(239,68,68,0.12)"   : "rgba(255,255,255,0.05)";
  const color =
    state === "done"  ? "#34d399" :
    state === "error" ? "#f87171" : "rgba(255,255,255,0.5)";
  return (
    <div className="mt-3 rounded-xl px-4 py-3 text-xs leading-relaxed" style={{ background: bg, color, border: `1px solid ${color}22` }}>
      {msg}
    </div>
  );
}

function CustomPortalModal({
  initial,
  onSave,
  onClose,
}: {
  initial: CustomPortal | null;
  onSave: (data: { name: string; description: string; tone: PortalTone; photo?: string }) => void;
  onClose: () => void;
}) {
  const [lang] = useLang();
  const t = SETTINGS[lang];
  const TONE_LABELS: Record<string, string> = {
    humoristico: t.toneHumoristico, apaixonado: t.toneApaixonado, critico: t.toneCritico,
    ironico: t.toneIronico, jornalistico: t.toneJornalistico, serio: t.toneSerio, agressivo: t.toneAgressivo,
  };
  const TONE_DESCS: Record<string, string> = {
    humoristico: t.toneHumoristicoDesc, apaixonado: t.toneApaixonadoDesc, critico: t.toneCriticoDesc,
    ironico: t.toneIronicoDesc, jornalistico: t.toneJornalisticoDesc, serio: t.toneSerioDesc, agressivo: t.toneAgressivoDesc,
  };
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tone, setTone] = useState<PortalTone>(initial?.tone ?? "jornalistico");
  const [photo, setPhoto] = useState<string | undefined>(initial?.photo);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const valid = name.trim().length > 0 && description.trim().length > 0 && !photoUploading;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setPhoto(localUrl);
    setPhotoUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/storage/uploads/file?folder=portals`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        if (url) {
          URL.revokeObjectURL(localUrl);
          setPhoto(url);
        }
      }
    } catch {
    } finally {
      setPhotoUploading(false);
    }
  };

  const initials = name.trim() ? name.trim().charAt(0).toUpperCase() : "?";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "var(--app-bg-lighter)", border: "1px solid rgba(var(--club-primary-rgb),0.2)", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: "1px solid rgba(var(--club-primary-rgb),0.1)" }}>
          <div>
            <h2 className="text-white font-bold text-base">{initial ? t.editPortalHeader : t.newPortalHeader}</h2>
            <p className="text-white/40 text-xs mt-0.5">{t.portalModalSubtitle}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/[0.07] transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Photo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">{t.photoLabel}</label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="relative flex-shrink-0 rounded-2xl overflow-hidden flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                style={{
                  width: 72, height: 72,
                  background: photo ? "transparent" : "rgba(var(--club-primary-rgb),0.12)",
                  border: `2px solid rgba(var(--club-primary-rgb),0.4)`,
                  color: "var(--club-primary)",
                  fontSize: 26,
                  fontWeight: 900,
                }}
                title={t.clickToAddPhoto}
              >
                {photo
                  ? <img src={photo} alt="foto" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <span>{initials}</span>
                }
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-2xl" style={{ background: "rgba(0,0,0,0.55)" }}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
              </button>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                  style={{ background: "rgba(var(--club-primary-rgb),0.12)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.25)" }}
                >
                  {photo ? t.changePhoto : t.addPhoto}
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto(undefined)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                    style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                  >
                    {t.removePhoto}
                  </button>
                )}
                <p className="text-white/30 text-xs">{t.optionalPhoto}</p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">{t.nameLabel}</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder={t.namePlaceholder}
              className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(var(--club-primary-rgb),0.2)",
                outline: "none",
              }}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">{t.descLabel}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder={t.descPlaceholder}
              className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20 resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}
            />
            <p className="text-right text-white/25 text-xs">{description.length}/200</p>
          </div>

          {/* Tone */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">{t.toneLabel}</label>
            <div className="grid grid-cols-2 gap-2">
              {PORTAL_TONES.map((pt) => {
                const active = tone === pt.id;
                return (
                  <button
                    key={pt.id}
                    onClick={() => setTone(pt.id)}
                    className="flex flex-col gap-1 px-3 py-2.5 rounded-xl text-left transition-all duration-150"
                    style={{
                      background: active ? "rgba(var(--club-primary-rgb),0.15)" : "rgba(255,255,255,0.03)",
                      border: active ? "1px solid rgba(var(--club-primary-rgb),0.45)" : "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <span className="text-base leading-none">{pt.emoji}</span>
                    <span className="text-xs font-bold" style={{ color: active ? "var(--club-primary)" : "rgba(255,255,255,0.7)" }}>{TONE_LABELS[pt.id] ?? pt.label}</span>
                    <span className="text-xs leading-tight" style={{ color: active ? "rgba(var(--club-primary-rgb),0.7)" : "rgba(255,255,255,0.3)" }}>{TONE_DESCS[pt.id] ?? pt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(var(--club-primary-rgb),0.1)" }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all duration-150 hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {t.cancelBtn}
          </button>
          <button
            disabled={!valid}
            onClick={() => valid && onSave({ name: name.trim(), description: description.trim(), tone, photo })}
            className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
            style={{
              background: valid ? "var(--club-gradient)" : "rgba(255,255,255,0.05)",
              color: valid ? "white" : "rgba(255,255,255,0.2)",
              border: valid ? "none" : "1px solid rgba(255,255,255,0.08)",
              cursor: valid ? "pointer" : "not-allowed",
              boxShadow: valid ? "0 4px 16px rgba(var(--club-primary-rgb),0.25)" : "none",
            }}
          >
            {initial ? t.saveChanges : t.createPortal}
          </button>
        </div>
      </div>
    </div>
  );
}

const API_BASE = "/api";
const AUTH_TOKEN_KEY = "fc_auth_token";

export function SettingsPage({ onReloadClubs, careerId, seasonId, onDeleteCareer, userPlan }: SettingsPageProps) {
  const [lang, setLang] = useLang();
  const t = SETTINGS[lang];
  const TONE_LABELS: Record<string, string> = {
    humoristico: t.toneHumoristico, apaixonado: t.toneApaixonado, critico: t.toneCritico,
    ironico: t.toneIronico, jornalistico: t.toneJornalistico, serio: t.toneSerio, agressivo: t.toneAgressivo,
  };
  const PORTAL_META_LABELS: Record<string, string> = { fanpage: t.fanPageLabel };
  const NAV_LABELS: Record<Section, string> = {
    temporada: t.navTemporada,
    api:       t.navApi,
    portais:   t.navPortais,
    ia:        t.navIa,
    idioma:    t.navIdioma,
  };
  const resolvedPlan = userPlan ?? getUserPlan();
  const planLimits = getPlanLimits(resolvedPlan);

  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  const [subscription, setSubscription] = useState<{
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    product_name: string | null;
  } | null>(null);
  const [subLoading, setSubLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token || resolvedPlan === "free") return;
    setSubLoading(true);
    fetch(`${API_BASE}/stripe/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d: { subscription?: typeof subscription }) => {
        setSubscription(d.subscription ?? null);
      })
      .catch(() => {})
      .finally(() => setSubLoading(false));
  }, [resolvedPlan]);

  const handleOpenPortal = useCallback(async () => {
    setPortalError("");
    setPortalLoading(true);
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const res = await fetch(`${API_BASE}/stripe/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? SETTINGS[lang].openPortalError);
      }
      const { url } = await res.json() as { url?: string };
      if (url) { window.location.href = url; }
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : SETTINGS[lang].unexpectedError);
    } finally {
      setPortalLoading(false);
    }
  }, [lang]);
  const [section, setSection] = useState<Section>("temporada");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(() => isSoundEnabled());

  /* ── Player sync ── */
  const [syncState, setSyncState]     = useState<SyncState>("idle");
  const [syncMsg, setSyncMsg]         = useState("");
  const [syncRemaining, setSyncRemaining] = useState(0);

  /* ── Full setup SSE ── */
  const [setupState, setSetupState]       = useState<SyncState>("idle");
  const [setupProgress, setSetupProgress] = useState<SeedProgress | null>(null);
  const [setupMsg, setSetupMsg]           = useState("");
  const esRef                             = useRef<EventSource | null>(null);
  const setupFinishedRef                  = useRef(false);

  /* ── Re-enrich SSE ── */
  const [reenrichState, setReenrichState]         = useState<SyncState>("idle");
  const [reenrichProgress, setReenrichProgress]   = useState<ReenrichProgress | null>(null);
  const [reenrichMsg, setReenrichMsg]             = useState("");
  const reenrichEsRef                             = useRef<EventSource | null>(null);
  const reenrichFinishedRef                       = useRef(false);

  /* ── Portal photos ── */
  const [portalPhotos, setPortalPhotosState] = useState<PortalPhotos>({});
  const [draftUrls, setDraftUrls] = useState<Record<PortalSource, string>>({ tnt: "", espn: "", fanpage: "" });
  const [savingPortal, setSavingPortal] = useState<PortalSource | null>(null);
  const [savedPortal, setSavedPortal] = useState<PortalSource | null>(null);
  const photoInputRef                         = useRef<HTMLInputElement>(null);
  const pendingSourceRef                      = useRef<PortalSource | null>(null);

  /* ── Custom portals ── */
  const [customPortals, setCustomPortals] = useState<CustomPortal[]>([]);
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [editingPortal, setEditingPortal] = useState<CustomPortal | null>(null);
  const customPhotoInputRef = useRef<HTMLInputElement>(null);
  const pendingCustomPortalIdRef = useRef<string | null>(null);

  useEffect(() => () => {
    esRef.current?.close();
    reenrichEsRef.current?.close();
  }, []);

  useEffect(() => {
    if (!careerId) return;
    fetchPortals(careerId).then(setCustomPortals);
    fetchPortalPhotos(careerId).then(setPortalPhotosState);
  }, [careerId]);

  /* ─── Handlers ─── */

  const handleReloadClubs = () => {
    clearClubCache();
    onReloadClubs();
  };

  const handleSyncPlayers = async () => {
    setSyncState("running"); setSyncMsg(SETTINGS[lang].syncingPlayers);
    try {
      const res  = await fetch("/api/players/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json() as { message?: string; remaining?: number; error?: string };
      if (!res.ok) { setSyncMsg(data.error ?? SETTINGS[lang].syncError); setSyncState("error"); }
      else         { setSyncMsg(data.message ?? t.doneSingle); setSyncRemaining(data.remaining ?? 0); setSyncState("done"); }
    } catch { setSyncMsg(SETTINGS[lang].connectionError); setSyncState("error"); }
  };

  const handleFullSetup = () => {
    setSetupState("running"); setSetupMsg(SETTINGS[lang].connectingMsg); setSetupProgress(null); setupFinishedRef.current = false;
    esRef.current?.close();
    const es = new EventSource("/api/admin/seed");
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as Record<string, unknown>;
        const type = ev.type as string;
        if (type === "phase" || type === "phase1_done") setSetupMsg(String(ev.message ?? ""));
        else if (type === "squads_start") setSetupProgress({ processed: 0, total: Number(ev.total ?? 0), playersSaved: 0, clubName: "", message: String(ev.message ?? "") });
        else if (type === "progress") setSetupProgress({ processed: Number(ev.processed ?? 0), total: Number(ev.total ?? 0), playersSaved: Number(ev.playersSaved ?? 0), clubName: String(ev.clubName ?? ""), message: String(ev.message ?? "") });
        else if (type === "rate_limit") { setupFinishedRef.current = true; setSetupMsg(String(ev.message ?? t.rateLimitReached)); setSetupState("error"); es.close(); }
        else if (type === "done")       { setupFinishedRef.current = true; setSetupMsg(String(ev.message ?? t.doneExclaim)); setSetupState("done"); setSetupProgress(null); es.close(); }
        else if (type === "error")      { setupFinishedRef.current = true; setSetupMsg(String(ev.message ?? t.errorFallback)); setSetupState("error"); es.close(); }
      } catch { /* ignore */ }
    };
    es.onerror = () => { if (!setupFinishedRef.current) { setSetupMsg(SETTINGS[lang].connectionLost); setSetupState("error"); } es.close(); };
  };

  const handleReenrich = () => {
    setReenrichState("running"); setReenrichMsg(SETTINGS[lang].connectingMsg); setReenrichProgress(null); reenrichFinishedRef.current = false;
    reenrichEsRef.current?.close();
    const es = new EventSource("/api/admin/reenrich-positions");
    reenrichEsRef.current = es;
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as Record<string, unknown>;
        const type = ev.type as string;
        if (type === "start")    setReenrichMsg(String(ev.message ?? ""));
        else if (type === "progress") setReenrichProgress({ processed: Number(ev.processed ?? 0), total: Number(ev.total ?? 0), teamsEnriched: Number(ev.teamsEnriched ?? 0), playersUpdated: Number(ev.playersUpdated ?? 0), clubName: String(ev.clubName ?? ""), message: String(ev.message ?? "") });
        else if (type === "done")  { reenrichFinishedRef.current = true; setReenrichMsg(String(ev.message ?? t.doneExclaim)); setReenrichState("done"); setReenrichProgress(null); es.close(); }
        else if (type === "error") { reenrichFinishedRef.current = true; setReenrichMsg(String(ev.message ?? t.errorFallback)); setReenrichState("error"); es.close(); }
      } catch { /* ignore */ }
    };
    es.onerror = () => { if (!reenrichFinishedRef.current) { setReenrichMsg(SETTINGS[lang].connectionLostSimple); setReenrichState("error"); } es.close(); };
  };

  const uploadToR2 = async (file: File, folder: string): Promise<string | null> => {
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/storage/uploads/file?folder=${folder}`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) return null;
      const { url } = (await res.json()) as { url: string };
      return url ?? null;
    } catch {
      return null;
    }
  };

  const handlePortalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const src  = pendingSourceRef.current;
    e.target.value = ""; pendingSourceRef.current = null;
    if (!file || !src || !careerId) return;
    const localUrl = URL.createObjectURL(file);
    setPortalPhotosState((prev) => ({ ...prev, [src]: localUrl }));
    setPhotoUploading(src);
    try {
      const publicUrl = await uploadToR2(file, "portal-photos");
      if (publicUrl) {
        URL.revokeObjectURL(localUrl);
        await savePortalPhoto(careerId, src, publicUrl);
        setPortalPhotosState((prev) => ({ ...prev, [src]: publicUrl }));
        window.dispatchEvent(new CustomEvent(PORTAL_PHOTOS_EVENT));
      }
    } finally {
      setPhotoUploading(null);
    }
  };

  const handleClearPortalPhoto = async (src: PortalSource) => {
    if (!careerId) return;
    setPortalPhotosState((prev) => { const next = { ...prev }; delete next[src]; return next; });
    setDraftUrls((prev) => ({ ...prev, [src]: "" }));
    await clearPortalPhotoApi(careerId, src);
    window.dispatchEvent(new CustomEvent(PORTAL_PHOTOS_EVENT));
  };

  const handleConfirmPortalUrl = async (src: PortalSource) => {
    const url = draftUrls[src].trim();
    if (!url || !careerId) return;
    setSavingPortal(src);
    try {
      await savePortalPhoto(careerId, src, url);
      setPortalPhotosState((prev) => ({ ...prev, [src]: url }));
      setDraftUrls((prev) => ({ ...prev, [src]: "" }));
      window.dispatchEvent(new CustomEvent(PORTAL_PHOTOS_EVENT));
      setSavedPortal(src);
      setTimeout(() => setSavedPortal(null), 2000);
    } finally {
      setSavingPortal(null);
    }
  };

  /* ─── Custom portal handlers ─── */

  const refreshCustomPortals = async () => {
    if (!careerId) return;
    const updated = await fetchPortals(careerId);
    setCustomPortals(updated);
    window.dispatchEvent(new CustomEvent(CUSTOM_PORTALS_EVENT));
  };

  const handleSavePortal = async (data: { name: string; description: string; tone: PortalTone; photo?: string }) => {
    if (!careerId) return;
    if (editingPortal) {
      await updatePortal(careerId, editingPortal.id, data);
    } else {
      await createPortal(careerId, data);
    }
    await refreshCustomPortals();
    setShowPortalModal(false);
    setEditingPortal(null);
  };

  const handleDeletePortal = async (id: string) => {
    if (!careerId) return;
    await deletePortal(careerId, id);
    await refreshCustomPortals();
  };

  const handleCustomPortalPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const portalId = pendingCustomPortalIdRef.current;
    e.target.value = ""; pendingCustomPortalIdRef.current = null;
    if (!file || !portalId || !careerId) return;
    const publicUrl = await uploadToR2(file, "portals");
    if (!publicUrl) return;
    await updatePortal(careerId, portalId, { photo: publicUrl });
    await refreshCustomPortals();
  };

  const handleClearCustomPortalPhoto = async (portalId: string) => {
    if (!careerId) return;
    await updatePortal(careerId, portalId, { photo: null });
    await refreshCustomPortals();
  };

  /* ─── Render helpers ─── */

  const actionBtn = (
    label: React.ReactNode,
    onClick: () => void,
    disabled = false,
    variant: "primary" | "ghost" = "ghost",
  ) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
      style={
        variant === "primary"
          ? { background: "var(--club-gradient)", color: "#fff", boxShadow: "0 4px 16px rgba(var(--club-primary-rgb),0.2)" }
          : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }
      }
    >
      {label}
    </button>
  );

  /* ─── Section: API & Dados ─── */
  const sectionApi = (
    <div className="space-y-5">

      {/* Importação completa */}
      <SectionCard
        title={t.apiSetupTitle}
        subtitle={t.apiSetupSubtitle}
      >
        <div className="flex flex-wrap gap-3 items-start">
          <button
            onClick={handleFullSetup}
            disabled={setupState === "running"}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: setupState === "done" ? "rgba(16,185,129,0.12)" : "rgba(var(--club-primary-rgb),0.12)",
              border: `1px solid ${setupState === "done" ? "rgba(16,185,129,0.3)" : "rgba(var(--club-primary-rgb),0.25)"}`,
              color: setupState === "done" ? "#34d399" : "var(--club-primary)",
            }}
          >
            {setupState === "running" ? (
              <><div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" /> {t.importing}</>
            ) : setupState === "done" ? (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> {t.importDone}</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> {t.importAll}</>
            )}
          </button>

          <span className="px-2 py-0.5 rounded text-[10px] font-bold self-center" style={{ background: "rgba(var(--club-primary-rgb),0.12)", color: "var(--club-primary)" }}>ADMIN</span>
        </div>

        {setupState === "running" && setupMsg && (
          <div className="mt-4 rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-white/60 text-xs">{setupMsg}</p>
            {setupProgress && (
              <>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${setupProgress.total > 0 ? Math.round((setupProgress.processed / setupProgress.total) * 100) : 0}%`, background: "var(--club-primary)" }} />
                </div>
                <p className="text-white/40 text-xs">{t.progressTeamsPlayers.replace("{processed}", String(setupProgress.processed)).replace("{total}", String(setupProgress.total)).replace("{players}", setupProgress.playersSaved.toLocaleString())}</p>
                {setupProgress.clubName && <p className="text-white/25 text-xs truncate">↳ {setupProgress.clubName}</p>}
              </>
            )}
          </div>
        )}
        <StatusMsg state={setupState} msg={(setupState === "done" || setupState === "error") ? setupMsg : ""} />
      </SectionCard>

      {/* Re-enrich */}
      <SectionCard
        title={t.reenrichTitle}
        subtitle={t.reenrichSubtitle}
      >
        <div className="flex flex-wrap gap-3 items-start">
          <button
            onClick={handleReenrich}
            disabled={reenrichState === "running"}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: reenrichState === "done" ? "rgba(16,185,129,0.12)" : "rgba(var(--club-primary-rgb),0.12)",
              border: `1px solid ${reenrichState === "done" ? "rgba(16,185,129,0.3)" : "rgba(var(--club-primary-rgb),0.25)"}`,
              color: reenrichState === "done" ? "#34d399" : "var(--club-primary)",
            }}
          >
            {reenrichState === "running" ? (
              <><div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" /> {t.reenriching}</>
            ) : reenrichState === "done" ? (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> {t.reenrichDone}</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> {t.reenrichBtn}</>
            )}
          </button>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold self-center" style={{ background: "rgba(var(--club-primary-rgb),0.12)", color: "var(--club-primary)" }}>ADMIN</span>
        </div>

        {reenrichState === "running" && (
          <div className="mt-4 rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-white/60 text-xs">{reenrichMsg}</p>
            {reenrichProgress && (
              <>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${reenrichProgress.total > 0 ? Math.round((reenrichProgress.processed / reenrichProgress.total) * 100) : 0}%`, background: "var(--club-primary)" }} />
                </div>
                <p className="text-white/40 text-xs">{t.progressTeamsPositions.replace("{processed}", String(reenrichProgress.processed)).replace("{total}", String(reenrichProgress.total)).replace("{positions}", reenrichProgress.playersUpdated.toLocaleString())}</p>
                {reenrichProgress.clubName && <p className="text-white/25 text-xs truncate">↳ {reenrichProgress.clubName}</p>}
              </>
            )}
          </div>
        )}
        <StatusMsg state={reenrichState} msg={(reenrichState === "done" || reenrichState === "error") ? reenrichMsg : ""} />
      </SectionCard>

      {/* Sync players + club list side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <SectionCard title={t.syncTitle} subtitle={t.syncSubtitle}>
          <button
            onClick={handleSyncPlayers}
            disabled={syncState === "running"}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 glass glass-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncState === "running"
              ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" /><span className="text-white/70">{t.syncing}</span></>
              : <><svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                <span className="text-white/70">{syncState === "done" && syncRemaining > 0 ? t.syncContinue.replace("{n}", String(syncRemaining)) : t.syncBtn}</span></>
            }
          </button>
          <StatusMsg state={syncState} msg={syncMsg} />
        </SectionCard>

        <SectionCard title={t.clubListTitle} subtitle={t.clubListSubtitle}>
          <button
            onClick={handleReloadClubs}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white/70 hover:text-white transition-all duration-200 glass glass-hover"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {t.reloadClubsBtn}
          </button>
        </SectionCard>
      </div>

    </div>
  );

  /* ─── Section: Portais de Notícias ─── */
  const sectionPortais = (
    <div className="space-y-5">
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePortalFileChange} />
      <input ref={customPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleCustomPortalPhotoChange} />

      {/* Portais Personalizados */}
      {careerId && (
        <SectionCard
          title={t.customPortaisTitle}
          subtitle={t.customPortaisSubtitle}
        >
          <div className="flex flex-col gap-3">
            {customPortals.map((portal) => {
              const toneInfo = PORTAL_TONES.find((pt) => pt.id === portal.tone);
              return (
                <div
                  key={portal.id}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {/* Avatar */}
                  <div
                    className="flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center font-black cursor-pointer relative"
                    style={{
                      width: 48, height: 48,
                      background: portal.photo ? "transparent" : "rgba(var(--club-primary-rgb),0.15)",
                      border: "2px solid rgba(var(--club-primary-rgb),0.4)",
                      color: "var(--club-primary)",
                      fontSize: 18,
                    }}
                    onClick={() => { pendingCustomPortalIdRef.current = portal.id; customPhotoInputRef.current?.click(); }}
                    title={t.clickToAddPhoto}
                  >
                    {portal.photo
                      ? <img src={portal.photo} alt={portal.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      : portal.name.charAt(0).toUpperCase()
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{portal.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {toneInfo && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold" style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }}>
                          {toneInfo.emoji} {TONE_LABELS[toneInfo.id] ?? toneInfo.label}
                        </span>
                      )}
                      <span className="text-white/30 text-xs truncate">{portal.description.slice(0, 50)}{portal.description.length > 50 ? "…" : ""}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {portal.photo && (
                      <button
                        onClick={() => handleClearCustomPortalPhoto(portal.id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/[0.08]"
                        style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
                        title={t.removePhotoTitle}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => { setEditingPortal(portal); setShowPortalModal(true); }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/[0.08]"
                      style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                      title={t.editPortalTitle}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeletePortal(portal.id)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-red-500/10"
                      style={{ color: "rgba(248,113,113,0.6)", border: "1px solid rgba(248,113,113,0.15)" }}
                      title={t.deletePortalTitle}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {planLimits.maxCustomPortals === 0 ? (
              <UpgradePrompt
                currentPlan={resolvedPlan}
                requiredPlan="ultra"
                featureName={t.upgradeCustomPortais}
                description={t.upgradeCustomPortaisDesc}
                compact
              />
            ) : customPortals.length < planLimits.maxCustomPortals && (
              <button
                onClick={() => { setEditingPortal(null); setShowPortalModal(true); }}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.99]"
                style={{
                  background: "rgba(var(--club-primary-rgb),0.08)",
                  border: "1px dashed rgba(var(--club-primary-rgb),0.35)",
                  color: "var(--club-primary)",
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t.addPortalBtn.replace("{count}", String(customPortals.length))}
              </button>
            )}

            {customPortals.length === 0 && (
              <p className="text-white/25 text-xs text-center -mt-1">
                {t.customPortaisExamples}
              </p>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title={t.portalPhotosTitle}
        subtitle={t.portalPhotosSubtitle}
      >
        <div className="space-y-3">
          {PORTAL_META.map(({ source, label, color, bgColor, defaultPhoto }) => {
            const photo = portalPhotos[source];
            const displayPhoto = photo || defaultPhoto;
            const draft = draftUrls[source];
            const isSaving = savingPortal === source;
            const isSaved = savedPortal === source;
            const displayLabel = PORTAL_META_LABELS[source] ?? label;
            return (
              <div
                key={source}
                className="rounded-2xl px-4 py-3 flex flex-col gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                {/* Top row: avatar + info + remove */}
                <div className="flex items-center gap-4">
                  <div
                    className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-black"
                    style={{ width: 52, height: 52, background: displayPhoto ? "transparent" : bgColor, border: `2.5px solid ${color}`, color, fontSize: 20 }}
                  >
                    {displayPhoto
                      ? <img src={displayPhoto} alt={displayLabel} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      : displayLabel.charAt(0).toUpperCase()
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{displayLabel}</p>
                    <p className="text-xs mt-0.5" style={{ color: isSaved ? "#34d399" : photo ? "#34d399" : defaultPhoto ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.3)" }}>
                      {isSaved ? t.photoSaved : photo ? t.photoActive : defaultPhoto ? t.photoDefault : t.photoInitial}
                    </p>
                  </div>
                  {photo && (
                    <button
                      onClick={() => handleClearPortalPhoto(source)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-white/[0.08] active:scale-95 flex-shrink-0"
                      style={{ color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}
                      title={t.removePhotoTitle}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* URL input + confirm button */}
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder={t.urlPlaceholder}
                    value={draft}
                    onChange={(e) => setDraftUrls((prev) => ({ ...prev, [source]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleConfirmPortalUrl(source); }}
                    className="flex-1 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <button
                    onClick={() => handleConfirmPortalUrl(source)}
                    disabled={!draft.trim() || isSaving}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${color} 18%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
                      color,
                    }}
                  >
                    {isSaving ? t.savingMsg : t.confirmBtn}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title={t.tipTitle}>
        <p className="text-white/40 text-sm leading-relaxed">
          {t.tipText}
        </p>
      </SectionCard>
    </div>
  );

  const sectionIA = (
    <div className="flex flex-col gap-5">
      <SectionCard title={t.planTitle} subtitle={t.planSubtitle}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${getPlanColor(resolvedPlan)} 12%, transparent)` }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: getPlanColor(resolvedPlan) }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm">{getPlanLabel(resolvedPlan)}</p>
              <p className="text-white/35 text-xs mt-0.5">{t.activePlan}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {[
              { label: t.aiGenerationsLabel, value: planLimits.aiGenerationsPerDay === Infinity ? t.unlimited : String(planLimits.aiGenerationsPerDay) },
              { label: t.aiModelLabel, value: resolvedPlan === "ultra" ? "GPT-4o" : "Gemini Flash" },
              { label: t.diretoriaLabel, value: planLimits.diretoriaEnabled ? t.enabled : t.lockedSingle },
              { label: t.customPortaisLabel, value: planLimits.maxCustomPortals === 0 ? t.blockedSingle : t.upTo.replace("{n}", String(planLimits.maxCustomPortals)) },
              { label: t.autoNewsLabel, value: planLimits.autoNewsEnabled ? t.enabledPl : t.lockedPl },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-white/45 text-xs">{label}</span>
                <span className="text-white/80 text-xs font-semibold">{value}</span>
              </div>
            ))}
          </div>

          {resolvedPlan === "free" && (
            <div className="rounded-xl px-4 py-3 flex flex-col gap-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs">{t.statusLabel}</span>
                <span className="text-white/80 text-xs font-semibold">{t.freeStatus}</span>
              </div>
            </div>
          )}
          {resolvedPlan !== "free" && (
            <div className="flex flex-col gap-2">
              {subLoading && (
                <div className="flex items-center gap-2 text-white/30 text-xs px-1">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t.loadingSub}
                </div>
              )}
              {!subLoading && subscription && (
                <div className="rounded-xl px-4 py-3 flex flex-col gap-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {subscription.product_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-xs">{t.activePlanLabel}</span>
                      <span className="text-white/80 text-xs font-semibold">{subscription.product_name}</span>
                    </div>
                  )}
                  {subscription.current_period_end && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-xs">
                        {subscription.cancel_at_period_end ? t.cancelAt : t.renewAt}
                      </span>
                      <span className={`text-xs font-semibold ${subscription.cancel_at_period_end ? "text-amber-400" : "text-white/80"}`}>
                        {new Date(subscription.current_period_end).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US")}
                      </span>
                    </div>
                  )}
                  {subscription.cancel_at_period_end && (
                    <p className="text-amber-400/70 text-xs mt-0.5">{t.cancelNote}</p>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={handleOpenPortal}
                  disabled={portalLoading}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-80 active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
                >
                  {portalLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {t.openingPortal}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                      </svg>
                      {t.manageSubBtn}
                    </>
                  )}
                </button>
                {portalError && <p className="text-red-400 text-xs text-center">{portalError}</p>}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {resolvedPlan !== "ultra" && (
        <UpgradePrompt
          currentPlan={resolvedPlan}
          requiredPlan={resolvedPlan === "free" ? "pro" : "ultra"}
          featureName={resolvedPlan === "free" ? t.upgradeMore : t.upgradeUltra}
          description={resolvedPlan === "free" ? t.upgradeMoreDesc : t.upgradeUltraDesc}
          compact
        />
      )}
    </div>
  );

  /* ─── Main render ─── */
  return (
    <>
    <div className="animate-fade-up">
      {/* Page heading */}
      <div className="mb-6">
        <h2 className="text-xl font-black text-white">{t.pageTitle}</h2>
        <p className="text-white/35 text-sm mt-0.5">{t.pageSubtitle}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left sidebar ── */}
        <nav className="w-full lg:w-52 flex-shrink-0 lg:sticky lg:top-20">
          <div className="flex lg:flex-col gap-1 p-1 rounded-2xl lg:p-0 lg:gap-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {NAV_ITEMS.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-left w-full transition-all duration-150"
                  style={{
                    background: active ? "rgba(var(--club-primary-rgb),0.12)" : "transparent",
                    color:      active ? "var(--club-primary)"                 : "rgba(255,255,255,0.45)",
                    border: active ? "1px solid rgba(var(--club-primary-rgb),0.2)" : "1px solid transparent",
                  }}
                >
                  <span style={{ color: active ? "var(--club-primary)" : "rgba(255,255,255,0.3)" }}>{item.icon}</span>
                  {NAV_LABELS[item.id]}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Right content ── */}
        <div className="flex-1 min-w-0">
          {section === "temporada" && (
            <div className="space-y-5">
              <SectionCard
                title={t.sNotificacoesTitle}
                subtitle={t.sNotificacoesSubtitle}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white/80 text-sm font-semibold">{t.soundLabel}</p>
                    <p className="text-white/35 text-xs mt-0.5 leading-relaxed">
                      {t.soundDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={soundEnabled}
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabledState(next);
                      setSoundEnabled(next);
                      if (next) playNotificationSound("noticias");
                    }}
                    className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
                    style={{
                      background: soundEnabled
                        ? "var(--club-primary, #22c55e)"
                        : "rgba(255,255,255,0.12)",
                    }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{ transform: soundEnabled ? "translateX(20px)" : "translateX(0)" }}
                    />
                  </button>
                </div>
              </SectionCard>

              <SectionCard
                title={t.sRivaisTitle}
                subtitle={t.sRivaisSubtitle}
              >
                {seasonId
                  ? <RivaisView seasonId={seasonId} />
                  : <p className="text-xs text-white/30">{t.noActiveSeason}</p>
                }
              </SectionCard>

              {onDeleteCareer && (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}
                >
                  <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(239,68,68,0.1)" }}>
                    <h3 className="text-sm font-bold" style={{ color: "#f87171" }}>{t.dangerZoneTitle}</h3>
                    <p className="text-white/35 text-xs mt-0.5 leading-relaxed">
                      {t.dangerZoneSubtitle}
                    </p>
                  </div>
                  <div className="px-6 py-5">
                    {!deleteConfirm ? (
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-white/70 text-sm font-semibold">{t.deleteCareerLabel}</p>
                          <p className="text-white/35 text-xs mt-0.5 leading-relaxed">
                            {t.deleteCareerDesc}
                          </p>
                        </div>
                        <button
                          onClick={() => setDeleteConfirm(true)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 hover:opacity-90 active:scale-95"
                          style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {t.deleteBtn}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div
                          className="flex items-start gap-3 rounded-xl px-4 py-3"
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
                        >
                          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className="text-xs leading-relaxed" style={{ color: "#f87171" }}>
                            {t.deleteConfirmMsg}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDeleteConfirm(false)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 hover:opacity-80"
                            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                          >
                            {t.cancelBtn}
                          </button>
                          <button
                            onClick={onDeleteCareer}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                            style={{ background: "rgba(239,68,68,0.85)", color: "white" }}
                          >
                            {t.deleteConfirmBtn}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {section === "api"     && sectionApi}
          {section === "portais" && sectionPortais}
          {section === "ia"      && sectionIA}
          {section === "idioma"  && (
            <div className="flex flex-col gap-6">
              <SectionCard
                title={t.idiomaSectionTitle}
                subtitle={t.idiomaSectionSubtitle}
              >
                <div className="flex gap-3">
                  <button
                    onClick={() => setLang("pt")}
                    className="flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95"
                    style={{
                      background: lang === "pt" ? "var(--club-gradient)" : "rgba(255,255,255,0.06)",
                      color: lang === "pt" ? "#fff" : "rgba(255,255,255,0.45)",
                      border: lang === "pt" ? "none" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    🇧🇷 PT
                  </button>
                  <button
                    onClick={() => setLang("en")}
                    className="flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95"
                    style={{
                      background: lang === "en" ? "var(--club-gradient)" : "rgba(255,255,255,0.06)",
                      color: lang === "en" ? "#fff" : "rgba(255,255,255,0.45)",
                      border: lang === "en" ? "none" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    🇺🇸 EN
                  </button>
                </div>
              </SectionCard>
            </div>
          )}
        </div>

      </div>
    </div>

    {showPortalModal && careerId && (
      <CustomPortalModal
        initial={editingPortal}
        onSave={handleSavePortal}
        onClose={() => { setShowPortalModal(false); setEditingPortal(null); }}
      />
    )}
    </>
  );
}
