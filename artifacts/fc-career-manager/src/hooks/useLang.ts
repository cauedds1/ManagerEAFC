import { useState, useEffect, useCallback } from "react";
import type { Lang } from "@/lib/i18n";
import { getEffectiveToken } from "@/lib/authToken";

export type { Lang };

const LANG_KEY = "fc_lang";

function readLang(): Lang {
  try {
    const s = localStorage.getItem(LANG_KEY);
    if (s === "pt" || s === "en") return s;
    return navigator.language?.startsWith("pt") ? "pt" : "en";
  } catch {
    return "pt";
  }
}

let _syncInFlight = false;

async function syncLangToServer(lang: Lang): Promise<void> {
  if (_syncInFlight) return;
  const token = getEffectiveToken();
  if (!token) return;
  _syncInFlight = true;
  try {
    await fetch("/api/auth/lang", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lang }),
    });
  } catch {
  } finally {
    _syncInFlight = false;
  }
}

export function applyLangFromServer(lang: string | null | undefined): void {
  if (lang !== "pt" && lang !== "en") return;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {}
  window.dispatchEvent(new StorageEvent("storage", { key: LANG_KEY, newValue: lang }));
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(readLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
    window.dispatchEvent(new StorageEvent("storage", { key: LANG_KEY, newValue: l }));
    void syncLangToServer(l);
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === LANG_KEY) {
        const v = e.newValue;
        if (v === "pt" || v === "en") setLangState(v);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return [lang, setLang];
}
