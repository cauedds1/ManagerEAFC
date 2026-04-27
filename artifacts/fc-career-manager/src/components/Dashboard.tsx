import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLang } from "@/hooks/useLang";
import { useIsNarrow } from "@/hooks/use-mobile";
import { PAINEL, DASHBOARD } from "@/lib/i18n";
import type { Career, Season } from "@/types/career";
import { SettingsPage } from "./SettingsPage";
import {
  getSquad,
  clearSquadCache,
  ageSquadInCache,
  consolidateSquadForNewSeason,
  getAllCachedPlayers,
  type SquadResult,
  type SquadPlayer,
  PT_BR_TO_POSITION,
  migratePositionOverride,
} from "@/lib/squadCache";
import { getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import { getTransfers, addTransfer, updateTransfer, saveTransfers } from "@/lib/transferStorage";
import { getTransferWindow, saveTransferWindow, type TransferWindowState } from "@/lib/transferWindowStorage";
import { getRivals } from "@/lib/rivalsStorage";
import { fetchPortals } from "@/lib/customPortalStorage";
import { fetchPortalPhotos, type PortalPhotos } from "@/lib/portalPhotosStorage";
import { addPost as addNewsPost, getPosts as getNoticiaPosts, getPostsEn as getNoticiaPostsEn, generatePostId, generateCommentId } from "@/lib/noticiaStorage";
import { getFanMood, setFanMood, computeFanMoodDelta, getFanMoodLabel } from "@/lib/fanMoodStorage";
import { getBoardMood, setBoardMood, computeBoardMoodDelta, getBoardMoodLabel, getBoardCrisisStreak, setBoardCrisisStreak } from "@/lib/boardMoodStorage";
import { getSeasonObjectives, saveSeasonObjectives, markObjectiveFailed, computeCupFailureSeverity, severityBoardPenalty } from "@/lib/seasonObjectivesStorage";
import type { SeasonObjective } from "@/lib/seasonObjectivesStorage";
import { calcSquadAvgOvr } from "@/lib/playerContext";
import type { TransferRecord } from "@/types/transfer";
import { getMatches, updateMatch } from "@/lib/matchStorage";
import type { MatchRecord } from "@/types/match";
import { runPerformanceEngine } from "@/lib/playerPerformanceEngine";
import { copyPlayerMoodsToNewSeason, getAllPlayerStats } from "@/lib/playerStatsStorage";
import { getLeaguePosition } from "@/lib/leagueStorage";
import { runAutoNews, runRumorNews, runPromotionRelegationNews, leagueTierLevel } from "@/lib/autoNewsService";
import { getAutoNewsEnabled } from "@/lib/autoNewsPreference";
import type { NewsPost, NewsSource, NewsCategory } from "@/types/noticias";
import type { BoardMember, DiretoriaMessage } from "@/types/diretoria";
import { PainelView } from "./PainelView";
import { NewsTicker } from "./NewsTicker";
import { ClubeView, FC_ELENCO_TAB_VIEWED_EVENT } from "./ClubeView";
import { TransferenciasView } from "./TransferenciasView";
import { PartidasView } from "./PartidasView";
import { NoticiasView, type BgGenParams, type AiPreview, type NoticiaGeneratedDetail, FC_NOTICIA_GENERATED_EVENT } from "./NoticiasView";
import { DiretoriaView } from "./DiretoriaView";
import { MomentosView } from "./MomentosView";
import { SeasonSelectModal } from "./SeasonSelectModal";
import { NewSeasonWizard } from "./NewSeasonWizard";
import { SeasonObjectivesCard } from "./SeasonObjectivesCard";
import { FinalizeSeasonModal } from "./FinalizeSeasonModal";
import { SeasonSummaryView } from "./SeasonSummaryView";
import { getSeasons, createSeason, activateSeason, generateSeasonId, updateSeasonLabel } from "@/lib/seasonStorage";
import { ensureCareerAndSeason1, deleteCareer } from "@/lib/careerStorage";
import { syncSeasonFromDb, syncCareerFromDb } from "@/lib/dbSync";
import {
  getMembers,
  addMember,
  getConversation,
  saveConversation,
  addNotification,
  getMemberCooldowns,
  setMemberCooldown,
  setPendingMeetingTrigger,
  generateMessageId,
  generateMemberId,
  FC_BOARD_MEMBER_ADDED_EVENT,
} from "@/lib/diretoriaStorage";
import { getClubPresident, buildFallbackPresident } from "@/lib/clubPresidents";
import { FC_MOMENTO_SAVED_EVENT } from "@/lib/momentoStorage";
import { CUSTOM_PORTALS_EVENT } from "@/lib/customPortalStorage";
import { getFinanceiroSettings, computeFinancialSnapshot } from "@/lib/financeiroStorage";
import { getFormerPlayers, addFormerPlayer, saveFormerPlayers, getCustomPlayers } from "@/lib/customPlayersStorage";
import { buildPlayerPerformanceContext, buildSquadOvrContext } from "@/lib/playerContext";
import { getAiHeaders } from "@/lib/apiStorage";
import { getUserPlan, getPlanLimits } from "@/lib/userPlan";
import {
  countUnreadDiretoria,
  countUnreadNoticias,
  initNoticiasSeenAt,
  markNoticiasRead,
  markDiretoriaRead,
} from "@/lib/unreadStorage";
import { NotificationToast, type ToastItem } from "./NotificationToast";
import { NotificationPopup, fetchPendingNotification } from "./NotificationPopup";
import { OnboardingEntry, PlanUpgradeEntry } from "./OnboardingEntry";
import { MissionWidget } from "./MissionWidget";
import { CuriosityTeaser, type TeaserKey } from "./CuriosityTeaser";
import {
  isOnboardingSeen,
  markOnboardingSeen,
  getSeenPlan,
  setSeenPlan,
  completeMission,
  isMissionComplete,
  allMissionsForPlanDone,
  getPlanDeltaMissions,
  FC_MISSION_COMPLETE_EVENT,
} from "@/lib/missionStorage";

interface DashboardProps {
  career: Career;
  onSeasonChange: (season: string) => void;
  onGoToCareers: () => void;
  onChangeClub: () => void;
  onReloadClubs: () => void;
  onDeleteCareer?: () => void;
  initialTab?: CareerTab;
  isDemo?: boolean;
}

type CareerTab = "resumo" | "painel" | "partidas" | "clube" | "transferencias" | "noticias" | "diretoria" | "momentos" | "configuracoes";
type BgGenStatus = "idle" | "generating" | "done" | "error";

const TABS: { id: CareerTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "painel",
    label: "painel",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: "partidas",
    label: "partidas",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c0 0 2.5 4 2.5 9s-2.5 9-2.5 9M12 3c0 0-2.5 4-2.5 9s2.5 9 2.5 9M3 12h18" />
      </svg>
    ),
  },
  {
    id: "clube",
    label: "clube",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: "transferencias",
    label: "transferencias",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    id: "noticias",
    label: "noticias",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h2" />
      </svg>
    ),
  },
  {
    id: "diretoria",
    label: "diretoria",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: "momentos",
    label: "momentos",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

function saveDiretoriaNotificationAsChatMessage(careerId: string, memberId: string, preview: string): void {
  const content = preview.trim();
  if (!content) return;
  const existing = getConversation(careerId, memberId);
  const lastMessage = existing.at(-1);
  if (lastMessage?.role === "character" && lastMessage.content === content) return;
  saveConversation(careerId, memberId, [
    ...existing,
    {
      id: generateMessageId(),
      role: "character",
      content,
      timestamp: Date.now(),
    },
  ]);
}

function useClubLogo(career: Career): string | null {
  const [src, setSrc] = useState<string | null>(() => {
    if (career.clubLogo) return career.clubLogo;
    if (career.clubId > 0) return `https://media.api-sports.io/football/teams/${career.clubId}.png`;
    return null;
  });

  useEffect(() => {
    if (career.clubLogo) { setSrc(career.clubLogo); return; }
    if (career.clubId > 0) { setSrc(`https://media.api-sports.io/football/teams/${career.clubId}.png`); return; }
    setSrc(null);
  }, [career.clubName, career.clubLogo, career.clubId]);

  return src;
}

function CoachAvatar({ career }: { career: Career }) {
  const [imgErr, setImgErr] = useState(false);
  const { photo, name } = career.coach;
  const initials = name.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
      style={{ border: "1.5px solid rgba(var(--club-primary-rgb),0.3)", background: "rgba(var(--club-primary-rgb),0.08)" }}
    >
      {photo && !imgErr ? (
        <img src={photo} alt={name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
      ) : (
        <span className="text-white/60 text-xs font-bold">{initials}</span>
      )}
    </div>
  );
}

export function Dashboard({ career, onSeasonChange, onGoToCareers, onChangeClub, onReloadClubs, onDeleteCareer, initialTab, isDemo }: DashboardProps) {
  const [lang] = useLang();
  const isNarrow = useIsNarrow();
  const painelTabLabel = PAINEL[lang].tabLabel;
  const t = DASHBOARD[lang];
  const tabLabels: Record<string, string> = {
    partidas: t.tabPartidas,
    clube: t.tabClube,
    transferencias: t.tabTransferencias,
    noticias: t.tabNoticias,
    diretoria: t.tabDiretoria,
    momentos: t.tabMomentos,
  };
  const userPlan = getUserPlan();
  const teamId = career.clubId > 0 ? career.clubId : 0;

  const logoUrl = useClubLogo(career);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const logoImgRef = useCallback((el: HTMLImageElement | null) => {
    if (!el) return;
    if (el.complete) {
      if (el.naturalWidth > 0) setImgLoaded(true);
      else setImgError(true);
    }
  }, []);
  const [activeTab, setActiveTab] = useState<CareerTab>(initialTab ?? "painel");
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [highlightMomentoId, setHighlightMomentoId] = useState<string | undefined>();
  const [portalPhotos, setPortalPhotos] = useState<PortalPhotos>({});
  const [customPortalPhotos, setCustomPortalPhotos] = useState<Record<string, string>>({});
  const [focusedPostId, setFocusedPostId] = useState<string | undefined>();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string>(career.currentSeasonId ?? career.id);
  const [activeSeasonLabel, setActiveSeasonLabel] = useState<string>(career.season);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [showNewSeasonWizard, setShowNewSeasonWizard] = useState(false);
  const [creatingNewSeason, setCreatingNewSeason] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeTargetSeasonId, setFinalizeTargetSeasonId] = useState<string | null>(null);
  const [dbSynced, setDbSynced] = useState(false);
  const isReadOnly = isDemo || (seasons.length > 0 && seasons.find((s) => s.id === activeSeasonId)?.isActive === false);

  const [squad, setSquad] = useState<SquadResult | null>(null);
  const [squadLoading, setSquadLoading] = useState(true);
  const [squadError, setSquadError] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const [transfers, setTransfers] = useState<TransferRecord[]>(
    () => getTransfers(activeSeasonId)
  );

  const [transferWindow, setTransferWindow] = useState<TransferWindowState>(
    () => getTransferWindow(activeSeasonId)
  );

  const [matches, setMatches] = useState<MatchRecord[]>(
    () => getMatches(activeSeasonId)
  );

  const [noticiasPosts, setNoticiasPosts] = useState(
    () => getNoticiaPosts(activeSeasonId)
  );

  const tickerPosts = useMemo(() => {
    if (lang === "en") {
      const enPosts = getNoticiaPostsEn(activeSeasonId);
      if (enPosts.length > 0) return enPosts;
    }
    return noticiasPosts;
  }, [lang, noticiasPosts, activeSeasonId]);

  useEffect(() => { setImgLoaded(false); setImgError(false); }, [logoUrl]);

  useEffect(() => {
    let cancelled = false;
    setSquadLoading(true);
    setSquadError(false);
    getSquad(teamId, career.clubName)
      .then((result) => {
        if (!cancelled) { setSquad(result); setSquadLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setSquadError(true); setSquadLoading(false); }
      });
    return () => { cancelled = true; };
  }, [teamId, career.clubName, refetchKey]);

  useEffect(() => {
    setDbSynced(false);
    backfillDoneRef.current = false;
    (async () => {
      const initialSeasonId = await ensureCareerAndSeason1(career);
      await syncCareerFromDb(career.id);

      // Load all seasons first so we know which is truly active
      const loaded = await getSeasons(career.id);
      setSeasons(loaded);

      // Determine the correct active season (not necessarily the first/initial one)
      let effectiveSeasonId = initialSeasonId;
      if (loaded.length > 0) {
        const active = loaded.find((s) => s.isActive) ?? loaded[loaded.length - 1];
        effectiveSeasonId = active.id;
        setActiveSeasonId(active.id);
        setActiveSeasonLabel(active.label);
      } else {
        setActiveSeasonId((prev) => (prev === career.id ? initialSeasonId : prev));
      }

      // Sync and load data for the ACTIVE season (not the initial/first one)
      await syncSeasonFromDb(effectiveSeasonId);
      setTransfers(getTransfers(effectiveSeasonId));
      setTransferWindow(getTransferWindow(effectiveSeasonId));
      setMatches(getMatches(effectiveSeasonId));
      setOverrides(getAllPlayerOverrides(career.id));
      setFormerPlayers(getFormerPlayers(career.id));

      // Default to "resumo" tab if the active season is already finalized
      const activeSeason = loaded.find((s) => s.id === effectiveSeasonId);
      if (activeSeason?.finalized) {
        setActiveTab("resumo");
      }

      setDbSynced(true);
    })();
  }, [career.id]);

  const loadSeasons = useCallback(async () => {
    const loaded = await getSeasons(career.id);
    setSeasons(loaded);
    if (loaded.length > 0) {
      const active = loaded.find((s) => s.isActive) ?? loaded[loaded.length - 1];
      setActiveSeasonId(active.id);
      setActiveSeasonLabel(active.label);
    }
  }, [career.id]);

  const switchToSeason = useCallback(async (season: Season) => {
    setShowSeasonModal(false);
    await syncSeasonFromDb(season.id);
    setActiveSeasonId(season.id);
    setActiveSeasonLabel(season.label);
    setTransfers(getTransfers(season.id));
    setTransferWindow(getTransferWindow(season.id));
    setMatches(getMatches(season.id));
    setNoticiasPosts(getNoticiaPosts(season.id));
    if (season.finalized) setActiveTab("resumo");
    else setActiveTab("painel");
  }, []);

  const handleRefreshSquad = useCallback(() => {
    clearSquadCache(teamId, career.clubName);
    setSquad(null);
    setRefetchKey((k) => k + 1);
  }, [teamId, career.clubName]);

  const [overrides, setOverrides] = useState(() => getAllPlayerOverrides(career.id));

  const refreshOverrides = useCallback(() => {
    setOverrides(getAllPlayerOverrides(career.id));
  }, [career.id]);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [diretoriaUnread, setDiretoriaUnread] = useState(0);
  const [noticiasUnread, setNoticiasUnread] = useState(0);
  const [fanMoodScore, setFanMoodScore] = useState<number>(() => getFanMood(career.currentSeasonId ?? career.id));
  const [boardMoodScore, setBoardMoodScore] = useState<number>(() => getBoardMood(career.currentSeasonId ?? career.id));
  const [seasonObjectives, setSeasonObjectives] = useState<SeasonObjective[]>(() => getSeasonObjectives(career.currentSeasonId ?? career.id));

  const [bgGenStatus, setBgGenStatus] = useState<BgGenStatus>("idle");
  const [bgGenLabel, setBgGenLabel] = useState("");
  const bgGenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backfillDoneRef = useRef(false);
  const [aiUsageToday, setAiUsageToday] = useState<number | undefined>(undefined);
  const [aiUsageLimit, setAiUsageLimit] = useState<number | undefined>(undefined);

  // ─── Admin notification popup ────────────────────────────────────────────────
  const [pendingNotification, setPendingNotification] = useState<{
    id: number; title: string; body: string; imageUrl: string | null; requiresResponse: boolean;
  } | null>(null);

  // ─── Onboarding state ───────────────────────────────────────────────────────
  const [showOnboardingEntry, setShowOnboardingEntry] = useState(false);
  const [showUpgradeEntry, setShowUpgradeEntry] = useState(false);
  const [upgradedFromPlan, setUpgradedFromPlan] = useState<"free" | "pro" | "ultra">("free");
  const [showMissions, setShowMissions] = useState(false);
  const [activeTeaserTrigger, setActiveTeaserTrigger] = useState<TeaserKey | null>(null);
  const [missionKey, setMissionKey] = useState(0);

  useEffect(() => {
    return () => { if (bgGenTimerRef.current) clearTimeout(bgGenTimerRef.current); };
  }, []);

  // ─── Onboarding initialization ──────────────────────────────────────────────
  useEffect(() => {
    if (!dbSynced || isDemo) return;
    fetchPendingNotification().then((notif) => {
      if (notif) setPendingNotification(notif);
    });
  }, [dbSynced, isDemo]);

  useEffect(() => {
    if (!dbSynced || isDemo) return;
    const seenPlan = getSeenPlan(career.id);
    if (!seenPlan) {
      // First time ever for this career
      if (!isOnboardingSeen(career.id)) {
        setShowOnboardingEntry(true);
      } else {
        setShowMissions(true);
      }
      setSeenPlan(career.id, userPlan);
      return;
    }
    if (seenPlan !== userPlan) {
      // Plan changed — show upgrade card
      const delta = getPlanDeltaMissions(seenPlan, userPlan);
      if (delta.length > 0) {
        setUpgradedFromPlan(seenPlan);
        setShowUpgradeEntry(true);
      }
      setSeenPlan(career.id, userPlan);
    }
    setShowMissions(true);
  }, [dbSynced, isDemo, career.id, userPlan]);

  useEffect(() => {
    setFanMoodScore(getFanMood(activeSeasonId));
    setBoardMoodScore(getBoardMood(activeSeasonId));
    setSeasonObjectives(getSeasonObjectives(activeSeasonId));
  }, [activeSeasonId, dbSynced]);

  useEffect(() => {
    fetchPortalPhotos(career.id).then(setPortalPhotos).catch(() => {});
  }, [career.id]);

  useEffect(() => {
    fetchPortals(career.id).then((portals) => {
      const map: Record<string, string> = {};
      for (const p of portals) {
        if (p.photo) map[p.id] = p.photo;
      }
      setCustomPortalPhotos(map);
    }).catch(() => {});
  }, [career.id]);

  useEffect(() => {
    initNoticiasSeenAt(activeSeasonId);
    setDiretoriaUnread(countUnreadDiretoria(career.id));
    setNoticiasUnread(countUnreadNoticias(activeSeasonId));
  }, [career.id, activeSeasonId]);

  useEffect(() => {
    const headers = getAiHeaders();
    if (!headers.Authorization) return;
    fetch("/api/noticias/ai-usage", { headers })
      .then(r => r.ok ? r.json() : null)
      .then((data: { aiUsageToday?: number; aiUsageLimit?: number } | null) => {
        if (!data) return;
        if (typeof data.aiUsageToday === "number") setAiUsageToday(data.aiUsageToday);
        if (typeof data.aiUsageLimit === "number") setAiUsageLimit(data.aiUsageLimit);
      })
      .catch(() => {});
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleNoticiaGenerateBackground = useCallback(async (params: BgGenParams) => {
    if (bgGenTimerRef.current) clearTimeout(bgGenTimerRef.current);
    setBgGenLabel(params.description.slice(0, 48) + (params.description.length > 48 ? "…" : ""));
    setBgGenStatus("generating");

    try {
      const headers = getAiHeaders();

      const res = await fetch("/api/noticias/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          description: params.description,
          clubName: career.clubName,
          season: career.season,
          source: params.source,
          category: params.category,
          clubLeague: effectiveLeague || undefined,
          currentCompetitions: currentCompetitions.length ? currentCompetitions : undefined,
          clubTitles: career.clubTitles?.length ? career.clubTitles : undefined,
          clubDescription: career.clubDescription || undefined,
          projeto: career.projeto || undefined,
          playersContext: params.playerContextStr || undefined,
          squadOvrContext: params.squadOvrContext || undefined,
          teamFormContext: params.teamFormContext || undefined,
          historicalContext: params.historicalContext,
          recentPostsContext: params.recentPostsContext,
          customPortal: params.customPortal,
          matchPlayerContext: params.lastMatchPlayerContext || undefined,
          attachedMatchContext: params.attachedMatchContext || undefined,
          fanMoodScore,
          fanMoodLabel: `${getFanMoodLabel(fanMoodScore, lang).emoji} ${getFanMoodLabel(fanMoodScore, lang).label}`,
          lang: params.lang ?? localStorage.getItem("fc_lang") ?? "pt",
        }),
      });

      if (!res.ok) {
        try {
          const errData = await res.json() as { code?: string; limit?: number };
          if (errData.code === "PLAN_LIMIT_REACHED") {
            if (typeof errData.limit === "number") {
              setAiUsageToday(errData.limit);
              setAiUsageLimit(errData.limit);
            }
            setBgGenStatus("idle");
            return;
          }
        } catch {}
        setBgGenStatus("error");
        bgGenTimerRef.current = setTimeout(() => setBgGenStatus("idle"), 5000);
        return;
      }

      const data = (await res.json()) as AiPreview & { aiUsageToday?: number; aiUsageLimit?: number };
      if (typeof data.aiUsageToday === "number") setAiUsageToday(data.aiUsageToday);
      if (typeof data.aiUsageLimit === "number") setAiUsageLimit(data.aiUsageLimit);

      const post: NewsPost = {
        id: generatePostId(),
        careerId: params.careerId,
        source: (data.source as NewsSource) ?? "fanpage",
        sourceHandle: data.sourceHandle,
        sourceName: data.sourceName,
        ...(data.title?.trim() ? { title: data.title.trim() } : {}),
        content: data.content,
        ...(params.imageUrl ? { imageUrl: params.imageUrl } : {}),
        ...(params.videoUrl ? { videoUrl: params.videoUrl, videoKey: params.videoKey } : {}),
        ...(params.customPortal ? { customPortalId: params.customPortal.id } : {}),
        likes: data.likes,
        commentsCount: data.commentsCount,
        sharesCount: data.sharesCount,
        comments: data.comments.map((c) => ({
          id: generateCommentId(),
          username: c.username,
          displayName: c.displayName,
          content: c.content,
          likes: c.likes,
          personality: (c.personality as NewsPost["comments"][0]["personality"]) ?? "neutro",
          replies: Array.isArray(c.replies)
            ? (c.replies as typeof data.comments).map((r) => ({
                id: generateCommentId(),
                username: r.username,
                displayName: r.displayName,
                content: r.content,
                likes: r.likes,
                personality: (r.personality as NewsPost["comments"][0]["personality"]) ?? "neutro",
                createdAt: Date.now() - Math.floor(Math.random() * 3_600_000),
              }))
            : [],
          createdAt: Date.now() - Math.floor(Math.random() * 3_600_000),
        })),
        createdAt: Date.now(),
        category: (data.category as NewsCategory) ?? "geral",
      };

      addNewsPost(params.seasonId, post);
      const detail: NoticiaGeneratedDetail = { post, seasonId: params.seasonId };
      window.dispatchEvent(new CustomEvent<NoticiaGeneratedDetail>(FC_NOTICIA_GENERATED_EVENT, { detail }));

      setBgGenStatus("done");
      bgGenTimerRef.current = setTimeout(() => setBgGenStatus("idle"), 4000);
    } catch {
      setBgGenStatus("error");
      bgGenTimerRef.current = setTimeout(() => setBgGenStatus("idle"), 5000);
    }
  }, [career, fanMoodScore, seasons, activeSeasonId]);

  const handleTabChange = useCallback((tab: CareerTab) => {
    setActiveTab(tab);
    if (tab === "diretoria") {
      markDiretoriaRead(career.id);
      setDiretoriaUnread(0);
    }
    if (tab === "noticias") {
      markNoticiasRead(activeSeasonId);
      setNoticiasUnread(0);
    }
  }, [career.id, activeSeasonId, userPlan]);

  useEffect(() => {
    const handler = () => {
      if (!isMissionComplete(career.id, "free_view_squad")) {
        completeMission(career.id, "free_view_squad");
      }
      if (userPlan !== "ultra") {
        setActiveTeaserTrigger("after_squad_rumor");
      }
    };
    window.addEventListener(FC_ELENCO_TAB_VIEWED_EVENT, handler);
    return () => window.removeEventListener(FC_ELENCO_TAB_VIEWED_EVENT, handler);
  }, [career.id, userPlan]);

  useEffect(() => {
    const handler = (e: Event) => {
      const momentoId = (e as CustomEvent<{ momentoId: string }>).detail?.momentoId;
      if (momentoId) {
        setActiveTab("momentos");
        setHighlightMomentoId(momentoId);
      }
    };
    document.addEventListener("fc:open-momentos", handler);
    return () => document.removeEventListener("fc:open-momentos", handler);
  }, []);

  useEffect(() => {
    setNoticiasPosts(getNoticiaPosts(activeSeasonId));
  }, [activeSeasonId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { seasonId, post, isAutoGenerated } = (e as CustomEvent<NoticiaGeneratedDetail>).detail ?? {};
      if (seasonId !== activeSeasonId) return;

      setNoticiasPosts(getNoticiaPosts(activeSeasonId));

      if (!isMissionComplete(career.id, "free_gen_news")) {
        completeMission(career.id, "free_gen_news");
      }

      if (userPlan === "pro" || userPlan === "ultra") {
        const posts = getNoticiaPosts(activeSeasonId);
        if (posts.length >= 3 && !isMissionComplete(career.id, "pro_gen_3_news")) {
          completeMission(career.id, "pro_gen_3_news");
        }
      }

      // Ultra mission 1: completes when the auto-news engine generates its first post
      if (userPlan === "ultra" && isAutoGenerated) {
        if (!isMissionComplete(career.id, "ultra_auto_news")) {
          completeMission(career.id, "ultra_auto_news");
        }
      }

      // Ultra mission 2: generate a rumor post (transfer category)
      if (userPlan === "ultra" && post?.category === "transferencia") {
        if (!isMissionComplete(career.id, "ultra_rumor")) {
          completeMission(career.id, "ultra_rumor");
        }
      }

      // Teaser: auto-news for non-ultra
      if (userPlan !== "ultra") {
        setActiveTeaserTrigger("after_news_auto");
      }
    };
    window.addEventListener(FC_NOTICIA_GENERATED_EVENT, handler);
    return () => window.removeEventListener(FC_NOTICIA_GENERATED_EVENT, handler);
  }, [activeSeasonId, career.id, userPlan]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ careerId: string }>).detail;
      if (detail?.careerId !== career.id) return;
      if (!isMissionComplete(career.id, "pro_setup_diretoria")) {
        completeMission(career.id, "pro_setup_diretoria");
      }
    };
    window.addEventListener(FC_BOARD_MEMBER_ADDED_EVENT, handler);
    return () => window.removeEventListener(FC_BOARD_MEMBER_ADDED_EVENT, handler);
  }, [career.id]);

  useEffect(() => {
    const handler = () => {
      if (!isMissionComplete(career.id, "pro_save_momento")) {
        completeMission(career.id, "pro_save_momento");
      }
      // Teaser: video-news for non-ultra — fires after the user actually uploads a momento
      if (userPlan !== "ultra") {
        setActiveTeaserTrigger("after_momento_videonews");
      }
    };
    window.addEventListener(FC_MOMENTO_SAVED_EVENT, handler);
    return () => window.removeEventListener(FC_MOMENTO_SAVED_EVENT, handler);
  }, [career.id, userPlan]);

  useEffect(() => {
    const handler = () => {
      if (userPlan === "ultra" && !isMissionComplete(career.id, "ultra_portal")) {
        completeMission(career.id, "ultra_portal");
      }
    };
    window.addEventListener(CUSTOM_PORTALS_EVENT, handler);
    return () => window.removeEventListener(CUSTOM_PORTALS_EVENT, handler);
  }, [career.id, userPlan]);

  useEffect(() => {
    const handler = (_e: Event) => {
      void _e;

      if (allMissionsForPlanDone(career.id, "free")) {
        const freeGuardKey = `fc_free_unlock_fired_${career.id}`;
        if (!localStorage.getItem(freeGuardKey)) {
          localStorage.setItem(freeGuardKey, "1");

          const runFreeUnlock = async () => {
            const activeLang = localStorage.getItem("fc_lang") ?? "pt";
            const existingMembers = getMembers(career.id);
            const alreadyHasPresidente = existingMembers.some((m) => m.role === "presidente");
            if (!alreadyHasPresidente) {
              let presData = getClubPresident(career.clubId);

              if (!presData) {
                try {
                  const aiRes = await fetch("/api/diretoria/generate-member", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      roleLabel: "Presidente",
                      clubName: career.clubName,
                      clubCountry: career.clubCountry,
                      clubLeague: career.clubLeague,
                      existingMembers: [],
                      lang: localStorage.getItem("fc_lang") ?? "pt",
                    }),
                  });
                  if (aiRes.ok) {
                    const aiData = (await aiRes.json()) as {
                      name?: string;
                      personalityStyle?: string;
                      patience?: number;
                      description?: string;
                    };
                    if (aiData.name) {
                      presData = {
                        name: aiData.name,
                        personality: (aiData.personalityStyle as import("@/types/diretoria").PersonalityStyle) ?? "diplomatico",
                        patience: aiData.patience ?? 65,
                        description: aiData.description ?? "",
                      };
                    }
                  }
                } catch {
                  /* ignore network errors; fall through to static fallback */
                }
                if (!presData) {
                  presData = buildFallbackPresident(career.clubId, career.clubCountry);
                }
              }

              const newMember: BoardMember = {
                id: generateMemberId(),
                name: presData.name,
                role: "presidente",
                roleLabel: activeLang === "en" ? "President" : "Presidente",
                description: presData.description,
                descriptionEn: presData.descriptionEn,
                personalityStyle: presData.personality,
                patience: presData.patience,
                mood: "bom",
                avatarColor: "#8B5CF6",
                createdAt: Date.now(),
                messageLimit: 15,
                userMessagesSent: 0,
              };
              addMember(career.id, newMember);

              const introContent = activeLang === "en"
                ? `Hello, manager! I'm ${presData.name}, president of ${career.clubName}. You've completed all the starter missions — that shows real commitment and we're on the right track. Congratulations! I'll be here whenever you need to talk about the club. I have high expectations for our work together.`
                : `Olá, treinador! Sou ${presData.name}, presidente do ${career.clubName}. Você completou todas as missões iniciais — isso mostra comprometimento e estamos no caminho certo. Parabéns! Vou estar aqui sempre que precisar conversar sobre o clube. Tenho grandes expectativas para o nosso trabalho juntos.`;
              const introMsg: DiretoriaMessage = {
                id: generateMessageId(),
                role: "character",
                content: introContent,
                timestamp: Date.now(),
              };
              saveConversation(career.id, newMember.id, [introMsg]);
              addNotification(career.id, { memberId: newMember.id, preview: introContent, triggeredAt: Date.now() });
              addToast({
                type: "diretoria",
                title: activeLang === "en" ? `${presData.name} (President)` : `${presData.name} (Presidente)`,
                preview: introContent,
              });
            }

            const welcomeContent = activeLang === "en"
              ? "Welcome to FC Career Manager!\n\nYou've completed the welcome missions and unlocked the full app. Your journey as a manager starts here — every decision matters, every season writes your story.\n\nWhat you can do now:\n• Board — chat with the president and club staff\n• News — generate and share career news with AI\n• Squad — track transfers, loans and contract renewals\n• Album — document special moments with photos and videos\n• Matches — follow games, results and season stats\n\nYour club president is already in the Board tab waiting to hear from you. Good luck, manager — football is waiting."
              : "Bem-vindo ao FC Career Manager!\n\nVocê completou as missões de boas-vindas e desbloqueou o aplicativo completo. Aqui começa a sua jornada como treinador — cada decisão importa, cada temporada escreve a sua história.\n\nO que você pode fazer agora:\n• Diretoria — converse com o presidente e os membros da comissão do clube\n• Notícias — gere e compartilhe notícias sobre a sua carreira com IA\n• Elenco — registre transferências, empréstimos e renovações de contrato\n• Álbum — documente momentos especiais com fotos e vídeos\n• Jogos — acompanhe partidas, resultados e estatísticas da temporada\n\nO presidente do seu clube já está na aba Diretoria aguardando o primeiro contato. Boa sorte, treinador — o futebol está esperando por você.";
            const welcomePost: NewsPost = {
              id: generatePostId(),
              careerId: career.id,
              source: "custom",
              sourceHandle: "@fccareerapp",
              sourceName: "FC Career Manager",
              sourcePhotoUrl: "/fcm-logo.png",
              content: welcomeContent,
              likes: 0,
              commentsCount: 0,
              sharesCount: 0,
              comments: [],
              createdAt: Date.now(),
              category: "conquista",
            };
            addNewsPost(activeSeasonId, welcomePost);
            addToast({
              type: "noticias",
              title: activeLang === "en" ? "FC Career Manager" : "FC Career Manager",
              preview: activeLang === "en"
                ? "Missions completed! Welcome to the full app."
                : "Missões concluídas! Bem-vindo ao app completo.",
            });
          };

          void runFreeUnlock();
        }
      }

      if (userPlan === "pro" && allMissionsForPlanDone(career.id, "pro")) {
        const proGuardKey = `fc_pro_congrats_fired_${career.id}`;
        if (!localStorage.getItem(proGuardKey)) {
          const president = getMembers(career.id).find((m) => m.role === "presidente");
          if (president) {
            localStorage.setItem(proGuardKey, "1");
            const proLang = localStorage.getItem("fc_lang") ?? "pt";
            const content = proLang === "en"
              ? `Congratulations, manager! You've completed all the plan missions and shown a high level of commitment to ${career.clubName}. The club is growing and I'm very pleased with your work. Keep it up — great achievements are ahead!`
              : `Parabéns, treinador! Você concluiu todas as missões do plano e demonstrou alto nível de comprometimento com o ${career.clubName}. O clube está evoluindo e estou muito satisfeito com o seu trabalho. Continue nesse ritmo — grandes conquistas estão por vir!`;
            const congratsMsg: DiretoriaMessage = {
              id: generateMessageId(),
              role: "character",
              content,
              timestamp: Date.now(),
            };
            const existing = getConversation(career.id, president.id);
            saveConversation(career.id, president.id, [...existing, congratsMsg]);
            addNotification(career.id, { memberId: president.id, preview: content, triggeredAt: Date.now() });
          }
        }
      }

      if (userPlan === "ultra" && allMissionsForPlanDone(career.id, "ultra")) {
        const ultraGuardKey = `fc_ultra_congrats_fired_${career.id}`;
        if (!localStorage.getItem(ultraGuardKey)) {
          const president = getMembers(career.id).find((m) => m.role === "presidente");
          if (president) {
            localStorage.setItem(ultraGuardKey, "1");
            const ultraLang = localStorage.getItem("fc_lang") ?? "pt";
            const content = ultraLang === "en"
              ? `Impressive, manager! You've completed every mission at the highest level. ${career.clubName} has an elite manager at the helm. The fans and the entire board are proud of what you've built here. Keep up this dedication — the future of this club is bright!`
              : `Impressionante, treinador! Você completou todas as missões no mais alto nível. O ${career.clubName} tem um técnico de elite no comando. A torcida e toda a diretoria estão orgulhosas do que você construiu aqui. Continue com essa dedicação — o futuro deste clube é brilhante!`;
            const congratsMsg: DiretoriaMessage = {
              id: generateMessageId(),
              role: "character",
              content,
              timestamp: Date.now(),
            };
            const existing = getConversation(career.id, president.id);
            saveConversation(career.id, president.id, [...existing, congratsMsg]);
            addNotification(career.id, { memberId: president.id, preview: content, triggeredAt: Date.now() });
          }
        }
      }
    };

    window.addEventListener(FC_MISSION_COMPLETE_EVENT, handler);
    return () => window.removeEventListener(FC_MISSION_COMPLETE_EVENT, handler);
  }, [career.id, career.clubId, career.clubName, career.clubCountry, userPlan, activeSeasonId]);

  const cachedPhotoMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of getAllCachedPlayers()) {
      if (p.photo) map.set(p.id, p.photo);
    }
    for (const t of transfers) {
      if (t.playerPhoto && t.playerId) map.set(t.playerId, t.playerPhoto);
    }
    return map;
  }, [transfers]);

  const transferredPlayers: SquadPlayer[] = transfers.map((t) => {
    const pos = migratePositionOverride(t.playerPositionPtBr) ?? "MID";
    return {
      id: t.playerId,
      name: overrides[t.playerId]?.nameOverride ?? t.playerName,
      age: t.playerAge,
      position: PT_BR_TO_POSITION[pos] ?? "Midfielder",
      positionPtBr: pos,
      photo: overrides[t.playerId]?.photoOverride || t.playerPhoto || cachedPhotoMap.get(t.playerId) || "",
      number: overrides[t.playerId]?.shirtNumber ?? t.shirtNumber,
    };
  });

  const squadPlayers: SquadPlayer[] = (squad?.players ?? []).map((p) => {
    const ovr = overrides[p.id];
    const posOvr = ovr?.positionOverride
      ? migratePositionOverride(ovr.positionOverride)
      : undefined;
    return {
      ...p,
      photo: ovr?.photoOverride || p.photo || cachedPhotoMap.get(p.id) || "",
      name: ovr?.nameOverride ?? p.name,
      number: ovr?.shirtNumber ?? p.number,
      ...(posOvr ? { positionPtBr: posOvr, position: PT_BR_TO_POSITION[posOvr] ?? p.position } : {}),
    };
  });

  // Only effective (non-pending) transfers affect the squad
  const effectiveTransfers = transfers.filter((t) => !t.windowPending);

  const soldPlayerIds = new Set(
    effectiveTransfers.filter((t) => t.type === "venda").map((t) => t.playerId),
  );
  const soldPlayerNames = new Set(
    effectiveTransfers
      .filter((t) => t.type === "venda" && !effectiveTransfers.find((c) => (!c.type || c.type === "compra") && c.playerId === t.playerId))
      .map((t) => t.playerName.toLowerCase().trim()),
  );

  const loanedOutIds = new Set(
    effectiveTransfers
      .filter((t) => t.type === "emprestimo" && t.loanDirection === "saida" && !t.loanEnded)
      .map((t) => t.playerId),
  );
  const loanedOutNames = new Set(
    effectiveTransfers
      .filter((t) => t.type === "emprestimo" && t.loanDirection === "saida" && !t.loanEnded)
      .map((t) => t.playerName.toLowerCase().trim()),
  );

  const removedIds = new Set([...soldPlayerIds, ...loanedOutIds]);
  const removedNames = new Set([...soldPlayerNames, ...loanedOutNames]);

  // Pending incoming transfers don't join the squad yet
  const effectiveTransferredPlayers = transferredPlayers.filter(
    (p) => !effectiveTransfers.find((t) => t.windowPending && t.playerId === p.id)
  );

  const existingIds = new Set(squadPlayers.map((p) => p.id));
  const newTransferredPlayers = effectiveTransferredPlayers.filter(
    (p) => !existingIds.has(p.id) && !removedIds.has(p.id),
  );

  const [formerPlayers, setFormerPlayers] = useState<SquadPlayer[]>(
    () => getFormerPlayers(career.id)
  );

  const [customPlayers, setCustomPlayers] = useState<SquadPlayer[]>(
    () => getCustomPlayers(career.id)
  );

  const handleCustomPlayersChange = useCallback((players: SquadPlayer[]) => {
    setCustomPlayers(players);
  }, []);

  const allPlayers = useMemo(() => {
    const customNames = new Set(customPlayers.map((p) => p.name.toLowerCase().trim()));
    const base = [
      ...squadPlayers.filter(
        (p) =>
          !removedIds.has(p.id) &&
          !removedNames.has(p.name.toLowerCase().trim()) &&
          !customNames.has(p.name.toLowerCase().trim()),
      ),
      ...newTransferredPlayers.filter((p) => !customNames.has(p.name.toLowerCase().trim())),
    ];
    const baseIds = new Set(base.map((p) => p.id));
    const extra = customPlayers.filter((p) => !baseIds.has(p.id) && !removedIds.has(p.id));
    return [...base, ...extra];
  }, [squadPlayers, removedIds, removedNames, newTransferredPlayers, customPlayers]);

  const handlePlayerRemoved = useCallback(() => {
    setFormerPlayers(getFormerPlayers(career.id));
  }, [career.id]);

  const handleImportSquad = useCallback((players: SquadPlayer[]) => {
    consolidateSquadForNewSeason(teamId, career.clubName, players);
    setSquad({
      players,
      source: squad?.source ?? "api-football",
      cachedAt: Date.now(),
    });
  }, [teamId, career.clubName, squad?.source]);

  const handlePlayerLeftInTrade = useCallback((player: SquadPlayer) => {
    addFormerPlayer(career.id, player);
    setFormerPlayers(getFormerPlayers(career.id));
  }, [career.id]);

  const allPlayersWithFormer = useMemo(() => {
    const currentIds = new Set(allPlayers.map((p) => p.id));
    return [
      ...allPlayers,
      ...formerPlayers.filter((p) => !currentIds.has(p.id)),
    ];
  }, [allPlayers, formerPlayers]);

  // Transfers from ALL seasons — used to reconstruct player data for historical views.
  const allCareerTransfers = useMemo(
    () => seasons.flatMap((s) => getTransfers(s.id)),
    [seasons],
  );

  // The most comprehensive possible player list for the career:
  // current squad + explicitly tracked former players + every player found in
  // any transfer record across ALL seasons + all squad-cache snapshots.
  // Used for match detail and finalized-season views so sold/former players
  // never disappear from historical data.
  const allTimeCareerPlayers = useMemo(() => {
    const map = new Map<number, SquadPlayer>(allPlayersWithFormer.map((p) => [p.id, p]));
    // Squad cache (all teams/clubs ever stored in localStorage)
    for (const p of getAllCachedPlayers()) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    // Every player who appeared in any transfer record across all seasons
    for (const t of allCareerTransfers) {
      if (!map.has(t.playerId)) {
        const pos = migratePositionOverride(t.playerPositionPtBr) ?? "MID";
        map.set(t.playerId, {
          id: t.playerId,
          name: t.playerName,
          age: t.playerAge,
          position: PT_BR_TO_POSITION[pos] ?? "Midfielder",
          positionPtBr: pos,
          photo: t.playerPhoto ?? "",
          number: t.shirtNumber,
        });
      }
    }
    return Array.from(map.values());
  }, [allPlayersWithFormer, allCareerTransfers]);

  // ─── Best-effort backfill: add playerSnapshot to old matches that lack it ───
  useEffect(() => {
    if (!dbSynced || seasons.length === 0 || backfillDoneRef.current) return;
    if (allTimeCareerPlayers.length === 0) return;
    backfillDoneRef.current = true;

    const playerMap = new Map<number, { name: string; photo: string; positionPtBr: string; number?: number }>(
      allTimeCareerPlayers.map((p) => [
        p.id,
        { name: p.name, photo: p.photo ?? "", positionPtBr: p.positionPtBr ?? "", number: p.number },
      ])
    );

    let activeSeasonNeedsRefresh = false;

    for (const season of seasons) {
      const seasonMatches = getMatches(season.id);
      for (const match of seasonMatches) {
        const hasSnapshot = match.playerSnapshot && Object.keys(match.playerSnapshot).length > 0;
        if (hasSnapshot) continue;

        const allPlayerIds = [...(match.starterIds ?? []), ...(match.subIds ?? [])];
        const snapshot: Record<number, { name: string; photo: string; positionPtBr: string; number?: number }> = {};

        for (const pid of allPlayerIds) {
          const player = playerMap.get(pid);
          if (!player) continue;
          snapshot[pid] = player;
        }

        if (Object.keys(snapshot).length === 0) continue;

        updateMatch(season.id, { ...match, playerSnapshot: snapshot });
        if (season.id === activeSeasonId) activeSeasonNeedsRefresh = true;
      }
    }

    if (activeSeasonNeedsRefresh) {
      setMatches(getMatches(activeSeasonId));
    }

    if (dbSynced) {
      setNoticiasPosts(getNoticiaPosts(activeSeasonId));
    }
  }, [dbSynced, seasons, allTimeCareerPlayers, activeSeasonId]);

  // For the elenco (squad) display in historical (read-only) seasons, include former
  // players who were NOT sold/loaned out in that specific season — they were still
  // squad members during that season.
  const elencoPlayers = useMemo(() => {
    if (!isReadOnly) return allPlayers;
    const currentIds = new Set(allPlayers.map((p) => p.id));
    return [
      ...allPlayers,
      ...formerPlayers.filter(
        (p) => !currentIds.has(p.id) && !removedIds.has(p.id) && !removedNames.has(p.name.toLowerCase().trim())
      ),
    ];
  }, [allPlayers, formerPlayers, removedIds, removedNames, isReadOnly]);

  // For finalized seasons: build the list of players who played ≥ 1 minute,
  // with the ones who left the club flagged for dimmed display.
  const finalizedSquadData = useMemo(() => {
    const seasonFinalized = !!seasons.find((s) => s.id === activeSeasonId)?.finalized;
    if (!seasonFinalized) return null;
    const stats = getAllPlayerStats(activeSeasonId);

    // Use the most comprehensive player map available so players who left the
    // club (even without going through explicit transfer flow) still appear.
    const playerMap = new Map(allTimeCareerPlayers.map((p) => [p.id, p]));

    const players = Object.entries(stats)
      .filter(([, s]) => s.totalMinutes >= 1)
      .map(([id]) => playerMap.get(Number(id)))
      .filter((p): p is SquadPlayer => p != null);
    const leftIds = new Set(players.filter((p) => removedIds.has(p.id)).map((p) => p.id));
    return { finalizedPlayers: players, finalizedLeftIds: leftIds, finalizedSeasonStats: stats };
  }, [seasons, activeSeasonId, allTimeCareerPlayers, removedIds]);

  const handleWindowToggle = useCallback(() => {
    if (transferWindow.open) {
      // Closing window
      const next = { open: false, openCount: transferWindow.openCount };
      saveTransferWindow(activeSeasonId, next);
      setTransferWindow(next);
    } else {
      // Opening window — activate all pending transfers
      if (transferWindow.openCount >= 2) return;
      const next = { open: true, openCount: transferWindow.openCount + 1 };
      saveTransferWindow(activeSeasonId, next);
      setTransferWindow(next);

      setTransfers((prev) => {
        const pendingOuts = prev.filter(
          (t) => t.windowPending && (t.type === "venda" || (t.type === "emprestimo" && t.loanDirection === "saida"))
        );
        for (const t of pendingOuts) {
          const player = allPlayers.find((p) => p.id === t.playerId);
          if (player) addFormerPlayer(career.id, player);
        }
        if (pendingOuts.length > 0) {
          setFormerPlayers(getFormerPlayers(career.id));
        }
        const activated = prev.map((t) => t.windowPending ? { ...t, windowPending: false } : t);
        saveTransfers(activeSeasonId, activated);
        return activated;
      });
    }
  }, [activeSeasonId, allPlayers, career.id, transferWindow]);

  const handleTransferAdded = useCallback((transfer: TransferRecord) => {
    addTransfer(activeSeasonId, transfer);
    setTransfers((prev) => [...prev, transfer]);
  }, [activeSeasonId]);

  const handleTransferUpdated = useCallback((id: string, changes: Partial<TransferRecord>) => {
    updateTransfer(activeSeasonId, id, changes);
    setTransfers((prev) => prev.map((t) => t.id === id ? { ...t, ...changes } : t));
  }, [activeSeasonId]);

  const handleNewPost = useCallback((post: NewsPost) => {
    const title = post.title ?? "Nova notícia";
    const preview = post.sourceName ?? post.source ?? "Notícias";
    addToast({ type: "noticias", title, preview });
    setNoticiasUnread((prev) => prev + 1);
    window.dispatchEvent(new CustomEvent<NoticiaGeneratedDetail>(FC_NOTICIA_GENERATED_EVENT, {
      detail: { post, seasonId: activeSeasonId, isAutoGenerated: true },
    }));
  }, [addToast, activeSeasonId]);

  const handleHighValueSigning = useCallback((playerName: string, ovr: number, position: string, fromClub?: string, deltaVsAvg?: number, isPending?: boolean) => {
    const headers = getAiHeaders();
    const fromClubStr = fromClub ? ` do ${fromClub}` : " de jogador livre";
    const deltaStr = deltaVsAvg != null && deltaVsAvg > 0 ? `, ${deltaVsAvg} pontos acima da média do elenco` : "";
    const seasonLabel = seasons.find((s) => s.id === activeSeasonId)?.label ?? career.season;
    const windowCtx = isPending
      ? ` A janela de transferências está FECHADA — o jogador ainda não se apresentou e só estará disponível quando a janela abrir.`
      : ` A janela de transferências está ABERTA — o jogador já está disponível no elenco.`;
    void fetch("/api/noticias/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({
        description: `${career.clubName} anuncia a contratação de ${playerName} (${position}, OVR ${ovr})${fromClubStr}${deltaStr}. Um reforço de alto nível que eleva o patamar do elenco.${windowCtx}`,
        clubName: career.clubName,
        season: seasonLabel,
        source: "espn",
        category: "transferencia",
        clubLeague: effectiveLeague || undefined,
        currentCompetitions: currentCompetitions.length ? currentCompetitions : undefined,
        clubDescription: career.clubDescription || undefined,
        projeto: career.projeto || undefined,
        lang: localStorage.getItem("fc_lang") ?? "pt",
      }),
    }).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json() as {
        source: string; sourceHandle: string; sourceName: string; category: string;
        title?: string; content: string; likes: number; commentsCount: number; sharesCount: number;
        comments: Array<{ username: string; displayName: string; content: string; likes: number; personality?: string; replies?: unknown[] }>;
      };
      const { generatePostId, generateCommentId, addPost } = await import("@/lib/noticiaStorage");
      const post: NewsPost = {
        id: generatePostId(),
        careerId: career.id,
        source: (data.source as NewsPost["source"]) ?? "espn",
        sourceHandle: data.sourceHandle,
        sourceName: data.sourceName,
        title: data.title,
        content: data.content,
        likes: data.likes ?? 0,
        commentsCount: data.commentsCount ?? 0,
        sharesCount: data.sharesCount ?? 0,
        comments: (data.comments ?? []).map((c) => ({
          id: generateCommentId(),
          username: c.username,
          displayName: c.displayName,
          content: c.content,
          likes: c.likes ?? 0,
          personality: c.personality as NewsPost["comments"][number]["personality"],
          replies: [],
          createdAt: Date.now(),
        })),
        category: "transferencia",
        createdAt: Date.now(),
      };
      addPost(activeSeasonId, post);
      handleNewPost(post);
    }).catch(() => {});
  }, [activeSeasonId, career.id, career.clubName, career.clubLeague, career.clubDescription, career.projeto, career.season, career.competitions, seasons, handleNewPost]);

  const runDiretoriaTriggers = useCallback(async (updatedMatches: MatchRecord[], currentAllPlayers: SquadPlayer[], isClassico?: boolean, rivalName?: string, fanMood?: number, fanMoodLabelStr?: string, boardMood?: number, boardMoodLabelStr?: string) => {
    const members = getMembers(career.id);
    if (members.length === 0) return;

    const matchCount = updatedMatches.length;
    const cooldowns = getMemberCooldowns(career.id, activeSeasonId);
    const MIN_MATCHES_BETWEEN_NOTIFS = 3;

    const eligibleMembers = members
      .filter((m) => (cooldowns[m.id] ?? -99) <= matchCount - MIN_MATCHES_BETWEEN_NOTIFS)
      .map((m) => ({
        id: m.id,
        name: m.name,
        roleLabel: m.roleLabel,
        description: m.description,
        mood: m.mood,
        patience: m.patience,
      }));

    const leaguePos = getLeaguePosition(activeSeasonId);
    const finSettings = getFinanceiroSettings(activeSeasonId);
    const finSnapshot = computeFinancialSnapshot(finSettings, transfers, getAllPlayerOverrides(career.id));
    const prevMatch = updatedMatches.slice(-2, -1)[0];
    const lastCheckedAt = prevMatch?.createdAt ?? 0;

    const recentMatches = updatedMatches.slice(-10).reverse().map((m) => ({
      opponent: m.opponent,
      myScore: m.myScore,
      opponentScore: m.opponentScore,
      result: m.myScore > m.opponentScore ? "vitoria" as const
              : m.myScore < m.opponentScore ? "derrota" as const
              : "empate" as const,
      tournament: m.tournament,
      date: m.date,
      createdAt: m.createdAt,
    }));

    const context = {
      clubName: career.clubName,
      clubLeague: effectiveLeague,
      currentCompetitions: currentCompetitions.length ? currentCompetitions : undefined,
      season: career.season,
      coachName: career.coach.name,
      squadSize: currentAllPlayers.length,
      transfersCount: transfers.length,
      recentMatches,
      leaguePosition: leaguePos,
      transferBudget: finSettings.transferBudget > 0 ? finSettings.transferBudget : undefined,
      remainingTransferBudget: finSettings.transferBudget > 0 ? finSnapshot.remainingTransferBudget : undefined,
      currentWageBill: finSettings.salaryBudget > 0 ? finSnapshot.currentWageBill : undefined,
      salaryBudget: finSettings.salaryBudget > 0 ? finSettings.salaryBudget : undefined,
      wageRoom: finSettings.salaryBudget > 0 ? finSnapshot.wageRoom : undefined,
      netSpend: finSettings.transferBudget > 0 ? finSnapshot.netSpend : undefined,
      projeto: career.projeto,
    };

    const playerPerf = buildPlayerPerformanceContext(activeSeasonId, currentAllPlayers, career.id);
    const squadOvrCtx = buildSquadOvrContext(currentAllPlayers, getAllPlayerOverrides(career.id));
    const headers = getAiHeaders();

    try {
      const res = await fetch("/api/diretoria/check-triggers", {
        method: "POST",
        headers,
        body: JSON.stringify({
          context,
          members: eligibleMembers,
          lastCheckedAt,
          playerPerformance: playerPerf.length > 0 ? playerPerf : undefined,
          squadOvrContext: squadOvrCtx || undefined,
          isClassico: isClassico || undefined,
          rivalName: rivalName || undefined,
          fanMoodScore: fanMood ?? undefined,
          fanMoodLabel: fanMoodLabelStr ?? undefined,
          boardMoodScore: boardMood ?? undefined,
          boardMoodLabel: boardMoodLabelStr ?? undefined,
          boardCrisisStreak: getBoardCrisisStreak(activeSeasonId),
          lang: localStorage.getItem("fc_lang") ?? "pt",
        }),
      });
      if (!res.ok) return;
      const data = await res.json() as {
        notifications: { memberId: string; preview: string }[];
        meetingTrigger: { reason: string; severity: "low" | "medium" | "high" } | null;
      };

      if (data.notifications?.length) {
        for (const n of data.notifications) {
          addNotification(career.id, { memberId: n.memberId, preview: n.preview, triggeredAt: Date.now() });
          saveDiretoriaNotificationAsChatMessage(career.id, n.memberId, n.preview);
          setMemberCooldown(career.id, activeSeasonId, n.memberId, matchCount);
          const member = members.find((m) => m.id === n.memberId);
          addToast({ type: "diretoria", title: member?.name ?? "Diretoria", preview: n.preview });
        }
        setDiretoriaUnread(countUnreadDiretoria(career.id));

        const firstNotif = data.notifications[0];
        if (firstNotif && Math.random() < 0.20) {
          void fetchPortals(career.id).then((customPortals) => {
            const jornalistico = customPortals.find((p) => p.tone === "jornalistico");
            if (!jornalistico) return;
            const headers = getAiHeaders();
            const triggerMember = members.find((m) => m.id === firstNotif.memberId);
            const meetingTriggerReason = data.meetingTrigger?.reason || undefined;
            void fetch("/api/noticias/generate-leak", {
              method: "POST",
              headers,
              body: JSON.stringify({
                clubName: career.clubName,
                season: career.season,
                clubLeague: effectiveLeague || undefined,
                currentCompetitions: currentCompetitions.length ? currentCompetitions : undefined,
                notificationPreview: firstNotif.preview,
                memberName: triggerMember?.name || undefined,
                meetingReason: meetingTriggerReason,
                customPortal: {
                  id: jornalistico.id,
                  name: jornalistico.name,
                  description: jornalistico.description,
                  tone: jornalistico.tone,
                },
                lang: localStorage.getItem("fc_lang") ?? "pt",
              }),
            }).then(async (leakRes) => {
              if (!leakRes.ok) return;
              const leakData = await leakRes.json() as {
                source: string; sourceHandle: string; sourceName: string;
                title?: string; content: string;
                likes: number; commentsCount: number; sharesCount: number;
                comments: Array<{ username: string; displayName: string; content: string; likes: number; personality?: string }>;
              };
              const leakPost: NewsPost = {
                id: generatePostId(),
                careerId: career.id,
                source: (leakData.source as NewsPost["source"]) ?? "custom",
                sourceHandle: leakData.sourceHandle,
                sourceName: leakData.sourceName,
                title: leakData.title,
                content: leakData.content,
                likes: leakData.likes ?? 0,
                commentsCount: leakData.commentsCount ?? 0,
                sharesCount: leakData.sharesCount ?? 0,
                comments: (leakData.comments ?? []).map((c) => ({
                  id: generateCommentId(),
                  username: c.username,
                  displayName: c.displayName,
                  content: c.content,
                  likes: c.likes ?? 0,
                  personality: c.personality as NewsPost["comments"][number]["personality"],
                  replies: [],
                  createdAt: Date.now(),
                })),
                category: "geral",
                createdAt: Date.now(),
                postTag: "leak",
                customPortalId: jornalistico.id,
              };
              addNewsPost(activeSeasonId, leakPost);
              handleNewPost(leakPost);
            }).catch(() => {});
          });
        }
      }

      if (data.meetingTrigger) {
        setPendingMeetingTrigger(career.id, data.meetingTrigger);
      }
    } catch {
    }
  }, [career.id, career.clubName, career.clubLeague, career.season, career.coach.name, career.projeto, career.competitions, activeSeasonId, seasons, transfers, addToast, handleNewPost]);

  const handleMatchUpdated = useCallback((match: MatchRecord) => {
    setMatches((prev) => prev.map((m) => m.id === match.id ? match : m));
  }, []);

  const handleMatchAdded = useCallback((match: MatchRecord) => {
    // Mission: free_log_match
    if (!isMissionComplete(career.id, "free_log_match")) {
      completeMission(career.id, "free_log_match");
    }
    // Teaser: show diretoria reaction for Free users
    const planLimitsCheck = getPlanLimits(userPlan);
    if (!planLimitsCheck.diretoriaEnabled) {
      setActiveTeaserTrigger("after_match_diretoria");
    }

    const updatedMatches = [...matches, match];
    setMatches(updatedMatches);
    setTimeout(() => runPerformanceEngine(activeSeasonId), 50);

    const seasonLabel = seasons.find((s) => s.id === activeSeasonId)?.label ?? activeSeasonLabel;
    const leaguePos = getLeaguePosition(activeSeasonId);

    const rivals = getRivals(activeSeasonId);
    const rivalName = rivals.find(
      (r) => r.toLowerCase() === match.opponent.toLowerCase(),
    ) ?? undefined;
    const isClassico = rivalName != null;

    const currentMood = getFanMood(activeSeasonId);
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let unbeatenStreak = 0;
    for (let i = sortedMatches.length - 1; i >= 0; i--) {
      const m = sortedMatches[i];
      if (m.myScore > m.opponentScore || m.myScore === m.opponentScore) {
        unbeatenStreak++;
      } else {
        break;
      }
    }
    const moodDelta = computeFanMoodDelta(match.myScore, match.opponentScore, isClassico, unbeatenStreak);
    const newMoodScore = Math.max(0, Math.min(100, currentMood + moodDelta));
    void setFanMood(activeSeasonId, newMoodScore);
    setFanMoodScore(newMoodScore);
    const moodInfo = getFanMoodLabel(newMoodScore, lang);

    const squadAvgOvr = calcSquadAvgOvr(allPlayers, getAllPlayerOverrides(career.id));
    const currentBoardMood = getBoardMood(activeSeasonId);
    const boardDelta = computeBoardMoodDelta({
      myScore: match.myScore,
      opponentScore: match.opponentScore,
      isClassico,
      matchCount: updatedMatches.length,
      squadAvgOvr,
      league: effectiveLeague,
      projeto: career.projeto,
      leaguePosition: leaguePos ? { position: leaguePos.position ?? 0, totalTeams: leaguePos.totalTeams ?? 20 } : null,
    });
    const newBoardMoodScore = Math.max(0, Math.min(100, currentBoardMood + boardDelta));
    void setBoardMood(activeSeasonId, newBoardMoodScore);
    setBoardMoodScore(newBoardMoodScore);
    const boardMoodInfo = getBoardMoodLabel(newBoardMoodScore, lang);

    const prevCrisisStreak = getBoardCrisisStreak(activeSeasonId);
    const newCrisisStreak = newBoardMoodScore < 20 ? prevCrisisStreak + 1 : 0;
    setBoardCrisisStreak(activeSeasonId, newCrisisStreak);

    // Cup objective failure detection
    const isCupLoss = match.myScore < match.opponentScore || (match.penaltyShootout && match.penaltyShootout.myScore < match.penaltyShootout.opponentScore);
    if (isCupLoss) {
      const currentObjectives = getSeasonObjectives(activeSeasonId);
      const pendingCupObjectives = currentObjectives.filter(
        (o) => o.status === "pending" && o.type === "cup_round" && o.competition && match.tournament.toLowerCase().includes(o.competition.toLowerCase()),
      );
      if (pendingCupObjectives.length > 0) {
        let updatedBoardScore = newBoardMoodScore;
        for (const obj of pendingCupObjectives) {
          const severity = computeCupFailureSeverity(
            obj.target,
            match.stage,
            squadAvgOvr,
            null,
          );
          const penalty = severityBoardPenalty(severity);
          const updatedObjs = markObjectiveFailed(activeSeasonId, obj.id, severity, updatedMatches.length);
          setSeasonObjectives(updatedObjs);
          updatedBoardScore = Math.max(0, Math.min(100, updatedBoardScore - penalty));
        }
        if (updatedBoardScore !== newBoardMoodScore) {
          void setBoardMood(activeSeasonId, updatedBoardScore);
          setBoardMoodScore(updatedBoardScore);
        }
      }
    }

    const planLimits = getPlanLimits(userPlan);

    if (planLimits.autoNewsEnabled && getAutoNewsEnabled(career.id)) {
      void runAutoNews(match, {
        careerId: career.id,
        seasonId: activeSeasonId,
        season: seasonLabel,
        clubName: career.clubName,
        clubLeague: effectiveLeague,
        currentCompetitions: currentCompetitions.length ? currentCompetitions : undefined,
        clubTitles: career.clubTitles,
        clubDescription: career.clubDescription,
        projeto: career.projeto,
        allMatches: updatedMatches,
        allPlayers,
        leaguePosition: leaguePos,
        rivals,
        fanMoodScore: newMoodScore,
        fanMoodLabel: `${moodInfo.emoji} ${moodInfo.label}`,
        onNewPost: handleNewPost,
      });
    }

    setTimeout(() => {
      void runDiretoriaTriggers(updatedMatches, allPlayers, isClassico, rivalName, newMoodScore, `${moodInfo.emoji} ${moodInfo.label}`, newBoardMoodScore, `${boardMoodInfo.emoji} ${boardMoodInfo.label}`);
    }, 1500);

    if (planLimits.autoNewsEnabled && getAutoNewsEnabled(career.id)) {
      setTimeout(() => {
        void fetchPortals(career.id).then((customPortals) => {
          void runRumorNews({
            careerId: career.id,
            seasonId: activeSeasonId,
            season: seasonLabel,
            clubName: career.clubName,
            clubLeague: effectiveLeague,
            currentCompetitions: currentCompetitions.length ? currentCompetitions : undefined,
            clubDescription: career.clubDescription,
            projeto: career.projeto,
            allMatches: updatedMatches,
            allPlayers,
            customPortals,
            fanMoodScore: newMoodScore,
            fanMoodLabel: `${moodInfo.emoji} ${moodInfo.label}`,
            onNewPost: handleNewPost,
          });
        });
      }, 3000);
    }
  }, [activeSeasonId, matches, allPlayers, seasons, activeSeasonLabel, career.id, career.clubName, career.clubLeague, career.clubTitles, career.clubDescription, career.projeto, career.competitions, runDiretoriaTriggers, handleNewPost]);

  const handleNewSeasonConfirm = useCallback(async (label: string, competitions: string[], objectives: SeasonObjective[]) => {
    setCreatingNewSeason(true);
    try {
      const newId = generateSeasonId();
      copyPlayerMoodsToNewSeason(activeSeasonId, newId);

      // Archive every player from the current squad as a "former player" so
      // they always appear in multi-season historical stats, even if they leave
      // without going through the explicit transfer flow.
      const existingFormer = getFormerPlayers(career.id);
      const existingFormerIds = new Set(existingFormer.map((p) => p.id));
      const newFormerEntries = allPlayers.filter((p) => !existingFormerIds.has(p.id));
      if (newFormerEntries.length > 0) {
        saveFormerPlayers(career.id, [...existingFormer, ...newFormerEntries]);
        setFormerPlayers(getFormerPlayers(career.id));
      }

      // Consolidate the effective squad (sold players removed, bought players added)
      // into the cache BEFORE clearing transfers, so the next season inherits the
      // exact same squad that ended the previous one.
      consolidateSquadForNewSeason(teamId, career.clubName, allPlayers);
      ageSquadInCache(teamId, career.clubName);
      setSquad((prev) => ({
        players: allPlayers.map((p) => ({ ...p, age: p.age + 1 })),
        source: prev?.source ?? "api-football",
        cachedAt: Date.now(),
      }));

      const oldLeague = seasons.find((s) => s.id === activeSeasonId)?.competitions?.[0] ?? career.clubLeague ?? "";
      const newLeague = competitions[0] ?? "";

      const newSeason = await createSeason(career.id, label, competitions, true, newId);
      if (newSeason) {
        await activateSeason(newSeason.id);
        onSeasonChange(label);
        await loadSeasons();
        setActiveSeasonId(newSeason.id);
        setActiveSeasonLabel(label);
        setTransfers([]);
        setTransferWindow({ open: false, openCount: 0 });
        setMatches([]);
        setShowNewSeasonWizard(false);
        setShowSeasonModal(false);

        const prevLeaguePos = getLeaguePosition(activeSeasonId);
        const prevTop4 = prevLeaguePos && prevLeaguePos.position <= 4;
        const initialBoardMood = prevTop4 ? 60 : 50;
        void setBoardMood(newSeason.id, initialBoardMood);
        setBoardMoodScore(initialBoardMood);

        if (objectives.length > 0) {
          saveSeasonObjectives(newSeason.id, objectives);
          setSeasonObjectives(objectives);
        } else {
          setSeasonObjectives([]);
        }

        if (oldLeague && newLeague && oldLeague !== newLeague && leagueTierLevel(oldLeague) !== leagueTierLevel(newLeague) && getPlanLimits(userPlan).autoNewsEnabled && getAutoNewsEnabled(career.id)) {
          setTimeout(() => {
            void runPromotionRelegationNews({
              careerId: career.id,
              newSeasonId: newSeason.id,
              newSeasonLabel: label,
              clubName: career.clubName,
              clubDescription: career.clubDescription,
              projeto: career.projeto,
              oldLeague,
              newLeague,
              onNewPost: handleNewPost,
            });
          }, 2000);
        }
      }
    } finally {
      setCreatingNewSeason(false);
    }
  }, [activeSeasonId, allPlayers, career.id, career.clubName, career.clubLeague, career.clubDescription, career.projeto, seasons, teamId, loadSeasons, onSeasonChange, handleNewPost]);

  const activeSeason = seasons.find((s) => s.id === activeSeasonId);
  const displayLabel = activeSeason?.label ?? activeSeasonLabel;
  const effectiveLeague = activeSeason?.competitions?.[0] ?? career.clubLeague;
  const currentCompetitions = activeSeason?.competitions ?? career.competitions ?? [];
  const isFinalized = !!activeSeason?.finalized;

  const handleFinalizeSeason = useCallback((seasonId: string) => {
    setFinalizeTargetSeasonId(seasonId);
    setShowFinalizeModal(true);
  }, []);

  const handleFinalizeConfirm = useCallback(() => {
    if (!finalizeTargetSeasonId) return;
    setSeasons((prev) => prev.map((s) => s.id === finalizeTargetSeasonId ? { ...s, finalized: true } : s));
    setShowFinalizeModal(false);
    setFinalizeTargetSeasonId(null);
    setActiveTab("resumo");
  }, [finalizeTargetSeasonId]);

  if (!dbSynced) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "var(--club-primary)" }}>
        <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm opacity-60">{t.loadingCareer}</span>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {showSeasonModal && (
        <SeasonSelectModal
          seasons={seasons}
          activeSeasonId={activeSeasonId}
          onSelect={switchToSeason}
          onNewSeason={!isDemo ? () => { setShowSeasonModal(false); setShowNewSeasonWizard(true); } : undefined}
          onRenameSeason={(seasonId, newLabel) => {
            void updateSeasonLabel(seasonId, newLabel);
            setSeasons((prev) => prev.map((s) => s.id === seasonId ? { ...s, label: newLabel } : s));
            if (seasonId === activeSeasonId) setActiveSeasonLabel(newLabel);
          }}
          onFinalizeSeason={!isDemo ? handleFinalizeSeason : undefined}
          onClose={() => setShowSeasonModal(false)}
        />
      )}
      {showFinalizeModal && finalizeTargetSeasonId && (() => {
        const targetSeason = seasons.find((s) => s.id === finalizeTargetSeasonId);
        return (
          <FinalizeSeasonModal
            seasonId={finalizeTargetSeasonId}
            seasonLabel={targetSeason?.label ?? displayLabel}
            onFinalize={handleFinalizeConfirm}
            onCancel={() => { setShowFinalizeModal(false); setFinalizeTargetSeasonId(null); }}
          />
        );
      })()}
      {showNewSeasonWizard && (
        <NewSeasonWizard
          existingSeasons={seasons}
          currentCompetitions={activeSeason?.competitions ?? career.competitions}
          onConfirm={handleNewSeasonConfirm}
          onCancel={() => setShowNewSeasonWizard(false)}
          isLoading={creatingNewSeason}
        />
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <header
          className="relative w-full overflow-hidden glass"
          style={{ borderBottom: "1px solid var(--surface-border)" }}
        >
          <div
            className="absolute inset-0 opacity-15"
            style={{ backgroundImage: `radial-gradient(circle at 15% 50%, var(--club-primary) 0%, transparent 55%), radial-gradient(circle at 85% 50%, var(--club-secondary) 0%, transparent 55%)` }}
          />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5">
            <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
              <div className="flex items-center gap-2 min-w-0">
                {!isDemo && (
                  <>
                    <button
                      onClick={onGoToCareers}
                      className="flex items-center gap-1.5 text-white/40 hover:text-white/80 text-xs font-medium transition-colors duration-200 flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      {t.breadcrumb}
                    </button>
                    <span className="text-white/15 text-xs">/</span>
                  </>
                )}
                <div className="flex items-center gap-1.5 min-w-0">
                  <CoachAvatar career={career} />
                  <span className="text-white/50 text-xs font-medium truncate max-w-[100px] sm:max-w-32">{career.coach.name}</span>
                </div>
              </div>

              {!isDemo && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setActiveTab("configuracoes")}
                    className="flex items-center justify-center w-11 h-11 rounded-xl text-white/50 hover:text-white transition-all duration-200 glass glass-hover"
                    title={t.settingsTooltip}
                    style={activeTab === "configuracoes" ? { color: "var(--club-primary)", background: "rgba(var(--club-primary-rgb),0.1)" } : {}}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(var(--club-primary-rgb),0.1)", border: "1px solid rgba(var(--club-primary-rgb),0.15)", boxShadow: "0 0 30px rgba(var(--club-primary-rgb),0.1)" }}
                >
                  {logoUrl && !imgError ? (
                    <img
                      key={logoUrl}
                      ref={logoImgRef}
                      src={logoUrl}
                      alt={career.clubName}
                      className={`w-9 h-9 sm:w-12 sm:h-12 object-contain transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                      onLoad={() => setImgLoaded(true)}
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <span className="text-xl sm:text-2xl font-black text-white/40">{career.clubName.substring(0, 2).toUpperCase()}</span>
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight truncate">{career.clubName}</h1>
                  <p className="text-white/50 text-xs sm:text-sm">{effectiveLeague}</p>
                  {(career.clubStadium || career.clubFounded) && (
                    <p className="text-white/20 text-xs mt-0.5 truncate hidden sm:block">
                      {career.clubStadium && <span>{career.clubStadium}</span>}
                      {career.clubStadium && career.clubFounded && <span> · </span>}
                      {career.clubFounded && <span>{t.foundedIn} {career.clubFounded}</span>}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {(() => {
                  const moodInfo = getFanMoodLabel(fanMoodScore, lang);
                  const pct = Math.max(0, Math.min(100, fanMoodScore));
                  const boardInfo = getBoardMoodLabel(boardMoodScore, lang);
                  const bPct = Math.max(0, Math.min(100, boardMoodScore));
                  return (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg"
                        style={{
                          background: `${moodInfo.color}14`,
                          border: `1px solid ${moodInfo.color}30`,
                        }}
                        title={t.moodTooltip.replace("{label}", moodInfo.label).replace("{score}", String(fanMoodScore))}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs flex-shrink-0" style={{ lineHeight: 1 }}>{moodInfo.emoji}</span>
                          <span className="text-xs text-white/30 font-medium flex-shrink-0">{t.fanMoodLabel}</span>
                          <span className="text-xs font-semibold flex-shrink-0" style={{ color: moodInfo.color }}>{moodInfo.label}</span>
                          <div
                            className="relative flex-shrink-0 rounded-full overflow-hidden"
                            style={{
                              width: 48,
                              height: 4,
                              background: "linear-gradient(to right, #ef4444 0%, #f97316 25%, #eab308 50%, #22c55e 75%, #16a34a 100%)",
                            }}
                          >
                            <div
                              className="absolute inset-y-0 right-0"
                              style={{
                                width: `${100 - pct}%`,
                                background: "rgba(0,0,0,0.72)",
                                transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div
                        className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg"
                        style={{
                          background: `${boardInfo.color}14`,
                          border: `1px solid ${boardInfo.color}30`,
                        }}
                        title={t.boardMoodTooltip.replace("{label}", boardInfo.label).replace("{score}", String(boardMoodScore))}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs flex-shrink-0" style={{ lineHeight: 1 }}>{boardInfo.emoji}</span>
                          <span className="text-xs text-white/30 font-medium flex-shrink-0">{t.boardMoodLabel}</span>
                          <span className="text-xs font-semibold flex-shrink-0" style={{ color: boardInfo.color }}>{boardInfo.label}</span>
                          <div
                            className="relative flex-shrink-0 rounded-full overflow-hidden"
                            style={{
                              width: 48,
                              height: 4,
                              background: "linear-gradient(to right, #ef4444 0%, #f97316 25%, #eab308 50%, #22c55e 75%, #16a34a 100%)",
                            }}
                          >
                            <div
                              className="absolute inset-y-0 right-0"
                              style={{
                                width: `${100 - bPct}%`,
                                background: "rgba(0,0,0,0.72)",
                                transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40 text-xs">{t.seasonLabel}</span>
                  <button
                    onClick={() => setShowSeasonModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-sm text-white hover:bg-white/10 transition-colors duration-200 group glass"
                  >
                    {displayLabel}
                    {isReadOnly && !isDemo && (
                      <span className="text-xs font-normal text-white/40 px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)" }}>
                        {t.readOnlyBadge}
                      </span>
                    )}
                    <svg className="w-3 h-3 text-white/30 group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                {!isDemo && (
                  <button
                    onClick={onChangeClub}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] glass glass-hover"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    {t.swapClub}
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <div
          data-dashboard-nav="1"
          className="flex sticky top-0 z-30 flex-col"
          style={{ background: "rgba(var(--club-primary-rgb), 0.06)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid var(--surface-border)" }}
        >
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <div className="flex overflow-x-auto scrollbar-none snap-x" style={{ WebkitOverflowScrolling: "touch" }}>
              {isFinalized && (() => {
                const active = activeTab === "resumo";
                return (
                  <button
                    key="resumo"
                    onClick={() => handleTabChange("resumo")}
                    className="relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3.5 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 snap-start"
                    style={{ color: active ? "var(--club-primary)" : "rgba(255,255,255,0.35)" }}
                  >
                    <span style={{ color: active ? "var(--club-primary)" : "rgba(255,255,255,0.3)" }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    {!isNarrow && t.tabResumo}
                    {active && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                        style={{ background: "var(--club-primary)" }}
                      />
                    )}
                  </button>
                );
              })()}
              {TABS.filter((tab) => !isDemo || tab.id !== "configuracoes").map((tab) => {
                const active = activeTab === tab.id;
                const unreadCount =
                  tab.id === "diretoria" ? diretoriaUnread
                  : tab.id === "noticias" ? noticiasUnread
                  : 0;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className="relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3.5 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 snap-start"
                    style={{
                      color: active ? "var(--club-primary)" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    <span style={{ color: active ? "var(--club-primary)" : "rgba(255,255,255,0.3)" }}>
                      {tab.icon}
                    </span>
                    {!isNarrow && (tab.id === "painel" ? painelTabLabel : (tabLabels[tab.id] ?? tab.label))}
                    {tab.id === "transferencias" && transfers.length > 0 && (
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded-full tabular-nums min-w-[20px] text-center"
                        style={{
                          background: active ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.08)",
                          color: active ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {transfers.length}
                      </span>
                    )}
                    {!active && unreadCount > 0 && (
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded-full tabular-nums min-w-[20px] text-center"
                        style={{
                          background: "rgba(239,68,68,0.85)",
                          color: "#fff",
                        }}
                      >
                        {unreadCount}
                      </span>
                    )}
                    {active && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                        style={{ background: "var(--club-primary)" }}
                      />
                    )}
                  </button>
                );
              })}
              {/* Persistent mission "?" reopen button */}
              {showMissions && !showOnboardingEntry && !showUpgradeEntry && !isDemo && (
                <button
                  onClick={() => {
                    localStorage.setItem(`fc_widget_collapsed_${career.id}`, "0");
                    setShowMissions(true);
                    setMissionKey((k) => k + 1);
                  }}
                  className="ml-auto my-auto mr-1 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: "rgba(var(--club-primary-rgb),0.15)",
                    border: "1px solid rgba(var(--club-primary-rgb),0.3)",
                    color: "var(--club-primary)",
                  }}
                  title={lang === "en" ? "Missions" : "Missões"}
                >
                  ?
                </button>
              )}
            </div>
          </div>
        </div>

        {isReadOnly && !isDemo && (
          <div
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4"
          >
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-yellow-400/80">
                {t.readOnlyBannerPre}<strong>{displayLabel}</strong>{t.readOnlyBannerPost}
              </span>
              <button
                onClick={() => setShowSeasonModal(true)}
                className="ml-auto text-yellow-400/70 hover:text-yellow-400 text-xs font-semibold underline whitespace-nowrap"
              >
                {t.goToCurrent}
              </button>
            </div>
          </div>
        )}

        {activeTab === "painel" && noticiasPosts.length > 0 && (
          <div className="max-w-7xl mx-auto">
            <NewsTicker
              posts={tickerPosts}
              portalPhotos={portalPhotos}
              customPortalPhotos={customPortalPhotos}
              onClickPost={(postId) => {
                setFocusedPostId(postId);
                setActiveTab("noticias");
              }}
              lang={lang}
              clubLogoUrl={logoUrl}
            />
          </div>
        )}

        {activeTab === "clube" && (
          <div className="pb-0">
          <ClubeView
            careerId={career.id}
            seasonId={activeSeasonId}
            career={career}
            seasons={seasons}
            squad={squad}
            squadLoading={squadLoading}
            squadError={squadError}
            allPlayers={elencoPlayers}
            historicalPlayers={allTimeCareerPlayers}
            formerPlayers={formerPlayers}
            transfers={transfers}
            onRefresh={handleRefreshSquad}
            onOpenSettings={() => setActiveTab("configuracoes")}
            onOverridesUpdated={refreshOverrides}
            onPlayerRemoved={handlePlayerRemoved}
            onImportSquad={handleImportSquad}
            onCustomPlayersChange={handleCustomPlayersChange}
            isReadOnly={isReadOnly}
            isFinalized={isFinalized}
            finalizedPlayers={finalizedSquadData?.finalizedPlayers}
            finalizedLeftIds={finalizedSquadData?.finalizedLeftIds}
            finalizedSeasonStats={finalizedSquadData?.finalizedSeasonStats}
            isCustomClub={career.isCustomClub}
            isDemo={isDemo}
          />
          </div>
        )}
        {activeTab !== "clube" && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6 pb-6">
            {activeTab === "resumo" && isFinalized && (
              <SeasonSummaryView
                careerId={career.id}
                seasonId={activeSeasonId}
                seasonLabel={displayLabel}
                career={career}
                allPlayers={allTimeCareerPlayers}
                clubLogoUrl={logoUrl}
              />
            )}
            {activeTab === "painel" && (
              <>
                {seasonObjectives.length > 0 && (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
                    <SeasonObjectivesCard objectives={seasonObjectives} seasonLabel={displayLabel} />
                  </div>
                )}
                <PainelView
                  careerId={career.id}
                  seasonId={activeSeasonId}
                  clubName={career.clubName}
                  clubLogoUrl={logoUrl}
                  allPlayers={allTimeCareerPlayers}
                  squadSize={allPlayers.length}
                  season={displayLabel}
                  matches={matches}
                  transferCount={transfers.length}
                  competitions={activeSeason?.competitions ?? career.competitions}
                  isReadOnly={isReadOnly}
                  onNavigateToSettings={!isDemo ? () => setActiveTab("configuracoes") : undefined}
                />
              </>
            )}
            {activeTab === "partidas" && (
              <PartidasView
                careerId={career.id}
                seasonId={activeSeasonId}
                season={displayLabel}
                clubName={career.clubName}
                clubLogoUrl={logoUrl}
                matches={matches}
                allPlayers={allTimeCareerPlayers}
                onMatchAdded={handleMatchAdded}
                onMatchUpdated={handleMatchUpdated}
                competitions={activeSeason?.competitions ?? career.competitions}
                isReadOnly={isReadOnly}
              />
            )}
            {activeTab === "transferencias" && (
              <TransferenciasView
                careerId={career.id}
                seasonId={activeSeasonId}
                transfers={transfers}
                season={displayLabel}
                clubName={career.clubName}
                clubLogoUrl={logoUrl}
                allPlayers={allPlayers}
                onTransferAdded={handleTransferAdded}
                onTransferUpdated={handleTransferUpdated}
                onHighValueSigning={handleHighValueSigning}
                onPlayerLeftInTrade={handlePlayerLeftInTrade}
                transferWindowOpen={transferWindow.open}
                transferWindowOpenCount={transferWindow.openCount}
                onToggleWindow={!isReadOnly ? handleWindowToggle : undefined}
                isReadOnly={isReadOnly}
              />
            )}
            {activeTab === "noticias" && (
              <NoticiasView
                career={career}
                seasonId={activeSeasonId}
                allPlayers={allTimeCareerPlayers}
                matches={matches}
                pastSeasons={seasons.filter((s) => !s.isActive)}
                isReadOnly={isReadOnly}
                onGenerateBackground={handleNoticiaGenerateBackground}
                userPlan={userPlan}
                aiUsageToday={aiUsageToday}
                aiUsageLimit={aiUsageLimit}
                focusedPostId={focusedPostId}
                onClearFocusedPost={() => setFocusedPostId(undefined)}
                clubLogoUrl={logoUrl}
                isDemo={isDemo}
              />
            )}
            {activeTab === "diretoria" && (
              <DiretoriaView
                career={career}
                matches={matches}
                transfers={transfers}
                squadSize={allPlayers.length}
                allPlayers={allTimeCareerPlayers}
                effectiveLeague={effectiveLeague}
                currentCompetitions={currentCompetitions}
                userPlan={userPlan}
                freeMissionsDone={allMissionsForPlanDone(career.id, "free")}
                isDemo={isDemo}
              />
            )}
            {activeTab === "momentos" && (
              <MomentosView
                seasonId={activeSeasonId}
                allSeasonIds={seasons.map((s) => s.id)}
                isReadOnly={isReadOnly}
                allPlayers={allPlayers}
                highlightMomentoId={highlightMomentoId}
                onClearHighlight={() => setHighlightMomentoId(undefined)}
              />
            )}
            {activeTab === "configuracoes" && !isDemo && (
              <SettingsPage
                onReloadClubs={onReloadClubs}
                careerId={career.id}
                seasonId={activeSeasonId}
                onDeleteCareer={onDeleteCareer ? () => { deleteCareer(career.id); onDeleteCareer(); } : undefined}
                userPlan={userPlan}
              />
            )}
          </div>
        )}
      </div>
      {bgGenStatus !== "idle" && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300"
          style={{
            background: bgGenStatus === "done"
              ? "rgba(16,185,129,0.15)"
              : bgGenStatus === "error"
              ? "rgba(239,68,68,0.15)"
              : "rgba(18,14,31,0.95)",
            border: `1px solid ${bgGenStatus === "done" ? "rgba(16,185,129,0.35)" : bgGenStatus === "error" ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.12)"}`,
            backdropFilter: "blur(16px)",
            minWidth: 260,
            maxWidth: "90vw",
          }}
        >
          {bgGenStatus === "generating" && (
            <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" style={{ color: "var(--club-primary)" }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {bgGenStatus === "done" && (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#34d399" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {bgGenStatus === "error" && (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#f87171" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white/90 text-sm font-semibold leading-tight">
              {bgGenStatus === "generating" && t.bgGenGenerating}
              {bgGenStatus === "done" && t.bgGenDone}
              {bgGenStatus === "error" && t.bgGenError}
            </p>
            {bgGenLabel && (
              <p className="text-white/40 text-xs mt-0.5 truncate">{bgGenLabel}</p>
            )}
          </div>
          <button
            onClick={() => { if (bgGenTimerRef.current) clearTimeout(bgGenTimerRef.current); setBgGenStatus("idle"); }}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <NotificationToast toasts={toasts} onDismiss={dismissToast} />

      {/* Onboarding Entry — first time */}
      {showOnboardingEntry && (
        <OnboardingEntry
          plan={userPlan}
          clubName={career.clubName}
          clubLogoUrl={logoUrl}
          onDone={() => {
            markOnboardingSeen(career.id);
            setShowOnboardingEntry(false);
            setShowMissions(true);
          }}
        />
      )}

      {/* Plan Upgrade Entry */}
      {showUpgradeEntry && (
        <PlanUpgradeEntry
          oldPlan={upgradedFromPlan}
          newPlan={userPlan}
          onDone={() => {
            setShowUpgradeEntry(false);
            setShowMissions(true);
          }}
        />
      )}

      {/* Mission Widget */}
      {showMissions && !showOnboardingEntry && !showUpgradeEntry && !isDemo && (
        <MissionWidget
          key={missionKey}
          careerId={career.id}
          plan={userPlan}
          onNavigateTab={(tab) => handleTabChange(tab as CareerTab)}
        />
      )}

      {/* Curiosity Teasers */}
      {activeTeaserTrigger && (
        <CuriosityTeaser
          careerId={career.id}
          trigger={activeTeaserTrigger}
          onDismiss={() => setActiveTeaserTrigger(null)}
        />
      )}

      {/* Admin Notification Popup */}
      {pendingNotification && (
        <NotificationPopup
          notification={pendingNotification}
          onDismiss={() => setPendingNotification(null)}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 hidden"
        style={{
          background: "rgba(10,8,20,0.95)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-stretch">
          {(
            [
              {
                id: "painel" as CareerTab,
                label: painelTabLabel,
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                ),
                badge: 0,
              },
              {
                id: "partidas" as CareerTab,
                label: tabLabels["partidas"] ?? "partidas",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c0 0 2.5 4 2.5 9s-2.5 9-2.5 9M12 3c0 0-2.5 4-2.5 9s2.5 9 2.5 9M3 12h18" />
                  </svg>
                ),
                badge: 0,
              },
              {
                id: "clube" as CareerTab,
                label: tabLabels["clube"] ?? "clube",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
                badge: 0,
              },
              {
                id: "diretoria" as CareerTab,
                label: tabLabels["diretoria"] ?? "diretoria",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                ),
                badge: diretoriaUnread,
              },
            ] as { id: CareerTab; label: string; icon: React.ReactNode; badge: number }[]
          ).map(({ id, label, icon, badge }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => { handleTabChange(id); setShowMobileMore(false); }}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 relative"
                style={{ color: active ? "var(--club-primary)" : "rgba(255,255,255,0.4)" }}
              >
                {active && (
                  <span
                    className="absolute top-0 left-[15%] right-[15%] h-0.5 rounded-full"
                    style={{ background: "var(--club-primary)" }}
                  />
                )}
                <span className="relative">
                  {icon}
                  {!active && badge > 0 && (
                    <span
                      className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold px-0.5"
                      style={{ background: "rgba(239,68,68,0.9)", color: "#fff" }}
                    >
                      {badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium capitalize leading-none">{label}</span>
              </button>
            );
          })}
          {/* Mais / More */}
          {(() => {
            const moreActive = showMobileMore || ["transferencias", "noticias", "momentos", "configuracoes", "resumo"].includes(activeTab);
            const moreBadge = noticiasUnread + (transfers.length > 0 ? 1 : 0);
            return (
              <button
                onClick={() => setShowMobileMore((v) => !v)}
                aria-label={lang === "en" ? "More navigation options" : "Mais opções de navegação"}
                aria-expanded={showMobileMore}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 relative"
                style={{ color: moreActive ? "var(--club-primary)" : "rgba(255,255,255,0.4)" }}
              >
                {moreActive && (
                  <span
                    className="absolute top-0 left-[15%] right-[15%] h-0.5 rounded-full"
                    style={{ background: "var(--club-primary)" }}
                  />
                )}
                <span className="relative">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  {!moreActive && moreBadge > 0 && (
                    <span
                      className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold px-0.5"
                      style={{ background: "rgba(239,68,68,0.9)", color: "#fff" }}
                    >
                      {moreBadge > 9 ? "9+" : moreBadge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium leading-none">{lang === "en" ? "More" : "Mais"}</span>
              </button>
            );
          })()}
        </div>
      </nav>

      {/* Mobile More Sheet */}
      {showMobileMore && (
        <div
          className="fixed inset-0 z-[41] sm:hidden"
          onClick={() => setShowMobileMore(false)}
        >
          <div
            className="absolute bottom-4 left-2 right-2 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "rgba(12,10,22,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(
              [
                ...(isFinalized ? [{ id: "resumo" as CareerTab, label: t.tabResumo, badge: 0 }] : []),
                { id: "transferencias" as CareerTab, label: tabLabels["transferencias"] ?? "transferências", badge: transfers.length },
                { id: "noticias" as CareerTab, label: tabLabels["noticias"] ?? "notícias", badge: noticiasUnread },
                { id: "momentos" as CareerTab, label: tabLabels["momentos"] ?? "momentos", badge: 0 },
                ...(!isDemo ? [{ id: "configuracoes" as CareerTab, label: lang === "en" ? "Settings" : "Configurações", badge: 0 }] : []),
              ] as { id: CareerTab; label: string; badge: number }[]
            ).map(({ id, label, badge }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => { handleTabChange(id); setShowMobileMore(false); }}
                  className="w-full flex items-center justify-between px-5 py-3.5"
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    color: active ? "var(--club-primary)" : "rgba(255,255,255,0.75)",
                  }}
                >
                  <span className="font-medium capitalize">{label}</span>
                  {badge > 0 && (
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded-full tabular-nums min-w-[20px] text-center"
                      style={{
                        background: active ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(239,68,68,0.85)",
                        color: active ? "var(--club-primary)" : "#fff",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
