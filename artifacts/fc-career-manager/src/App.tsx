import { useState, useEffect, useCallback } from "react";
import { Club, ClubEntry } from "@/types/club";
import { Career } from "@/types/career";
import { CareerSelection } from "@/components/CareerSelection";
import { CreateCareerWizard } from "@/components/CreateCareerWizard";
import { Dashboard } from "@/components/Dashboard";
import { ApiKeySetup } from "@/components/ApiKeySetup";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { applyTheme, resetTheme, extractColorsFromImage } from "@/lib/themeManager";
import { getClubColors } from "@/lib/clubColors";
import { APIFOOTBALL_TO_FC26_NAME } from "@/lib/footballApiMap";
import {
  getApiKey,
  fetchAndCacheClubList,
  getCachedClubList,
  getDbClubs,
  CACHE_KEY,
  clearClubCache,
  ApiAuthError,
  ApiRateLimitError,
  ProgressCallback,
} from "@/lib/clubListCache";
import { listCareers, saveCareer, migrateFromLegacy, updateCareerSeason } from "@/lib/careerStorage";

type AppView =
  | "init"
  | "key-missing"
  | "loading-clubs"
  | "fetch-error"
  | "career-selection"
  | "create-wizard"
  | "dashboard";

type WizardMode = "new" | "change-club";

interface LoadingProgress {
  loaded: number;
  total: number;
  leagueName: string;
}

async function resolveTheme(club: { name: string; apiFootballId?: number; logo?: string }): Promise<void> {
  const directColors = getClubColors(club.name);
  if (directColors) { applyTheme(directColors); return; }

  const fc26Name = APIFOOTBALL_TO_FC26_NAME[club.name];
  if (fc26Name) {
    const mappedColors = getClubColors(fc26Name);
    if (mappedColors) { applyTheme(mappedColors); return; }
  }

  const logoUrl =
    club.logo ??
    (club.apiFootballId
      ? `https://media.api-sports.io/football/teams/${club.apiFootballId}.png`
      : null);

  if (logoUrl) {
    const extracted = await extractColorsFromImage(logoUrl);
    applyTheme(extracted);
    return;
  }

  resetTheme();
}

function ClubListLoader({ progress }: { progress: LoadingProgress }) {
  const pct = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-8">
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
          {progress.leagueName ? `${progress.leagueName}...` : "Conectando a API-Football..."}
        </p>
        <div className="mb-3">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%`, background: "var(--club-gradient)" }} />
          </div>
        </div>
        <p className="text-white/25 text-xs tabular-nums">{progress.loaded} / {progress.total} ligas</p>
      </div>
    </div>
  );
}

function FetchErrorScreen({ onRetry, onChangeKey }: { onRetry: () => void; onChangeKey: () => void }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-8"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-white font-black text-xl mb-2">Limite de requisicoes</h2>
        <p className="text-white/40 text-sm mb-8 leading-relaxed">A API-Football atingiu o limite de chamadas. Aguarde alguns minutos e tente novamente.</p>
        <div className="flex flex-col gap-3">
          <button onClick={onRetry} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "var(--club-gradient)", boxShadow: "0 4px 20px rgba(var(--club-primary-rgb),0.25)" }}>
            Tentar novamente
          </button>
          <button onClick={onChangeKey} className="w-full py-3 rounded-xl font-semibold text-sm text-white/60 hover:text-white transition-all duration-200 glass glass-hover">
            Alterar chave de API
          </button>
        </div>
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
  const [progress, setProgress] = useState<LoadingProgress>({ loaded: 0, total: 31, leagueName: "" });

  useEffect(() => {
    resetTheme();
  }, []);

  const doFetchClubs = useCallback(
    (afterFetch: (clubs: ClubEntry[]) => void) => {
      setView("loading-clubs");
      setProgress({ loaded: 0, total: 31, leagueName: "" });

      const onProgress: ProgressCallback = (loaded, total, leagueName) => {
        setProgress({ loaded, total, leagueName });
      };

      fetchAndCacheClubList(onProgress)
        .then((clubs) => {
          setAllClubs(clubs);
          afterFetch(clubs);
        })
        .catch((err: unknown) => {
          if (err instanceof ApiAuthError) { setView("key-missing"); return; }
          if (err instanceof ApiRateLimitError) { setView("fetch-error"); return; }
          const cached = getCachedClubList();
          if (cached && cached.length > 0) {
            setAllClubs(cached);
            afterFetch(cached);
          } else {
            setView("key-missing");
          }
        });
    },
    []
  );

  const resolveViewAfterClubs = useCallback((hasCareers: boolean) => {
    if (hasCareers) {
      setView("career-selection");
    } else {
      setWizardMode("new");
      setView("create-wizard");
    }
  }, []);

  const startFetching = useCallback((hasCareers: boolean) => {
    doFetchClubs(() => resolveViewAfterClubs(hasCareers));
  }, [doFetchClubs, resolveViewAfterClubs]);

  useEffect(() => {
    migrateFromLegacy();
    const loadedCareers = listCareers();
    setCareers(loadedCareers);
    const hasCareers = loadedCareers.length > 0;

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

        if (hasCareers) {
          setView("career-selection");
          const key = getApiKey();
          if (key) {
            fetchAndCacheClubList()
              .then((clubs) => setAllClubs(clubs))
              .catch(() => {});
          }
        } else {
          const key = getApiKey();
          if (!key) {
            setView("key-missing");
          } else {
            startFetching(hasCareers);
          }
        }
      })
      .catch(() => {
        if (hasCareers) {
          setView("career-selection");
        } else {
          const key = getApiKey();
          if (!key) { setView("key-missing"); return; }
          startFetching(hasCareers);
        }
      });
  }, [startFetching]);

  const handleKeySet = useCallback(() => {
    const cached = getCachedClubList();
    const hasCareers = listCareers().length > 0;
    if (cached && cached.length > 0) {
      setAllClubs(cached);
      resolveViewAfterClubs(hasCareers);
    } else {
      startFetching(hasCareers);
    }
  }, [startFetching, resolveViewAfterClubs]);

  const enterCareer = useCallback(async (career: Career) => {
    setActiveCareer(career);
    await resolveTheme({
      name: career.clubName,
      apiFootballId: career.clubId > 0 ? career.clubId : undefined,
      logo: career.clubLogo || undefined,
    });
    setView("dashboard");
  }, []);

  const handleWizardComplete = useCallback(
    async (newCareer: Career) => {
      let careerToEnter = newCareer;

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
          updatedAt: Date.now(),
        };
        saveCareer(careerToEnter);
      } else {
        saveCareer(newCareer);
      }

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
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "var(--club-primary)", borderTopColor: "transparent" }} />
        </div>
      );
    }

    if (view === "key-missing") {
      return <ApiKeySetup onKeySet={handleKeySet} />;
    }

    if (view === "loading-clubs") {
      return <ClubListLoader progress={progress} />;
    }

    if (view === "fetch-error") {
      return <FetchErrorScreen onRetry={() => startFetching(listCareers().length > 0)} onChangeKey={() => setView("key-missing")} />;
    }

    if (view === "career-selection") {
      return (
        <CareerSelection
          careers={careers}
          onSelectCareer={enterCareer}
          onCreateNew={handleCreateNew}
          onCareersChange={handleCareersChange}
        />
      );
    }

    if (view === "create-wizard") {
      return (
        <CreateCareerWizard
          allClubs={allClubs}
          onComplete={handleWizardComplete}
          onCancel={activeCareer ? async () => { await resolveTheme({ name: activeCareer.clubName, apiFootballId: activeCareer.clubId > 0 ? activeCareer.clubId : undefined, logo: activeCareer.clubLogo || undefined }); setView("dashboard"); } : handleGoToCareers}
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
          onGoToCareers={handleGoToCareers}
          onChangeClub={handleChangeClub}
          onReloadClubs={handleReloadClubs}
        />
      );
    }

    return (
      <CareerSelection
        careers={careers}
        onSelectCareer={enterCareer}
        onCreateNew={handleCreateNew}
        onCareersChange={handleCareersChange}
      />
    );
  };

  return (
    <>
      <AnimatedBackground />
      <div className="relative z-10">
        {renderView()}
      </div>
    </>
  );
}
