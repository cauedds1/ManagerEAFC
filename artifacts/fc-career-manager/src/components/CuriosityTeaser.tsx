import { useEffect, useState, useCallback } from "react";
import { useLang } from "@/hooks/useLang";
import { ONBOARDING } from "@/lib/i18n";
import { isTeaserSeen, markTeaserSeen, type TeaserKey } from "@/lib/missionStorage";

interface TeaserConfig {
  key: TeaserKey;
  headlineKey: string;
  subKey: string;
  ctaKey: string;
  blurContent: string;
}

const TEASERS: TeaserConfig[] = [
  {
    key: "after_match_diretoria",
    headlineKey: "t_match_diretoria",
    subKey: "t_match_diretoria_sub",
    ctaKey: "t_match_diretoria_cta",
    blurContent: "\"Resultado aceitável. Mas precisamos melhorar o desempenho fora de casa...\"",
  },
  {
    key: "after_news_auto",
    headlineKey: "t_news_auto",
    subKey: "t_news_auto_sub",
    ctaKey: "t_news_auto_cta",
    blurContent: "BREAKING: Técnico conquista vitória expressiva — fanbase vai às redes sociais celebrar",
  },
  {
    key: "after_squad_rumor",
    headlineKey: "t_squad_rumor",
    subKey: "t_squad_rumor_sub",
    ctaKey: "t_squad_rumor_cta",
    blurContent: "Clube da Premier League monitora atacante. Proposta de €25M pode chegar em breve.",
  },
  {
    key: "after_momento_videonews",
    headlineKey: "t_momento_videonews",
    subKey: "t_momento_videonews_sub",
    ctaKey: "t_momento_videonews_cta",
    blurContent: "🎬 Golaço aos 89' — Compilação do mês publicada automaticamente",
  },
];

export type { TeaserKey };

interface CuriosityTeaserProps {
  careerId: string;
  trigger: TeaserKey | null;
  onDismiss: () => void;
}

export function CuriosityTeaser({ careerId, trigger, onDismiss }: CuriosityTeaserProps) {
  const [lang] = useLang();
  const t = ONBOARDING[lang];
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<TeaserConfig | null>(null);

  useEffect(() => {
    if (!trigger) return;
    if (isTeaserSeen(careerId, trigger)) return;
    const cfg = TEASERS.find((t) => t.key === trigger);
    if (!cfg) return;
    markTeaserSeen(careerId, trigger);
    setConfig(cfg);
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, [trigger, careerId]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setConfig(null);
      onDismiss();
    }, 300);
  }, [onDismiss]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(dismiss, 9000);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  if (!config) return null;

  return (
    <div
      className="fixed bottom-24 right-4 z-[450] w-72 flex flex-col gap-2.5 rounded-2xl p-4 transition-all duration-300"
      style={{
        background: "rgba(14,12,24,0.97)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        backdropFilter: "blur(20px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-white/90 text-xs font-semibold leading-snug flex-1">
          {t[config.headlineKey]}
        </p>
        <button
          onClick={dismiss}
          className="w-5 h-5 flex items-center justify-center rounded-md text-white/25 hover:text-white/50 transition-colors flex-shrink-0 mt-0.5"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div
        className="relative rounded-xl px-3 py-2 overflow-hidden"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <p className="text-white/40 text-[11px] leading-snug italic select-none">
          {config.blurContent}
        </p>
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
            background: "rgba(14,12,24,0.55)",
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-white/30 text-[10px] leading-snug flex-1">{t[config.subKey]}</p>
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
          style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)" }}
        >
          {t[config.ctaKey]}
        </span>
      </div>
    </div>
  );
}
