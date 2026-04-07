import { useState, useEffect, useCallback } from "react";
import { Club } from "@/types/club";
import { fetchClubs, fetchLeagues } from "@/lib/api";
import { leagueCache } from "@/lib/imageCache";

export interface UseClubDataReturn {
  clubs: Club[];
  leagues: string[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  updateClubLeague: (clubName: string, league: string) => void;
}

export function useClubData(): UseClubDataReturn {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [leagues, setLeagues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchClubs(), fetchLeagues()])
      .then(([clubList, leagueList]) => {
        if (cancelled) return;

        const enriched = clubList.map((c) => {
          if (c.league !== "Outras ligas") return c;
          const cached = leagueCache.get(c.name);
          return cached && cached !== "Outras ligas" ? { ...c, league: cached } : c;
        });

        setClubs(enriched);
        setLeagues(leagueList);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? "Erro ao carregar os dados");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const updateClubLeague = useCallback((clubName: string, league: string) => {
    setClubs((prev) =>
      prev.map((c) => {
        if (c.name !== clubName) return c;
        if (c.league === "Outras ligas" && league && league !== "Outras ligas") {
          return { ...c, league };
        }
        return c;
      })
    );
  }, []);

  return {
    clubs,
    leagues,
    loading,
    error,
    retry: () => setAttempt((a) => a + 1),
    updateClubLeague,
  };
}
