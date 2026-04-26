import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { api, type Career, type Season } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';

interface CareerContextValue {
  activeCareer: Career | null;
  activeSeason: Season | null;
  setActiveCareer: (career: Career | null) => void;
  setActiveSeason: (season: Season | null) => void;
  loadSeasons: (careerId: string) => Promise<Season[]>;
  refreshCareers: () => void;
}

const CareerContext = createContext<CareerContextValue | null>(null);

export function CareerProvider({ children }: { children: ReactNode }) {
  const [activeCareer, setActiveCareerState] = useState<Career | null>(null);
  const [activeSeason, setActiveSeasonState] = useState<Season | null>(null);

  const setActiveCareer = useCallback((career: Career | null) => {
    setActiveCareerState(career);
    setActiveSeasonState(null);
  }, []);

  const setActiveSeason = useCallback((season: Season | null) => {
    setActiveSeasonState(season);
  }, []);

  const loadSeasons = useCallback(async (careerId: string): Promise<Season[]> => {
    try {
      const seasons = await api.careers.seasons(careerId);
      if (!Array.isArray(seasons)) return [];
      const active = seasons.find((s) => s.isActive) ?? seasons[seasons.length - 1] ?? null;
      setActiveSeasonState(active);
      return seasons;
    } catch {
      return [];
    }
  }, []);

  const refreshCareers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/careers'] });
  }, []);

  const value = useMemo<CareerContextValue>(
    () => ({
      activeCareer,
      activeSeason,
      setActiveCareer,
      setActiveSeason,
      loadSeasons,
      refreshCareers,
    }),
    [activeCareer, activeSeason, setActiveCareer, setActiveSeason, loadSeasons, refreshCareers]
  );

  return <CareerContext.Provider value={value}>{children}</CareerContext.Provider>;
}

export function useCareer() {
  const ctx = useContext(CareerContext);
  if (!ctx) throw new Error('useCareer must be used within CareerProvider');
  return ctx;
}
