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
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--app-bg, #0a0a0a)" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
            style={{ background: "var(--club-primary, #1a1a2e)22", border: "1px solid var(--club-primary, #4f46e5)30" }}
          >
            <svg className="w-8 h-8" style={{ color: "var(--club-primary, #4f46e5)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">FC Career Manager</h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Configuração única necessária para buscar os clubes e salvar no banco de dados.
            Após isso, o app funciona sem a chave — mesmo limpando o cache do navegador.
          </p>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <label className="block text-white/60 text-xs font-semibold tracking-widest uppercase mb-3">
            Chave de API
          </label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Cole sua chave aqui..."
              autoComplete="off"
              className="w-full pr-10 pl-4 py-3 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${error ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.12)"}`,
                fontFamily: show ? "inherit" : "monospace",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--club-primary, #4f46e5)80")}
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = error ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.12)")
              }
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {show ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            className="mt-5 w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:opacity-85 active:scale-95"
            style={{ background: "var(--club-primary, #4f46e5)" }}
          >
            Confirmar e carregar clubes
          </button>
        </div>

        <div
          className="mt-4 p-4 rounded-xl"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="text-white/30 text-xs leading-relaxed">
            🔒 Sua chave fica salva localmente no navegador e nunca é enviada a terceiros além da{" "}
            <a
              href="https://www.api-football.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "inherit" }}
            >
              API-Football
            </a>
            . A lista de clubes é salva no banco de dados e não é perdida ao limpar o cache.
          </p>
        </div>
      </div>
    </div>
  );
}
