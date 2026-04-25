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
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
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

let _deferredPrompt: BeforeInstallPromptEvent | null = null;
const _promptListeners = new Set<(hasPrompt: boolean) => void>();
const _statusListeners = new Set<(status: PWAInstallStatus) => void>();

function notifyPromptListeners(hasPrompt: boolean) {
  _promptListeners.forEach((cb) => cb(hasPrompt));
}

function notifyStatusListeners(status: PWAInstallStatus) {
  _statusListeners.forEach((cb) => cb(status));
}

declare global {
  interface Window {
    __pwaInstallListenerRegistered?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__pwaInstallListenerRegistered) {
  window.__pwaInstallListenerRegistered = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredPrompt = e as BeforeInstallPromptEvent;
    notifyPromptListeners(true);
  });

  window.addEventListener("appinstalled", () => {
    _deferredPrompt = null;
    notifyPromptListeners(false);
    notifyStatusListeners("standalone");
  });
}

function getDeviceStatus(): PWAInstallStatus {
  if (typeof window === "undefined") return "unsupported";
  if (isInStandaloneMode()) return "standalone";
  if (isIOS()) return "ios";
  if (isAndroid()) return "android";
  if (!isMobile()) return "desktop";
  return "unsupported";
}

export function usePWAInstall(): UsePWAInstallReturn {
  const [installing, setInstalling] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(!!_deferredPrompt);
  const [status, setStatus] = useState<PWAInstallStatus>(getDeviceStatus);

  useEffect(() => {
    const onPromptChange = (has: boolean) => setHasPrompt(has);
    const onStatusChange = (s: PWAInstallStatus) => setStatus(s);

    _promptListeners.add(onPromptChange);
    _statusListeners.add(onStatusChange);
    setHasPrompt(!!_deferredPrompt);

    return () => {
      _promptListeners.delete(onPromptChange);
      _statusListeners.delete(onStatusChange);
    };
  }, []);

  const install = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!_deferredPrompt) return "unavailable";
    setInstalling(true);
    try {
      _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      if (outcome === "accepted") {
        _deferredPrompt = null;
        notifyPromptListeners(false);
        notifyStatusListeners("standalone");
      }
      return outcome === "accepted" ? "accepted" : "dismissed";
    } finally {
      setInstalling(false);
    }
  };

  return {
    status,
    canInstall: status === "android" && hasPrompt,
    installing,
    install,
  };
}
