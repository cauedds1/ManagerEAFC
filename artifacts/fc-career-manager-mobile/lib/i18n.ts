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
  'settings.ai.hint':            { pt: 'Notícias geradas por IA, análises e Diretoria', en: 'AI-generated news, analysis and Boardroom' },
  'settings.sound.hint':         { pt: 'Feedback tátil ao registrar partidas e ações', en: 'Haptic feedback when recording matches and actions' },
  'settings.season.new':         { pt: 'Nova temporada',          en: 'New season' },
  'settings.season.finalize':    { pt: 'Finalizar temporada',     en: 'Finalize season' },
  'settings.season.finalizeAction':{ pt: 'Finalizar',             en: 'Finalize' },
  'settings.season.noActiveTitle': { pt: 'Nenhuma temporada ativa', en: 'No active season' },
  'settings.season.noActiveMsg':   { pt: 'Não há temporada ativa para finalizar.', en: 'No active season to finalize.' },
  'settings.career.notSelectedTitle': { pt: 'Carreira não selecionada', en: 'No career selected' },
  'settings.career.notSelectedMsg':   { pt: 'Selecione uma carreira primeiro.', en: 'Select a career first.' },
  'settings.boardAi':            { pt: 'Diretoria IA',            en: 'AI Boardroom' },
  'settings.boardAi.active':     { pt: 'Ativada',                 en: 'Enabled' },
  'settings.boardAi.requires':   { pt: 'Requer Pro',              en: 'Requires Pro' },
  'settings.danger':             { pt: 'Zona de perigo',          en: 'Danger zone' },
  'settings.deleteAccount':      { pt: 'Excluir conta',           en: 'Delete account' },
  'settings.deleteAccountMsg':   { pt: 'Esta ação é irreversível. Todos os seus dados serão apagados permanentemente.', en: 'This action is irreversible. All your data will be permanently deleted.' },
  'settings.deleteRequested':    { pt: 'Exclusão solicitada',     en: 'Deletion requested' },
  'settings.deleteRequestedMsg': { pt: 'Entraremos em contato pelo e-mail cadastrado para confirmar.', en: 'We will contact you via the registered email to confirm.' },
  'settings.newPortal':          { pt: 'Novo portal',             en: 'New portal' },
  'settings.newPortal.create':   { pt: 'Criar',                   en: 'Create' },
  'settings.newPortal.name':     { pt: 'Nome do portal *',        en: 'Portal name *' },
  'settings.newPortal.namePh':   { pt: 'Ex: Folha do Torcedor',   en: 'e.g.: Fan Daily' },
  'settings.newPortal.desc':     { pt: 'Descrição',               en: 'Description' },
  'settings.newPortal.descPh':   { pt: 'Como este portal cobre as notícias…', en: 'How this portal covers the news…' },
  'settings.newPortal.tone':     { pt: 'Tom de escrita',          en: 'Writing tone' },

  // diretoria
  'diretoria.removeMemberTitle': { pt: 'Remover membro',          en: 'Remove member' },
  'diretoria.removeMemberMsg':   { pt: 'Tem certeza?',            en: 'Are you sure?' },
  'diretoria.generateError':     { pt: 'Não foi possível gerar o membro. Tente novamente.', en: 'Could not generate the member. Please try again.' },
  'diretoria.field.topicPh':     { pt: 'Descreva a pauta…',       en: 'Describe the topic…' },
  'diretoria.field.namePh':      { pt: 'Nome do dirigente',       en: 'Member name' },
  'diretoria.field.bioPh':       { pt: 'Personalidade, histórico…', en: 'Personality, background…' },
  'diretoria.meeting.title.member':{ pt: 'Convocar Reunião',      en: 'Call Meeting' },
  'diretoria.meeting.title.topic': { pt: 'Escolher Pauta',        en: 'Choose Topic' },
  'diretoria.meeting.title.minutes':{ pt: 'Ata da Reunião',       en: 'Meeting Minutes' },
  'diretoria.meeting.minutesHeader':{ pt: '📋 Ata da Reunião',    en: '📋 Meeting Minutes' },
  'diretoria.meeting.memberLabel':{ pt: 'Membro:',                 en: 'Member:' },
  'diretoria.aiGenerate':        { pt: 'Gerar com IA',            en: 'Generate with AI' },
  'common.remove':               { pt: 'Remover',                 en: 'Remove' },
  'news.modal.titleHeader':      { pt: '✨ Gerar com IA',          en: '✨ Generate with AI' },
  'news.modal.typeLabel':        { pt: 'TIPO',                    en: 'TYPE' },
  'news.modal.portalPrefix':     { pt: 'Portal:',                 en: 'Portal:' },
  'news.modal.source':           { pt: 'Fonte',                   en: 'Source' },
  'news.modal.generatingImage':  { pt: 'Gerando…',                en: 'Generating…' },
  'news.modal.generateImage':    { pt: 'Gerar Imagem',            en: 'Generate Image' },
  'news.modal.close':            { pt: 'Fechar',                  en: 'Close' },
  'news.modal.portalRequired':   { pt: 'Portal necessário',       en: 'Portal required' },
  'news.modal.imageError':       { pt: 'Erro ao gerar imagem. Tente novamente.', en: 'Image generation failed. Please try again.' },
  'diretoria.topic.0':           { pt: 'Avaliação do desempenho na temporada', en: 'Season performance review' },
  'diretoria.topic.1':           { pt: 'Situação no mercado de transferências', en: 'Transfer market situation' },
  'diretoria.topic.2':           { pt: 'Gestão financeira e orçamento', en: 'Finance and budget management' },
  'diretoria.topic.3':           { pt: 'Objetivos e metas da temporada', en: 'Season objectives and goals' },
  'diretoria.topic.4':           { pt: 'Pressão por resultados recentes', en: 'Pressure over recent results' },
  'diretoria.topic.5':           { pt: 'Renovações de contrato', en: 'Contract renewals' },
  'diretoria.topic.6':           { pt: 'Planejamento tático', en: 'Tactical planning' },
  'diretoria.topic.7':           { pt: 'Outro assunto',          en: 'Another topic' },
  'diretoria.meetingHintPrefix': { pt: 'Pauta da reunião com',   en: 'Meeting topic with' },
  'diretoria.input.noMembers':   { pt: 'Adicione membros da diretoria', en: 'Add board members first' },
  'diretoria.input.toMember':    { pt: 'Mensagem para',          en: 'Message to' },
  'diretoria.input.topicPh':     { pt: 'Escreva uma pauta ou pergunta…', en: 'Write a topic or question…' },
  'checkout.success.title':      { pt: 'Pagamento confirmado',    en: 'Payment confirmed' },
  'checkout.success.body':       { pt: 'Seu plano foi atualizado. Você já pode voltar ao app.', en: 'Your plan has been updated. You can return to the app.' },
  'checkout.cancel.title':       { pt: 'Pagamento cancelado',     en: 'Payment canceled' },
  'checkout.cancel.body':        { pt: 'Nenhuma cobrança foi feita. Você pode tentar novamente quando quiser.', en: 'No charge was made. You can try again whenever you like.' },
  'checkout.back':               { pt: 'Voltar ao app',           en: 'Return to app' },
  'checkout.billing.title':      { pt: 'Assinatura atualizada',   en: 'Subscription updated' },
  'checkout.billing.body':       { pt: 'Suas alterações de assinatura foram salvas. Você já pode voltar ao app.', en: 'Your subscription changes have been saved. You can return to the app.' },
  'common.ok':                   { pt: 'OK',                      en: 'OK' },
  'common.discover':             { pt: 'Descobrir',               en: 'Discover' },
  'registrarPartida.saveError':  { pt: 'Não foi possível salvar a partida.', en: 'Could not save the match.' },

  // Landing / welcome screen
  'landing.kicker':              { pt: 'FC CAREER MANAGER',       en: 'FC CAREER MANAGER' },
  'landing.title':               { pt: 'Bem-vindo,',              en: 'Welcome,' },
  'landing.subtitle':            { pt: 'Gerencie sua carreira como técnico — partidas, elenco, transferências e mais, com IA.', en: 'Manage your manager career — matches, squad, transfers and more, with AI.' },
  'landing.coachFallback':       { pt: 'Treinador',               en: 'Coach' },
  'landing.feature.ai.title':    { pt: 'Diretoria IA',            en: 'AI Boardroom' },
  'landing.feature.ai.desc':     { pt: 'Reuniões e decisões guiadas por IA', en: 'AI-guided meetings and calls' },
  'landing.feature.news.title':  { pt: 'Notícias',                en: 'News' },
  'landing.feature.news.desc':   { pt: 'Manchetes geradas para sua carreira', en: 'Headlines generated for your career' },
  'landing.feature.community.title': { pt: 'Comunidade',          en: 'Community' },
  'landing.feature.community.desc':  { pt: 'Compartilhe momentos e veja outros técnicos', en: 'Share moments and follow other coaches' },
  'landing.feature.trophies.title':  { pt: 'Troféus',             en: 'Trophies' },
  'landing.feature.trophies.desc':   { pt: 'Histórico de conquistas',         en: 'Trophy history and stats' },
  'landing.howItWorks':          { pt: 'COMO FUNCIONA',           en: 'HOW IT WORKS' },
  'landing.step1.title':         { pt: 'Crie sua carreira',       en: 'Create your career' },
  'landing.step1.desc':          { pt: 'Escolha um clube e seu treinador',   en: 'Pick a club and your coach' },
  'landing.step2.title':         { pt: 'Registre partidas',       en: 'Log matches' },
  'landing.step2.desc':          { pt: 'Acompanhe resultados e estatísticas', en: 'Track results and stats' },
  'landing.step3.title':         { pt: 'Use a IA',                en: 'Use the AI' },
  'landing.step3.desc':          { pt: 'Gere notícias e converse com a diretoria', en: 'Generate news and chat with the board' },
  'landing.community.title':     { pt: 'Comunidade ao vivo',      en: 'Live community' },
  'landing.community.sub':       { pt: 'Treinadores do mundo todo',           en: 'Coaches from around the world' },
  'landing.cta.start':           { pt: 'Começar',                 en: 'Get started' },
  'landing.cta.login':           { pt: 'Já tenho conta',          en: 'I already have an account' },

  // News ticker
  'news.ticker.label':           { pt: 'NOTÍCIAS',                en: 'NEWS' },

  // Career reveal reel
  'reveal.kicker':               { pt: 'NOVA CARREIRA',           en: 'NEW CAREER' },
  'reveal.intro.title':          { pt: 'Uma nova jornada começa', en: 'A new journey begins' },
  'reveal.intro.sub':            { pt: 'Prepare-se para escrever sua história.', en: 'Get ready to write your story.' },
  'reveal.club.kicker':          { pt: 'SEU CLUBE',               en: 'YOUR CLUB' },
  'reveal.coach.kicker':         { pt: 'NA BEIRA DO CAMPO',       en: 'ON THE TOUCHLINE' },
  'reveal.season.kicker':        { pt: 'TEMPORADA INICIAL',       en: 'OPENING SEASON' },
  'reveal.season.sub':           { pt: 'Cada decisão conta.',     en: 'Every decision counts.' },
  'reveal.finale.kicker':        { pt: 'VAMOS LÁ',                en: 'LET\'S GO' },
  'reveal.finale.title':         { pt: 'A bola vai rolar',        en: 'The ball is about to roll' },
  'reveal.finale.cta':           { pt: 'Entrar no clube',         en: 'Enter the club' },
  'reveal.tapHint':              { pt: 'Toque para avançar',      en: 'Tap to skip ahead' },

  // Reels modal (milestone moments)
  'reels.momentLabel':           { pt: 'MOMENTO',                 en: 'MOMENT' },
  'reels.share':                 { pt: 'Compartilhar',            en: 'Share' },

  // Section help & onboarding hints
  'help.openLabel':              { pt: 'Abrir ajuda',             en: 'Open help' },
  'help.news.title':             { pt: 'Notícias',                en: 'News' },
  'help.news.body':              { pt: 'Manchetes da sua carreira são geradas por IA. Toque em uma para ler.', en: 'Career headlines are generated by AI. Tap one to read.' },
  'help.news.tip':               { pt: 'Dica: rumores e leaks ficam mais ricos com plano Pro/Ultra.', en: 'Tip: rumours and leaks are richer on Pro/Ultra.' },
  'help.squad.title':            { pt: 'Elenco',                  en: 'Squad' },
  'help.squad.body':             { pt: 'Veja jogadores, posições e moral. Toque em um para detalhes.', en: 'See players, positions and morale. Tap one for details.' },
  'help.squad.tip':              { pt: 'Joias da base aparecem com a etiqueta "Cria".', en: 'Academy gems show a "Cria" badge.' },
  'help.diretoria.title':        { pt: 'Diretoria',               en: 'Boardroom' },
  'help.diretoria.body':         { pt: 'Converse com a diretoria com IA. Cada reunião reflete o momento do clube.', en: 'Chat with your AI board. Each meeting reflects the club\'s state.' },
  'help.diretoria.tip':          { pt: 'Pauta clara = resposta melhor.', en: 'A clear agenda yields better replies.' },
  'help.transfers.title':        { pt: 'Transferências',          en: 'Transfers' },
  'help.transfers.body':         { pt: 'Acompanhe a janela de transferências e movimentos do mercado.', en: 'Track the transfer window and market moves.' },
  'help.transfers.tip':          { pt: 'A janela limita quando você pode reforçar.', en: 'The window limits when you can sign players.' },

  // Curiosity teasers
  'teaser.after_match_diretoria.headline': { pt: 'A diretoria está comentando a partida', en: 'The board is reacting to the match' },
  'teaser.after_match_diretoria.preview':  { pt: '"Resultado aceitável. Mas precisamos melhorar fora de casa..."', en: '"Acceptable result. But we need to improve away from home..."' },
  'teaser.after_match_diretoria.sub':      { pt: 'Veja a reação completa em Diretoria.', en: 'See the full reaction in Boardroom.' },
  'teaser.after_match_diretoria.cta':      { pt: 'Abrir Diretoria',         en: 'Open Boardroom' },
  'teaser.after_news_auto.headline':       { pt: 'O motor automático está aquecendo', en: 'The auto news engine is warming up' },
  'teaser.after_news_auto.preview':        { pt: 'BREAKING: Técnico conquista vitória expressiva', en: 'BREAKING: Coach delivers commanding win' },
  'teaser.after_news_auto.sub':            { pt: 'Notícias geradas sozinhas no Ultra.', en: 'News generated for you on Ultra.' },
  'teaser.after_news_auto.cta':            { pt: 'Ver notícias',            en: 'See news' },
  'teaser.after_squad_rumor.headline':     { pt: 'Tem rumor circulando',    en: 'A rumour is going around' },
  'teaser.after_squad_rumor.preview':      { pt: 'Clube europeu monitora seu atacante. Proposta pode chegar.', en: 'European club monitors your striker. Bid may arrive soon.' },
  'teaser.after_squad_rumor.sub':          { pt: 'Rumores aparecem no Ultra.', en: 'Rumours appear on Ultra.' },
  'teaser.after_squad_rumor.cta':          { pt: 'Abrir Notícias',          en: 'Open News' },
  'teaser.after_momento_videonews.headline': { pt: 'Tem novo Momento publicado', en: 'A new Moment has been posted' },
  'teaser.after_momento_videonews.preview':  { pt: '🎬 Golaço aos 89\' — Compilação do mês', en: '🎬 Stunner at 89\' — Month\'s compilation' },
  'teaser.after_momento_videonews.sub':      { pt: 'Acompanhe na aba Momentos.', en: 'See it in the Moments tab.' },
  'teaser.after_momento_videonews.cta':      { pt: 'Ver Momentos',          en: 'See Moments' },
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
