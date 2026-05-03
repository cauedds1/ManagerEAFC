import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  ScrollView, Platform, RefreshControl, ActivityIndicator, Image, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useCareer } from '@/contexts/CareerContext';
import { useAuth } from '@/contexts/AuthContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type NewsItem, type CustomPortal } from '@/lib/api';
import { Colors } from '@/constants/colors';
import { queryClient } from '@/lib/queryClient';
import { router } from 'expo-router';
import { getLang, useT } from '@/lib/i18n';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { useToast } from '@/components/Toast';

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  vitoria:      { icon: '🏆', color: Colors.success,          label: 'Vitória' },
  derrota:      { icon: '😔', color: Colors.destructive,      label: 'Derrota' },
  empate:       { icon: '🤝', color: Colors.warning,          label: 'Empate' },
  lesao:        { icon: '🤕', color: Colors.destructive,      label: 'Lesão' },
  transferencia:{ icon: '🔄', color: Colors.info,             label: 'Transferência' },
  conquista:    { icon: '🥇', color: Colors.warning,          label: 'Conquista' },
  treino:       { icon: '⚽', color: Colors.mutedForeground,  label: 'Treino' },
  geral:        { icon: '📰', color: Colors.mutedForeground,  label: 'Notícia' },
};

function getTypeCfg(type?: string) {
  if (!type) return TYPE_CONFIG.geral;
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.geral;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function socialPostToNewsItem(raw: Record<string, unknown>, type?: string): NewsItem {
  const headline =
    (raw.title as string) ||
    (raw.headline as string) ||
    'Notícia gerada';
  const body =
    (raw.content as string) ||
    (raw.body as string) ||
    '';
  const noticia = raw.noticia as Record<string, unknown> | undefined;
  if (noticia) {
    return {
      id: (noticia.id as string) || `gen_${Date.now()}`,
      headline: (noticia.headline as string) || headline,
      body: (noticia.body as string) || body,
      type: (noticia.type as string) || type || 'geral',
      source: (noticia.source as string) || (raw.sourceName as string) || undefined,
      createdAt: (noticia.createdAt as number) || Date.now(),
    };
  }
  return {
    id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    headline,
    body,
    type: (raw.category as string) || type || 'geral',
    source: (raw.sourceName as string) || undefined,
    createdAt: Date.now(),
  };
}

type GenType = 'noticia' | 'rumor' | 'boas_vindas' | 'leak';

const GEN_OPTIONS: { id: GenType; icon: string; label: string; desc: string; planRequired?: 'pro' | 'ultra'; needsPortal?: boolean }[] = [
  { id: 'noticia',     icon: '📰', label: 'Gerar Notícia',         desc: 'Notícia sobre o clube com IA' },
  { id: 'rumor',       icon: '🕵️', label: 'Gerar Rumor',           desc: 'Rumor de mercado de transferências', planRequired: 'ultra' },
  { id: 'boas_vindas', icon: '👋', label: 'Post de Boas-Vindas',   desc: 'Apresentação do treinador ao clube' },
  { id: 'leak',        icon: '🔓', label: 'Gerar Vazamento',        desc: 'Bastidores vazados para a imprensa', planRequired: 'pro', needsPortal: true },
];

const OPENAI_KEY_STORE = 'fc_openai_key';

async function getStoredOpenAiKey(): Promise<string> {
  if (Platform.OS === 'web') return localStorage.getItem(OPENAI_KEY_STORE) ?? '';
  return (await SecureStore.getItemAsync(OPENAI_KEY_STORE)) ?? '';
}
async function saveOpenAiKey(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(OPENAI_KEY_STORE, key); return; }
  await SecureStore.setItemAsync(OPENAI_KEY_STORE, key);
}

function ImageKeyModal({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: (key: string) => void }) {
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState('');
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.genSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.genHeader}>
            <Text style={styles.genTitle}>🔑 Chave OpenAI</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={[styles.genBody, { gap: 12 }]}>
            <Text style={styles.optionDesc}>
              Para gerar imagens, insira sua chave de API da OpenAI (começa com sk-). Ela é salva localmente no dispositivo.
            </Text>
            <TextInput
              style={styles.descInput}
              value={key}
              onChangeText={setKey}
              placeholder="sk-..."
              placeholderTextColor={Colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>
          <View style={styles.genFooter}>
            <TouchableOpacity
              style={[styles.genBtn, { backgroundColor: `${Colors.primary}22`, borderColor: `${Colors.primary}44` }, !key.startsWith('sk-') && { opacity: 0.5 }]}
              onPress={() => { if (key.startsWith('sk-')) { saveOpenAiKey(key); onConfirm(key); } }}
              disabled={!key.startsWith('sk-')}
            >
              <Ionicons name="checkmark" size={18} color={Colors.primary} />
              <Text style={[styles.genBtnText, { color: Colors.primary }]}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface NewsModalProps {
  item: NewsItem;
  onClose: () => void;
  userPlan?: 'free' | 'pro' | 'ultra';
  clubName?: string;
  onImageGenerated?: (newsId: string, imageUrl: string) => void;
}

function NewsModal({ item, onClose, userPlan, clubName, onImageGenerated }: NewsModalProps) {
  const insets = useSafeAreaInsets();
  const cfg = getTypeCfg(item.type);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const canGenImage = userPlan === 'pro' || userPlan === 'ultra';

  const doGenerateImage = async (openAiKey: string) => {
    if (!clubName) return;
    setImgLoading(true);
    setImgError(null);
    try {
      const eventType = item.type === 'vitoria' ? 'victory' : item.type === 'derrota' ? 'defeat' : 'general';
      const result = await api.noticias.generateImage(
        { clubName, imagePromptContext: { eventType } },
        openAiKey,
      );
      onImageGenerated?.(item.id, result.imageUrl);
      setShowKeyModal(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('OpenAI') || msg.includes('sk-') || msg.includes('402')) {
        setShowKeyModal(true);
      } else {
        setImgError('Erro ao gerar imagem. Tente novamente.');
      }
    }
    setImgLoading(false);
  };

  const handleGenerateImage = async () => {
    const storedKey = await getStoredOpenAiKey();
    if (storedKey.startsWith('sk-')) {
      await doGenerateImage(storedKey);
    } else {
      setShowKeyModal(true);
    }
  };

  return (
    <>
      <Modal visible transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalContainer, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.modalImage} resizeMode="cover" />
            ) : null}
            <View style={[styles.typeChip, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}33` }]}>
              <Text style={styles.typeChipEmoji}>{cfg.icon}</Text>
              <Text style={[styles.typeChipText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={styles.modalHeadline}>{item.headline}</Text>
            <View style={styles.modalMeta}>
              <Text style={styles.modalDate}>{formatDate(item.createdAt)}</Text>
              {item.source ? (
                <Text style={styles.modalSource}>Fonte: {item.source}</Text>
              ) : null}
            </View>
            <View style={styles.modalDivider} />
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
              <Text style={styles.modalBody}>{item.body}</Text>
            </ScrollView>
            {imgError ? (
              <Text style={{ color: Colors.destructive, fontSize: 12, textAlign: 'center', marginTop: 6 }}>{imgError}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              {canGenImage && !item.imageUrl && onImageGenerated && (
                <TouchableOpacity
                  style={[styles.closeBtn, { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: `${Colors.info}18`, borderColor: `${Colors.info}33`, borderWidth: 1 }]}
                  onPress={handleGenerateImage}
                  disabled={imgLoading}
                >
                  {imgLoading
                    ? <ActivityIndicator size="small" color={Colors.info} />
                    : <Ionicons name="image-outline" size={16} color={Colors.info} />
                  }
                  <Text style={[styles.closeBtnText, { color: Colors.info }]}>
                    {imgLoading ? 'Gerando…' : 'Gerar Imagem'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.closeBtn, { flex: 1 }]} onPress={onClose}>
                <Text style={styles.closeBtnText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <ImageKeyModal
        visible={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        onConfirm={(k) => doGenerateImage(k)}
      />
    </>
  );
}

interface GenerateModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerated: (item: NewsItem) => void;
  clubName: string;
  clubLeague?: string;
  clubDescription?: string;
  projeto?: string;
  coachName?: string;
  coachNationality?: string;
  seasonLabel?: string;
  userPlan: 'free' | 'pro' | 'ultra';
  portals?: CustomPortal[];
}

function GenerateModal({
  visible, onClose, onGenerated,
  clubName, clubLeague, clubDescription, projeto,
  coachName, coachNationality, seasonLabel, userPlan, portals,
}: GenerateModalProps) {
  const theme = useClubTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<GenType>('noticia');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const requiredForSelected: 'pro' | 'ultra' | null =
    GEN_OPTIONS.find((o) => o.id === selected)?.planRequired ?? null;

  const lang = getLang();
  const t = useT();
  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      let raw: Record<string, unknown>;
      if (selected === 'noticia') {
        const desc = description.trim() || (lang === 'en'
          ? `Write a creative, interesting news article about ${clubName} in season ${seasonLabel ?? ''}.`
          : `Gere uma notícia criativa e interessante sobre o ${clubName} na temporada ${seasonLabel ?? ''}.`);
        raw = await api.noticias.generateManual({
          description: desc,
          clubName,
          season: seasonLabel,
          source: 'fanpage',
          category: 'geral',
          clubLeague,
          clubDescription,
          projeto,
          lang,
        });
      } else if (selected === 'rumor') {
        raw = await api.noticias.generateRumor({
          clubName,
          season: seasonLabel,
          clubLeague,
          clubDescription,
          projeto,
          lang,
        });
      } else if (selected === 'leak') {
        const portal = portals?.[0];
        if (!portal) {
          setError(t('news.createPortalFirst'));
          setLoading(false);
          return;
        }
        const ctx = description.trim() || (lang === 'en'
          ? `Behind the scenes at ${clubName} in season ${seasonLabel ?? ''}`
          : `Bastidores do ${clubName} na temporada ${seasonLabel ?? ''}`);
        raw = await api.noticias.generateLeak({
          clubName,
          season: seasonLabel,
          clubLeague,
          notificationPreview: ctx,
          customPortal: { name: portal.name, tone: portal.tone },
          lang,
        });
      } else {
        raw = await api.noticias.generateWelcome({
          coachName: coachName ?? (lang === 'en' ? 'Coach' : 'Técnico'),
          coachNationality,
          clubName,
          clubLeague,
          clubDescription,
          projeto,
          lang,
        });
      }
      const item = socialPostToNewsItem(raw, selected === 'rumor' ? 'transferencia' : selected === 'leak' ? 'geral' : 'geral');
      onGenerated(item);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Ultra') || msg.includes('Pro') || msg.includes('PLAN')) {
        setShowPaywall(true);
      } else if (msg.includes('Limite') || msg.includes('limit')) {
        setError(t('news.dailyLimitReached'));
        setShowPaywall(true);
      } else {
        setError(t('news.generateError'));
      }
    }
    setLoading(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.genSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.genHeader}>
            <Text style={styles.genTitle}>✨ Gerar com IA</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.genBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.genSectionLabel}>TIPO</Text>
            <View style={styles.optionList}>
              {GEN_OPTIONS.map((opt) => {
                const planLocked =
                  (opt.planRequired === 'ultra' && userPlan !== 'ultra') ||
                  (opt.planRequired === 'pro' && userPlan === 'free');
                const portalLocked = opt.needsPortal && (!portals || portals.length === 0);
                const locked = planLocked || portalLocked;
                const active = selected === opt.id;
                const lockLabel = planLocked
                  ? (opt.planRequired === 'ultra' ? '  •  Ultra' : '  •  Pro')
                  : portalLocked ? `  •  ${getLang() === 'en' ? 'Portal required' : 'Portal necessário'}` : '';
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.optionRow,
                      active && { backgroundColor: `rgba(${theme.primaryRgb},0.12)`, borderColor: `rgba(${theme.primaryRgb},0.35)` },
                      locked && !planLocked && { opacity: 0.55 },
                    ]}
                    onPress={() => {
                      setSelected(opt.id);
                      if (planLocked) setShowPaywall(true);
                      else setShowPaywall(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.optionIcon}>{opt.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, active && { color: theme.primary }]}>{opt.label}</Text>
                      <Text style={styles.optionDesc}>{opt.desc}{locked ? lockLabel : ''}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                    {locked && <Ionicons name="lock-closed" size={16} color={Colors.mutedForeground} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {(selected === 'noticia' || selected === 'leak') && (
              <View style={{ marginTop: 12, gap: 6 }}>
                <Text style={styles.genSectionLabel}>
                  {selected === 'leak' ? 'CONTEXTO DO VAZAMENTO (opcional)' : 'DESCRIÇÃO (opcional)'}
                </Text>
                <TextInput
                  style={styles.descInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={
                    selected === 'leak'
                      ? `Ex: Reunião tensa sobre contratações no ${clubName}…`
                      : `Ex: Fale sobre a última vitória do ${clubName}…`
                  }
                  placeholderTextColor={Colors.mutedForeground}
                  multiline
                  maxLength={300}
                />
                {selected === 'leak' && portals && portals.length > 0 && (
                  <Text style={styles.optionDesc}>Portal: {portals[0].name}</Text>
                )}
              </View>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={16} color={Colors.destructive} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {showPaywall && requiredForSelected ? (
              <View style={{ marginTop: 12 }}>
                <UpgradePrompt
                  currentPlan={userPlan}
                  requiredPlan={requiredForSelected}
                  featureName={requiredForSelected === 'ultra' ? t('news.aiRumors') : t('news.aiLeaks')}
                  description={t('news.requiredPlanHint')}
                  compact
                  onUpgraded={() => setShowPaywall(false)}
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.genFooter}>
            <TouchableOpacity
              style={[styles.genBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.18)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }, loading && { opacity: 0.7 }]}
              onPress={handleGenerate}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color={theme.primary} />
                : <>
                    <Ionicons name="sparkles-outline" size={18} color={theme.primary} />
                    <Text style={[styles.genBtnText, { color: theme.primary }]}>Gerar</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const { activeSeason, activeCareer } = useCareer();
  const { user } = useAuth();
  const theme = useClubTheme();
  const tr = useT();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: aiUsage } = useQuery({
    queryKey: ['/api/noticias/ai-usage'],
    queryFn: () => api.aiUsage.get(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const usagePct = aiUsage && aiUsage.aiUsageLimit > 0 ? aiUsage.aiUsageToday / aiUsage.aiUsageLimit : 0;
  const lastWarnRef = useRef(0);
  useEffect(() => {
    if (!aiUsage) return;
    const now = Date.now();
    if (now - lastWarnRef.current < 60_000) return;
    if (aiUsage.aiUsageToday >= aiUsage.aiUsageLimit && aiUsage.aiUsageLimit > 0 && aiUsage.aiUsageLimit < 9999) {
      lastWarnRef.current = now;
      showToast({ type: 'warning', title: tr('toast.aiQuota.exceeded'), preview: `${aiUsage.aiUsageToday}/${aiUsage.aiUsageLimit}` });
    } else if (usagePct >= 0.8 && aiUsage.aiUsageLimit < 9999) {
      lastWarnRef.current = now;
      showToast({ type: 'warning', title: tr('toast.aiQuota.warn'), preview: `${aiUsage.aiUsageToday}/${aiUsage.aiUsageLimit}` });
    }
  }, [aiUsage, usagePct, tr, showToast]);

  const { data: seasonData, isLoading } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
    staleTime: 1000 * 60 * 2,
  });

  const { data: portals } = useQuery({
    queryKey: ['/api/portals', activeCareer?.id],
    queryFn: () => activeCareer ? api.portals.list(activeCareer.id) : null,
    enabled: !!activeCareer?.id,
    staleTime: 1000 * 60 * 10,
  });

  const news: NewsItem[] = [...(seasonData?.data?.news ?? [])].sort((a, b) => b.createdAt - a.createdAt);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/data/season', activeSeason?.id] });
    setRefreshing(false);
  }, [activeSeason?.id]);

  const handlePress = (item: NewsItem) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setSelected(item);
  };

  const handleGenerated = useCallback(async (item: NewsItem) => {
    setShowGenerate(false);
    if (!activeSeason) return;
    setGenerating(true);
    try {
      const currentNews: NewsItem[] = seasonData?.data?.news ?? [];
      const updated = [item, ...currentNews];
      await api.seasonData.set(activeSeason.id, 'news', updated);
      await queryClient.invalidateQueries({ queryKey: ['/api/data/season', activeSeason.id] });
      if (Platform.OS !== 'web') {
        try {
          const careerId = activeCareer?.id ?? '';
          const countKey = `fc_news_count_${careerId}`;
          const countStr = await SecureStore.getItemAsync(countKey);
          const count = parseInt(countStr ?? '0', 10) + 1;
          await SecureStore.setItemAsync(countKey, String(count));
          await SecureStore.setItemAsync(`fc_mission_${careerId}_free_gen_news`, '1');
          if (count >= 3) {
            await SecureStore.setItemAsync(`fc_mission_${careerId}_pro_gen_3_news`, '1');
          }
        } catch {}
      }
    } catch {}
    setGenerating(false);
  }, [activeSeason, activeCareer, seasonData]);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{getLang() === 'en' ? 'News' : 'Notícias'}</Text>
          {!isLoading && news.length > 0 && (
            <Text style={styles.subtitle}>{news.length} {getLang() === 'en' ? (news.length === 1 ? 'item' : 'items') : `notícia${news.length !== 1 ? 's' : ''}`}</Text>
          )}
        </View>
        {activeSeason && (
          <TouchableOpacity
            style={[styles.genFab, { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.35)` }]}
            onPress={() => setShowGenerate(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles-outline" size={18} color={theme.primary} />
            <Text style={[styles.genFabText, { color: theme.primary }]}>{getLang() === 'en' ? 'Generate' : 'Gerar'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {aiUsage && aiUsage.aiUsageLimit > 0 && aiUsage.aiUsageLimit < 9999 ? (
        <View style={styles.aiUsageCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiUsageLabel}>{tr('news.aiUsage')}</Text>
            <Text style={styles.aiUsageValue}>
              {aiUsage.aiUsageToday} / {aiUsage.aiUsageLimit} · {Math.max(0, aiUsage.aiUsageLimit - aiUsage.aiUsageToday)} {tr('news.aiUsageRemaining')}
            </Text>
            <View style={styles.aiUsageBarTrack}>
              <View
                style={[
                  styles.aiUsageBarFill,
                  {
                    width: `${Math.min(100, Math.round(usagePct * 100))}%`,
                    backgroundColor: usagePct >= 1 ? Colors.destructive : usagePct >= 0.8 ? '#f59e0b' : theme.primary,
                  },
                ]}
              />
            </View>
          </View>
          {(usagePct >= 0.8 || (user?.plan ?? 'free') === 'free') ? (
            <TouchableOpacity
              style={[styles.aiUsageCta, { backgroundColor: `rgba(${theme.primaryRgb},0.18)`, borderColor: `rgba(${theme.primaryRgb},0.35)` }]}
              onPress={() => router.push('/(tabs)/perfil')}
            >
              <Ionicons name="diamond-outline" size={14} color={theme.primary} />
              <Text style={[styles.aiUsageCtaText, { color: theme.primary }]}>{tr('news.aiUsageUpgrade')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {generating && (
        <View style={styles.generatingBar}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.generatingText}>{getLang() === 'en' ? 'Adding news to feed…' : 'Adicionando notícia ao feed…'}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : news.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.iconWrap, { backgroundColor: `rgba(${theme.primaryRgb}, 0.12)` }]}>
            <Ionicons name="newspaper-outline" size={40} color={theme.primary} />
          </View>
          <Text style={styles.emptyTitle}>{getLang() === 'en' ? 'No news yet' : 'Sem notícias'}</Text>
          <Text style={styles.emptyText}>
            {getLang() === 'en'
              ? 'News appears after recording matches or generating with AI.'
              : 'Notícias aparecem após registrar partidas ou ao gerar com IA.'}
          </Text>
          {activeSeason && (
            <TouchableOpacity
              style={[styles.emptyGenBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.12)`, borderColor: `rgba(${theme.primaryRgb},0.3)` }]}
              onPress={() => setShowGenerate(true)}
            >
              <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
              <Text style={[styles.emptyGenBtnText, { color: theme.primary }]}>
                {getLang() === 'en' ? 'Generate your first news' : 'Gerar primeira notícia'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={news}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const cfg = getTypeCfg(item.type);
            const preview = item.body.length > 100 ? item.body.slice(0, 100) + '…' : item.body;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => handlePress(item)}
                activeOpacity={0.75}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                ) : null}
                <View style={styles.cardTop}>
                  <View style={[styles.typeChip, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}33` }]}>
                    <Text style={styles.typeChipEmoji}>{cfg.icon}</Text>
                    <Text style={[styles.typeChipText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
                    {item.source ? <Text style={styles.cardSource} numberOfLines={1}>{item.source}</Text> : null}
                  </View>
                </View>
                <Text style={styles.headline} numberOfLines={2}>{item.headline}</Text>
                {preview && <Text style={styles.preview} numberOfLines={2}>{preview}</Text>}
                <View style={styles.readMore}>
                  <Text style={[styles.readMoreText, { color: theme.primary }]}>Ler mais</Text>
                  <Ionicons name="chevron-forward" size={14} color={theme.primary} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {selected && (
        <NewsModal
          item={selected}
          onClose={() => setSelected(null)}
          userPlan={user?.plan ?? 'free'}
          clubName={activeCareer?.clubName}
          onImageGenerated={async (newsId, imageUrl) => {
            if (!activeSeason) return;
            try {
              const currentNews: NewsItem[] = seasonData?.data?.news ?? [];
              const updated = currentNews.map((n) => n.id === newsId ? { ...n, imageUrl } : n);
              await api.seasonData.set(activeSeason.id, 'news', updated);
              await queryClient.invalidateQueries({ queryKey: ['/api/data/season', activeSeason.id] });
              setSelected((prev) => prev && prev.id === newsId ? { ...prev, imageUrl } : prev);
            } catch {}
          }}
        />
      )}

      {showGenerate && activeCareer && activeSeason && (
        <GenerateModal
          visible={showGenerate}
          onClose={() => setShowGenerate(false)}
          onGenerated={handleGenerated}
          clubName={activeCareer.clubName}
          clubLeague={activeCareer.clubLeague}
          clubDescription={activeCareer.clubDescription}
          projeto={activeCareer.projeto}
          coachName={activeCareer.coach?.name}
          coachNationality={activeCareer.coach?.nationality}
          seasonLabel={activeSeason.label}
          userPlan={user?.plan ?? 'free'}
          portals={portals ?? []}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 22, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  genFab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  genFabText: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  generatingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  generatingText: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  iconWrap: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  emptyGenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: Colors.radius, borderWidth: 1,
    marginTop: 4,
  },
  emptyGenBtnText: { fontSize: 14, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 8,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 120, borderRadius: Colors.radius, marginBottom: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1,
  },
  typeChipEmoji: { fontSize: 12 },
  typeChipText: { fontSize: 11, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  cardDate: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  headline: { fontSize: 15, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold', lineHeight: 22 },
  preview: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  readMoreText: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  separator: { height: 8 },
  cardSource: { fontSize: 10, color: Colors.info, fontFamily: 'Inter_400Regular', marginTop: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  modalContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, gap: 12,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2, alignSelf: 'center', marginBottom: 8,
  },
  modalImage: { width: '100%', height: 160, borderRadius: Colors.radius, marginBottom: 4 },
  modalHeadline: { fontSize: 17, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold', lineHeight: 26 },
  modalMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  modalDate: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  modalSource: { fontSize: 12, color: Colors.info, fontFamily: 'Inter_400Regular' },
  modalDivider: { height: 1, backgroundColor: Colors.border },
  modalBody: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  closeBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Colors.radius, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  closeBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  genSheet: {
    backgroundColor: Colors.backgroundLighter,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '88%',
  },
  genHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  genTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  genBody: { padding: 20, gap: 8 },
  genSectionLabel: { fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, marginBottom: 6 },
  optionList: { gap: 8 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  optionIcon: { fontSize: 22 },
  optionLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  optionDesc: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  descInput: {
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14,
    minHeight: 72, textAlignVertical: 'top',
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    backgroundColor: `${Colors.destructive}15`, borderRadius: Colors.radius,
    padding: 12, borderWidth: 1, borderColor: `${Colors.destructive}30`,
  },
  errorText: { fontSize: 13, color: Colors.destructive, fontFamily: 'Inter_400Regular', flex: 1 },
  genFooter: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  genBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: Colors.radius, paddingVertical: 14, borderWidth: 1,
  },
  genBtnText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  aiUsageCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 8, padding: 12,
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  aiUsageLabel: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  aiUsageValue: { fontSize: 13, color: Colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  aiUsageBarTrack: { height: 5, backgroundColor: Colors.muted, borderRadius: 99, marginTop: 8, overflow: 'hidden' },
  aiUsageBarFill: { height: '100%', borderRadius: 99 },
  aiUsageCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
  },
  aiUsageCtaText: { fontSize: 12, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
});
