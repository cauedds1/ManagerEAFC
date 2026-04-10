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
import { getOpenAIKey, setOpenAIKey, clearOpenAIKey } from "@/lib/openaiKeyStorage";

interface SettingsPageProps {
  onReloadClubs: () => void;
}

type SyncState = "idle" | "running" | "done" | "error";
type Section = "api" | "portais" | "ia";

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

export function SettingsPage({ onReloadClubs }: SettingsPageProps) {
  const [section, setSection] = useState<Section>("api");

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
  const [portalPhotos, setPortalPhotosState] = useState<PortalPhotos>(() => getPortalPhotos());
  const photoInputRef                         = useRef<HTMLInputElement>(null);
  const pendingSourceRef                      = useRef<PortalSource | null>(null);

  /* ── OpenAI key ── */
  const [openaiKey, setOpenaiKeyState]     = useState(() => getOpenAIKey());
  const [showOpenaiKey, setShowOpenaiKey]  = useState(false);
  const [openaiSaved, setOpenaiSaved]      = useState(false);

  useEffect(() => () => {
    esRef.current?.close();
    reenrichEsRef.current?.close();
  }, []);

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

  const handlePortalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const src  = pendingSourceRef.current;
    e.target.value = ""; pendingSourceRef.current = null;
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
          {section === "api"     && sectionApi}
          {section === "portais" && sectionPortais}
          {section === "ia"      && sectionIA}
        </div>

      </div>
    </div>
  );
}
