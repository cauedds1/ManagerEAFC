import { useState, useEffect, useCallback } from "react";
import { Club, ClubEntry } from "@/types/club";
import { ClubSelection } from "@/components/ClubSelection";
import { Dashboard } from "@/components/Dashboard";
import { ApiKeySetup } from "@/components/ApiKeySetup";
import { applyTheme, resetTheme, extractColorsFromImage } from "@/lib/themeManager";
import { getClubColors } from "@/lib/clubColors";
import { APIFOOTBALL_TO_FC26_NAME } from "@/lib/footballApiMap";
import {
  getApiKey,
  fetchAndCacheClubList,
  getCachedClubList,
  ProgressCallback,
} from "@/lib/clubListCache";
import { getCurrentSeason } from "@/lib/api";

const CLUB_STORAGE_KEY = "fc-career-manager-club";

type AppView = "init" | "key-missing" | "loading-clubs" | "selection" | "dashboard";

interface StoredData {
  club: Club;
  season: string;
  selectedAt: number;
}

interface LoadingProgress {
  loaded: number;
  total: number;
  leagueName: string;
}

async function resolveTheme(club: Club): Promise<void> {
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
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: "var(--app-bg, #0a0a0a)" }}
    >
      <div className="w-full max-w-sm text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-8"
          style={{ background: "var(--club-primary, #4f46e5)18", border: "1px solid var(--club-primary, #4f46e5)30" }}
        >
          <svg className="w-8 h-8 animate-spin" style={{ color: "var(--club-primary, #4f46e5)" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>

        <h2 className="text-white font-black text-xl mb-2">Carregando clubes</h2>

        {progress.leagueName ? (
          <p className="text-white/40 text-sm mb-8 min-h-5 truncate">
            {progress.leagueName}...
          </p>
        ) : (
          <p className="text-white/40 text-sm mb-8 min-h-5">Conectando à API-Football...</p>
        )}

        <div className="mb-3">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%`, background: "var(--club-primary, #4f46e5)" }}
            />
          </div>
        </div>

        <p className="text-white/25 text-xs tabular-nums">
          {progress.loaded} / {progress.total} ligas
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<AppView>("init");
  const [stored, setStored] = useState<StoredData | null>(null);
  const [allClubs, setAllClubs] = useState<ClubEntry[]>([]);
  const [progress, setProgress] = useState<LoadingProgress>({ loaded: 0, total: 31, leagueName: "" });
  const [selecting, setSelecting] = useState(false);

  const startFetching = useCallback(() => {
    setView("loading-clubs");
    setProgress({ loaded: 0, total: 31, leagueName: "" });

    const onProgress: ProgressCallback = (loaded, total, leagueName) => {
      setProgress({ loaded, total, leagueName });
    };

    fetchAndCacheClubList(onProgress)
      .then((clubs) => {
        setAllClubs(clubs);
        setView("selection");
      })
      .catch(() => {
        const cached = getCachedClubList();
        if (cached && cached.length > 0) {
          setAllClubs(cached);
          setView("selection");
        } else {
          setView("key-missing");
        }
      });
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLUB_STORAGE_KEY);
      if (raw) {
        const data: StoredData = JSON.parse(raw);
        if (data.club?.name && data.season) {
          setStored(data);
          resolveTheme(data.club).catch(() => resetTheme());
          setView("dashboard");
          return;
        }
      }
    } catch {}

    resetTheme();

    const key = getApiKey();
    if (!key) {
      setView("key-missing");
      return;
    }

    const cached = getCachedClubList();
    if (cached && cached.length > 0) {
      setAllClubs(cached);
      setView("selection");
      return;
    }

    startFetching();
  }, [startFetching]);

  const handleKeySet = useCallback(
    (_key: string) => {
      const cached = getCachedClubList();
      if (cached && cached.length > 0) {
        setAllClubs(cached);
        setView("selection");
      } else {
        startFetching();
      }
    },
    [startFetching]
  );

  const handleSelectClub = useCallback(
    async (entry: ClubEntry) => {
      if (selecting) return;
      setSelecting(true);
      try {
        const club: Club = {
          name: entry.name,
          league: entry.league,
          apiFootballId: entry.id,
          logo: entry.logo,
        };
        await resolveTheme(club);
        const season = getCurrentSeason();
        const data: StoredData = { club, season, selectedAt: Date.now() };
        localStorage.setItem(CLUB_STORAGE_KEY, JSON.stringify(data));
        setStored(data);
        setView("dashboard");
      } finally {
        setSelecting(false);
      }
    },
    [selecting]
  );

  const handleChangeClub = useCallback(() => {
    localStorage.removeItem(CLUB_STORAGE_KEY);
    setStored(null);
    resetTheme();
    if (allClubs.length > 0) {
      setView("selection");
    } else {
      const cached = getCachedClubList();
      if (cached && cached.length > 0) {
        setAllClubs(cached);
        setView("selection");
      } else if (getApiKey()) {
        startFetching();
      } else {
        setView("key-missing");
      }
    }
  }, [allClubs.length, startFetching]);

  const handleSeasonChange = useCallback(
    (season: string) => {
      if (!stored) return;
      const data = { ...stored, season };
      localStorage.setItem(CLUB_STORAGE_KEY, JSON.stringify(data));
      setStored(data);
    },
    [stored]
  );

  if (view === "init") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--app-bg, #0a0a0a)" }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--club-primary, #4f46e5)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (view === "key-missing") {
    return <ApiKeySetup onKeySet={handleKeySet} />;
  }

  if (view === "loading-clubs") {
    return <ClubListLoader progress={progress} />;
  }

  if (view === "dashboard" && stored) {
    return (
      <Dashboard
        club={stored.club}
        season={stored.season}
        onSeasonChange={handleSeasonChange}
        onChangeClub={handleChangeClub}
      />
    );
  }

  return (
    <ClubSelection
      allClubs={allClubs}
      onSelectClub={handleSelectClub}
      selecting={selecting}
    />
  );
}
