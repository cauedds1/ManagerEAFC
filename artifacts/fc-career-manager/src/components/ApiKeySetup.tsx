import { useState } from "react";
import { setApiKey } from "@/lib/clubListCache";

interface ApiKeySetupProps {
  onKeySet: (key: string) => void;
}

export function ApiKeySetup({ onKeySet }: ApiKeySetupProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  const handleSubmit = () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Informe sua chave de API");
      return;
    }
    setApiKey(trimmed);
    onKeySet(trimmed);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-6 animate-float"
            style={{ background: "rgba(var(--club-primary-rgb),0.12)", border: "1px solid rgba(var(--club-primary-rgb),0.2)", boxShadow: "0 0 40px rgba(var(--club-primary-rgb),0.15)" }}>
            <svg className="w-9 h-9" style={{ color: "var(--club-primary)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">FC Career Manager</h1>
          <p className="text-white/40 text-sm leading-relaxed max-w-sm mx-auto">
            Configure sua chave para buscar e salvar os clubes. Depois disso, o app funciona sem ela.
          </p>
        </div>

        <div className="glass rounded-2xl p-6" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
          <label className="block text-white/50 text-xs font-semibold tracking-widest uppercase mb-3">
            Chave da API-Football
          </label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Cole sua chave aqui..."
              autoComplete="off"
              className="w-full pr-10 pl-4 py-3.5 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none transition-all duration-300"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(var(--club-primary-rgb),0.15)"}`,
                fontFamily: show ? "inherit" : "monospace",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
              }}
              onFocus={(e) => {
                if (!error) {
                  e.currentTarget.style.borderColor = `rgba(var(--club-primary-rgb),0.4)`;
                  e.currentTarget.style.boxShadow = `inset 0 1px 2px rgba(0,0,0,0.3), 0 0 20px rgba(var(--club-primary-rgb),0.1)`;
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = error ? "rgba(239,68,68,0.5)" : "rgba(var(--club-primary-rgb),0.15)";
                e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.3)";
              }}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
            >
              {show ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            className="mt-5 w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "var(--club-gradient)",
              boxShadow: "0 4px 20px rgba(var(--club-primary-rgb),0.3)",
            }}
          >
            Confirmar e carregar clubes
          </button>
        </div>

        <div className="mt-4 glass rounded-xl p-4" style={{ opacity: 0.7 }}>
          <p className="text-white/30 text-xs leading-relaxed flex items-start gap-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--club-primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>
              Sua chave fica salva apenas no navegador. Clubes ficam salvos no servidor — não perde ao limpar cache.
              {" "}<a href="https://www.api-football.com" target="_blank" rel="noopener noreferrer" className="underline opacity-60 hover:opacity-100 transition-opacity">api-football.com</a>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
