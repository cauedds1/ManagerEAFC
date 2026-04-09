import { useState, useEffect, useRef } from "react";
import { getApiKey, setApiKey, clearClubCache } from "@/lib/clubListCache";
import { clearAllSquadCaches } from "@/lib/squadCache";

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

export function Settings({ isOpen, onClose, onReloadClubs }: SettingsProps) {
  const [apiKey, setApiKeyState] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  // Player sync (existing button)
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncMsg, setSyncMsg] = useState("");
  const [syncRemaining, setSyncRemaining] = useState(0);

  // Full initial setup (SSE button)
  const [setupState, setSetupState] = useState<SyncState>("idle");
  const [setupProgress, setSetupProgress] = useState<SeedProgress | null>(null);
  const [setupMsg, setSetupMsg] = useState("");
  const esRef = useRef<EventSource | null>(null);
  const setupFinishedRef = useRef(false);

  // Re-enrich positions (SSE button)
  const [reenrichState, setReenrichState] = useState<SyncState>("idle");
  const [reenrichProgress, setReenrichProgress] = useState<ReenrichProgress | null>(null);
  const [reenrichMsg, setReenrichMsg] = useState("");
  const reenrichEsRef = useRef<EventSource | null>(null);
  const reenrichFinishedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setApiKeyState(getApiKey() ?? "");
      setSaved(false);
      setSyncState("idle");
      setSyncMsg("");
      if (setupState !== "running") {
        setSetupState("idle");
        setSetupMsg("");
        setSetupProgress(null);
      }
    }
  }, [isOpen]);

  // Cleanup SSE on unmount
  useEffect(() => () => {
    esRef.current?.close();
    reenrichEsRef.current?.close();
  }, []);

  if (!isOpen) return null;

  const handleSaveKey = () => {
    const trimmed = apiKey.trim();
    if (trimmed) { setApiKey(trimmed); clearAllSquadCaches(); }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReloadClubs = () => {
    clearClubCache();
    onClose();
    onReloadClubs();
  };

  const handleSyncPlayers = async () => {
    const key = apiKey.trim() || (getApiKey() ?? "");
    if (!key) { setSyncMsg("Configure e salve a chave de API primeiro."); setSyncState("error"); return; }
    setSyncState("running");
    setSyncMsg("Buscando jogadores na API...");
    try {
      const res = await fetch("/api/players/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json() as { message?: string; remaining?: number; error?: string };
      if (!res.ok) { setSyncMsg(data.error ?? "Erro ao sincronizar."); setSyncState("error"); }
      else { setSyncMsg(data.message ?? "Concluído."); setSyncRemaining(data.remaining ?? 0); setSyncState("done"); }
    } catch { setSyncMsg("Erro de conexão. Tente novamente."); setSyncState("error"); }
  };

  const handleFullSetup = () => {
    const key = apiKey.trim() || (getApiKey() ?? "");
    if (!key) { setSetupMsg("Configure e salve a chave de API primeiro."); setSetupState("error"); return; }

    setSetupState("running");
    setSetupMsg("Conectando...");
    setSetupProgress(null);
    setupFinishedRef.current = false;

    esRef.current?.close();
    const es = new EventSource(`/api/admin/seed?apiKey=${encodeURIComponent(key)}`);
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
          setSetupMsg(String(ev.message ?? "Limite de req. atingido."));
          setSetupState("error");
          es.close();
        } else if (type === "done") {
          setupFinishedRef.current = true;
          setSetupMsg(String(ev.message ?? "Concluído!"));
          setSetupState("done");
          setSetupProgress(null);
          es.close();
        } else if (type === "error") {
          setupFinishedRef.current = true;
          setSetupMsg(String(ev.message ?? "Erro."));
          setSetupState("error");
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      if (!setupFinishedRef.current) {
        setSetupMsg("Conexão perdida. Verifique a chave de API e tente novamente.");
        setSetupState("error");
      }
      es.close();
    };
  };

  const handleReenrich = () => {
    setReenrichState("running");
    setReenrichMsg("Conectando...");
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
          setReenrichMsg(String(ev.message ?? "Concluído!"));
          setReenrichState("done");
          setReenrichProgress(null);
          es.close();
        } else if (type === "error") {
          reenrichFinishedRef.current = true;
          setReenrichMsg(String(ev.message ?? "Erro."));
          setReenrichState("error");
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      if (!reenrichFinishedRef.current) {
        setReenrichMsg("Conexão perdida. Tente novamente.");
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

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(var(--club-primary-rgb),0.12)" }}>
              <svg className="w-4 h-4" style={{ color: "var(--club-primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-white font-bold text-base">Configurações</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all duration-150">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[72vh] overflow-y-auto">

          {/* ── API Key ── */}
          <div>
            <label className="block text-white/50 text-xs font-semibold tracking-widest uppercase mb-3">Chave de API — API-Football</label>
            <div className="relative mb-3">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => { setApiKeyState(e.target.value); setSaved(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                placeholder="Cole sua chave aqui..."
                autoComplete="off"
                className="w-full pr-10 pl-4 py-2.5 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none transition-all duration-200 glass"
                style={{ fontFamily: showKey ? "inherit" : "monospace" }}
              />
              <button type="button" onClick={() => setShowKey((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {showKey
                  ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            </div>
            <button onClick={handleSaveKey}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: saved ? "rgba(16,185,129,0.8)" : "var(--club-gradient)", color: "#fff", boxShadow: saved ? "none" : "0 4px 16px rgba(var(--club-primary-rgb),0.2)" }}>
              {saved ? "Salvo ✓" : "Salvar chave"}
            </button>
            <p className="mt-2 text-white/25 text-xs flex items-center gap-1.5">
              <svg className="w-3 h-3 flex-shrink-0" style={{ color: "var(--club-primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Armazenada apenas no seu navegador
            </p>
          </div>

          <div style={{ height: "1px", background: "var(--surface-border)" }} />

          {/* ── Setup inicial ── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-white/50 text-xs font-semibold tracking-widest uppercase">Configuração inicial do sistema</p>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }}>ADMIN</span>
            </div>
            <p className="text-white/30 text-xs leading-relaxed mb-3">
              Importa <strong className="text-white/50">todos os times e jogadores</strong> de todas as ligas via API-Football em uma única operação (~3 min, ~700 req). Execute uma vez antes de compartilhar o sistema — após isso todos os usuários têm tudo disponível sem configurar nada.
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
                    <span>Importando...</span>
                  </>
                ) : setupState === "done" ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span>Importação concluída</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span>Importar tudo agora</span>
                  </>
                )}
              </span>
            </button>

            {/* Live progress */}
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
                    <p className="text-white/40 text-xs">{setupProgress.processed}/{setupProgress.total} times · {setupProgress.playersSaved.toLocaleString("pt-BR")} jogadores salvos</p>
                    {setupProgress.clubName && <p className="text-white/25 text-xs truncate">↳ {setupProgress.clubName}</p>}
                  </>
                )}
              </div>
            )}

            {/* Done / error message */}
            {(setupState === "done" || setupState === "error") && setupMsg && (
              <div className="mt-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed" style={{ background: syncColor(setupState), color: "#fff" }}>
                {setupMsg}
              </div>
            )}
          </div>

          <div style={{ height: "1px", background: "var(--surface-border)" }} />

          {/* ── Corrigir posições (msmc.cc) ── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-white/50 text-xs font-semibold tracking-widest uppercase">Corrigir posições dos jogadores</p>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }}>ADMIN</span>
            </div>
            <p className="text-white/30 text-xs leading-relaxed mb-3">
              Atualiza as posições de todos os jogadores usando dados do EA FC 26 (msmc.cc). Corrige mapeamentos incorretos de times como Milan, Inter, Newcastle etc.
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
                    <span>Corrigindo posições...</span>
                  </>
                ) : reenrichState === "done" ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span>Posições atualizadas</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span>Corrigir posições agora</span>
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
                    <p className="text-white/40 text-xs">{reenrichProgress.processed}/{reenrichProgress.total} times · {reenrichProgress.playersUpdated.toLocaleString("pt-BR")} posições corrigidas</p>
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

          {/* ── Atualizar dados de jogadores ── */}
          <div>
            <p className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-1">Dados de Jogadores</p>
            <p className="text-white/30 text-xs leading-relaxed mb-3">
              Sincroniza jogadores de times ainda não importados (90 por vez).
            </p>
            <button
              onClick={handleSyncPlayers}
              disabled={syncState === "running"}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 glass glass-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-2">
                {syncState === "running" ? (
                  <><div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" /><span className="text-white/70">Sincronizando...</span></>
                ) : (
                  <><svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <span className="text-white/70">{syncState === "done" && syncRemaining > 0 ? `Continuar (${syncRemaining} restantes)` : "Atualizar dados de jogadores"}</span></>
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
            <p className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-1">Lista de Clubes</p>
            <p className="text-white/30 text-xs leading-relaxed mb-3">Limpa o cache local e busca novamente todos os clubes.</p>
            <button onClick={handleReloadClubs} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white/70 hover:text-white transition-all duration-200 glass glass-hover">
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Atualizar lista de clubes
              </span>
            </button>
          </div>
        </div>

        <div className="px-6 py-4" style={{ borderTop: "1px solid var(--surface-border)" }}>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white/50 hover:text-white transition-all duration-200">Fechar</button>
        </div>
      </div>
    </div>
  );
}
