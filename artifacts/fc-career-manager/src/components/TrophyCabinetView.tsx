import { useMemo } from "react";
import { getCompetitionResults } from "@/lib/competitionResultStorage";

interface Props {
  careerId: string;
}

export function TrophyCabinetView({ careerId }: Props) {
  const trophies = useMemo(() => {
    const all = getCompetitionResults(careerId);
    return all.filter((r) => r.isChampion).sort((a, b) => b.createdAt - a.createdAt);
  }, [careerId]);

  if (trophies.length === 0) {
    return (
      <div className="px-4 sm:px-6 flex flex-col items-center justify-center py-20 gap-4 text-center">
        <span className="text-6xl opacity-30">🏆</span>
        <p className="text-white/40 text-sm font-medium">Nenhum troféu ainda</p>
        <p className="text-white/20 text-xs max-w-xs">
          Registre resultados de competições em que seu time foi campeão para vê-los aqui
        </p>
      </div>
    );
  }

  const byCompetition = useMemo(() => {
    const map = new Map<string, typeof trophies>();
    for (const t of trophies) {
      const key = t.competitionName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [trophies]);

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      {/* Destaque: total de troféus */}
      <div
        className="flex items-center gap-4 px-5 py-4 rounded-2xl"
        style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}
      >
        <span className="text-4xl">🏆</span>
        <div>
          <p className="text-3xl font-black tabular-nums" style={{ color: "#fbbf24" }}>
            {trophies.length}
          </p>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wide">
            Troféu{trophies.length !== 1 ? "s" : ""} conquistado{trophies.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-white/25 text-xs">
            {byCompetition.length} competição{byCompetition.length !== 1 ? "ões" : ""}
          </p>
        </div>
      </div>

      {/* Prateleira por competição */}
      <div>
        <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3">Por competição</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {byCompetition.map(([compName, wins]) => (
            <div
              key={compName}
              className="rounded-2xl px-4 py-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-white/85 text-sm">{compName}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {wins.map((w) => (
                      <span key={w.id} title={w.seasonLabel} className="text-sm cursor-default">
                        🏆
                      </span>
                    ))}
                  </div>
                </div>
                {wins.length > 1 && (
                  <span
                    className="text-xl font-black tabular-nums flex-shrink-0"
                    style={{ color: "#fbbf24" }}
                  >
                    ×{wins.length}
                  </span>
                )}
              </div>
              {/* Temporadas */}
              <div className="mt-2 flex flex-wrap gap-1">
                {wins.map((w) => (
                  <span
                    key={w.id}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}
                  >
                    {w.seasonLabel}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline completa */}
      <div>
        <p className="text-white/25 text-[11px] font-bold tracking-widest uppercase mb-3">Histórico</p>
        <div className="space-y-2">
          {trophies.map((t, idx) => (
            <div
              key={t.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <span
                className="w-6 text-center text-xs font-black tabular-nums"
                style={{ color: idx === 0 ? "#fbbf24" : "rgba(255,255,255,0.2)" }}
              >
                #{idx + 1}
              </span>
              <span className="text-base">🏆</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white/80">{t.competitionName}</p>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}
              >
                {t.seasonLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
