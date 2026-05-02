import { useEffect, useMemo, useState } from "react";
import { getAllMatchesForCareer } from "@/lib/matchStorage";
import type { MatchRecord } from "@/types/match";
import type { Season } from "@/types/career";
import { useLang } from "@/hooks/useLang";
import { CLUBE } from "@/lib/i18n";
import { computeCareerRecords } from "@/lib/recordsCalculator";

interface Props {
  careerId: string;
  seasons: Season[];
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  const [y, mo, da] = d.split("-");
  if (!y || !mo || !da) return d;
  return `${da}/${mo}/${y}`;
}

function dateRange(start: string | null, end: string | null): string {
  if (!start) return "";
  if (!end || start === end) return fmtDate(start);
  return `${fmtDate(start)} → ${fmtDate(end)}`;
}

function RecordCard({
  icon,
  title,
  value,
  subLabel,
  accent = "rgba(var(--club-primary-rgb),0.9)",
}: {
  icon: string;
  title: string;
  value: string;
  subLabel?: string;
  accent?: string;
}) {
  const empty = value === "—";
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-start gap-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${empty ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      <span className="text-lg leading-none mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-white/50 leading-tight">{title}</p>
        {subLabel && (
          <p className="text-[10px] text-white/35 mt-1 leading-snug truncate">{subLabel}</p>
        )}
      </div>
      <div
        className="text-xl font-black tabular-nums leading-none ml-2 flex-shrink-0"
        style={{ color: empty ? "rgba(255,255,255,0.15)" : accent }}
      >
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-bold tracking-widest uppercase text-white/30">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">{children}</div>
    </section>
  );
}

export function RecordesView({ careerId, seasons }: Props) {
  const [lang] = useLang();
  const t = CLUBE[lang];

  const [matches, setMatches] = useState<MatchRecord[]>(() => getAllMatchesForCareer(careerId));

  useEffect(() => {
    setMatches(getAllMatchesForCareer(careerId));
  }, [careerId]);

  const records = useMemo(() => computeCareerRecords(matches, seasons), [matches, seasons]);

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <span className="text-5xl">🏅</span>
        <p className="text-white/40 text-sm">{t.recordsEmpty}</p>
      </div>
    );
  }

  const dash = "—";

  // ── Match records helpers
  const matchRecord = (
    rec: { value: number; scoreLine: string; date: string | null } | null,
  ): { value: string; subLabel?: string } => {
    if (!rec) return { value: dash };
    const dateStr = rec.date ? `, ${fmtDate(rec.date)}` : "";
    return { value: String(rec.value), subLabel: `${rec.scoreLine}${dateStr}` };
  };

  const matchTotalRecord = (
    rec: { value: number; scoreLine: string; date: string | null } | null,
  ): { value: string; subLabel?: string } => {
    if (!rec) return { value: dash };
    const dateStr = rec.date ? `, ${fmtDate(rec.date)}` : "";
    return { value: String(rec.value), subLabel: `${rec.scoreLine}${dateStr}` };
  };

  const opponentRecord = (
    rec: { value: number; opponents: string[] } | null,
  ): { value: string; subLabel?: string } => {
    if (!rec) return { value: dash };
    return { value: String(rec.value), subLabel: rec.opponents.join(", ") };
  };

  const seasonRecord = (
    rec: { value: number; seasonLabel: string } | null,
  ): { value: string; subLabel?: string } => {
    if (!rec) return { value: dash };
    return { value: String(rec.value), subLabel: rec.seasonLabel };
  };

  const yearRecord = (
    rec: { value: number; year: string } | null,
  ): { value: string; subLabel?: string } => {
    if (!rec) return { value: dash };
    return { value: String(rec.value), subLabel: rec.year };
  };

  const avgRecord = (
    rec: { value: number; seasonLabel: string; matches: number } | null,
  ): { value: string; subLabel?: string } => {
    if (!rec) return { value: dash };
    return {
      value: rec.value.toFixed(2),
      subLabel: `${rec.seasonLabel} · ${rec.matches} ${rec.matches === 1 ? t.gameSingular : t.gamePlural}`,
    };
  };

  const streakRecord = (
    rec: { value: number; startDate: string | null; endDate: string | null } | null,
  ): { value: string; subLabel?: string } => {
    if (!rec) return { value: dash };
    return {
      value: String(rec.value),
      subLabel: dateRange(rec.startDate, rec.endDate) || undefined,
    };
  };

  const winColor  = "#34d399";
  const lossColor = "#f87171";
  const drawColor = "#94a3b8";
  const goldColor = "#fbbf24";
  const blueColor = "#60a5fa";

  return (
    <div className="px-4 sm:px-6 py-6 space-y-7">
      <div>
        <h2 className="text-white font-black text-lg leading-tight">{t.recordsHeading}</h2>
        <p className="text-white/35 text-xs mt-0.5">{t.recordsSubtitle}</p>
      </div>

      <Section title={t.recordsSecMatches}>
        <RecordCard icon="🏆" title={t.recBiggestWin}      accent={winColor}  {...matchRecord(records.partidas.biggestWin)} />
        <RecordCard icon="🏠" title={t.recBiggestWinHome}  accent={winColor}  {...matchRecord(records.partidas.biggestWinHome)} />
        <RecordCard icon="✈️" title={t.recBiggestWinAway}  accent={winColor}  {...matchRecord(records.partidas.biggestWinAway)} />
        <RecordCard icon="💔" title={t.recBiggestLoss}     accent={lossColor} {...matchRecord(records.partidas.biggestLoss)} />
        <RecordCard icon="🏠" title={t.recBiggestLossHome} accent={lossColor} {...matchRecord(records.partidas.biggestLossHome)} />
        <RecordCard icon="✈️" title={t.recBiggestLossAway} accent={lossColor} {...matchRecord(records.partidas.biggestLossAway)} />
        <RecordCard icon="🤝" title={t.recHighestDraw}     accent={drawColor} {...matchTotalRecord(records.partidas.highestDraw)} />
        <RecordCard icon="⚽" title={t.recMostGoalsFor}    accent={winColor}  {...matchTotalRecord(records.partidas.mostGoalsFor)} />
        <RecordCard icon="🥅" title={t.recMostGoalsAgainst}accent={lossColor} {...matchTotalRecord(records.partidas.mostGoalsAgainst)} />
        <RecordCard icon="🎯" title={t.recMostGoalsTotal}  accent={goldColor} {...matchTotalRecord(records.partidas.mostGoalsTotal)} />
      </Section>

      <Section title={t.recordsSecOpponents}>
        <RecordCard icon="🆚" title={t.recMostFaced}      accent={blueColor} {...opponentRecord(records.adversarios.mostFaced)} />
        <RecordCard icon="⚽" title={t.recMostScoredVs}   accent={winColor}  {...opponentRecord(records.adversarios.mostScoredVs)} />
        <RecordCard icon="🥅" title={t.recMostConcededVs} accent={lossColor} {...opponentRecord(records.adversarios.mostConcededVs)} />
        <RecordCard icon="🏆" title={t.recMostBeaten}     accent={winColor}  {...opponentRecord(records.adversarios.mostBeaten)} />
        <RecordCard icon="😤" title={t.recHardest}        accent={lossColor} {...opponentRecord(records.adversarios.hardest)} />
      </Section>

      <Section title={t.recordsSecSeason}>
        <RecordCard icon="⚽" title={t.recSeasonMostGoals}       accent={winColor}  {...seasonRecord(records.temporada.mostGoals)} />
        <RecordCard icon="📅" title={t.recSeasonMostMatches}     accent={blueColor} {...seasonRecord(records.temporada.mostMatches)} />
        <RecordCard icon="🏆" title={t.recSeasonMostWins}        accent={winColor}  {...seasonRecord(records.temporada.mostWins)} />
        <RecordCard icon="🤝" title={t.recSeasonMostDraws}       accent={drawColor} {...seasonRecord(records.temporada.mostDraws)} />
        <RecordCard icon="💔" title={t.recSeasonMostLosses}      accent={lossColor} {...seasonRecord(records.temporada.mostLosses)} />
        <RecordCard icon="🧤" title={t.recSeasonMostCleanSheets} accent={blueColor} {...seasonRecord(records.temporada.mostCleanSheets)} />
        <RecordCard icon="📈" title={t.recSeasonBestAvg}         accent={goldColor} {...avgRecord(records.temporada.bestGoalsAvg)} />
      </Section>

      <Section title={t.recordsSecYear}>
        <RecordCard icon="⚽" title={t.recYearMostGoals}  accent={winColor}  {...yearRecord(records.anoCivil.mostGoals)} />
        <RecordCard icon="🏆" title={t.recYearMostWins}   accent={winColor}  {...yearRecord(records.anoCivil.mostWins)} />
        <RecordCard icon="🤝" title={t.recYearMostDraws}  accent={drawColor} {...yearRecord(records.anoCivil.mostDraws)} />
        <RecordCard icon="💔" title={t.recYearMostLosses} accent={lossColor} {...yearRecord(records.anoCivil.mostLosses)} />
      </Section>

      <Section title={t.recordsSecStreaks}>
        <RecordCard icon="🔥" title={t.recStreakWins}      accent={winColor}  {...streakRecord(records.sequencias.longestWinning)} />
        <RecordCard icon="🛡️" title={t.recStreakUnbeaten} accent={blueColor} {...streakRecord(records.sequencias.longestUnbeaten)} />
        <RecordCard icon="🧤" title={t.recStreakCleanSheet} accent={blueColor} {...streakRecord(records.sequencias.longestCleanSheet)} />
      </Section>
    </div>
  );
}
