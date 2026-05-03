import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';

export type Lang = 'pt' | 'en';

const LANG_KEY = 'fc_locale';

// Kept for back-compat with existing engines (fanMoodStorage etc).
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
const _listeners = new Set<(lang: Lang) => void>();

export function getLang(): Lang {
  return _currentLang;
}

export async function setLang(lang: Lang): Promise<void> {
  _currentLang = lang;
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(LANG_KEY, lang);
    } else {
      await SecureStore.setItemAsync(LANG_KEY, lang);
    }
  } catch {}
  _listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn: (lang: Lang) => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export async function loadPersistedLang(): Promise<Lang> {
  try {
    const stored = Platform.OS === 'web'
      ? localStorage.getItem(LANG_KEY)
      : await SecureStore.getItemAsync(LANG_KEY);
    if (stored === 'pt' || stored === 'en') {
      _currentLang = stored;
      return stored;
    }
    const device = Localization.getLocales()[0]?.languageCode ?? 'pt';
    const guess: Lang = device.startsWith('pt') ? 'pt' : 'en';
    _currentLang = guess;
    return guess;
  } catch {
    return _currentLang;
  }
}

const DICTIONARY: Record<string, Record<Lang, string>> = {
  // common
  'common.cancel':  { pt: 'Cancelar',         en: 'Cancel' },
  'common.save':    { pt: 'Salvar',           en: 'Save' },
  'common.close':   { pt: 'Fechar',           en: 'Close' },
  'common.error':   { pt: 'Erro',             en: 'Error' },
  'common.loading': { pt: 'Carregando...',    en: 'Loading...' },
  'common.copy':    { pt: 'Copiar',           en: 'Copy' },
  'common.share':   { pt: 'Compartilhar',     en: 'Share' },
  'common.copied':  { pt: 'Copiado!',         en: 'Copied!' },

  // settings
  'settings.title':              { pt: 'Configurações',   en: 'Settings' },
  'settings.account':            { pt: 'Conta',           en: 'Account' },
  'settings.language':           { pt: 'Idioma',          en: 'Language' },
  'settings.language.portuguese':{ pt: 'Português (BR)',  en: 'Portuguese (BR)' },
  'settings.language.english':   { pt: 'Inglês',          en: 'English' },
  'settings.plan':               { pt: 'Plano',           en: 'Plan' },
  'settings.upgrade':            { pt: 'Fazer upgrade',   en: 'Upgrade plan' },
  'settings.manageSubscription': { pt: 'Gerenciar assinatura', en: 'Manage subscription' },
  'settings.openingCheckout':    { pt: 'Abrindo checkout...',  en: 'Opening checkout...' },
  'settings.openingPortal':      { pt: 'Abrindo portal...',    en: 'Opening portal...' },
  'settings.aiUsage':            { pt: 'Uso de IA',       en: 'AI usage' },
  'settings.aiUsageMonth':       { pt: 'gerações este mês', en: 'generations this month' },
  'settings.byok.title':         { pt: 'Sua chave OpenAI', en: 'Your OpenAI key' },
  'settings.byok.placeholder':   { pt: 'sk-...',          en: 'sk-...' },
  'settings.byok.hint':          { pt: 'Use sua própria chave para gerar imagens. Armazenada com segurança no aparelho.', en: 'Use your own key for image generation. Stored securely on-device.' },
  'settings.byok.saved':         { pt: 'Chave salva',     en: 'Key saved' },
  'settings.byok.cleared':       { pt: 'Chave removida',  en: 'Key cleared' },
  'settings.notifications':      { pt: 'Notificações',    en: 'Notifications' },
  'settings.sound':              { pt: 'Som',             en: 'Sound' },
  'settings.bugReport':          { pt: 'Reportar problema', en: 'Report a problem' },
  'settings.referral':           { pt: 'Convide amigos',  en: 'Invite friends' },
  'settings.export':             { pt: 'Exportar carreira', en: 'Export career' },
  'settings.exportSuccess':      { pt: 'Exportação concluída', en: 'Export complete' },
  'settings.exportError':        { pt: 'Erro ao exportar', en: 'Export error' },

  // upgrade prompt
  'upgrade.requiredPlan':  { pt: 'Plano',          en: 'Plan' },
  'upgrade.cta':           { pt: 'Fazer upgrade',  en: 'Upgrade now' },
  'upgrade.opening':       { pt: 'Aguarde...',     en: 'Please wait...' },
  'upgrade.error':         { pt: 'Não foi possível abrir o checkout.', en: 'Could not open checkout.' },
  'upgrade.currentPlan':   { pt: 'Seu plano atual',en: 'Your current plan' },

  // bug report
  'bugReport.title':       { pt: 'Reportar problema',     en: 'Report a problem' },
  'bugReport.subject':     { pt: 'Assunto',               en: 'Subject' },
  'bugReport.description': { pt: 'Descrição',             en: 'Description' },
  'bugReport.send':        { pt: 'Enviar',                en: 'Send' },
  'bugReport.sent':        { pt: 'Relatório enviado!',    en: 'Report sent!' },
  'bugReport.thanks':      { pt: 'Obrigado por nos ajudar a melhorar.', en: 'Thanks for helping us improve.' },

  // toasts / notifications
  'toast.community.newReaction':    { pt: 'Nova reação',          en: 'New reaction' },
  'toast.board.newMeeting':         { pt: 'Reunião da diretoria', en: 'Board meeting' },
  'toast.aiQuota.warn':             { pt: 'Cota de IA quase no limite', en: 'AI quota almost reached' },
  'toast.aiQuota.exceeded':         { pt: 'Cota de IA esgotada',  en: 'AI quota exceeded' },

  // referral
  'referral.title':      { pt: 'Seu link de convite',   en: 'Your referral link' },
  'referral.hint':       { pt: 'Convide um amigo e ganhe benefícios.', en: 'Invite a friend and earn perks.' },
};

export const i18n = new I18n(
  (() => {
    const pt: Record<string, string> = {};
    const en: Record<string, string> = {};
    for (const k of Object.keys(DICTIONARY)) {
      pt[k] = DICTIONARY[k].pt;
      en[k] = DICTIONARY[k].en;
    }
    return { pt, en };
  })(),
  { defaultLocale: 'pt', enableFallback: true, missingBehavior: 'guess' as const },
);
i18n.locale = _currentLang;
onLangChange((l) => { i18n.locale = l; });

export function t(key: string, lang?: Lang): string {
  if (lang) return DICTIONARY[key]?.[lang] ?? i18n.t(key);
  return DICTIONARY[key]?.[_currentLang] ?? i18n.t(key);
}

export function useLang(): Lang {
  const [lang, setLangState] = useState<Lang>(_currentLang);
  useEffect(() => {
    setLangState(_currentLang);
    return onLangChange((l) => setLangState(l));
  }, []);
  return lang;
}

export function useT(): (key: string) => string {
  const lang = useLang();
  return (key: string) => DICTIONARY[key]?.[lang] ?? key;
}
