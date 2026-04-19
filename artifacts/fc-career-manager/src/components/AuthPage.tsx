import { useState } from "react";

interface AuthPageProps {
  onBack: () => void;
  onAuthSuccess: (token: string, user: { id: number; email: string; name: string }) => void;
}

const API_BASE = "/api";

export function AuthPage({ onBack, onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    if (!isLogin && !name.trim()) {
      setError("Informe seu nome.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isLogin ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;
      const body: Record<string, string> = { email: email.trim(), password };
      if (!isLogin) body.name = name.trim();

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { token?: string; user?: { id: number; email: string; name: string }; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Ocorreu um erro. Tente novamente.");
        return;
      }

      if (!data.token || !data.user) {
        setError("Resposta inválida do servidor.");
        return;
      }

      localStorage.setItem("fc_auth_token", data.token);
      localStorage.setItem("fc_auth_user", JSON.stringify(data.user));
      onAuthSuccess(data.token, data.user);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const switchMode = () => {
    setMode(isLogin ? "signup" : "login");
    setError("");
  };

  return (
    <div className="relative h-full flex flex-col items-center justify-center px-4 overflow-y-auto py-10">
      <button
        onClick={onBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-white/40 hover:text-white/70 text-sm font-medium transition-colors duration-200">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Voltar
      </button>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1)", boxShadow: "0 8px 32px rgba(139,92,246,0.4)" }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 5l1.8 3.6L17.4 9l-2.7 2.7.6 3.9L12 13.8l-3.3 1.8.6-3.9L6.6 9l3.6-.4L12 5z" />
            </svg>
          </div>
          <h1 className="text-white font-black text-xl" style={{ letterSpacing: "-0.02em" }}>
            {isLogin ? "Bem-vindo de volta" : "Criar conta"}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {isLogin ? "Entre na sua conta para continuar" : "Comece de graça, sem cartão"}
          </p>
        </div>

        <div className="rounded-2xl p-6"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>

          <div className="flex flex-col gap-3 mb-4">
            {!isLogin && (
              <div>
                <label className="block text-white/50 text-xs font-medium mb-1.5">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Seu nome"
                  autoComplete="name"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "inherit" }}
                  onFocus={e => { e.currentTarget.style.border = "1px solid rgba(139,92,246,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.1)"; }}
                  onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
            )}
            <div>
              <label className="block text-white/50 text-xs font-medium mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="seu@email.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "inherit" }}
                onFocus={e => { e.currentTarget.style.border = "1px solid rgba(139,92,246,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.1)"; }}
                onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
            <div>
              <label className="block text-white/50 text-xs font-medium mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLogin ? "Sua senha" : "Mínimo 6 caracteres"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "inherit" }}
                onFocus={e => { e.currentTarget.style.border = "1px solid rgba(139,92,246,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.1)"; }}
                onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-300"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:scale-100"
            style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1)", boxShadow: "0 4px 20px rgba(139,92,246,0.35)" }}>
            {loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
          </button>
        </div>

        <p className="text-center text-white/35 text-sm mt-5">
          {isLogin ? "Não tem conta?" : "Já tem uma conta?"}{" "}
          <button
            onClick={switchMode}
            className="font-semibold transition-colors duration-200"
            style={{ color: "#a78bfa" }}
            onMouseEnter={e => e.currentTarget.style.color = "#c4b5fd"}
            onMouseLeave={e => e.currentTarget.style.color = "#a78bfa"}>
            {isLogin ? "Criar agora" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}
