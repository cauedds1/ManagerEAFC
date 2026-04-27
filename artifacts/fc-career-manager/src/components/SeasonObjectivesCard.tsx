import type { SeasonObjective } from "@/lib/seasonObjectivesStorage";
import { useLang } from "@/hooks/useLang";

interface SeasonObjectivesCardProps {
  objectives: SeasonObjective[];
  seasonLabel?: string;
}

const STATUS_CONFIG = {
  pending: { emoji: "🎯", colorClass: "text-white/60", bgStyle: "rgba(255,255,255,0.04)", borderStyle: "rgba(255,255,255,0.08)" },
  achieved: { emoji: "✅", colorClass: "text-emerald-400", bgStyle: "rgba(34,197,94,0.06)", borderStyle: "rgba(34,197,94,0.2)" },
  failed: { emoji: "❌", colorClass: "text-red-400", bgStyle: "rgba(239,68,68,0.06)", borderStyle: "rgba(239,68,68,0.2)" },
};

const SEVERITY_LABELS: Record<string, { pt: string; en: string; color: string }> = {
  minor: { pt: "Leve", en: "Minor", color: "#eab308" },
  moderate: { pt: "Moderada", en: "Moderate", color: "#f97316" },
  major: { pt: "Grave", en: "Major", color: "#ef4444" },
};

const TYPE_LABELS: Record<string, { pt: string; en: string; icon: string }> = {
  league_position: { pt: "Liga", en: "League", icon: "🏆" },
  cup_round: { pt: "Copa", en: "Cup", icon: "🥇" },
  custom: { pt: "Meta", en: "Goal", icon: "⭐" },
};

export function SeasonObjectivesCard({ objectives, seasonLabel }: SeasonObjectivesCardProps) {
  const [lang] = useLang();
  const isEn = lang === "en";

  if (objectives.length === 0) return null;

  const achieved = objectives.filter((o) => o.status === "achieved").length;
  const failed = objectives.filter((o) => o.status === "failed").length;
  const pending = objectives.filter((o) => o.status === "pending").length;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(15,15,25,0.6)" }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <div>
            <p className="text-white font-bold text-sm">
              {isEn ? "Season Objectives" : "Objetivos da Temporada"}
            </p>
            {seasonLabel && (
              <p className="text-white/30 text-xs">{seasonLabel}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {achieved > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
              {achieved} ✅
            </span>
          )}
          {failed > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
              {failed} ❌
            </span>
          )}
          {pending > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
              {pending} 🎯
            </span>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {objectives.map((obj) => {
          const cfg = STATUS_CONFIG[obj.status];
          const typeInfo = TYPE_LABELS[obj.type];
          const severityInfo = obj.failSeverity ? SEVERITY_LABELS[obj.failSeverity] : null;

          return (
            <div
              key={obj.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: cfg.bgStyle, border: `1px solid ${cfg.borderStyle}` }}
            >
              <span className="text-sm flex-shrink-0 mt-0.5">{cfg.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-white/30 text-xs">{typeInfo.icon}</span>
                  <span className="text-white/40 text-xs">{isEn ? typeInfo.en : typeInfo.pt}</span>
                  {obj.competition && (
                    <>
                      <span className="text-white/20 text-xs">·</span>
                      <span className="text-white/40 text-xs truncate">{obj.competition}</span>
                    </>
                  )}
                </div>
                <p className={`text-sm font-semibold ${cfg.colorClass} leading-snug`}>{obj.target}</p>
                {obj.status === "failed" && severityInfo && (
                  <p className="text-xs mt-0.5" style={{ color: severityInfo.color }}>
                    {isEn ? `Severity: ${severityInfo.en}` : `Severidade: ${severityInfo.pt}`}
                    {obj.failedAtMatch != null && ` · ${isEn ? "failed at match" : "falhou na partida"} #${obj.failedAtMatch}`}
                  </p>
                )}
                {obj.status === "achieved" && obj.achievedAtMatch != null && (
                  <p className="text-xs text-emerald-400/60 mt-0.5">
                    {isEn ? `Achieved at match #${obj.achievedAtMatch}` : `Alcançado na partida #${obj.achievedAtMatch}`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
