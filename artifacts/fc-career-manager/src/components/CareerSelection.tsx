import { useState, useEffect, useMemo } from "react";
import { Career } from "@/types/career";
import { deleteCareer } from "@/lib/careerStorage";
import { getClubColors, ClubColors } from "@/lib/clubColors";
import { APIFOOTBALL_TO_FC26_NAME } from "@/lib/footballApiMap";
import { hexToRgb, SYSTEM_COLORS } from "@/lib/themeManager";
import { getUserPlan, getPlanLimits, getPlanLabel, type Plan } from "@/lib/userPlan";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useLang } from "@/hooks/useLang";
import { CAREER_SEL } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { getAllCareersAgg } from "@/lib/careerAggregateStats";
import { getSeasons } from "@/lib/seasonStorage";

interface CareerSelectionProps {
  careers: Career[];
  onSelectCareer: (career: Career) => void;
  onCreateNew: () => void;
  onCareersChange: (careers: Career[]) => void;
  onLogout?: () => void;
  onUpgrade?: () => void;
  userPlan?: Plan;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function resolveCareerColors(clubName: string, savedPrimary?: string, savedSecondary?: string) {
  if (savedPrimary && savedSecondary) {
    const [r, g, b] = hexToRgb(savedPrimary);
    return { primary: savedPrimary, rgb: `${r},${g},${b}`, gradient: `linear-gradient(135deg, ${savedPrimary}, ${savedSecondary})` };
  }
  let colors: ClubColors | null = getClubColors(clubName);
  if (!colors) { const fc26 = APIFOOTBALL_TO_FC26_NAME[clubName]; if (fc26) colors = getClubColors(fc26); }
  if (!colors) colors = SYSTEM_COLORS;
  const [r, g, b] = hexToRgb(colors.primary);
  return { primary: colors.primary, rgb: `${r},${g},${b}`, gradient: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` };
}

function ClubLogoLg({ logo, name, rgb }: { logo: string; name: string; rgb: string }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{ background: `rgba(${rgb},0.1)`, border: `1.5px solid rgba(${rgb},0.2)`, boxShadow: `0 0 20px rgba(${rgb},0.15)` }}>
      {logo && !err ? (
        <img src={logo} alt={name} className={`w-10 h-10 object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)} onError={() => setErr(true)} />
      ) : (
        <span className="text-base font-black" style={{ color: `rgba(${rgb},0.7)` }}>{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function CoachAvatar({ career, rgb }: { career: Career; rgb: string }) {
  const [err, setErr] = useState(false);
  const photo = career.coach.photo;
  const initials = career.coach.name.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0" style={{ border: `1.5px solid rgba(${rgb},0.25)` }}>
      {photo && !err ? (
        <img src={photo} alt={career.coach.name} className="w-full h-full object-cover" onError={() => setErr(true)} />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-white/50"
          style={{ background: `rgba(${rgb},0.1)` }}>{initials}</div>
      )}
    </div>
  );
}

function ClubLogoSmall({ logo, name }: { logo: string; name: string }) {
  const [err, setErr] = useState(false);
  if (logo && !err) {
    return <img src={logo} alt={name} className="w-full h-full object-contain p-0.5" onError={() => setErr(true)} />;
  }
  return <span className="text-[9px] font-black text-white/50">{name.slice(0, 2).toUpperCase()}</span>;
}

function ClubMosaicRow({ careers, onSelectCareer, label }: {
  careers: Career[];
  onSelectCareer: (c: Career) => void;
  label: string;
}) {
  const max = 7;
  const shown = careers.slice(0, max);
  const rest = careers.length - max;

  return (
    <div className="hidden sm:block">
      <p className="text-[9px] font-bold tracking-widest uppercase text-white/20 mb-2">{label}</p>
      <div className="flex items-center">
        {shown.map((career, i) => (
          <button
            key={career.id}
            onClick={() => onSelectCareer(career)}
            title={career.clubName}
            className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center transition-all duration-150 hover:scale-110 hover:z-10 focus:outline-none"
            style={{
              marginLeft: i === 0 ? 0 : -8,
              zIndex: shown.length - i,
              border: "2px solid rgba(10,10,20,0.9)",
              background: "rgba(255,255,255,0.05)",
            }}
          >
            <ClubLogoSmall logo={career.clubLogo} name={career.clubName} />
          </button>
        ))}
        {rest > 0 && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black text-white/40 flex-shrink-0"
            style={{ marginLeft: -8, background: "rgba(255,255,255,0.06)", border: "2px solid rgba(10,10,20,0.9)" }}
          >
            +{rest}
          </div>
        )}
      </div>
    </div>
  );
}

function PlanBadge({ plan, label, upgradeLabel, onUpgrade }: { plan: Plan; label: string; upgradeLabel: string; onUpgrade?: () => void }) {
  const isUltra = plan === "ultra";
  const isPro = plan === "pro";
  const canUpgrade = !isUltra && onUpgrade;

  const badgeBg = isUltra
    ? "rgba(245,158,11,0.08)"
    : isPro
    ? "rgba(124,92,252,0.08)"
    : "rgba(255,255,255,0.04)";
  const badgeBorder = isUltra
    ? "1px solid rgba(245,158,11,0.22)"
    : isPro
    ? "1px solid rgba(124,92,252,0.22)"
    : "1px solid rgba(255,255,255,0.07)";
  const planColor = isUltra ? "#f59e0b" : isPro ? "#a78bfa" : "rgba(255,255,255,0.35)";
  const planIcon = isUltra ? (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118L10 15.347l-3.95 2.878c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.05 2.927z" />
    </svg>
  ) : isPro ? (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ) : (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: badgeBg, border: badgeBorder }}
    >
      <span style={{ color: planColor }}>{planIcon}</span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-[9px] font-bold tracking-widest uppercase text-white/25">
          {label}
        </span>
        <span className="text-xs font-black" style={{ color: planColor }}>
          {getPlanLabel(plan)}
        </span>
      </div>
      {isUltra && (
        <span className="text-[9px] font-bold text-amber-400/60 tracking-wide">PREMIUM</span>
      )}
      {canUpgrade && (
        <button
          onClick={onUpgrade}
          className="text-[10px] font-semibold transition-colors duration-150 hover:text-white/70 flex-shrink-0"
          style={{ color: isPro ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.22)" }}
        >
          {upgradeLabel}
        </button>
      )}
    </div>
  );
}

function TrajectStat({
  value,
  label,
  accent,
  loading,
  icon,
}: {
  value: number | string;
  label: string;
  accent?: string;
  loading?: boolean;
  icon: React.ReactNode;
}) {
  const displayColor = loading ? "rgba(255,255,255,0.18)" : (accent ?? "rgba(255,255,255,0.75)");
  return (
    <div
      className="rounded-xl p-2.5 flex flex-col gap-1"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-black leading-none tabular-nums" style={{ color: displayColor }}>
          {loading ? "—" : value}
        </p>
        <span style={{ color: displayColor, opacity: 0.5 }}>{icon}</span>
      </div>
      <p className="text-[9px] font-medium text-white/22 leading-tight">{label}</p>
    </div>
  );
}

function DeleteConfirmModal({ career, t, onConfirm, onCancel }: {
  career: Career;
  t: typeof CAREER_SEL["pt"];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cc = useMemo(() => resolveCareerColors(career.clubName, career.clubPrimary, career.clubSecondary), [career.clubName, career.clubPrimary, career.clubSecondary]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{
          background: "rgba(14,14,28,0.97)",
          border: `1px solid rgba(${cc.rgb},0.2)`,
          boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <p className="text-white font-black text-sm">{t.confirmDeleteTitle}</p>
            <p className="text-white/40 text-xs mt-0.5 truncate">{career.clubName}</p>
          </div>
        </div>
        <p className="text-white/50 text-xs leading-relaxed">{t.confirmDeleteBody}</p>
        <div className="flex gap-2 mt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98]"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {t.confirmDeleteCancel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 active:scale-[0.98]"
            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            {t.confirmDeleteBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

function CareerCard({ career, onSelect, onRequestDelete, index, t }: {
  career: Career;
  onSelect: () => void;
  onRequestDelete: () => void;
  index: number;
  t: typeof CAREER_SEL["pt"];
}) {
  const cc = useMemo(() => resolveCareerColors(career.clubName, career.clubPrimary, career.clubSecondary), [career.clubName, career.clubPrimary, career.clubSecondary]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRequestDelete();
  };

  return (
    <div
      className="relative group animate-slide-up"
      style={{ animationDelay: `${Math.min(index * 60, 300)}ms`, animationFillMode: "both" }}
    >
      <button
        onClick={onSelect}
        className="w-full text-left rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
        style={{
          background: `rgba(${cc.rgb},0.06)`,
          border: `1px solid rgba(${cc.rgb},0.12)`,
          backdropFilter: "blur(16px)",
          boxShadow: `0 2px 20px rgba(0,0,0,0.25)`,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px rgba(${cc.rgb},0.2), 0 2px 20px rgba(0,0,0,0.3)`; (e.currentTarget as HTMLElement).style.borderColor = `rgba(${cc.rgb},0.25)`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 20px rgba(0,0,0,0.25)`; (e.currentTarget as HTMLElement).style.borderColor = `rgba(${cc.rgb},0.12)`; }}
      >
        <div className="h-1 w-full" style={{ background: cc.gradient }} />

        <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden" style={{ top: 4 }}>
          <div className="absolute -top-8 -left-4 w-32 h-32 rounded-full blur-2xl opacity-20"
            style={{ background: cc.primary }} />
        </div>

        <div className="relative p-4">
          <div className="flex items-start gap-3 mb-3">
            <ClubLogoLg logo={career.clubLogo} name={career.clubName} rgb={cc.rgb} />
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-white font-black text-base leading-tight truncate">{career.clubName}</h3>
              <p className="text-white/45 text-xs mt-0.5 truncate">{career.clubLeague}</p>
              {career.clubCountry && <p className="text-white/25 text-[10px] mt-0.5">{career.clubCountry}</p>}
            </div>
            <span className="text-[11px] font-bold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5"
              style={{ background: `rgba(${cc.rgb},0.12)`, color: cc.primary }}>
              {career.season}
            </span>
          </div>

          <div className="mb-3" style={{ height: "1px", background: `rgba(${cc.rgb},0.1)` }} />

          <div className="flex items-center gap-2">
            <CoachAvatar career={career} rgb={cc.rgb} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm leading-none">{career.coach.nationalityFlag}</span>
                <p className="text-white/70 font-semibold text-xs truncate">{career.coach.name}</p>
              </div>
              <p className="text-white/25 text-[10px] mt-0.5">{career.coach.nationality} · {career.coach.age} {t.coachAge}</p>
            </div>
            <p className="text-white/25 text-[10px] flex-shrink-0">{formatDate(career.createdAt)}</p>
          </div>
        </div>

        <div className="px-4 py-2.5 flex items-center justify-between"
          style={{ borderTop: `1px solid rgba(${cc.rgb},0.08)` }}>
          <span className="text-white/25 text-xs group-hover:text-white/50 transition-colors duration-200">
            {t.continueCareer}
          </span>
          <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all duration-200"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      <button
        onClick={handleDelete}
        className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center opacity-20 hover:opacity-100 focus:opacity-100 active:opacity-100 text-white/50 hover:text-red-400 hover:bg-red-500/15 active:bg-red-500/15 transition-all duration-200"
        style={{ touchAction: "manipulation" }}
        title={t.deleteCareer}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function NewCareerCard({ onClick, index, label }: { onClick: () => void; index: number; label: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl flex flex-col items-center justify-center gap-2.5 py-8 transition-all duration-200 group hover:scale-[1.02] hover:-translate-y-0.5 animate-slide-up"
      style={{
        animationDelay: `${Math.min(index * 60, 300)}ms`,
        animationFillMode: "both",
        background: "rgba(255,255,255,0.02)",
        border: "1.5px dashed rgba(255,255,255,0.10)",
        backdropFilter: "blur(8px)",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(var(--club-primary-rgb),0.35)"; (e.currentTarget as HTMLElement).style.background = "rgba(var(--club-primary-rgb),0.05)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-110"
        style={{ background: "rgba(var(--club-primary-rgb),0.1)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}>
        <svg className="w-5 h-5" style={{ color: "var(--club-primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </div>
      <p className="text-white/35 text-sm font-semibold group-hover:text-white/60 transition-colors duration-200">
        {label}
      </p>
    </button>
  );
}

export function CareerSelection({ careers, onSelectCareer, onCreateNew, onCareersChange, onLogout, onUpgrade, userPlan }: CareerSelectionProps) {
  const [lang, setLang] = useLang();
  const t = CAREER_SEL[lang];

  const resolvedPlan = userPlan ?? getUserPlan();
  const planLimits = getPlanLimits(resolvedPlan);
  const atCareerLimit = isFinite(planLimits.maxCareers) && careers.length >= planLimits.maxCareers;
  const [localCareers, setLocalCareers] = useState(careers);
  const [seasonCount, setSeasonCount] = useState<number | null>(null);
  const [pendingDeleteCareer, setPendingDeleteCareer] = useState<Career | null>(null);

  useEffect(() => { setLocalCareers(careers); }, [careers]);

  const handleConfirmDelete = () => {
    if (!pendingDeleteCareer) return;
    const id = pendingDeleteCareer.id;
    setPendingDeleteCareer(null);
    deleteCareer(id);
    const updated = localCareers.filter((c) => c.id !== id);
    setLocalCareers(updated);
    onCareersChange(updated);
  };

  const hasCareer = localCareers.length > 0;
  const leagueCount = [...new Set(localCareers.map(c => c.clubLeague))].length;
  const careerLabel = localCareers.length === 1 ? t.statCareer : t.statCareers;
  const leagueLabel = leagueCount === 1 ? t.statLeague : t.statLeagues;

  const totalAgg = useMemo(
    () => getAllCareersAgg(localCareers.map(c => c.id)),
    [localCareers],
  );

  useEffect(() => {
    if (localCareers.length === 0) { setSeasonCount(0); return; }
    setSeasonCount(null);
    let cancelled = false;
    Promise.all(localCareers.map(c => getSeasons(c.id))).then(results => {
      if (!cancelled) setSeasonCount(results.reduce((sum, ss) => sum + ss.length, 0));
    });
    return () => { cancelled = true; };
  }, [localCareers]);

  return (
    <>
    <div className="h-full flex flex-col sm:flex-row overflow-hidden">

      <div className="career-sidebar w-full sm:w-64 xl:w-72 flex-shrink-0 flex flex-col p-5 sm:p-7 relative overflow-hidden gap-0">

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl opacity-10"
            style={{ background: "var(--club-primary)" }} />
          {hasCareer && (
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-5"
              style={{ background: "var(--club-primary)" }} />
          )}
        </div>

        <div className="relative flex-1 min-h-0 overflow-y-auto flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>

          <div className="hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center animate-float flex-shrink-0"
            style={{ background: "rgba(var(--club-primary-rgb),0.12)", border: "1px solid rgba(var(--club-primary-rgb),0.2)", boxShadow: "0 0 30px rgba(var(--club-primary-rgb),0.15)" }}>
            <svg className="w-6 h-6" style={{ color: "var(--club-primary)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159-.69-.159-1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
          </div>

          <div className="flex sm:block items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase sm:mb-2" style={{ color: "var(--club-primary)" }}>
                {t.eaLabel}
              </p>
              <h1 className="text-lg sm:text-2xl font-black text-white leading-tight" style={{ whiteSpace: "pre-line" }}>
                {hasCareer ? t.headingExisting : t.headingNew}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!atCareerLimit && (
                <button
                  onClick={onCreateNew}
                  className="sm:hidden flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl font-bold text-white text-sm transition-all duration-200 active:scale-[0.98]"
                  style={{ background: "var(--club-gradient)", boxShadow: "0 4px 20px rgba(var(--club-primary-rgb),0.25)" }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  {t.newCareer}
                </button>
              )}
              <LangToggle lang={lang} setLang={setLang} />
              {onLogout && (
                <button
                  onClick={onLogout}
                  aria-label={t.logout}
                  className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl transition-all duration-200 active:scale-[0.97]"
                  style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <PlanBadge plan={resolvedPlan} label={t.planBadgeLabel} upgradeLabel={t.planUpgradeLink} onUpgrade={onUpgrade} />

          <p className="text-white/30 text-xs leading-relaxed hidden sm:block -mt-1">
            {hasCareer ? t.descExisting : t.descNew}
          </p>

          {hasCareer && (
            <>
              <ClubMosaicRow
                careers={localCareers}
                onSelectCareer={onSelectCareer}
                label={t.clubsLabel}
              />

              <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} className="hidden sm:block" />

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-2xl font-black text-white">{localCareers.length}</p>
                  <p className="text-white/30 text-[10px] font-medium mt-0.5">{careerLabel}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-2xl font-black text-white">{leagueCount}</p>
                  <p className="text-white/30 text-[10px] font-medium mt-0.5">{leagueLabel}</p>
                </div>
              </div>

              <div className="hidden sm:block">
                <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} className="mb-4" />
                <p className="text-[9px] font-bold tracking-widest uppercase text-white/20 mb-2.5">{t.sectionTrajectory}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  <TrajectStat value={totalAgg.matches} label={t.statMatches} icon={
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4l3 3" /></svg>
                  } />
                  <TrajectStat value={totalAgg.wins} label={t.statWins} accent="#34d399" icon={
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                  } />
                  <TrajectStat value={totalAgg.draws} label={t.statDraws} accent="rgba(148,163,184,0.8)" icon={
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
                  } />
                  <TrajectStat value={totalAgg.losses} label={t.statLosses} accent="#f87171" icon={
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  } />
                  <TrajectStat value={totalAgg.goals} label={t.statGoals} accent="#fbbf24" icon={
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth={2} /><circle cx="12" cy="12" r="3" /></svg>
                  } />
                  <TrajectStat
                    value={seasonCount ?? 0}
                    label={t.statSeasons}
                    accent="rgba(var(--club-primary-rgb),1)"
                    loading={seasonCount === null}
                    icon={
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative flex-col gap-2 hidden sm:flex pt-4 flex-shrink-0">
          {atCareerLimit ? (
            <UpgradePrompt
              currentPlan={resolvedPlan}
              requiredPlan={resolvedPlan === "free" ? "pro" : "ultra"}
              featureName={`${t.newCareer} (${careers.length}/${planLimits.maxCareers})`}
              description={t.upgradeAtLimit.replace("{plan}", getPlanLabel(resolvedPlan))}
              compact
            />
          ) : (
            <button
              onClick={onCreateNew}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "var(--club-gradient)", boxShadow: "0 4px 20px rgba(var(--club-primary-rgb),0.25)" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t.newCareer}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto p-5 xl:p-7">
        {!hasCareer ? (
          <div className="h-full flex flex-col items-center justify-center animate-fade-up relative overflow-hidden">

            <svg viewBox="0 0 600 400" className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="xMidYMid slice"
              style={{ opacity: 0.04 }}>
              <rect x="30" y="20" width="540" height="360" rx="10" fill="none" stroke="white" strokeWidth="2" />
              <line x1="300" y1="20" x2="300" y2="380" stroke="white" strokeWidth="1.5" />
              <circle cx="300" cy="200" r="60" fill="none" stroke="white" strokeWidth="1.5" />
              <circle cx="300" cy="200" r="4" fill="white" />
              <rect x="30" y="140" width="90" height="120" rx="3" fill="none" stroke="white" strokeWidth="1.5" />
              <rect x="480" y="140" width="90" height="120" rx="3" fill="none" stroke="white" strokeWidth="1.5" />
            </svg>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(ellipse, rgba(var(--club-primary-rgb),0.06) 0%, transparent 70%)" }} />

            <div className="relative w-24 h-24 rounded-3xl flex items-center justify-center mb-7 animate-float"
              style={{ background: "rgba(var(--club-primary-rgb),0.08)", border: "1px solid rgba(var(--club-primary-rgb),0.18)", boxShadow: "0 0 60px rgba(var(--club-primary-rgb),0.15)" }}>
              <div className="absolute inset-2 rounded-2xl" style={{ border: "1px solid rgba(var(--club-primary-rgb),0.1)" }} />
              <svg className="w-11 h-11 relative" style={{ color: "var(--club-primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159-.69-.159-1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
            </div>

            <div className="text-center mb-7 relative">
              <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--club-primary)", opacity: 0.7 }}>
                {t.modeLabel}
              </p>
              <h3 className="text-white font-black text-2xl mb-2.5 leading-tight">{t.startJourney}</h3>
              <p className="text-white/35 text-sm leading-relaxed max-w-[280px] mx-auto">
                {t.descEmpty}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-xs relative">
              {[
                { icon: "⚽", label: t.chip700 },
                { icon: "📊", label: t.chipStats },
                { icon: "🤖", label: t.chipAI },
                { icon: "🏆", label: t.chipLegacy },
              ].map((chip) => (
                <div key={chip.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: "rgba(var(--club-primary-rgb),0.07)", border: "1px solid rgba(var(--club-primary-rgb),0.15)", color: "rgba(255,255,255,0.45)" }}>
                  <span>{chip.icon}</span>
                  <span>{chip.label}</span>
                </div>
              ))}
            </div>

            <button
              onClick={onCreateNew}
              className="relative flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-bold text-white text-sm transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
              style={{ background: "var(--club-gradient)", boxShadow: "0 4px 24px rgba(var(--club-primary-rgb),0.3), 0 1px 0 rgba(255,255,255,0.1) inset" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(var(--club-primary-rgb),0.45), 0 1px 0 rgba(255,255,255,0.1) inset"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(var(--club-primary-rgb),0.3), 0 1px 0 rgba(255,255,255,0.1) inset"}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t.createFirst}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 xl:gap-4 auto-rows-max">
            {localCareers.map((career, i) => (
              <CareerCard
                key={career.id}
                career={career}
                onSelect={() => onSelectCareer(career)}
                onRequestDelete={() => setPendingDeleteCareer(career)}
                index={i}
                t={t}
              />
            ))}
            {!atCareerLimit && <NewCareerCard onClick={onCreateNew} index={localCareers.length} label={t.newCareer} />}
          </div>
        )}
      </div>
    </div>

    {pendingDeleteCareer && (
      <DeleteConfirmModal
        career={pendingDeleteCareer}
        t={t}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteCareer(null)}
      />
    )}
    </>
  );
}
