import { useState, useEffect } from "react";
import { Club } from "@/types/club";
import { fetchClubs, fetchLeagues } from "@/lib/api";

export interface UseClubDataReturn {
  clubs: Club[];
  leagues: string[];
  loading: boolean;
  error: string | null;
  retry: () => void;
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
        setClubs(clubList);
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

  return {
    clubs,
    leagues,
    loading,
    error,
    retry: () => setAttempt((a) => a + 1),
  };
}
