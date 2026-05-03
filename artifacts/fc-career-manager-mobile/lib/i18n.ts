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

  // perfil (profile tab)
  'perfil.activeCareer':   { pt: 'Carreira Ativa',     en: 'Active Career' },
  'perfil.club':           { pt: 'Clube',              en: 'Club' },
  'perfil.coach':          { pt: 'Treinador',          en: 'Coach' },
  'perfil.activeSeason':   { pt: 'Temporada ativa',    en: 'Active season' },
  'perfil.league':         { pt: 'Liga',               en: 'League' },
  'perfil.email':          { pt: 'E-mail',             en: 'E-mail' },
  'perfil.upgradeTitle':   { pt: 'Upgrade para Pro',   en: 'Upgrade to Pro' },
  'perfil.upgradeText':    { pt: 'Desbloqueie a Diretoria com IA, análises avançadas, múltiplas temporadas e muito mais.', en: 'Unlock the AI Boardroom, advanced analytics, multiple seasons and more.' },
  'perfil.viewPlans':      { pt: 'Ver planos',         en: 'View plans' },
  'perfil.theme':          { pt: 'Tema',               en: 'Theme' },
  'perfil.themeDark':      { pt: 'Escuro',             en: 'Dark' },
  'perfil.notificationsOn':{ pt: 'Ativadas',           en: 'Enabled' },
  'perfil.logout':         { pt: 'Sair da conta',      en: 'Sign out' },
  'perfil.logoutConfirm':  { pt: 'Deseja sair da sua conta?', en: 'Sign out of your account?' },
  'perfil.referralSection':{ pt: 'Indicações',         en: 'Referrals' },

  // news
  'news.aiUsage':            { pt: 'Uso de IA hoje',         en: 'AI usage today' },
  'news.aiUsageRemaining':   { pt: 'restantes',              en: 'remaining' },
  'news.aiUsageUpgrade':     { pt: 'Aumente seu limite',     en: 'Increase your limit' },
  'news.locked':             { pt: 'Bloqueado',              en: 'Locked' },
  'news.portalRequired':     { pt: 'Portal necessário',      en: 'Portal required' },
  'news.dailyLimitReached':  { pt: 'Limite de gerações do dia atingido. Tente amanhã.', en: 'Daily AI limit reached. Try again tomorrow.' },
  'news.generateError':      { pt: 'Erro ao gerar. Tente novamente.', en: 'Failed to generate. Try again.' },
  'news.createPortalFirst':  { pt: 'Crie um portal personalizado nas Configurações para usar esta opção.', en: 'Create a custom portal in Settings to use this option.' },
  'news.aiRumors':           { pt: 'Rumores com IA',         en: 'AI rumors' },
  'news.aiLeaks':            { pt: 'Vazamentos com IA',      en: 'Leaked stories' },
  'news.requiredPlanHint':   { pt: 'Disponível no plano necessário.', en: 'Available on the required plan.' },

  // bug report
  'bugReport.screenshot':    { pt: 'Captura de tela (opcional)', en: 'Screenshot (optional)' },
  'bugReport.attach':        { pt: 'Anexar captura',           en: 'Attach screenshot' },
  'bugReport.remove':        { pt: 'Remover',                  en: 'Remove' },
  'bugReport.bothFields':    { pt: 'Preencha ambos os campos.',en: 'Please fill in both fields.' },
  'bugReport.galleryDenied': { pt: 'Permissão à galeria negada.', en: 'Gallery permission denied.' },

  // toasts
  'toast.board.newReply':    { pt: 'Resposta da diretoria',     en: 'Board reply' },
  'toast.community.quotaWarn':    { pt: 'Cota da comunidade quase no limite', en: 'Community quota almost reached' },
  'toast.community.quotaExceeded':{ pt: 'Cota da comunidade esgotada',        en: 'Community quota exceeded' },

  // plan labels
  'plan.free':  { pt: 'Gratuito', en: 'Free' },
  'plan.pro':   { pt: 'Pro',      en: 'Pro' },
  'plan.ultra': { pt: 'Ultra',    en: 'Ultra' },

  // news option labels
  'news.opt.noticia.label':     { pt: 'Gerar Notícia',          en: 'Generate News' },
  'news.opt.noticia.desc':      { pt: 'Notícia sobre o clube com IA', en: 'AI-generated club news' },
  'news.opt.rumor.label':       { pt: 'Gerar Rumor',            en: 'Generate Rumor' },
  'news.opt.rumor.desc':        { pt: 'Rumor de mercado de transferências', en: 'Transfer market rumor' },
  'news.opt.boasVindas.label':  { pt: 'Post de Boas-Vindas',    en: 'Welcome Post' },
  'news.opt.boasVindas.desc':   { pt: 'Apresentação do treinador ao clube', en: 'Coach introduction to the club' },
  'news.opt.leak.label':        { pt: 'Gerar Vazamento',        en: 'Generate Leak' },
  'news.opt.leak.desc':         { pt: 'Bastidores vazados para a imprensa', en: 'Behind-the-scenes story for the press' },
  'news.modal.title':           { pt: 'Gerar Conteúdo com IA',  en: 'Generate Content with AI' },
  'news.modal.contextLabel':    { pt: 'CONTEXTO (OPCIONAL)',    en: 'CONTEXT (OPTIONAL)' },
  'news.modal.contextHint':     { pt: 'Adicione detalhes para guiar a geração.', en: 'Add details to guide generation.' },
  'news.modal.generateBtn':     { pt: 'Gerar',                  en: 'Generate' },
  'news.modal.cancelBtn':       { pt: 'Cancelar',               en: 'Cancel' },
  'news.title':                 { pt: 'Notícias',               en: 'News' },
  'news.itemsCount.one':        { pt: 'notícia',                en: 'item' },
  'news.itemsCount.other':      { pt: 'notícias',               en: 'items' },
  'news.empty.title':           { pt: 'Sem notícias',           en: 'No news yet' },
  'news.empty.text':            { pt: 'Notícias aparecem após registrar partidas ou ao gerar com IA.', en: 'News appears after recording matches or generating with AI.' },
  'news.empty.cta':             { pt: 'Gerar primeira notícia', en: 'Generate your first news' },
  'news.adding':                { pt: 'Adicionando notícia ao feed…', en: 'Adding news to feed…' },
  'news.headerCta':             { pt: 'Gerar',                  en: 'Generate' },

  // settings extras
  'settings.support':            { pt: 'Suporte',                en: 'Support' },
  'settings.support.bugReport':  { pt: 'Reportar problema',      en: 'Report a problem' },
  'settings.support.email':      { pt: 'Falar com o suporte',    en: 'Contact support' },
  'settings.about':              { pt: 'Sobre',                  en: 'About' },
  'settings.exportShare':        { pt: 'Compartilhar exportação',en: 'Share export' },
  'settings.exportSubject':      { pt: 'Exportação da carreira', en: 'Career export' },

  // news type labels
  'news.type.vitoria':       { pt: 'Vitória',         en: 'Win' },
  'news.type.derrota':       { pt: 'Derrota',         en: 'Loss' },
  'news.type.empate':        { pt: 'Empate',          en: 'Draw' },
  'news.type.lesao':         { pt: 'Lesão',           en: 'Injury' },
  'news.type.transferencia': { pt: 'Transferência',   en: 'Transfer' },
  'news.type.conquista':     { pt: 'Conquista',       en: 'Achievement' },
  'news.type.treino':        { pt: 'Treino',          en: 'Training' },
  'news.type.geral':         { pt: 'Notícia',         en: 'News' },

  // image-key modal
  'news.imageKey.title':     { pt: '🔑 Chave OpenAI',  en: '🔑 OpenAI Key' },
  'news.imageKey.hint':      { pt: 'Para gerar imagens, insira sua chave de API da OpenAI (começa com sk-). Ela é salva localmente no dispositivo.', en: 'To generate images, enter your OpenAI API key (starts with sk-). Stored locally on your device.' },
  'news.imageKey.confirm':   { pt: 'Confirmar',        en: 'Confirm' },

  // configuracoes settings
  'settings.section.portals':    { pt: 'Portais de Notícias',     en: 'News Portals' },
  'settings.section.season':     { pt: 'Temporada',               en: 'Season' },
  'settings.section.ai':         { pt: 'Inteligência Artificial', en: 'Artificial Intelligence' },
  'settings.section.sound':      { pt: 'Som e Haptics',           en: 'Sound & Haptics' },
  'settings.portals.default':    { pt: 'Portais padrão',          en: 'Default portals' },
  'settings.portals.custom':     { pt: 'Portais personalizados',  en: 'Custom portals' },
  'settings.portals.create':     { pt: 'Criar portal',            en: 'Create portal' },
  'settings.portals.deleteTitle':{ pt: 'Excluir portal',          en: 'Delete portal' },
  'settings.portals.deleteMsg':  { pt: 'Deseja excluir este portal?', en: 'Delete this portal?' },
  'settings.portals.nameRequired':{ pt: 'Nome obrigatório',       en: 'Name required' },
  'settings.portals.nameRequiredMsg':{ pt: 'Digite o nome do portal.', en: 'Enter the portal name.' },
  'settings.portals.createError':{ pt: 'Não foi possível criar o portal.', en: 'Could not create the portal.' },
  'settings.portals.photoError': { pt: 'Não foi possível atualizar a foto do portal.', en: 'Could not update the portal photo.' },
  'settings.season.endTitle':    { pt: 'Temporada finalizada',    en: 'Season ended' },
  'common.email':                { pt: 'E-mail',                  en: 'Email' },
  'common.delete':               { pt: 'Excluir',                 en: 'Delete' },
  'settings.season.active':      { pt: 'Temporada ativa',         en: 'Active season' },
  'settings.ai.enabled':         { pt: 'IA ativada',              en: 'AI enabled' },
  'settings.sound.enabled':      { pt: 'Som e vibrações',         en: 'Sound & vibrations' },
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
