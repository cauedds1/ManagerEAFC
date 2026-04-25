import { useState, useEffect } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
};

export type PWAInstallStatus = "android" | "ios" | "standalone" | "desktop" | "unsupported";

export interface UsePWAInstallReturn {
  status: PWAInstallStatus;
  canInstall: boolean;
  installing: boolean;
  install: () => Promise<void>;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream;
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState<PWAInstallStatus>("unsupported");

  useEffect(() => {
    if (isInStandaloneMode()) {
      setStatus("standalone");
      return;
    }
    if (isIOS()) {
      setStatus("ios");
      return;
    }
    if (isAndroid()) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setStatus("android");
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
    if (!isMobile()) {
      setStatus("desktop");
    }
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setStatus("standalone");
    }
    setInstalling(false);
    setDeferredPrompt(null);
  };

  return {
    status,
    canInstall: status === "android" && !!deferredPrompt,
    installing,
    install,
  };
}
