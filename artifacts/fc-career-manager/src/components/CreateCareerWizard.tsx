import { useState, useRef, useMemo } from "react";
import { CoachProfile, InitialContext, KeyPlayer, TransferEntry, RecentMatch, Mission } from "@/types/career";
import { Career } from "@/types/career";
import { ClubEntry } from "@/types/club";
import { CoachSetup } from "./CoachSetup";
import { ClubPicker } from "./ClubPicker";
import { TeamPreview } from "./TeamPreview";
import { CareerSetupStep } from "./CareerSetupStep";
import { createCareer } from "@/lib/careerStorage";
import { createEmptyInitialContext } from "@/types/career";
import { getCurrentSeason } from "@/lib/api";
import { applyTheme, resetTheme, extractColorsFromImage, getCurrentColors } from "@/lib/themeManager";
import { getClubColors } from "@/lib/clubColors";
import { APIFOOTBALL_TO_FC26_NAME, LeagueInfo, ALL_LEAGUES } from "@/lib/footballApiMap";
import { searchClubs } from "@/lib/clubListCache";
import type { ClubTitle } from "@/types/career";
import { useLang } from "@/hooks/useLang";
import { WIZARD } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { getAuthHeaders } from "@/lib/careerStorage";

interface CreateCareerWizardProps {
  allClubs: ClubEntry[];
  onComplete: (career: Career) => Promise<void>;
  onCancel: () => void;
  initialStep?: 0 | 1 | 2;
  initialCoach?: CoachProfile | null;
}

type ParsedContext = InitialContext;

type PrePhase = "path-select" | "ongoing-input" | "ongoing-preview" | null;
type Path = "quick" | "detailed" | "manual";

function ProgressBar({ step, t }: { step: number; t: typeof WIZARD["pt"] }) {
  const steps = [t.stepCoach, t.stepClub, t.stepPreview, t.stepSetup];
  return (
    <div className="flex items-center gap-1.5 mb-5">
      {steps.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={label} className="flex items-center gap-1.5 flex-1">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{
                  background: done ? "var(--club-primary)" : active ? "rgba(var(--club-primary-rgb),0.15)" : "rgba(255,255,255,0.05)",
                  border: active || done ? "2px solid var(--club-primary)" : "2px solid rgba(255,255,255,0.08)",
                  color: done || active ? "white" : "rgba(255,255,255,0.3)",
                  boxShadow: active ? "0 0 16px rgba(var(--club-primary-rgb),0.3)" : "none",
                }}
              >
                {done ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className="text-xs font-semibold hidden sm:block"
                style={{ color: active ? "white" : done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)" }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px transition-all duration-500" style={{ background: done ? "var(--club-primary)" : "rgba(255,255,255,0.06)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MoodBar({ value, label, reason, onChange }: { value: number; label: string; reason?: string; onChange?: (v: number) => void }) {
  const color = value >= 70 ? "#22c55e" : value >= 40 ? "#eab308" : "#ef4444";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-white/60 text-xs font-semibold uppercase tracking-wide">{label}</span>
        <span className="text-white font-bold text-sm tabular-nums">{value}/100</span>
      </div>
      {onChange ? (
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, ${color} 0%, ${color} ${value}%, rgba(255,255,255,0.08) ${value}%, rgba(255,255,255,0.08) 100%)` }}
        />
      ) : (
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
        </div>
      )}
      {reason && <p className="text-white/45 text-[11px] leading-snug italic">{reason}</p>}
    </div>
  );
}

function ConfidenceBadge({ value, t }: { value: string; t: typeof WIZARD["pt"] }) {
  const map: Record<string, { color: string; label: string }> = {
    high: { color: "#4ade80", label: t.confidenceHigh },
    low: { color: "#f87171", label: t.confidenceLow },
    medium: { color: "#facc15", label: t.confidenceMedium },
  };
  const m = map[value] ?? map.medium;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
      style={{ background: `${m.color}1f`, color: m.color }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function SectionCard({ title, badge, children, delay = 0 }: { title: string; badge?: React.ReactNode; children: React.ReactNode; delay?: number }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 animate-slide-up"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        animationDelay: `${delay}ms`,
        animationFillMode: "both",
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-white/80 text-xs font-bold uppercase tracking-widest">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  );
}

function PlayerChip({ p, t }: { p: KeyPlayer; t: typeof WIZARD["pt"] }) {
  const roleMap: Record<string, string> = {
    star: t.rolesStar,
    captain: t.rolesCaptain,
    "young promise": t.rolesYoung,
    young: t.rolesYoung,
    loan: t.rolesLoan,
    injured: t.rolesInjured,
  };
  const roleLabel = roleMap[p.role.toLowerCase()] ?? p.role;
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(var(--club-primary-rgb),0.08)" }}>
      <span className="text-white text-xs font-semibold">{p.name}</span>
      {roleLabel && <span className="text-[9px] uppercase font-bold tracking-wider" style={{ color: "var(--club-primary)" }}>{roleLabel}</span>}
      {p.note && <span className="text-white/40 text-[10px] truncate max-w-[120px]">· {p.note}</span>}
    </div>
  );
}

function TransferRow({ x, dir }: { x: TransferEntry; dir: "in" | "out" }) {
  const arrow = dir === "in" ? "←" : "→";
  const club = dir === "in" ? x.from : x.to;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span style={{ color: dir === "in" ? "#4ade80" : "#f87171" }} className="font-bold">{arrow}</span>
      <span className="text-white font-semibold">{x.name}</span>
      {club && <span className="text-white/40">· {club}</span>}
      {x.fee && <span className="text-white/30 text-[10px]">{x.fee}</span>}
    </div>
  );
}

function MatchRow({ m }: { m: RecentMatch }) {
  const color = m.result === "W" ? "#4ade80" : m.result === "L" ? "#f87171" : "#facc15";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black" style={{ background: `${color}22`, color }}>
        {m.result}
      </span>
      <span className="text-white font-semibold flex-1 truncate">{m.opponent}</span>
      {m.score && <span className="text-white/60 tabular-nums">{m.score}</span>}
      {m.competition && <span className="text-white/30 text-[10px] truncate max-w-[100px]">{m.competition}</span>}
    </div>
  );
}

function MissionCard({ m }: { m: Mission }) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{
        background: "rgba(var(--club-primary-rgb),0.08)",
        border: "1px solid rgba(var(--club-primary-rgb),0.18)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-white text-sm font-bold">{m.title}</span>
        {m.deadline && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: "var(--club-primary)", background: "rgba(var(--club-primary-rgb),0.12)" }}>
            {m.deadline}
          </span>
        )}
      </div>
      {m.description && <p className="text-white/55 text-xs leading-relaxed">{m.description}</p>}
    </div>
  );
}

function findClubMatch(clubName: string, allClubs: ClubEntry[]): ClubEntry | null {
  if (!clubName.trim()) return null;
  const exact = allClubs.find((c) => c.name.toLowerCase() === clubName.toLowerCase());
  if (exact) return exact;
  const fc26 = Object.entries(APIFOOTBALL_TO_FC26_NAME).find(([k, v]) =>
    k.toLowerCase() === clubName.toLowerCase() || v.toLowerCase() === clubName.toLowerCase()
  );
  if (fc26) {
    const found = allClubs.find((c) => c.name.toLowerCase() === fc26[0].toLowerCase());
    if (found) return found;
  }
  const results = searchClubs(clubName, allClubs);
  if (results.length > 0) {
    const top = results[0];
    const tn = top.name.toLowerCase();
    const cn = clubName.toLowerCase();
    if (tn.includes(cn) || cn.includes(tn)) return top;
  }
  return null;
}

function leagueForClub(club: ClubEntry): LeagueInfo | null {
  return ALL_LEAGUES.find((l) => l.id === club.leagueId) ?? null;
}

export function CreateCareerWizard({
  allClubs,
  onComplete,
  onCancel,
  initialStep = 0,
  initialCoach,
}: CreateCareerWizardProps) {
  const [lang, setLang] = useLang();
  const t = WIZARD[lang];

  const [prePhase, setPrePhase] = useState<PrePhase>(initialStep === 0 ? "path-select" : null);
  const [chosenPath, setChosenPath] = useState<Path | null>(null);
  const [ongoingText, setOngoingText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [ongoingError, setOngoingError] = useState("");
  const [parsedContext, setParsedContext] = useState<ParsedContext | null>(null);
  const [extractedCoach, setExtractedCoach] = useState<CoachProfile | null>(null);
  const [editedClubName, setEditedClubName] = useState("");
  const isOngoing = useRef(false);

  const [step, setStep] = useState<0 | 1 | 2 | 3>(initialStep as 0 | 1 | 2 | 3);
  const [coach, setCoach] = useState<CoachProfile | null>(initialCoach ?? null);
  const [selectedClub, setSelectedClub] = useState<ClubEntry | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<LeagueInfo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resolvedColors, setResolvedColors] = useState<{ primary: string; secondary: string } | null>(null);
  const clubInfoRef = useRef<{ description?: string; titles?: ClubTitle[] }>({});

  const autoDetectedClub = useMemo<ClubEntry | null>(() => {
    const name = editedClubName.trim() || parsedContext?.club?.name;
    if (!name) return null;
    return findClubMatch(name, allClubs);
  }, [parsedContext, allClubs, editedClubName]);

  const handleAnalyze = async (textOverride?: string) => {
    const text = (textOverride ?? ongoingText).trim();
    if (!text) return;
    setAnalyzing(true);
    setOngoingError("");
    try {
      const res = await fetch("/api/careers/parse-ongoing-context", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ description: text }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json() as ParsedContext;
      setParsedContext(data);
      setEditedClubName("");
      // Pre-fill coach from extracted info
      if (data?.coach?.name) {
        setExtractedCoach({
          name: data.coach.name,
          nationality: data.coach.nationality || "Brasil",
          age: 40,
        } as CoachProfile);
      }
      // If detected club exists, apply its theme right away
      if (data?.club?.name) {
        const match = findClubMatch(data.club.name, allClubs);
        if (match) {
          const direct = getClubColors(match.name);
          if (direct) {
            applyTheme(direct);
            setResolvedColors(direct);
          } else if (match.logo) {
            try {
              const ext = await extractColorsFromImage(match.logo);
              applyTheme(ext);
              setResolvedColors(ext);
            } catch {}
          }
        }
      }
      setPrePhase("ongoing-preview");
    } catch {
      setOngoingError(t.ongoingError);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCoachNext = (coachData: CoachProfile) => {
    setCoach(coachData);
    setStep(selectedClub ? 3 : 1);
  };

  const effectiveInitialCoach = coach ?? extractedCoach ?? initialCoach ?? null;

  const handleClubSelect = async (club: ClubEntry, league: LeagueInfo | null) => {
    setSelectedLeague(league);
    setSelectedClub(club);
    setResolvedColors(null);
    setStep(2);

    const directColors = getClubColors(club.name);
    if (directColors) { applyTheme(directColors); setResolvedColors(directColors); return; }

    const fc26Name = APIFOOTBALL_TO_FC26_NAME[club.name];
    if (fc26Name) {
      const mappedColors = getClubColors(fc26Name);
      if (mappedColors) { applyTheme(mappedColors); setResolvedColors(mappedColors); return; }
    }

    const logoUrl = club.logo || (club.id ? `https://media.api-sports.io/football/teams/${club.id}.png` : null);
    if (logoUrl) {
      const extracted = await extractColorsFromImage(logoUrl);
      applyTheme(extracted);
      setResolvedColors(extracted);
    }
  };

  const handlePreviewNext = () => {
    setStep(3);
  };

  // Continue from ongoing-preview into the wizard. If club auto-detected, fast-track to setup.
  const handleOngoingPreviewContinue = () => {
    if (autoDetectedClub) {
      setSelectedClub(autoDetectedClub);
      setSelectedLeague(leagueForClub(autoDetectedClub));
      setPrePhase(null);
      setStep(coach ? 3 : 0); // if no coach yet, still need step 0
    } else {
      setPrePhase(null);
      setStep(coach ? 1 : 0);
    }
  };

  const handlePickClubManually = () => {
    setPrePhase(null);
    setStep(coach ? 1 : 0);
  };

  const handleSetupConfirm = async (projeto: string, competitions: string[]) => {
    if (!coach || !selectedClub) return;
    setConfirming(true);
    const colors = resolvedColors || getCurrentColors();
    const career = {
      ...createCareer(coach, selectedClub, {
        projeto: projeto || undefined,
        competitions: competitions.length > 0 ? competitions : undefined,
        clubDescription: clubInfoRef.current.description || undefined,
        clubTitles: clubInfoRef.current.titles?.length ? clubInfoRef.current.titles : undefined,
        ...(isOngoing.current && parsedContext ? {
          backstory: parsedContext.narrativeSummary || parsedContext.storyArc || undefined,
          initialBoardMood: parsedContext.moods?.board?.value,
          initialFanMood: parsedContext.moods?.fans?.value,
          initialContext: parsedContext,
        } : {}),
      }),
      clubPrimary: colors.primary,
      clubSecondary: colors.secondary,
    };
    try {
      await onComplete(career);
    } finally {
      setConfirming(false);
    }
  };

  const handleBack = () => {
    if (step === 2) resetTheme();
    if (step > 0) setStep((s) => (s - 1) as 0 | 1 | 2 | 3);
  };

  const season = getCurrentSeason();
  const isPreviewStep = step === 2;

  const headerTitle = prePhase === "path-select"
    ? t.careerTypeTitle
    : isOngoing.current
    ? t.careerTypeOngoing
    : t.newCareer;

  const stageMap: Record<string, string> = {
    "pre-season": t.seasonStagePre,
    early: t.seasonStageEarly,
    mid: t.seasonStageMid,
    late: t.seasonStageLate,
    playoffs: t.seasonStagePlayoffs,
    finished: t.seasonStageFinished,
  };

  const TEMPLATES: Array<{ key: string; label: string; text: string }> = [
    { key: "tplStart", label: t.tplStart, text: lang === "pt"
      ? "Acabei de assumir o clube na pré-temporada da temporada 2025/26. Quero conhecer o elenco e definir o estilo de jogo."
      : "Just took over the club in pre-season 2025/26. I want to learn the squad and set the playing style." },
    { key: "tplMid", label: t.tplMid, text: lang === "pt"
      ? "Estou no meio da temporada, jogando bem mas com altos e baixos. A diretoria ainda confia, a torcida está dividida."
      : "I'm mid-season, playing well but inconsistent. The board still trusts me, fans are divided." },
    { key: "tplTitle", label: t.tplTitle, text: lang === "pt"
      ? "Brigando pelo título nacional, na 1ª ou 2ª colocação. Diretoria eufórica, torcida sonhando alto, pressão pelo título."
      : "Fighting for the league title, sitting 1st or 2nd. Board ecstatic, fans dreaming big, title pressure." },
    { key: "tplRel", label: t.tplRel, text: lang === "pt"
      ? "Estou na zona de rebaixamento, últimos 5 jogos foram terríveis. Torcida revoltada, diretoria me dando uma última chance."
      : "I'm in the relegation zone, last 5 games were terrible. Fans furious, board giving me one last chance." },
    { key: "tplRebuild", label: t.tplRebuild, text: lang === "pt"
      ? "Projeto de reconstrução de longo prazo. Vendi os veteranos e estou apostando em jovens. Resultados oscilantes mas com potencial."
      : "Long-term rebuild project. Sold veterans and betting on youth. Wobbly results but lots of potential." },
  ];

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <div
        className="flex items-center justify-between px-4 sm:px-6 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--surface-border)" }}
      >
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors duration-200 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          {t.cancel}
        </button>
        <span className="text-white/25 text-xs font-semibold tracking-widest uppercase">
          {headerTitle}
        </span>
        <div style={{ width: 80 }} className="flex justify-end">
          <LangToggle lang={lang} setLang={setLang} />
        </div>
      </div>

      {/* Pre-step: Path Selection (3 paths) */}
      {prePhase === "path-select" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-black text-white mb-2">{t.careerTypeTitle}</h2>
              <p className="text-white/40 text-sm">{t.careerTypeSubtitle}</p>
            </div>

            <button
              onClick={() => { isOngoing.current = false; setChosenPath(null); setPrePhase(null); }}
              className="flex flex-col gap-2 p-5 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: "rgba(var(--club-primary-rgb),0.08)", border: "1.5px solid rgba(var(--club-primary-rgb),0.2)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: "rgba(var(--club-primary-rgb),0.15)" }}>✨</div>
                <span className="text-white font-bold text-base">{t.careerTypeNew}</span>
              </div>
              <p className="text-white/45 text-sm leading-relaxed">{t.careerTypeNewDesc}</p>
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">{t.careerTypeOngoing}</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <div className="flex flex-col gap-3">
              {([
                { key: "detailed", title: t.pathDetailed, desc: t.pathDetailedDesc, icon: "📊", primary: true },
                { key: "quick", title: t.pathQuick, desc: t.pathQuickDesc, icon: "⚡", primary: false },
                { key: "manual", title: t.pathManual, desc: t.pathManualDesc, icon: "🎛️", primary: false },
              ] as const).map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    isOngoing.current = p.key !== "manual";
                    setChosenPath(p.key);
                    if (p.key === "manual") {
                      isOngoing.current = true;
                      setParsedContext(createEmptyInitialContext());
                      setPrePhase("ongoing-preview");
                    } else {
                      setPrePhase("ongoing-input");
                    }
                  }}
                  className="flex flex-col gap-2 p-4 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: p.primary ? "rgba(var(--club-primary-rgb),0.06)" : "rgba(255,255,255,0.04)",
                    border: p.primary ? "1.5px solid rgba(var(--club-primary-rgb),0.18)" : "1.5px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: "rgba(255,255,255,0.06)" }}>{p.icon}</div>
                    <span className="text-white font-bold text-sm">{p.title}</span>
                  </div>
                  <p className="text-white/45 text-xs leading-relaxed">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pre-step: Ongoing Career Input */}
      {prePhase === "ongoing-input" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-black text-white mb-1.5">{chosenPath === "quick" ? t.pathQuick : t.ongoingTitle}</h2>
              <p className="text-white/40 text-sm leading-relaxed">{chosenPath === "quick" ? t.pathQuickDesc : t.ongoingSubtitle}</p>
            </div>

            <div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">{t.templatesLabel}</p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.key}
                    onClick={() => setOngoingText(tpl.text)}
                    className="text-xs px-2.5 py-1 rounded-full transition-all hover:scale-105 active:scale-95"
                    style={{ background: "rgba(var(--club-primary-rgb),0.08)", border: "1px solid rgba(var(--club-primary-rgb),0.18)", color: "var(--club-primary)" }}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={ongoingText}
              onChange={(e) => setOngoingText(e.target.value)}
              placeholder={t.ongoingPlaceholder}
              rows={10}
              className="w-full px-4 py-3.5 rounded-xl text-white text-sm font-medium focus:outline-none resize-none transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", lineHeight: "1.6" }}
              onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(var(--club-primary-rgb),0.5)"; }}
              onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)"; }}
            />

            {ongoingError && (
              <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <p className="text-red-300 text-xs font-medium">{ongoingError}</p>
                <button
                  onClick={() => {
                    isOngoing.current = true;
                    setChosenPath("manual");
                    setParsedContext(createEmptyInitialContext());
                    setOngoingError("");
                    setPrePhase("ongoing-preview");
                  }}
                  className="text-xs font-bold underline text-red-200 self-start"
                >
                  {t.pathManual}
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setPrePhase("path-select")}
                className="px-5 py-3 rounded-xl text-sm font-semibold text-white/50 hover:text-white/80 transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {t.ongoingBack}
              </button>
              <button
                onClick={() => handleAnalyze()}
                disabled={analyzing || !ongoingText.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: "var(--club-gradient)", boxShadow: "0 4px 16px rgba(var(--club-primary-rgb),0.25)" }}
              >
                {analyzing ? t.ongoingAnalyzing : t.ongoingAnalyze}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-step: Rich AI Parsed Context Preview */}
      {prePhase === "ongoing-preview" && parsedContext && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
            {/* Header with overall confidence + field counter */}
            {(() => {
              const totalFields = 14;
              let captured = 0;
              if (parsedContext.club?.name) captured++;
              if (parsedContext.coach?.name) captured++;
              if (parsedContext.season?.label) captured++;
              if (parsedContext.leaguePosition?.rank != null) captured++;
              if (parsedContext.preferredFormation) captured++;
              if (parsedContext.keyPlayers?.length) captured++;
              if (parsedContext.transfersIn?.length || parsedContext.transfersOut?.length) captured++;
              if (parsedContext.recentMatches?.length) captured++;
              if (parsedContext.injuries?.length) captured++;
              if (parsedContext.trophiesWon?.length) captured++;
              if (parsedContext.ongoingCompetitions?.length) captured++;
              if (parsedContext.missions?.length) captured++;
              if (parsedContext.boardLetter) captured++;
              if (parsedContext.narrativeSummary || parsedContext.storyArc) captured++;
              return (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-white mb-1">{t.previewTitle}</h2>
                    <p className="text-white/40 text-sm">{t.previewSubtitle}</p>
                    <p className="text-white/55 text-xs mt-2 font-semibold">
                      <span style={{ color: "var(--club-primary)" }}>{captured}</span>/{totalFields} {t.fieldsCaptured}
                    </p>
                  </div>
                  <ConfidenceBadge value={parsedContext.overallConfidence} t={t} />
                </div>
              );
            })()}

            {/* Club + Season + Position quick row */}
            <SectionCard
              title={parsedContext.club.name ? t.extractedClub : t.extractedClubMissing}
              badge={<ConfidenceBadge value={parsedContext.club.confidence} t={t} />}
              delay={0}
            >
              {autoDetectedClub ? (
                <div className="flex items-center gap-3">
                  {autoDetectedClub.logo && <img src={autoDetectedClub.logo} alt="" className="w-10 h-10 object-contain" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">{autoDetectedClub.name}</p>
                    <p className="text-white/40 text-xs">{autoDetectedClub.league}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md" style={{ color: "var(--club-primary)", background: "rgba(var(--club-primary-rgb),0.12)" }}>
                    {t.autoFilledFromAI}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    value={editedClubName || parsedContext.club.name}
                    onChange={(e) => setEditedClubName(e.target.value)}
                    placeholder={t.selectClubManually}
                    className="w-full px-3 py-2 rounded-lg text-white text-sm font-semibold focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                  />
                  <button
                    onClick={handlePickClubManually}
                    className="text-xs font-semibold px-3 py-2 rounded-lg self-end"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
                  >
                    {t.selectClubManually}
                  </button>
                </div>
              )}
            </SectionCard>

            {/* Season + Position grid */}
            {(parsedContext.season.label || parsedContext.leaguePosition.rank != null) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {parsedContext.season.label && (
                  <SectionCard title={t.extractedSeasonStage} badge={<ConfidenceBadge value={parsedContext.season.confidence} t={t} />} delay={50}>
                    <div className="flex flex-col gap-1">
                      <p className="text-white text-base font-black">{parsedContext.season.label}</p>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        {parsedContext.season.stage && <span>{stageMap[parsedContext.season.stage] ?? parsedContext.season.stage}</span>}
                        {parsedContext.season.matchday != null && <span>· {t.matchdayLabel} {parsedContext.season.matchday}</span>}
                      </div>
                    </div>
                  </SectionCard>
                )}
                {(parsedContext.leaguePosition.rank != null || parsedContext.leaguePosition.form) && (
                  <SectionCard title={t.extractedPosition} badge={<ConfidenceBadge value={parsedContext.leaguePosition.confidence} t={t} />} delay={75}>
                    <div className="flex items-center gap-3">
                      {parsedContext.leaguePosition.rank != null && (
                        <span className="text-white text-2xl font-black tabular-nums">#{parsedContext.leaguePosition.rank}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        {parsedContext.leaguePosition.points != null && (
                          <p className="text-white/70 text-xs">{parsedContext.leaguePosition.points} pts</p>
                        )}
                        {parsedContext.leaguePosition.form && (
                          <p className="text-white/50 text-xs font-mono">{parsedContext.leaguePosition.form}</p>
                        )}
                        {parsedContext.leaguePosition.gap && (
                          <p className="text-white/40 text-[10px] mt-0.5">{parsedContext.leaguePosition.gap}</p>
                        )}
                      </div>
                    </div>
                  </SectionCard>
                )}
              </div>
            )}

            {/* Moods */}
            <SectionCard title={t.previewBoardMood + " · " + t.previewFanMood + " · " + t.extractedDressingRoom} delay={100}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MoodBar value={parsedContext.moods.board.value} label={t.previewBoardMood} reason={parsedContext.moods.board.reason} onChange={(v) => setParsedContext((p) => p && ({ ...p, moods: { ...p.moods, board: { ...p.moods.board, value: v } } }))} />
                <MoodBar value={parsedContext.moods.fans.value} label={t.previewFanMood} reason={parsedContext.moods.fans.reason} onChange={(v) => setParsedContext((p) => p && ({ ...p, moods: { ...p.moods, fans: { ...p.moods.fans, value: v } } }))} />
                <MoodBar value={parsedContext.moods.dressingRoom.value} label={t.extractedDressingRoom} reason={parsedContext.moods.dressingRoom.reason} onChange={(v) => setParsedContext((p) => p && ({ ...p, moods: { ...p.moods, dressingRoom: { ...p.moods.dressingRoom, value: v } } }))} />
              </div>
            </SectionCard>

            {/* Story arc */}
            {parsedContext.storyArc && (
              <SectionCard title={t.extractedStoryArc} delay={125}>
                <p className="text-white/75 text-sm leading-relaxed italic">"{parsedContext.storyArc}"</p>
              </SectionCard>
            )}

            {/* Project */}
            {parsedContext.projeto && (
              <SectionCard title={t.previewProject} delay={150}>
                <p className="text-white/85 text-sm leading-relaxed">{parsedContext.projeto}</p>
              </SectionCard>
            )}

            {/* Key players */}
            {parsedContext.keyPlayers.length > 0 && (
              <SectionCard title={t.extractedKeyPlayers} delay={175}>
                <div className="flex flex-wrap gap-1.5">
                  {parsedContext.keyPlayers.map((p, i) => <PlayerChip key={i} p={p} t={t} />)}
                </div>
              </SectionCard>
            )}

            {/* Transfers */}
            {(parsedContext.transfersIn.length > 0 || parsedContext.transfersOut.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {parsedContext.transfersIn.length > 0 && (
                  <SectionCard title={t.extractedTransfersIn} delay={200}>
                    <div className="flex flex-col gap-1.5">
                      {parsedContext.transfersIn.map((x, i) => <TransferRow key={i} x={x} dir="in" />)}
                    </div>
                  </SectionCard>
                )}
                {parsedContext.transfersOut.length > 0 && (
                  <SectionCard title={t.extractedTransfersOut} delay={225}>
                    <div className="flex flex-col gap-1.5">
                      {parsedContext.transfersOut.map((x, i) => <TransferRow key={i} x={x} dir="out" />)}
                    </div>
                  </SectionCard>
                )}
              </div>
            )}

            {/* Recent matches + rivals */}
            {(parsedContext.recentMatches.length > 0 || parsedContext.rivals.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {parsedContext.recentMatches.length > 0 && (
                  <SectionCard title={t.extractedRecentMatches} delay={250}>
                    <div className="flex flex-col gap-1.5">
                      {parsedContext.recentMatches.map((m, i) => <MatchRow key={i} m={m} />)}
                    </div>
                  </SectionCard>
                )}
                {parsedContext.rivals.length > 0 && (
                  <SectionCard title={t.extractedRivals} delay={275}>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedContext.rivals.map((r, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-md font-semibold" style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5" }}>{r}</span>
                      ))}
                    </div>
                  </SectionCard>
                )}
              </div>
            )}

            {/* Finances */}
            {(parsedContext.finances.summary || parsedContext.finances.budget) && (
              <SectionCard title={t.extractedFinances} badge={<ConfidenceBadge value={parsedContext.finances.confidence} t={t} />} delay={300}>
                {parsedContext.finances.summary && <p className="text-white/70 text-sm">{parsedContext.finances.summary}</p>}
                {parsedContext.finances.budget && <p className="text-white/50 text-xs mt-1">{parsedContext.finances.budget}</p>}
              </SectionCard>
            )}

            {/* Missions */}
            {parsedContext.missions.length > 0 && (
              <SectionCard title={t.extractedMissions} delay={325}>
                <div className="flex flex-col gap-2">
                  {parsedContext.missions.map((m, i) => <MissionCard key={i} m={m} />)}
                </div>
              </SectionCard>
            )}

            {/* Board letter */}
            {parsedContext.boardLetter && (
              <SectionCard title={t.boardLetterTitle} delay={350}>
                <div
                  className="rounded-xl p-4 text-sm leading-relaxed text-white/85 italic"
                  style={{
                    background: "linear-gradient(135deg, rgba(var(--club-primary-rgb),0.08), rgba(var(--club-primary-rgb),0.02))",
                    border: "1px solid rgba(var(--club-primary-rgb),0.18)",
                    fontFamily: "Georgia, serif",
                  }}
                >
                  "{parsedContext.boardLetter}"
                </div>
              </SectionCard>
            )}

            {/* Prediction */}
            {(parsedContext.prediction.endOfSeason || parsedContext.prediction.boardReaction) && (
              <SectionCard title={t.predictionTitle} badge={<ConfidenceBadge value={parsedContext.prediction.confidence} t={t} />} delay={375}>
                {parsedContext.prediction.endOfSeason && (
                  <div>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{t.predEndOfSeason}</p>
                    <p className="text-white/80 text-sm">{parsedContext.prediction.endOfSeason}</p>
                  </div>
                )}
                {parsedContext.prediction.boardReaction && (
                  <div>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{t.predBoardReaction}</p>
                    <p className="text-white/80 text-sm">{parsedContext.prediction.boardReaction}</p>
                  </div>
                )}
              </SectionCard>
            )}

            {/* Inconsistencies */}
            {parsedContext.inconsistencies.length > 0 && (
              <SectionCard title={t.inconsistenciesTitle} delay={400}>
                <ul className="flex flex-col gap-1">
                  {parsedContext.inconsistencies.map((s, i) => (
                    <li key={i} className="text-amber-200/80 text-xs flex gap-2"><span>⚠</span><span>{s}</span></li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Deepening questions */}
            {parsedContext.deepeningQuestions.length > 0 && (
              <SectionCard title={t.deepenTitle} delay={425}>
                <p className="text-white/45 text-xs mb-2">{t.deepenHint}</p>
                <ul className="flex flex-col gap-1.5">
                  {parsedContext.deepeningQuestions.map((q, i) => (
                    <li key={i} className="text-white/70 text-xs flex gap-2"><span style={{ color: "var(--club-primary)" }}>?</span><span>{q}</span></li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Squad sync warning */}
            <div
              className="rounded-2xl p-4 flex items-start gap-3 animate-slide-up"
              style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", animationDelay: "450ms", animationFillMode: "both" }}
            >
              <span className="text-xl flex-shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-amber-200 text-sm font-bold mb-1">{t.squadSyncTitle}</p>
                <p className="text-amber-100/70 text-xs leading-relaxed">{parsedContext.squadSyncWarning || t.squadSyncFallback}</p>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setPrePhase("ongoing-input")}
                className="px-4 py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {t.previewEdit}
              </button>
              <button
                onClick={() => handleAnalyze()}
                disabled={analyzing}
                className="px-4 py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {analyzing ? t.ongoingAnalyzing : t.analyzeAgain}
              </button>
              <button
                onClick={handleOngoingPreviewContinue}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: "var(--club-gradient)", boxShadow: "0 4px 16px rgba(var(--club-primary-rgb),0.25)" }}
              >
                {t.previewContinue}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Normal wizard steps (when prePhase is null) */}
      {prePhase === null && (
        <>
          {isPreviewStep && selectedClub && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-4 pb-2">
                <ProgressBar step={step} t={t} />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-3">
                <TeamPreview
                  club={selectedClub}
                  season={season}
                  onNext={handlePreviewNext}
                  onBack={handleBack}
                  onClubInfoLoaded={(info) => { clubInfoRef.current = info; }}
                />
              </div>
            </div>
          )}

          {!isPreviewStep && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {step === 1 ? (
                <div className="flex-1 overflow-y-auto flex flex-col">
                  <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pt-5 pb-2 flex-shrink-0">
                    <ProgressBar step={step} t={t} />
                  </div>
                  <div key={step} className="flex-1 min-h-0 w-full px-3 pb-4 flex flex-col">
                    <ClubPicker allClubs={allClubs} onSelectClub={handleClubSelect} initialLeague={selectedLeague} />
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
                    <ProgressBar step={step} t={t} />
                    <div key={step}>
                      {step === 0 && <CoachSetup onNext={handleCoachNext} initial={effectiveInitialCoach} />}
                      {step === 3 && selectedClub && (
                        <CareerSetupStep
                          club={selectedClub}
                          season={season}
                          clubInfo={clubInfoRef.current}
                          onConfirm={handleSetupConfirm}
                          onBack={handleBack}
                          confirming={confirming}
                          initialProject={parsedContext?.projeto || undefined}
                          initialCompetitions={parsedContext?.competitions}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
