import { useState, useEffect, useCallback } from "react";
import type { Lang } from "@/lib/i18n";

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

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(readLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
    window.dispatchEvent(new StorageEvent("storage", { key: LANG_KEY, newValue: l }));
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
