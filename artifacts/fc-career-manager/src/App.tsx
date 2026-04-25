import { useState, useEffect, useCallback } from "react";
import { ClubEntry } from "@/types/club";
import { Career } from "@/types/career";
import { CareerSelection } from "@/components/CareerSelection";
import { CreateCareerWizard } from "@/components/CreateCareerWizard";
import { Dashboard } from "@/components/Dashboard";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { LandingPage } from "@/components/LandingPage";
import { AuthPage } from "@/components/AuthPage";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { applyTheme, resetTheme, extractColorsFromImage } from "@/lib/themeManager";
import { getClubColors } from "@/lib/clubColors";
import { APIFOOTBALL_TO_FC26_NAME } from "@/lib/footballApiMap";
import { fetchSquadFromBackend } from "@/lib/squadCache";
import {
  fetchBackendClubList,
  getCachedClubList,
  getDbClubs,
  CACHE_KEY,
  clearClubCache,
  ApiRateLimitError,
} from "@/lib/clubListCache";
import { listCareers, saveCareer, migrateFromLegacy, updateCareerSeason, fetchCareersFromApi, AuthExpiredError, getEffectiveToken } from "@/lib/careerStorage";
import { sessionClear } from "@/lib/sessionStore";
import { PLAN_PROMOTION } from "@/lib/i18n";

const AUTH_TOKEN_KEY = "fc_auth_token";
const AUTH_USER_KEY = "fc_auth_user";
const IMPERSONATION_USER_KEY = "fc_impersonation_user";
const API_BASE = "/api";

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function ImpersonationBanner({ userName, onEnd }: { userName: string; onEnd: () => void }) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between px-4 py-2 gap-3"
      style={{ background: "rgba(234,179,8,0.95)", backdropFilter: "blur(8px)", boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <svg className="w-4 h-4 flex-shrink-0 text-yellow-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span className="text-yellow-900 font-bold text-xs truncate">
          Modo Admin — Visualizando como <span className="underline">{userName}</span>
        </span>
      </div>
      <button
        onClick={onEnd}
        className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold transition-all hover:opacity-80"
        style={{ background: "rgba(0,0,0,0.2)", color: "#713f12" }}
      >
        Encerrar visualização
      </button>
    </div>
  );
}

function DemoBanner({ lang, onEnd }: { lang: "pt" | "en"; onEnd: () => void }) {
  const label = lang === "en"
    ? "Interactive Demo — Watford FC · Championship"
    : "Demo Interativa — Watford FC · Championship";
  const btn = lang === "en" ? "Exit demo" : "Sair da demo";
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between px-4 py-2 gap-3"
      style={{ background: "rgba(16,185,129,0.95)", backdropFilter: "blur(8px)", boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#065f46" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-bold text-xs truncate" style={{ color: "#065f46" }}>{label}</span>
      </div>
      <button
        onClick={onEnd}
        className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold transition-all hover:opacity-80"
        style={{ background: "rgba(0,0,0,0.15)", color: "#065f46" }}
      >
        {btn}
      </button>
    </div>
  );
}

interface AuthUser {
  id: number;
  email: string;
  name: string;
  plan?: "free" | "pro" | "ultra";
}

type AppView =
  | "init"
  | "landing"
  | "auth"
  | "loading-clubs"
  | "fetch-error"
  | "squad-loading"
  | "career-selection"
  | "create-wizard"
  | "dashboard";

type WizardMode = "new" | "change-club";

interface LoadingProgress {
  loaded: number;
  total: number;
  leagueName: string;
}

async function resolveTheme(club: {
  name: string;
  apiFootballId?: number;
  logo?: string;
  savedPrimary?: string;
  savedSecondary?: string;
}): Promise<{ primary: string; secondary: string }> {
  if (club.savedPrimary && club.savedSecondary) {
    const colors = { primary: club.savedPrimary, secondary: club.savedSecondary };
    applyTheme(colors);
    return colors;
  }

  const directColors = getClubColors(club.name);
  if (directColors) { applyTheme(directColors); return directColors; }

  const fc26Name = APIFOOTBALL_TO_FC26_NAME[club.name];
  if (fc26Name) {
    const mappedColors = getClubColors(fc26Name);
    if (mappedColors) { applyTheme(mappedColors); return mappedColors; }
  }

  const logoUrl =
    club.logo ??
    (club.apiFootballId
      ? `https://media.api-sports.io/football/teams/${club.apiFootballId}.png`
      : null);

  if (logoUrl) {
    const extracted = await extractColorsFromImage(logoUrl);
    applyTheme(extracted);
    return extracted;
  }

  resetTheme();
  return { primary: "#8B5CF6", secondary: "#6366F1" };
}

function ClubListLoader({ progress }: { progress: LoadingProgress }) {
  const pct = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
  return (
    <div className="relative h-full flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-8 animate-float"
          style={{ background: "rgba(var(--club-primary-rgb),0.1)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}>
          <svg className="w-8 h-8 animate-spin" style={{ color: "var(--club-primary)" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <h2 className="text-white font-black text-xl mb-2">Carregando clubes</h2>
        <p className="text-white/40 text-sm mb-8 min-h-5 truncate">
          {progress.leagueName ? `${progress.leagueName}...` : "Buscando dados..."}
        </p>
        <div className="mb-3">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: pct > 0 ? `${pct}%` : "100%", background: "var(--club-gradient)", animation: pct === 0 ? "pulse 1.5s ease-in-out infinite" : undefined }} />
          </div>
        </div>
        {pct > 0 && (
          <p className="text-white/25 text-xs tabular-nums">{progress.loaded} / {progress.total} ligas</p>
        )}
      </div>
    </div>
  );
}

function FetchErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="relative h-full flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-8"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-white font-black text-xl mb-2">Erro ao carregar clubes</h2>
        <p className="text-white/40 text-sm mb-8 leading-relaxed">Não foi possível buscar a lista de clubes. Verifique a conexão e tente novamente.</p>
        <div className="flex flex-col gap-3">
          <button onClick={onRetry} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "var(--club-gradient)", boxShadow: "0 4px 20px rgba(var(--club-primary-rgb),0.25)" }}>
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

const PROMO_CONFETTI_COLORS = ["#34d399","#6ee7b7","#a78bfa","#818cf8","#fbbf24","#fb923c","#f472b6","#60a5fa","#c084fc"];
const PROMO_CONFETTI_COUNT = 30;

function PlanPromotionModal({ plan, lang, onClose }: { plan: "pro" | "ultra"; lang: "pt" | "en"; onClose: () => void }) {
  const t = PLAN_PROMOTION[lang];
  const body = plan === "ultra" ? t.bodyUltra : t.bodyPro;
  const planLabel = plan === "ultra" ? "Ultra" : "Pro";
  const planColor = plan === "ultra" ? "#c084fc" : "#60a5fa";
  const planBg = plan === "ultra" ? "rgba(168,85,247,0.15)" : "rgba(59,130,246,0.15)";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(14px)" }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: PROMO_CONFETTI_COUNT }).map((_, i) => {
          const angle = (360 / PROMO_CONFETTI_COUNT) * i;
          const dist = 90 + (i % 3) * 40;
          const dx = Math.cos((angle * Math.PI) / 180) * dist;
          const dy = Math.sin((angle * Math.PI) / 180) * dist - 40;
          const color = PROMO_CONFETTI_COLORS[i % PROMO_CONFETTI_COLORS.length];
          const size = 5 + (i % 4);
          const delay = (i % 8) * 50;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "44%",
                width: size,
                height: size,
                borderRadius: i % 2 === 0 ? "50%" : "2px",
                background: color,
                opacity: 0,
                animation: `promo-particle 1.3s ease-out ${delay}ms forwards`,
                ["--dx" as string]: `${dx}px`,
                ["--dy" as string]: `${dy}px`,
              }}
            />
          );
        })}
        <style>{`
          @keyframes promo-particle {
            0%   { transform: translate(-50%,-50%) translate(0,0) scale(1); opacity: 1; }
            75%  { opacity: 0.7; }
            100% { transform: translate(-50%,-50%) translate(var(--dx),var(--dy)) scale(0.2); opacity: 0; }
          }
        `}</style>
      </div>

      <div
        className="relative w-full max-w-sm rounded-3xl p-8 flex flex-col items-center gap-6 text-center"
        style={{
          background: "rgba(14,12,24,0.98)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px ${planColor}22`,
        }}
      >
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
          style={{ background: planBg, border: `1px solid ${planColor}55` }}
        >
          🏆
        </div>
        <div className="flex flex-col items-center gap-2">
          <span
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{ background: planBg, color: planColor }}
          >
            {planLabel}
          </span>
          <h2 className="text-white font-black text-xl">{t.title}</h2>
          <p className="text-white/60 text-sm leading-relaxed">{body}</p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            background: `linear-gradient(135deg, ${planColor}cc, ${planColor}77)`,
            boxShadow: `0 4px 20px ${planColor}44`,
          }}
        >
          {t.btn}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<AppView>("init");
  const [careers, setCareers] = useState<Career[]>([]);
  const [allClubs, setAllClubs] = useState<ClubEntry[]>([]);
  const [activeCareer, setActiveCareer] = useState<Career | null>(null);
  const [wizardMode, setWizardMode] = useState<WizardMode>("new");
  const [progress, setProgress] = useState<LoadingProgress>({ loaded: 0, total: 0, leagueName: "" });
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authInitialPlan, setAuthInitialPlan] = useState<"free" | "pro" | "ultra">("free");
  const [authCheckoutDraft, setAuthCheckoutDraft] = useState<{ name: string; email: string; plan: "pro" | "ultra" } | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutConfirmed, setCheckoutConfirmed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUserName, setImpersonatedUserName] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [demoInitialTab, setDemoInitialTab] = useState<string | null>(null);
  const [planPromotion, setPlanPromotion] = useState<{ plan: "pro" | "ultra" } | null>(null);
  const [lang, setLangState] = useState<"pt" | "en">(() => {
    try {
      const s = localStorage.getItem("fc_lang");
      if (s === "pt" || s === "en") return s;
      return navigator.language?.startsWith("pt") ? "pt" : "en";
    } catch { return "pt"; }
  });
  const setLang = useCallback((l: "pt" | "en") => {
    setLangState(l);
    try { localStorage.setItem("fc_lang", l); } catch {}
    window.dispatchEvent(new StorageEvent("storage", { key: "fc_lang", newValue: l }));
  }, []);

  useEffect(() => {
    resetTheme();
  }, []);

  const resolveViewAfterClubs = useCallback((_hasCareers: boolean) => {
    setView("career-selection");
  }, []);

  const doFetchClubs = useCallback(
    (afterFetch: (clubs: ClubEntry[]) => void) => {
      setView("loading-clubs");
      setProgress({ loaded: 0, total: 0, leagueName: "" });

      getDbClubs()
        .then((dbClubs) => {
          if (dbClubs && dbClubs.length > 0) {
            setAllClubs(dbClubs);
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ clubs: dbClubs, cachedAt: Date.now() })); } catch {}
            afterFetch(dbClubs);
            return;
          }
          return fetchBackendClubList()
            .then((clubs) => {
              setAllClubs(clubs);
              afterFetch(clubs);
            })
            .catch((err: unknown) => {
              if (err instanceof ApiRateLimitError) { setView("fetch-error"); return; }
              const cached = getCachedClubList();
              if (cached && cached.length > 0) {
                setAllClubs(cached);
                afterFetch(cached);
              } else {
                setView("fetch-error");
              }
            });
        })
        .catch(() => {
          fetchBackendClubList()
            .then((clubs) => { setAllClubs(clubs); afterFetch(clubs); })
            .catch(() => { setView("fetch-error"); });
        });
    },
    []
  );

  const startFetching = useCallback((hasCareers: boolean) => {
    doFetchClubs(() => resolveViewAfterClubs(hasCareers));
  }, [doFetchClubs, resolveViewAfterClubs]);

  const handleLandingStart = useCallback(() => {
    const loadedCareers = listCareers();
    const hasCareers = loadedCareers.length > 0;
    const localCached = getCachedClubList();
    if (localCached && localCached.length > 0) {
      setAllClubs(localCached);
      resolveViewAfterClubs(hasCareers);
      return;
    }
    doFetchClubs(() => resolveViewAfterClubs(hasCareers));
  }, [doFetchClubs, resolveViewAfterClubs]);

  const handleLandingLogin = useCallback(() => {
    setAuthInitialPlan("free");
    setView("auth");
  }, []);

  const handleLandingStartWithPlan = useCallback((plan: "pro" | "ultra") => {
    setAuthInitialPlan(plan);
    setView("auth");
  }, []);

  const handleAuthBack = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setView("landing");
      requestAnimationFrame(() => requestAnimationFrame(() => setIsExiting(false)));
    }, 360);
  }, []);

  const WELCOME_KEY = (userId: number) => `fc_onboarded_${userId}`;

  const handleAuthSuccess = useCallback(async (token: string, user: AuthUser) => {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(IMPERSONATION_USER_KEY);
    setIsImpersonating(false);
    setImpersonatedUserName("");
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    setAuthUser(user);
    const fetched = await fetchCareersFromApi();
    setCareers(fetched);
    const hasCareers = fetched.length > 0;
    const isFirstTime = !localStorage.getItem(`fc_onboarded_${user.id}`);
    if (isFirstTime) setShowWelcome(true);
    const localCached = getCachedClubList();
    if (localCached && localCached.length > 0) {
      setAllClubs(localCached);
      resolveViewAfterClubs(hasCareers);
      return;
    }
    doFetchClubs(() => resolveViewAfterClubs(hasCareers));
  }, [doFetchClubs, resolveViewAfterClubs]);

  const handleWelcomeDismiss = useCallback(() => {
    if (authUser) localStorage.setItem(WELCOME_KEY(authUser.id), "1");
    setShowWelcome(false);
  }, [authUser]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem("fc-career-manager-careers");
    localStorage.removeItem("fc-career-manager-synced-ids");
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(IMPERSONATION_USER_KEY);
    sessionClear();
    setAuthUser(null);
    setActiveCareer(null);
    setCareers([]);
    setIsImpersonating(false);
    setImpersonatedUserName("");
    resetTheme();
    setView("landing");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("checkout") === "cancel") {
      window.history.replaceState({}, "", window.location.pathname);
      try {
        const raw = sessionStorage.getItem("fc_checkout_draft");
        if (raw) {
          const draft = JSON.parse(raw) as { name: string; email: string; plan: "pro" | "ultra" };
          sessionStorage.removeItem("fc_checkout_draft");
          setAuthCheckoutDraft(draft);
          setAuthInitialPlan(draft.plan);
          setView("auth");
        }
      } catch {}
      return;
    }

    if (params.get("checkout") !== "success") return;

    const sessionId = params.get("session_id");
    window.history.replaceState({}, "", window.location.pathname);
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    if (sessionId && !token) {
      // New user registration flow — exchange Stripe session for account
      setCheckoutPending(true);
      let attempts = 0;
      const MAX_ATTEMPTS = 12;

      const tryFromCheckout = async () => {
        if (attempts >= MAX_ATTEMPTS) {
          setCheckoutPending(false);
          return;
        }
        attempts++;
        try {
          const res = await fetch(`${API_BASE}/auth/from-checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          if (!res.ok) {
            setTimeout(tryFromCheckout, 3000);
            return;
          }
          const data = await res.json() as { token?: string; user?: AuthUser };
          if (data.token && data.user) {
            setCheckoutPending(false);
            setCheckoutConfirmed(true);
            setTimeout(() => setCheckoutConfirmed(false), 4000);
            await handleAuthSuccess(data.token, data.user);
          } else {
            setTimeout(tryFromCheckout, 3000);
          }
        } catch {
          setTimeout(tryFromCheckout, 3000);
        }
      };

      tryFromCheckout();
      return;
    }

    if (token) {
      // Existing user upgrade flow — poll for plan change
      setCheckoutPending(true);
      const start = Date.now();
      const TIMEOUT_MS = 120_000;
      const INTERVAL_MS = 3_000;

      const poll = setInterval(async () => {
        if (Date.now() - start > TIMEOUT_MS) {
          clearInterval(poll);
          setCheckoutPending(false);
          return;
        }
        try {
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const data = await res.json() as { user?: { plan?: string } };
          if (data.user?.plan && data.user.plan !== "free") {
            clearInterval(poll);
            const stored = localStorage.getItem(AUTH_USER_KEY);
            if (stored) {
              try {
                const parsed = JSON.parse(stored) as AuthUser;
                const updated = { ...parsed, plan: data.user.plan as AuthUser["plan"] };
                localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
                setAuthUser(updated);
              } catch {}
            }
            setCheckoutPending(false);
            setCheckoutConfirmed(true);
            setTimeout(() => setCheckoutConfirmed(false), 4000);
          }
        } catch {}
      }, INTERVAL_MS);

      return () => clearInterval(poll);
    }
  }, [handleAuthSuccess]);

  const handleEndImpersonation = useCallback(() => {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(IMPERSONATION_USER_KEY);
    setIsImpersonating(false);
    setImpersonatedUserName("");
    try { window.close(); } catch {}
    setAuthUser(null);
    setActiveCareer(null);
    setCareers([]);
    resetTheme();
    setView("landing");
  }, []);

  const handleEndDemo = useCallback(() => {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    setIsDemo(false);
    setDemoInitialTab(null);
    setAuthUser(null);
    setActiveCareer(null);
    setCareers([]);
    resetTheme();
    setView("landing");
  }, []);

  useEffect(() => {
    migrateFromLegacy();

    const urlParams = new URLSearchParams(window.location.search);

    const demoParam = urlParams.get("demo");
    const demoTab = urlParams.get("tab");
    if (demoParam === "true") {
      window.history.replaceState({}, "", window.location.pathname);
      if (demoTab) setDemoInitialTab(demoTab);
      fetch(`${API_BASE}/auth/demo`)
        .then(r => r.ok ? r.json() as Promise<{ token: string; careerId: string; user: AuthUser }> : Promise.reject())
        .then(({ token, careerId: _careerId, user }) => {
          sessionStorage.setItem(AUTH_TOKEN_KEY, token);
          setIsDemo(true);
          setAuthUser(user);
          fetchCareersFromApi().then((fetchedCareers) => {
            setCareers(fetchedCareers);
            const localCached = getCachedClubList();
            if (localCached && localCached.length > 0) {
              setAllClubs(localCached);
              resolveViewAfterClubs(fetchedCareers.length > 0);
              return;
            }
            startFetching(fetchedCareers.length > 0);
          }).catch(() => {
            setCareers([]);
            setView("career-selection");
          });
        })
        .catch(() => {
          // Don't fall back to landing — in an iframe it would re-trigger the demo loop.
          // Stay in init state briefly then surface a career-selection fallback.
          setCareers([]);
          setView("career-selection");
        });
      return;
    }

    const impersonationToken = urlParams.get("impersonation_token");
    if (impersonationToken) {
      window.history.replaceState({}, "", window.location.pathname);
      const payload = parseJwtPayload(impersonationToken);
      if (payload && typeof payload.id === "number" && payload.impersonated === true) {
        const impUser: AuthUser = {
          id: payload.id as number,
          email: typeof payload.email === "string" ? payload.email : "",
          name: typeof payload.name === "string" ? payload.name : "Usuário",
          plan: typeof payload.plan === "string" ? payload.plan as "free" | "pro" | "ultra" : "free",
        };
        sessionStorage.setItem(AUTH_TOKEN_KEY, impersonationToken);
        sessionStorage.setItem(IMPERSONATION_USER_KEY, JSON.stringify(impUser));
        setIsImpersonating(true);
        setImpersonatedUserName(impUser.name);
        setAuthUser(impUser);
        fetchCareersFromApi().then((fetchedCareers) => {
          setCareers(fetchedCareers);
          const localCached = getCachedClubList();
          if (localCached && localCached.length > 0) {
            setAllClubs(localCached);
            resolveViewAfterClubs(fetchedCareers.length > 0);
            return;
          }
          startFetching(fetchedCareers.length > 0);
        }).catch(() => {
          setCareers([]);
          setView("career-selection");
        });
        return;
      }
    }

    const storedImpUser = sessionStorage.getItem(IMPERSONATION_USER_KEY);
    if (storedImpUser) {
      try {
        const impUser = JSON.parse(storedImpUser) as AuthUser;
        setIsImpersonating(true);
        setImpersonatedUserName(impUser.name);
        setAuthUser(impUser);
      } catch {}
    } else {
      const storedUser = localStorage.getItem(AUTH_USER_KEY);
      if (storedUser) {
        try { setAuthUser(JSON.parse(storedUser) as AuthUser); } catch {}
      }
      const syncToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (syncToken) {
        fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${syncToken}` } })
          .then(r => r.ok ? r.json() as Promise<{ user?: { plan?: string } }> : null)
          .then(data => {
            if (!data?.user?.plan) return;
            const serverPlan = data.user.plan as "free" | "pro" | "ultra";
            try {
              const raw = localStorage.getItem(AUTH_USER_KEY);
              if (!raw) return;
              const parsed = JSON.parse(raw) as AuthUser;
              const oldPlan = parsed.plan ?? "free";
              const rank: Record<string, number> = { free: 0, pro: 1, ultra: 2 };
              const isUpgrade = (rank[serverPlan] ?? 0) > (rank[oldPlan] ?? 0);
              if (serverPlan !== oldPlan) {
                const updated = { ...parsed, plan: serverPlan };
                localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
                setAuthUser(updated);
              }
              if (isUpgrade && (serverPlan === "pro" || serverPlan === "ultra")) {
                const seenKey = `fc_plan_promoted_${parsed.id ?? "anon"}_${serverPlan}`;
                if (!sessionStorage.getItem(seenKey)) {
                  sessionStorage.setItem(seenKey, "1");
                  setPlanPromotion({ plan: serverPlan });
                }
              }
            } catch {}
          })
          .catch(() => {});
      }
    }

    // Restore demo mode when session token has demo:true (handles page reloads)
    const sessionToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (sessionToken && !sessionStorage.getItem(IMPERSONATION_USER_KEY)) {
      const demoPayload = parseJwtPayload(sessionToken);
      if (demoPayload?.demo === true) {
        setIsDemo(true);
        setAuthUser({
          id: typeof demoPayload.id === "number" ? demoPayload.id : 0,
          email: typeof demoPayload.email === "string" ? demoPayload.email : "demo@fc-career-manager.app",
          name: typeof demoPayload.name === "string" ? demoPayload.name : "Demo Coach",
          plan: (typeof demoPayload.plan === "string" ? demoPayload.plan : "pro") as "free" | "pro" | "ultra",
        });
      }
    }

    const token = getEffectiveToken();
    if (!token) {
      const localCareers = listCareers();
      setCareers(localCareers);
      setView("landing");
      return;
    }

    fetchCareersFromApi().then((fetchedCareers) => {
      setCareers(fetchedCareers);
      const hasCareers = fetchedCareers.length > 0;

      const localCached = getCachedClubList();
      if (localCached && localCached.length > 0) {
        setAllClubs(localCached);
        resolveViewAfterClubs(hasCareers);
        return;
      }

      getDbClubs()
        .then((dbClubs) => {
          if (dbClubs && dbClubs.length > 0) {
            setAllClubs(dbClubs);
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify({ clubs: dbClubs, cachedAt: Date.now() }));
            } catch {}
            resolveViewAfterClubs(hasCareers);
            return;
          }
          startFetching(hasCareers);
        })
        .catch(() => {
          startFetching(hasCareers);
        });
    }).catch((err: unknown) => {
      if (err instanceof AuthExpiredError) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
        sessionStorage.removeItem(IMPERSONATION_USER_KEY);
        setAuthUser(null);
        setIsImpersonating(false);
        setImpersonatedUserName("");
      }
      const localCareers = listCareers();
      setCareers(localCareers);
      setView("landing");
    });
  }, [startFetching, resolveViewAfterClubs]);

  const enterCareer = useCallback(async (career: Career) => {
    setActiveCareer(career);
    const colors = await resolveTheme({
      name: career.clubName,
      apiFootballId: career.clubId > 0 ? career.clubId : undefined,
      logo: career.clubLogo || undefined,
      savedPrimary: career.clubPrimary,
      savedSecondary: career.clubSecondary,
    });
    if (!career.clubPrimary || !career.clubSecondary) {
      const updated = { ...career, clubPrimary: colors.primary, clubSecondary: colors.secondary, updatedAt: Date.now() };
      saveCareer(updated);
      setActiveCareer(updated);
      const latest = listCareers();
      setCareers(latest);
    }
    setView("dashboard");
  }, []);

  const handleWizardComplete = useCallback(
    async (newCareer: Career) => {
      let careerToEnter = { ...newCareer };

      if (wizardMode === "change-club" && activeCareer) {
        careerToEnter = {
          ...activeCareer,
          clubId: newCareer.clubId,
          clubName: newCareer.clubName,
          clubLogo: newCareer.clubLogo,
          clubLeague: newCareer.clubLeague,
          clubCountry: newCareer.clubCountry,
          clubStadium: newCareer.clubStadium,
          clubFounded: newCareer.clubFounded,
          clubPrimary: newCareer.clubPrimary,
          clubSecondary: newCareer.clubSecondary,
          isCustomClub: newCareer.clubId === 0 ? true : undefined,
          updatedAt: Date.now(),
        };
      } else if (newCareer.clubId === 0) {
        careerToEnter = { ...newCareer, isCustomClub: true };
      }

      if (careerToEnter.clubId > 0) {
        setView("squad-loading");
        await fetchSquadFromBackend(careerToEnter.clubId).catch(() => {});
      }

      saveCareer(careerToEnter);
      const updatedCareers = listCareers();
      setCareers(updatedCareers);
      await enterCareer(careerToEnter);
    },
    [wizardMode, activeCareer, enterCareer]
  );

  const handleCreateNew = useCallback(() => {
    setWizardMode("new");
    setView("create-wizard");
  }, []);

  const handleGoToCareers = useCallback(() => {
    setActiveCareer(null);
    resetTheme();
    const latest = listCareers();
    setCareers(latest);
    setView("career-selection");
  }, []);

  const handleChangeClub = useCallback(() => {
    setWizardMode("change-club");
    setView("create-wizard");
  }, []);

  const handleSeasonChange = useCallback(
    (season: string) => {
      if (!activeCareer) return;
      updateCareerSeason(activeCareer.id, season);
      const updated = { ...activeCareer, season, updatedAt: Date.now() };
      setActiveCareer(updated);
      const latest = listCareers();
      setCareers(latest);
    },
    [activeCareer]
  );

  const handleReloadClubs = useCallback(() => {
    clearClubCache();
    setAllClubs([]);
    doFetchClubs(() => {
      if (activeCareer) {
        setView("dashboard");
      } else {
        setView("career-selection");
      }
    });
  }, [activeCareer, doFetchClubs]);

  const handleCareersChange = useCallback((updated: Career[]) => {
    setCareers(updated);
  }, []);

  const renderView = () => {
    if (view === "init") {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "var(--club-primary)", borderTopColor: "transparent" }} />
        </div>
      );
    }

    if (view === "landing") {
      return <LandingPage onStart={handleLandingStart} onLogin={handleLandingLogin} onStartWithPlan={handleLandingStartWithPlan} lang={lang} setLang={setLang} />;
    }

    if (view === "auth") {
      return <AuthPage onBack={handleAuthBack} onAuthSuccess={handleAuthSuccess} initialPlan={authInitialPlan} checkoutDraft={authCheckoutDraft} onDraftConsumed={() => setAuthCheckoutDraft(null)} lang={lang} setLang={setLang} />;
    }

    if (view === "loading-clubs") {
      return <ClubListLoader progress={progress} />;
    }

    if (view === "squad-loading") {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "var(--club-primary)", borderTopColor: "transparent" }} />
          <p className="text-white/40 text-sm">Carregando elenco...</p>
        </div>
      );
    }

    if (view === "fetch-error") {
      return <FetchErrorScreen onRetry={() => startFetching(listCareers().length > 0)} />;
    }

    if (view === "career-selection") {
      return (
        <CareerSelection
          careers={careers}
          onSelectCareer={enterCareer}
          onCreateNew={handleCreateNew}
          onCareersChange={handleCareersChange}
          onLogout={handleLogout}
          onUpgrade={() => setView("landing")}
          userPlan={authUser?.plan ?? "free"}
        />
      );
    }

    if (view === "create-wizard") {
      return (
        <CreateCareerWizard
          allClubs={allClubs}
          onComplete={handleWizardComplete}
          onCancel={activeCareer ? async () => { await resolveTheme({ name: activeCareer.clubName, apiFootballId: activeCareer.clubId > 0 ? activeCareer.clubId : undefined, logo: activeCareer.clubLogo || undefined, savedPrimary: activeCareer.clubPrimary, savedSecondary: activeCareer.clubSecondary }); setView("dashboard"); } : handleGoToCareers}
          initialStep={wizardMode === "change-club" ? 1 : 0}
          initialCoach={wizardMode === "change-club" ? activeCareer?.coach : null}
        />
      );
    }

    if (view === "dashboard" && activeCareer) {
      return (
        <Dashboard
          career={activeCareer}
          onSeasonChange={handleSeasonChange}
          onGoToCareers={isDemo ? handleEndDemo : handleGoToCareers}
          onChangeClub={isDemo ? () => {} : handleChangeClub}
          onReloadClubs={handleReloadClubs}
          onDeleteCareer={isDemo ? undefined : handleGoToCareers}
          initialTab={demoInitialTab as Parameters<typeof Dashboard>[0]["initialTab"] ?? undefined}
          isDemo={isDemo}
        />
      );
    }

    return (
      <CareerSelection
        careers={careers}
        onSelectCareer={enterCareer}
        onCreateNew={handleCreateNew}
        onCareersChange={handleCareersChange}
        onLogout={handleLogout}
        onUpgrade={() => setView("landing")}
        userPlan={authUser?.plan ?? "free"}
      />
    );
  };

  return (
    <>
      <AnimatedBackground />
      {isImpersonating && (
        <ImpersonationBanner userName={impersonatedUserName} onEnd={handleEndImpersonation} />
      )}
      {isDemo && !isImpersonating && (
        <DemoBanner lang={lang} onEnd={handleEndDemo} />
      )}
      <div className="relative h-full overflow-hidden" style={(isImpersonating || isDemo) ? { paddingTop: "40px" } : undefined}>
        <div
          style={{
            height: "100%",
            transition: "opacity 0.36s ease, transform 0.36s ease",
            opacity: isExiting ? 0 : 1,
            transform: isExiting ? "translateX(32px)" : "translateX(0)",
          }}
        >
          {renderView()}
        </div>
      </div>

      {showWelcome && authUser && (
        <WelcomeScreen
          userName={authUser.name}
          plan={authUser.plan ?? "free"}
          onContinue={handleWelcomeDismiss}
        />
      )}

      {planPromotion && !showWelcome && (
        <PlanPromotionModal
          plan={planPromotion.plan}
          lang={lang}
          onClose={() => setPlanPromotion(null)}
        />
      )}

      {checkoutPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          <div className="text-center px-6 py-10 rounded-3xl max-w-xs w-full mx-4"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
              <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24"
                style={{ color: "#a78bfa" }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h2 className="text-white font-black text-lg mb-2">Confirmando pagamento...</h2>
            <p className="text-white/40 text-sm leading-relaxed">Estamos aguardando a confirmação do Stripe. Isso pode levar alguns segundos.</p>
          </div>
        </div>
      )}

      {checkoutConfirmed && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-lg"
          style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", backdropFilter: "blur(8px)" }}>
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            style={{ color: "#34d399" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-white font-bold text-sm">Plano ativado com sucesso!</span>
        </div>
      )}
    </>
  );
}
