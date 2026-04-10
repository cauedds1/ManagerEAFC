import { useMemo } from "react";
import { getMatches } from "@/lib/matchStorage";
import type { MatchRecord } from "@/types/match";
import { getMatchResult } from "@/types/match";

interface StreakRecord {
  count: number;
  startDate: string | null;
  endDate: string | null;
}

export interface StreakEntry {
  current: StreakRecord;
  best: StreakRecord;
}

export interface AllStreaks {
  vitorias: StreakEntry;
  derrotas: StreakEntry;
  invicta: StreakEntry;
  semSofrer: StreakEntry;
  comGols: StreakEntry;
  vitoriasEmCasa: StreakEntry;
  invictaEmCasa: StreakEntry;
  semSofrerEmCasa: StreakEntry;
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

const EMPTY_RECORD: StreakRecord = { count: 0, startDate: null, endDate: null };

const HOME_ONLY_KEYS: Set<StreakKey> = new Set([
  "vitoriasEmCasa",
  "invictaEmCasa",
  "semSofrerEmCasa",
]);

function computeStreakForKey(
  sorted: MatchRecord[],
  key: StreakKey,
): StreakEntry {
  const stream = HOME_ONLY_KEYS.has(key)
    ? sorted.filter((m) => m.location === "casa")
    : sorted;

  let curCount = 0;
  let curStart: string | null = null;
  let curEnd: string | null = null;
  let bestRecord: StreakRecord = { ...EMPTY_RECORD };

  for (const m of stream) {
    if (matchQualifies(m, key)) {
      if (curCount === 0) curStart = m.date;
      curCount++;
      curEnd = m.date;
      if (curCount > bestRecord.count) {
        bestRecord = { count: curCount, startDate: curStart, endDate: curEnd };
      }
    } else {
      curCount = 0;
      curStart = null;
      curEnd = null;
    }
  }

  return {
    current: { count: curCount, startDate: curStart, endDate: curEnd },
    best: bestRecord,
  };
}

export function computeStreaks(matches: MatchRecord[]): AllStreaks {
  const sorted = [...matches].sort((a, b) => a.createdAt - b.createdAt);

  return {
    vitorias:        computeStreakForKey(sorted, "vitorias"),
    derrotas:        computeStreakForKey(sorted, "derrotas"),
    invicta:         computeStreakForKey(sorted, "invicta"),
    semSofrer:       computeStreakForKey(sorted, "semSofrer"),
    comGols:         computeStreakForKey(sorted, "comGols"),
    vitoriasEmCasa:  computeStreakForKey(sorted, "vitoriasEmCasa"),
    invictaEmCasa:   computeStreakForKey(sorted, "invictaEmCasa"),
    semSofrerEmCasa: computeStreakForKey(sorted, "semSofrerEmCasa"),
  };
}

const STREAK_META: {
  key: StreakKey;
  icon: string;
  label: string;
  color: string;
  border: string;
}[] = [
  { key: "vitorias",        icon: "🏆", label: "Maior Série de Vitórias",            color: "#34d399", border: "rgba(16,185,129,0.25)"  },
  { key: "derrotas",        icon: "💔", label: "Maior Série de Derrotas",             color: "#f87171", border: "rgba(239,68,68,0.25)"   },
  { key: "invicta",         icon: "🛡️", label: "Maior Série Invicta",                color: "#60a5fa", border: "rgba(59,130,246,0.25)"  },
  { key: "semSofrer",       icon: "🧤", label: "Maior Série sem Sofrer Gols",         color: "#a78bfa", border: "rgba(139,92,246,0.25)"  },
  { key: "comGols",         icon: "⚽", label: "Maior Série Marcando Gols",           color: "#fbbf24", border: "rgba(245,158,11,0.25)"  },
  { key: "vitoriasEmCasa",  icon: "🏠", label: "Maior Série de Vitórias em Casa",    color: "#34d399", border: "rgba(16,185,129,0.25)"  },
  { key: "invictaEmCasa",   icon: "🔒", label: "Maior Série Invicta em Casa",         color: "#60a5fa", border: "rgba(59,130,246,0.25)"  },
  { key: "semSofrerEmCasa", icon: "🚫", label: "Maior Série sem Sofrer Gol em Casa",  color: "#a78bfa", border: "rgba(139,92,246,0.25)"  },
];

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

function dateRange(rec: StreakRecord): string {
  if (!rec.startDate) return "—";
  if (rec.startDate === rec.endDate || !rec.endDate) return fmtDate(rec.startDate);
  return `${fmtDate(rec.startDate)} → ${fmtDate(rec.endDate)}`;
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
    <div className="w-full px-4 pb-6 pt-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STREAK_META.map(({ key, icon, label, color, border }) => {
          const entry = streaks[key];
          const hasBest = entry.best.count > 0;
          const hasCurrent = entry.current.count > 0;

          return (
            <div
              key={key}
              className="rounded-xl flex flex-col"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${hasBest ? border : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                <span className="text-lg leading-none">{icon}</span>
                <span className="text-xs text-white/50 leading-tight">{label}</span>
              </div>

              {hasBest ? (
                <>
                  <div className="px-4 pb-1">
                    <div
                      className="text-4xl font-black tabular-nums leading-none"
                      style={{ color }}
                    >
                      {entry.best.count}
                    </div>
                    <div className="text-[10px] font-medium mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {entry.best.count === 1 ? "jogo" : "jogos"} — recorde histórico
                    </div>
                    <div className="text-[10px] text-white/25 mt-1">
                      {dateRange(entry.best)}
                    </div>
                  </div>

                  {hasCurrent && entry.current.count !== entry.best.count && (
                    <div
                      className="mx-3 mb-3 mt-2 rounded-lg px-3 py-2"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div className="text-[10px] text-white/35 mb-0.5">Sequência atual</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-bold tabular-nums" style={{ color }}>
                          {entry.current.count}
                        </span>
                        <span className="text-[10px] text-white/30">
                          {entry.current.count === 1 ? "jogo" : "jogos"}
                        </span>
                      </div>
                    </div>
                  )}

                  {hasCurrent && entry.current.count === entry.best.count && (
                    <div className="px-4 pb-3 mt-1">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${color}20`, color }}
                      >
                        EM ANDAMENTO
                      </span>
                    </div>
                  )}

                  {!hasCurrent && <div className="pb-3" />}
                </>
              ) : (
                <div className="px-4 pb-4">
                  <div className="text-3xl font-black text-white/15 leading-none">—</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
