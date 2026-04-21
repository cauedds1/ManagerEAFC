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

interface CareerSelectionProps {
  careers: Career[];
  onSelectCareer: (career: Career) => void;
  onCreateNew: () => void;
  onCareersChange: (careers: Career[]) => void;
  onLogout?: () => void;
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

function CareerCard({ career, onSelect, onDelete, index, t }: {
  career: Career;
  onSelect: () => void;
  onDelete: () => void;
  index: number;
  t: typeof CAREER_SEL["pt"];
}) {
  const [deleting, setDeleting] = useState(false);
  const cc = useMemo(() => resolveCareerColors(career.clubName, career.clubPrimary, career.clubSecondary), [career.clubName, career.clubPrimary, career.clubSecondary]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    setTimeout(() => onDelete(), 280);
  };

  return (
    <div
      className="relative group animate-slide-up"
      style={{ animationDelay: `${Math.min(index * 60, 300)}ms`, animationFillMode: "both", opacity: deleting ? 0 : 1, transform: deleting ? "scale(0.97)" : "scale(1)", transition: "opacity 280ms, transform 280ms" }}
    >
      <button
        onClick={onSelect}
        disabled={deleting}
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
        className="absolute top-4 right-4 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:!opacity-100 text-white/0 group-hover:text-white/30 hover:!text-red-400 hover:!bg-red-500/15 transition-all duration-200"
        title={t.deleteCareer}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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

export function CareerSelection({ careers, onSelectCareer, onCreateNew, onCareersChange, onLogout, userPlan }: CareerSelectionProps) {
  const [lang] = useLang();
  const t = CAREER_SEL[lang];

  const resolvedPlan = userPlan ?? getUserPlan();
  const planLimits = getPlanLimits(resolvedPlan);
  const atCareerLimit = isFinite(planLimits.maxCareers) && careers.length >= planLimits.maxCareers;
  const [localCareers, setLocalCareers] = useState(careers);

  useEffect(() => { setLocalCareers(careers); }, [careers]);

  const handleDelete = (id: string) => {
    deleteCareer(id);
    const updated = localCareers.filter((c) => c.id !== id);
    setLocalCareers(updated);
    onCareersChange(updated);
  };

  const hasCareer = localCareers.length > 0;

  const leagueCount = [...new Set(localCareers.map(c => c.clubLeague))].length;
  const careerLabel = localCareers.length === 1 ? t.statCareer : t.statCareers;
  const leagueLabel = leagueCount === 1 ? t.statLeague : t.statLeagues;

  return (
    <div className="h-full flex overflow-hidden">

      <div
        className="w-64 xl:w-72 flex-shrink-0 flex flex-col justify-between p-7 relative overflow-hidden"
        style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl opacity-10"
            style={{ background: "var(--club-primary)" }} />
        </div>

        <div className="relative">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-7 animate-float"
            style={{ background: "rgba(var(--club-primary-rgb),0.12)", border: "1px solid rgba(var(--club-primary-rgb),0.2)", boxShadow: "0 0 30px rgba(var(--club-primary-rgb),0.15)" }}>
            <svg className="w-6 h-6" style={{ color: "var(--club-primary)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
          </div>

          <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: "var(--club-primary)" }}>
            {t.eaLabel}
          </p>
          <h1 className="text-2xl font-black text-white leading-tight mb-3" style={{ whiteSpace: "pre-line" }}>
            {hasCareer ? t.headingExisting : t.headingNew}
          </h1>
          <p className="text-white/30 text-xs leading-relaxed">
            {hasCareer ? t.descExisting : t.descNew}
          </p>

          {hasCareer && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-2xl font-black text-white">{localCareers.length}</p>
                <p className="text-white/30 text-[10px] font-medium mt-0.5">{careerLabel}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-2xl font-black text-white">{leagueCount}</p>
                <p className="text-white/30 text-[10px] font-medium mt-0.5">{leagueLabel}</p>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex flex-col gap-2">
          {atCareerLimit ? (
            <UpgradePrompt
              currentPlan={resolvedPlan}
              requiredPlan={resolvedPlan === "free" ? "pro" : "ultra"}
              featureName={`${t.newCareer} (${careers.length}/${planLimits.maxCareers})`}
              description={`${lang === "pt" ? `Você atingiu o limite de carreiras do plano ${getPlanLabel(resolvedPlan)}. Faça upgrade para criar mais.` : `You have reached the career limit for the ${getPlanLabel(resolvedPlan)} plan. Upgrade to create more.`}`}
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
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
              </svg>
              {t.logout}
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
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
                onDelete={() => handleDelete(career.id)}
                index={i}
                t={t}
              />
            ))}
            {!atCareerLimit && <NewCareerCard onClick={onCreateNew} index={localCareers.length} label={t.newCareer} />}
          </div>
        )}
      </div>
    </div>
  );
}
