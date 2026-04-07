import { useState, useEffect } from "react";
import { Club } from "@/types/club";
import { ClubSelection } from "@/components/ClubSelection";
import { Dashboard } from "@/components/Dashboard";
import { applyTheme, resetTheme, extractColorsFromImage } from "@/lib/themeManager";
import { getClubColors } from "@/lib/clubColors";
import { getClubImage } from "@/lib/imageCache";
import { getCurrentSeason } from "@/lib/api";

const STORAGE_KEY = "fc-career-manager-club";

interface StoredData {
  club: Club;
  season: string;
  selectedAt: number;
}

async function restoreTheme(club: Club) {
  const hardcoded = getClubColors(club.name);
  if (hardcoded) {
    applyTheme(hardcoded);
    return;
  }

  const imageUrl = await getClubImage(club);
  if (imageUrl) {
    const colors = await extractColorsFromImage(imageUrl);
    applyTheme(colors);
  }
}

function App() {
  const [stored, setStored] = useState<StoredData | null>(null);
  const [view, setView] = useState<"selection" | "dashboard">("selection");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data: StoredData = JSON.parse(raw);
        if (data.club && data.season) {
          setStored(data);
          setView("dashboard");
          restoreTheme(data.club);
        } else {
          resetTheme();
        }
      } else {
        resetTheme();
      }
    } catch {
      resetTheme();
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectClub = (club: Club) => {
    const season = getCurrentSeason();
    const data: StoredData = { club, season, selectedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setStored(data);
    setView("dashboard");
  };

  const handleChangeClub = () => {
    resetTheme();
    setView("selection");
  };

  const handleSeasonChange = (season: string) => {
    if (!stored) return;
    const data = { ...stored, season };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setStored(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--app-bg, #0a0a0a)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-[var(--club-primary)] border-t-transparent animate-spin" />
      </div>
    );
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

  return <ClubSelection onSelectClub={handleSelectClub} />;
}

export default App;
