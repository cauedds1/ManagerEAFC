// PORTED FROM artifacts/fc-career-manager/src/lib/i18n.ts — adapted for React Native (AsyncStorage-backed localCache, no DOM).
/**
 * Minimal i18n shim used by the mobile ports of mood/board engines.
 * Currently only Portuguese strings are required by the engines we ship;
 * English strings are duplicated so callers picking lang="en" still work.
 */

export type Lang = 'pt' | 'en';

export const DASHBOARD: Record<Lang, {
  moodRevoltada: string;
  moodInsatisfeita: string;
  moodNeutra: string;
  moodAnimada: string;
  moodEuforica: string;
}> = {
  pt: {
    moodRevoltada:    'Revoltada',
    moodInsatisfeita: 'Insatisfeita',
    moodNeutra:       'Neutra',
    moodAnimada:      'Animada',
    moodEuforica:     'Eufórica',
  },
  en: {
    moodRevoltada:    'Outraged',
    moodInsatisfeita: 'Unhappy',
    moodNeutra:       'Neutral',
    moodAnimada:      'Hyped',
    moodEuforica:     'Euphoric',
  },
};

let _currentLang: Lang = 'pt';

export function setLang(lang: Lang): void {
  _currentLang = lang;
}

export function getLang(): Lang {
  return _currentLang;
}
