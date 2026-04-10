import { useMemo } from "react";
import { getMatches } from "@/lib/matchStorage";
import type { MatchRecord } from "@/types/match";
import { getMatchResult } from "@/types/match";

interface StreakRecord {
  count: number;
  startDate: string | null;
  endDate: string | null;
}

export interface AllStreaks {
  vitorias: StreakRecord;
  derrotas: StreakRecord;
  invicta: StreakRecord;
  semSofrer: StreakRecord;
  comGols: StreakRecord;
  vitoriasEmCasa: StreakRecord;
  invictaEmCasa: StreakRecord;
  semSofrerEmCasa: StreakRecord;
}

type StreakKey = keyof AllStreaks;

function matchQualifies(m: MatchRecord, key: StreakKey): boolean {
  const result = getMatchResult(m.myScore, m.opponentScore);
  switch (key) {
    case "vitorias":        return result === "vitoria";
    case "derrotas":        return result === "derrota";
    case "invicta":         return result !== "derrota";
    case "semSofrer":       return m.opponentScore === 0;
    case "comGols":         return m.myScore > 0;
    case "vitoriasEmCasa":  return m.location === "casa" && result === "vitoria";
    case "invictaEmCasa":   return m.location === "casa" && result !== "derrota";
    case "semSofrerEmCasa": return m.location === "casa" && m.opponentScore === 0;
  }
}

export function computeStreaks(matches: MatchRecord[]): AllStreaks {
  const sorted = [...matches].sort((a, b) => a.createdAt - b.createdAt);

  const KEYS: StreakKey[] = [
    "vitorias", "derrotas", "invicta", "semSofrer",
    "comGols", "vitoriasEmCasa", "invictaEmCasa", "semSofrerEmCasa",
  ];

  const best: AllStreaks = {
    vitorias:        { count: 0, startDate: null, endDate: null },
    derrotas:        { count: 0, startDate: null, endDate: null },
    invicta:         { count: 0, startDate: null, endDate: null },
    semSofrer:       { count: 0, startDate: null, endDate: null },
    comGols:         { count: 0, startDate: null, endDate: null },
    vitoriasEmCasa:  { count: 0, startDate: null, endDate: null },
    invictaEmCasa:   { count: 0, startDate: null, endDate: null },
    semSofrerEmCasa: { count: 0, startDate: null, endDate: null },
  };

  for (const key of KEYS) {
    let cur = 0;
    let curStart: string | null = null;

    for (const m of sorted) {
      if (matchQualifies(m, key)) {
        if (cur === 0) curStart = m.date;
        cur++;
        if (cur > best[key].count) {
          best[key] = { count: cur, startDate: curStart, endDate: m.date };
        }
      } else {
        cur = 0;
        curStart = null;
      }
    }
  }

  return best;
}

const STREAK_META: {
  key: StreakKey;
  icon: string;
  label: string;
  color: string;
  border: string;
}[] = [
  { key: "vitorias",        icon: "🏆", label: "Maior Série de Vitórias",           color: "#34d399", border: "rgba(16,185,129,0.25)" },
  { key: "derrotas",        icon: "💔", label: "Maior Série de Derrotas",            color: "#f87171", border: "rgba(239,68,68,0.25)"   },
  { key: "invicta",         icon: "🛡️", label: "Maior Série Invicta",               color: "#60a5fa", border: "rgba(59,130,246,0.25)"  },
  { key: "semSofrer",       icon: "🧤", label: "Maior Série sem Sofrer Gols",        color: "#a78bfa", border: "rgba(139,92,246,0.25)"  },
  { key: "comGols",         icon: "⚽", label: "Maior Série Marcando Gols",          color: "#fbbf24", border: "rgba(245,158,11,0.25)"  },
  { key: "vitoriasEmCasa",  icon: "🏠", label: "Maior Série de Vitórias em Casa",   color: "#34d399", border: "rgba(16,185,129,0.25)"  },
  { key: "invictaEmCasa",   icon: "🔒", label: "Maior Série Invicta em Casa",        color: "#60a5fa", border: "rgba(59,130,246,0.25)"  },
  { key: "semSofrerEmCasa", icon: "🚫", label: "Maior Série sem Sofrer Gol em Casa", color: "#a78bfa", border: "rgba(139,92,246,0.25)"  },
];

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

interface Props {
  careerId: string;
}

export function SequenciasView({ careerId }: Props) {
  const matches = useMemo(() => getMatches(careerId), [careerId]);
  const streaks = useMemo(() => computeStreaks(matches), [matches]);

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <span className="text-5xl">📊</span>
        <p className="text-white/40 text-sm">Registre partidas para calcular as sequências</p>
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-6 pt-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STREAK_META.map(({ key, icon, label, color, border }) => {
          const rec = streaks[key];
          const hasData = rec.count > 0;
          return (
            <div
              key={key}
              className="rounded-xl p-4 flex flex-col gap-2"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${hasData ? border : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">{icon}</span>
                <span className="text-xs text-white/50 leading-tight">{label}</span>
              </div>

              {hasData ? (
                <>
                  <div
                    className="text-4xl font-black tabular-nums leading-none"
                    style={{ color }}
                  >
                    {rec.count}
                  </div>
                  <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {rec.count === 1 ? "jogo" : "jogos"}
                  </div>
                  {rec.startDate && (
                    <div className="text-xs text-white/30 border-t border-white/5 pt-2 mt-1">
                      {rec.startDate === rec.endDate
                        ? fmtDate(rec.startDate)
                        : `${fmtDate(rec.startDate)} → ${fmtDate(rec.endDate)}`}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-3xl font-black text-white/15 leading-none">—</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
