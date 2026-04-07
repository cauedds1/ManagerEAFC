import { useState, useEffect } from "react";
import { getApiKey, setApiKey, clearClubCache } from "@/lib/clubListCache";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onReloadClubs: () => void;
}

export function Settings({ isOpen, onClose, onReloadClubs }: SettingsProps) {
  const [apiKey, setApiKeyState] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKeyState(getApiKey() ?? "");
      setSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveKey = () => {
    const trimmed = apiKey.trim();
    if (trimmed) setApiKey(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReloadClubs = () => {
    clearClubCache();
    onClose();
    onReloadClubs();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "#141414",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--club-primary)20" }}
            >
              <svg className="w-4 h-4" style={{ color: "var(--club-primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-white font-bold text-base">Configurações</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/08 transition-all duration-150"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* API Key section */}
          <div>
            <label className="block text-white/50 text-xs font-semibold tracking-widest uppercase mb-3">
              Chave de API — API-Football
            </label>
            <div className="relative mb-3">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => { setApiKeyState(e.target.value); setSaved(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                placeholder="Cole sua chave aqui..."
                autoComplete="off"
                className="w-full pr-10 pl-4 py-2.5 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontFamily: showKey ? "inherit" : "monospace",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--club-primary)80")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showKey ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
            <button
              onClick={handleSaveKey}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:opacity-85 active:scale-95"
              style={{ background: saved ? "rgba(16,185,129,0.8)" : "var(--club-primary)", color: "#fff" }}
            >
              {saved ? "✓ Salvo" : "Salvar chave"}
            </button>
            <p className="mt-2 text-white/25 text-xs">
              🔒 Armazenada apenas no seu navegador
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />

          {/* Club list cache section */}
          <div>
            <p className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-1">
              Lista de Clubes
            </p>
            <p className="text-white/30 text-xs leading-relaxed mb-3">
              Limpa o cache local e busca novamente todos os clubes da API-Football. Isso pode levar cerca de 15 segundos.
            </p>
            <button
              onClick={handleReloadClubs}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-white/70 hover:text-white transition-all duration-200 hover:opacity-90 active:scale-95"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Atualizar lista de clubes
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl font-semibold text-sm text-white/50 hover:text-white transition-all duration-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
