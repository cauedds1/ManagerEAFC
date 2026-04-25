import { useState, useEffect } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const DISMISS_KEY = "fc_pwa_banner_dismissed";

export function PWAInstallBanner() {
  const { status, canInstall, installing, install } = usePWAInstall();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (status === "standalone") return;

    if (status === "ios") {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
    if (status === "android" && canInstall) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [status, canInstall]);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const handleInstall = async () => {
    const outcome = await install();
    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
    setShow(false);
  };

  if (!show) return null;

  const isIOSDevice = status === "ios";

  return (
    <div
      className="fixed bottom-[72px] left-3 right-3 z-[60] sm:hidden rounded-2xl shadow-2xl overflow-hidden"
      style={{
        background: "rgba(14,11,26,0.97)",
        border: "1px solid rgba(139,92,246,0.25)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        animation: "slideUpFade 0.35s cubic-bezier(0.25,0.46,0.45,0.94) both",
      }}
    >
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex items-start gap-3 p-4">
        <div
          className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)" }}
        >
          <img src="/pwa-192.png" alt="FC Career Manager" className="w-8 h-8 rounded-lg" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">
            Instale o FC Career Manager
          </p>
          {isIOSDevice ? (
            <p className="text-white/50 text-xs mt-1 leading-relaxed">
              Toque em{" "}
              <span className="inline-flex items-center gap-0.5 text-white/70">
                <svg className="w-3 h-3 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {" "}Compartilhar
              </span>
              {" "}e depois em{" "}
              <span className="text-white/70 font-medium">Adicionar à Tela de Início</span>
            </p>
          ) : (
            <p className="text-white/50 text-xs mt-1 leading-relaxed">
              Acesse direto da tela inicial, como um app nativo — sem precisar da loja.
            </p>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!isIOSDevice && (
        <div
          className="flex items-center gap-2 px-4 pb-4"
        >
          <button
            onClick={handleInstall}
            disabled={installing}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{
              background: "linear-gradient(135deg, rgba(139,92,246,0.9), rgba(109,40,217,0.9))",
              color: "#fff",
              border: "1px solid rgba(139,92,246,0.5)",
            }}
          >
            {installing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {installing ? "Instalando..." : "Instalar app"}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2.5 rounded-xl text-xs font-medium transition-colors"
            style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)" }}
          >
            Agora não
          </button>
        </div>
      )}

      {isIOSDevice && (
        <div
          className="mx-4 mb-4 p-3 rounded-xl flex items-start gap-2"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <span className="text-white/20 text-xs leading-relaxed">
            No Safari: toque no ícone{" "}
            <svg className="w-3 h-3 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "rgba(255,255,255,0.4)", verticalAlign: "middle" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {" "}na barra inferior → <strong className="text-white/40">Adicionar à Tela de Início</strong>
          </span>
        </div>
      )}
    </div>
  );
}
