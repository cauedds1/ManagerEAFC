import { useState, useEffect, useRef } from "react";
import { checkUsername, setMyUsername } from "@/lib/community";

interface Props {
  lang: "pt" | "en";
  onSet: (username: string) => void;
  onClose?: () => void;
  initialValue?: string;
}

const T = {
  pt: {
    title: "Escolha seu @username",
    subtitle: "É como você aparecerá na Comunidade. Permanente após confirmar.",
    placeholder: "ex: tecnico_carlos",
    rule: "3-20 caracteres · letras, números e _",
    available: "Disponível",
    taken: "Esse @ já está em uso",
    invalid: "Caracteres inválidos",
    save: "Confirmar @",
    saving: "Salvando…",
    skip: "Mais tarde",
  },
  en: {
    title: "Choose your @username",
    subtitle: "How you'll appear in the Community. Permanent once confirmed.",
    placeholder: "ex: coach_carlos",
    rule: "3-20 chars · letters, numbers and _",
    available: "Available",
    taken: "Already taken",
    invalid: "Invalid characters",
    save: "Confirm @",
    saving: "Saving…",
    skip: "Later",
  },
};

export function UsernameModal({ lang, onSet, onClose, initialValue }: Props) {
  const t = T[lang];
  const [value, setValue] = useState(initialValue ?? "");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const checkRef = useRef<number | null>(null);

  useEffect(() => {
    const v = value.trim().toLowerCase();
    if (!v) { setStatus("idle"); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(v)) { setStatus("invalid"); return; }
    setStatus("checking");
    if (checkRef.current) window.clearTimeout(checkRef.current);
    checkRef.current = window.setTimeout(async () => {
      try {
        const r = await checkUsername(v);
        setStatus(r.available ? "available" : "taken");
      } catch { setStatus("idle"); }
    }, 400);
  }, [value]);

  const handleSave = async () => {
    if (status !== "available") return;
    setSaving(true); setErr("");
    try {
      const r = await setMyUsername(value.trim().toLowerCase());
      onSet(r.username);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}>
      <div className="relative w-full max-w-sm rounded-3xl p-7 flex flex-col gap-5"
        style={{ background: "rgba(14,12,24,0.98)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
        <div className="flex flex-col gap-1">
          <h2 className="text-white font-black text-xl">{t.title}</h2>
          <p className="text-white/55 text-sm leading-relaxed">{t.subtitle}</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-white/40 font-bold text-lg">@</span>
            <input
              type="text"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase())}
              placeholder={t.placeholder}
              maxLength={20}
              className="flex-1 bg-transparent outline-none text-white text-sm font-medium placeholder:text-white/25"
            />
            {status === "checking" && (
              <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
            )}
          </div>
          <p className="text-white/40 text-xs px-1">{t.rule}</p>
          {status === "available" && <p className="text-emerald-400 text-xs px-1">✓ {t.available}</p>}
          {status === "taken" && <p className="text-red-400 text-xs px-1">✗ {t.taken}</p>}
          {status === "invalid" && <p className="text-amber-400 text-xs px-1">✗ {t.invalid}</p>}
          {err && <p className="text-red-400 text-xs px-1">{err}</p>}
        </div>
        <div className="flex gap-2 mt-1">
          {onClose && (
            <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white/85 transition"
              style={{ background: "rgba(255,255,255,0.04)" }}>{t.skip}</button>
          )}
          <button
            onClick={handleSave}
            disabled={status !== "available" || saving}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
            style={{ background: "var(--club-gradient, linear-gradient(135deg,#8b5cf6,#6366f1))", boxShadow: "0 4px 20px rgba(139,92,246,0.35)" }}
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
