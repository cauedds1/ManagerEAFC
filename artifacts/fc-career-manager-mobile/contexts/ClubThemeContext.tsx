import { createContext, useContext, useMemo, ReactNode } from 'react';
import { getClubColors } from '@/lib/clubColors';
import { useCareer } from './CareerContext';

interface ClubTheme {
  primary: string;
  secondary: string;
  primaryRgb: string;
  isDark: boolean;
}

const ClubThemeContext = createContext<ClubTheme>({
  primary: '#8B5CF6',
  secondary: '#6366F1',
  primaryRgb: '139, 92, 246',
  isDark: true,
});

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '139, 92, 246';
  return `${r}, ${g}, ${b}`;
}

function isColorDark(hex: string): boolean {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

export function ClubThemeProvider({ children }: { children: ReactNode }) {
  const { activeCareer } = useCareer();

  const theme = useMemo<ClubTheme>(() => {
    if (!activeCareer) {
      return {
        primary: '#8B5CF6',
        secondary: '#6366F1',
        primaryRgb: '139, 92, 246',
        isDark: true,
      };
    }

    const fromCareer = activeCareer.clubPrimary && activeCareer.clubSecondary
      ? { primary: activeCareer.clubPrimary, secondary: activeCareer.clubSecondary }
      : null;

    const colors = fromCareer ?? getClubColors(activeCareer.clubName);

    return {
      primary: colors.primary,
      secondary: colors.secondary,
      primaryRgb: hexToRgb(colors.primary),
      isDark: isColorDark(colors.primary),
    };
  }, [activeCareer]);

  return (
    <ClubThemeContext.Provider value={theme}>
      {children}
    </ClubThemeContext.Provider>
  );
}

export function useClubTheme(): ClubTheme {
  return useContext(ClubThemeContext);
}
