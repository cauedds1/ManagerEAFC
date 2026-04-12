import { useState, useEffect, useRef } from "react";
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
import { getOpenAIKey, setOpenAIKey, clearOpenAIKey } from "@/lib/openaiKeyStorage";
import { RivaisView } from "./RivaisView";

interface SettingsPageProps {
  onReloadClubs: () => void;
  careerId?: string;
  seasonId?: string;
}

type SyncState = "idle" | "running" | "done" | "error";
type Section = "api" | "portais" | "ia" | "temporada";

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

const PORTAL_META: { source: PortalSource; label: string; color: string; bgColor: string }[] = [
  { source: "tnt",     label: "TNT Sports",      color: "#E8002D",              bgColor: "rgba(232,0,45,0.15)" },
  { source: "espn",    label: "ESPN",             color: "#E67E22",              bgColor: "rgba(230,126,34,0.15)" },
  { source: "fanpage", label: "FanPage do Clube", color: "var(--club-primary)",  bgColor: "rgba(var(--club-primary-rgb),0.15)" },
];

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  {
    id: "temporada",
    label: "Temporada",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "api",
    label: "API & Dados",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
  },
  {
    id: "portais",
    label: "Portais de Notícias",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h2" />
      </svg>
    ),
  },
  {
    id: "ia",
    label: "IA & Notícias",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
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
            <h2 className="text-white font-bold text-base">{initial ? "Editar Portal" : "Novo Portal"}</h2>
            <p className="text-white/40 text-xs mt-0.5">A IA usará o tom escolhido ao escrever as notícias.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/[0.07] transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Photo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Foto do Portal</label>
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
                title="Clique para adicionar foto"
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
                  {photo ? "Alterar foto" : "Adicionar foto"}
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto(undefined)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                    style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                  >
                    Remover
                  </button>
                )}
                <p className="text-white/30 text-xs">Foto opcional do portal</p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Nome do Portal</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Ex: Baldasso Internacional"
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
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Descrição / Quem é?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Ex: Jornalista apaixonado pelo Grêmio, especialista em futebol gaúcho, escreve com emoção e fidelidade ao clube."
              className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20 resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}
            />
            <p className="text-right text-white/25 text-xs">{description.length}/200</p>
          </div>

          {/* Tone */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Tom do Portal</label>
            <div className="grid grid-cols-2 gap-2">
              {PORTAL_TONES.map((t) => {
                const active = tone === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className="flex flex-col gap-1 px-3 py-2.5 rounded-xl text-left transition-all duration-150"
                    style={{
                      background: active ? "rgba(var(--club-primary-rgb),0.15)" : "rgba(255,255,255,0.03)",
                      border: active ? "1px solid rgba(var(--club-primary-rgb),0.45)" : "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <span className="text-base leading-none">{t.emoji}</span>
                    <span className="text-xs font-bold" style={{ color: active ? "var(--club-primary)" : "rgba(255,255,255,0.7)" }}>{t.label}</span>
                    <span className="text-xs leading-tight" style={{ color: active ? "rgba(var(--club-primary-rgb),0.7)" : "rgba(255,255,255,0.3)" }}>{t.description}</span>
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
            Cancelar
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
            {initial ? "Salvar alterações" : "Criar portal"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage({ onReloadClubs, careerId, seasonId }: SettingsPageProps) {
  const [section, setSection] = useState<Section>("temporada");

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
  const [photoUploading, setPhotoUploading] = useState<PortalSource | null>(null);
  const photoInputRef                         = useRef<HTMLInputElement>(null);
  const pendingSourceRef                      = useRef<PortalSource | null>(null);

  /* ── Custom portals ── */
  const [customPortals, setCustomPortals] = useState<CustomPortal[]>([]);
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [editingPortal, setEditingPortal] = useState<CustomPortal | null>(null);
  const customPhotoInputRef = useRef<HTMLInputElement>(null);
  const pendingCustomPortalIdRef = useRef<string | null>(null);

  /* ── OpenAI key ── */
  const [openaiKey, setOpenaiKeyState]     = useState(() => getOpenAIKey());
  const [showOpenaiKey, setShowOpenaiKey]  = useState(false);
  const [openaiSaved, setOpenaiSaved]      = useState(false);

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

  const handleSaveOpenaiKey = () => {
    setOpenAIKey(openaiKey);
    setOpenaiSaved(true);
    setTimeout(() => setOpenaiSaved(false), 2000);
  };

  const handleClearOpenaiKey = () => {
    clearOpenAIKey();
    setOpenaiKeyState("");
    setOpenaiSaved(false);
  };

  const handleReloadClubs = () => {
    clearClubCache();
    onReloadClubs();
  };

  const handleSyncPlayers = async () => {
    setSyncState("running"); setSyncMsg("Buscando jogadores na API...");
    try {
      const res  = await fetch("/api/players/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json() as { message?: string; remaining?: number; error?: string };
      if (!res.ok) { setSyncMsg(data.error ?? "Erro ao sincronizar."); setSyncState("error"); }
      else         { setSyncMsg(data.message ?? "Concluído."); setSyncRemaining(data.remaining ?? 0); setSyncState("done"); }
    } catch { setSyncMsg("Erro de conexão. Tente novamente."); setSyncState("error"); }
  };

  const handleFullSetup = () => {
    setSetupState("running"); setSetupMsg("Conectando..."); setSetupProgress(null); setupFinishedRef.current = false;
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
        else if (type === "rate_limit") { setupFinishedRef.current = true; setSetupMsg(String(ev.message ?? "Limite atingido.")); setSetupState("error"); es.close(); }
        else if (type === "done")       { setupFinishedRef.current = true; setSetupMsg(String(ev.message ?? "Concluído!")); setSetupState("done"); setSetupProgress(null); es.close(); }
        else if (type === "error")      { setupFinishedRef.current = true; setSetupMsg(String(ev.message ?? "Erro.")); setSetupState("error"); es.close(); }
      } catch { /* ignore */ }
    };
    es.onerror = () => { if (!setupFinishedRef.current) { setSetupMsg("Conexão perdida. Verifique a chave e tente novamente."); setSetupState("error"); } es.close(); };
  };

  const handleReenrich = () => {
    setReenrichState("running"); setReenrichMsg("Conectando..."); setReenrichProgress(null); reenrichFinishedRef.current = false;
    reenrichEsRef.current?.close();
    const es = new EventSource("/api/admin/reenrich-positions");
    reenrichEsRef.current = es;
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as Record<string, unknown>;
        const type = ev.type as string;
        if (type === "start")    setReenrichMsg(String(ev.message ?? ""));
        else if (type === "progress") setReenrichProgress({ processed: Number(ev.processed ?? 0), total: Number(ev.total ?? 0), teamsEnriched: Number(ev.teamsEnriched ?? 0), playersUpdated: Number(ev.playersUpdated ?? 0), clubName: String(ev.clubName ?? ""), message: String(ev.message ?? "") });
        else if (type === "done")  { reenrichFinishedRef.current = true; setReenrichMsg(String(ev.message ?? "Concluído!")); setReenrichState("done"); setReenrichProgress(null); es.close(); }
        else if (type === "error") { reenrichFinishedRef.current = true; setReenrichMsg(String(ev.message ?? "Erro.")); setReenrichState("error"); es.close(); }
      } catch { /* ignore */ }
    };
    es.onerror = () => { if (!reenrichFinishedRef.current) { setReenrichMsg("Conexão perdida. Tente novamente."); setReenrichState("error"); } es.close(); };
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
    await clearPortalPhotoApi(careerId, src);
    window.dispatchEvent(new CustomEvent(PORTAL_PHOTOS_EVENT));
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
        title="Configuração Inicial do Sistema"
        subtitle="Importa todos os times e jogadores de todas as ligas via API-Football (~3 min, ~700 requisições). Execute uma vez — após isso todos os usuários têm os dados sem precisar configurar nada."
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
              <><div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" /> Importando...</>
            ) : setupState === "done" ? (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Importação concluída</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Importar tudo</>
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
                <p className="text-white/40 text-xs">{setupProgress.processed}/{setupProgress.total} times · {setupProgress.playersSaved.toLocaleString("pt-BR")} jogadores salvos</p>
                {setupProgress.clubName && <p className="text-white/25 text-xs truncate">↳ {setupProgress.clubName}</p>}
              </>
            )}
          </div>
        )}
        <StatusMsg state={setupState} msg={(setupState === "done" || setupState === "error") ? setupMsg : ""} />
      </SectionCard>

      {/* Re-enrich */}
      <SectionCard
        title="Corrigir Posições dos Jogadores"
        subtitle="Atualiza as posições de todos os jogadores usando dados do EA FC 26 (msmc.cc). Corrige mapeamentos incorretos de times como Milan, Inter, Newcastle etc."
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
              <><div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" /> Corrigindo...</>
            ) : reenrichState === "done" ? (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Posições atualizadas</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> Corrigir posições</>
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
                <p className="text-white/40 text-xs">{reenrichProgress.processed}/{reenrichProgress.total} times · {reenrichProgress.playersUpdated.toLocaleString("pt-BR")} corrigidas</p>
                {reenrichProgress.clubName && <p className="text-white/25 text-xs truncate">↳ {reenrichProgress.clubName}</p>}
              </>
            )}
          </div>
        )}
        <StatusMsg state={reenrichState} msg={(reenrichState === "done" || reenrichState === "error") ? reenrichMsg : ""} />
      </SectionCard>

      {/* Sync players + club list side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <SectionCard title="Dados de Jogadores" subtitle="Sincroniza jogadores de times ainda não importados (90 por vez).">
          <button
            onClick={handleSyncPlayers}
            disabled={syncState === "running"}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 glass glass-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncState === "running"
              ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" /><span className="text-white/70">Sincronizando...</span></>
              : <><svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                <span className="text-white/70">{syncState === "done" && syncRemaining > 0 ? `Continuar (${syncRemaining} restantes)` : "Atualizar jogadores"}</span></>
            }
          </button>
          <StatusMsg state={syncState} msg={syncMsg} />
        </SectionCard>

        <SectionCard title="Lista de Clubes" subtitle="Limpa o cache local e busca novamente todos os clubes.">
          <button
            onClick={handleReloadClubs}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white/70 hover:text-white transition-all duration-200 glass glass-hover"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Atualizar lista
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
          title="Portais Personalizados"
          subtitle="Crie perfis únicos — jornalistas, torcedores, criadores de conteúdo — que a IA vai imitar ao gerar notícias. Máximo 3 portais por carreira."
        >
          <div className="flex flex-col gap-3">
            {customPortals.map((portal) => {
              const toneInfo = PORTAL_TONES.find((t) => t.id === portal.tone);
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
                    title="Clique para alterar a foto"
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
                          {toneInfo.emoji} {toneInfo.label}
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
                        title="Remover foto"
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
                      title="Editar portal"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeletePortal(portal.id)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-red-500/10"
                      style={{ color: "rgba(248,113,113,0.6)", border: "1px solid rgba(248,113,113,0.15)" }}
                      title="Deletar portal"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {customPortals.length < 3 && (
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
                Adicionar portal ({customPortals.length}/3)
              </button>
            )}

            {customPortals.length === 0 && (
              <p className="text-white/25 text-xs text-center -mt-1">
                Ex: "Baldasso Internacional", "Farid Grêmio", seu jornalista favorito…
              </p>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Fotos dos Portais"
        subtitle="Personalize a foto de perfil de cada portal. A imagem aparece no avatar circular do feed de Notícias. Formatos: JPG, PNG, WebP."
      >
        <div className="space-y-3">
          {PORTAL_META.map(({ source, label, color, bgColor }) => {
            const photo = portalPhotos[source];
            return (
              <div
                key={source}
                className="flex items-center gap-4 rounded-2xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                {/* Avatar preview */}
                <div
                  className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-black"
                  style={{ width: 52, height: 52, background: photo ? "transparent" : bgColor, border: `2.5px solid ${color}`, color, fontSize: 20 }}
                >
                  {photo
                    ? <img src={photo} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : label.charAt(0).toUpperCase()
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: photo ? "#34d399" : "rgba(255,255,255,0.3)" }}>
                    {photo ? "Foto personalizada ativa" : "Usando inicial do nome"}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { pendingSourceRef.current = source; photoInputRef.current?.click(); }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 hover:opacity-90 active:scale-95"
                    style={{
                      background: `color-mix(in srgb, ${color} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
                      color,
                    }}
                  >
                    {photo ? "Trocar" : "Adicionar foto"}
                  </button>
                  {photo && (
                    <button
                      onClick={() => handleClearPortalPhoto(source)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-white/[0.08] active:scale-95"
                      style={{ color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}
                      title="Remover foto"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Dica de uso">
        <p className="text-white/40 text-sm leading-relaxed">
          Use logotipos quadrados ou circulares do portal para melhor resultado. A imagem é recortada automaticamente no centro para caber no círculo. Para remover uma foto e voltar à inicial, clique no botão <strong className="text-white/60">×</strong> ao lado do portal.
        </p>
      </SectionCard>
    </div>
  );

  const sectionIA = (
    <div className="flex flex-col gap-5">
      <SectionCard
        title="Chave da OpenAI"
        subtitle="Adicione sua própria chave da OpenAI para gerar notícias e comentários únicos, criativos e sem repetições. Sem chave, o sistema usa um modelo padrão compartilhado."
      >
        <div className="flex flex-col gap-3">
          <div className="relative">
            <input
              type={showOpenaiKey ? "text" : "password"}
              value={openaiKey}
              onChange={(e) => setOpenaiKeyState(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveOpenaiKey(); }}
              placeholder="sk-..."
              className="w-full px-4 py-3 rounded-xl text-white text-sm font-mono focus:outline-none placeholder:text-white/20 pr-12"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
            <button
              onClick={() => setShowOpenaiKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              tabIndex={-1}
            >
              {showOpenaiKey ? (
                <svg className="w-4.5 h-4.5 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveOpenaiKey}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: openaiSaved ? "rgba(16,185,129,0.25)" : "var(--club-gradient)", color: openaiSaved ? "#34d399" : "white", border: openaiSaved ? "1px solid rgba(16,185,129,0.4)" : "none" }}
            >
              {openaiSaved ? "Chave salva!" : "Salvar chave"}
            </button>
            {openaiKey && (
              <button
                onClick={handleClearOpenaiKey}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 hover:opacity-80 active:scale-95"
                style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                Remover
              </button>
            )}
          </div>

          {openaiKey && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(52,211,153,0.8)" }}>
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Chave configurada — todas as gerações de notícias vão usar sua conta OpenAI
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Como funciona">
        <ul className="flex flex-col gap-3 text-sm text-white/45 leading-relaxed">
          <li className="flex gap-2.5">
            <span style={{ color: "var(--club-primary)" }} className="text-base leading-none mt-0.5">1.</span>
            <span>Acesse <strong className="text-white/60">platform.openai.com</strong>, vá em <em>API Keys</em> e crie uma nova chave.</span>
          </li>
          <li className="flex gap-2.5">
            <span style={{ color: "var(--club-primary)" }} className="text-base leading-none mt-0.5">2.</span>
            <span>Cole a chave aqui e clique em <strong className="text-white/60">Salvar chave</strong>.</span>
          </li>
          <li className="flex gap-2.5">
            <span style={{ color: "var(--club-primary)" }} className="text-base leading-none mt-0.5">3.</span>
            <span>Ao criar uma notícia no modo <strong className="text-white/60">Automático (IA)</strong>, o sistema usará sua chave para gerar conteúdo exclusivo — sem limites de criatividade.</span>
          </li>
        </ul>
      </SectionCard>
    </div>
  );

  /* ─── Main render ─── */
  return (
    <>
    <div className="animate-fade-up">
      {/* Page heading */}
      <div className="mb-6">
        <h2 className="text-xl font-black text-white">Configurações</h2>
        <p className="text-white/35 text-sm mt-0.5">API, sincronização de dados e personalização</p>
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
                  {item.label}
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
                title="Rivais da Temporada"
                subtitle="Defina até 3 rivais para a temporada atual. Clássicos têm tom diferenciado nas notícias e na Diretoria."
              >
                {seasonId
                  ? <RivaisView seasonId={seasonId} />
                  : <p className="text-xs text-white/30">Nenhuma temporada ativa.</p>
                }
              </SectionCard>
            </div>
          )}
          {section === "api"     && sectionApi}
          {section === "portais" && sectionPortais}
          {section === "ia"      && sectionIA}
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
