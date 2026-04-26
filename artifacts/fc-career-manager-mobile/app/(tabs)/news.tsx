import { useState, useCallback } from 'react';
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
import { api, type NewsItem } from '@/lib/api';
import { Colors } from '@/constants/colors';
import { queryClient } from '@/lib/queryClient';

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

type GenType = 'noticia' | 'rumor' | 'boas_vindas';

const GEN_OPTIONS: { id: GenType; icon: string; label: string; desc: string; planRequired?: 'ultra' }[] = [
  { id: 'noticia',     icon: '📰', label: 'Gerar Notícia',         desc: 'Notícia sobre o clube com IA' },
  { id: 'rumor',       icon: '🕵️', label: 'Gerar Rumor',           desc: 'Rumor de mercado de transferências', planRequired: 'ultra' },
  { id: 'boas_vindas', icon: '👋', label: 'Post de Boas-Vindas',   desc: 'Apresentação do treinador ao clube' },
];

function NewsModal({ item, onClose }: { item: NewsItem; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const cfg = getTypeCfg(item.type);
  return (
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
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
            <Text style={styles.modalBody}>{item.body}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Fechar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
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
}

function GenerateModal({
  visible, onClose, onGenerated,
  clubName, clubLeague, clubDescription, projeto,
  coachName, coachNationality, seasonLabel, userPlan,
}: GenerateModalProps) {
  const theme = useClubTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<GenType>('noticia');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      let raw: Record<string, unknown>;
      if (selected === 'noticia') {
        const desc = description.trim() || `Gere uma notícia criativa e interessante sobre o ${clubName} na temporada ${seasonLabel ?? ''}.`;
        raw = await api.noticias.generateManual({
          description: desc,
          clubName,
          season: seasonLabel,
          source: 'fanpage',
          category: 'geral',
          clubLeague,
          clubDescription,
          projeto,
          lang: 'pt',
        });
      } else if (selected === 'rumor') {
        raw = await api.noticias.generateRumor({
          clubName,
          season: seasonLabel,
          clubLeague,
          clubDescription,
          projeto,
          lang: 'pt',
        });
      } else {
        raw = await api.noticias.generateWelcome({
          coachName: coachName ?? 'Técnico',
          coachNationality,
          clubName,
          clubLeague,
          clubDescription,
          projeto,
          lang: 'pt',
        });
      }
      const item = socialPostToNewsItem(raw, selected === 'rumor' ? 'transferencia' : 'geral');
      onGenerated(item);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Ultra') || msg.includes('PLAN')) {
        setError('Este recurso requer o plano Ultra.');
      } else if (msg.includes('Limite')) {
        setError('Limite de gerações do dia atingido. Tente amanhã.');
      } else {
        setError('Erro ao gerar. Tente novamente.');
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
                const locked = opt.planRequired === 'ultra' && userPlan !== 'ultra';
                const active = selected === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.optionRow,
                      active && { backgroundColor: `rgba(${theme.primaryRgb},0.12)`, borderColor: `rgba(${theme.primaryRgb},0.35)` },
                      locked && { opacity: 0.55 },
                    ]}
                    onPress={() => { if (!locked) setSelected(opt.id); }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.optionIcon}>{opt.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, active && { color: theme.primary }]}>{opt.label}</Text>
                      <Text style={styles.optionDesc}>{opt.desc}{locked ? '  •  Ultra' : ''}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                    {locked && <Ionicons name="lock-closed" size={16} color={Colors.mutedForeground} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {selected === 'noticia' && (
              <View style={{ marginTop: 12, gap: 6 }}>
                <Text style={styles.genSectionLabel}>DESCRIÇÃO (opcional)</Text>
                <TextInput
                  style={styles.descInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={`Ex: Fale sobre a última vitória do ${clubName}…`}
                  placeholderTextColor={Colors.mutedForeground}
                  multiline
                  maxLength={300}
                />
              </View>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={16} color={Colors.destructive} />
                <Text style={styles.errorText}>{error}</Text>
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
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: seasonData, isLoading } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
    staleTime: 1000 * 60 * 2,
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
          <Text style={styles.title}>Notícias</Text>
          {!isLoading && news.length > 0 && (
            <Text style={styles.subtitle}>{news.length} notícia{news.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
        {activeSeason && (
          <TouchableOpacity
            style={[styles.genFab, { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.35)` }]}
            onPress={() => setShowGenerate(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles-outline" size={18} color={theme.primary} />
            <Text style={[styles.genFabText, { color: theme.primary }]}>Gerar</Text>
          </TouchableOpacity>
        )}
      </View>

      {generating && (
        <View style={styles.generatingBar}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.generatingText}>Adicionando notícia ao feed…</Text>
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
          <Text style={styles.emptyTitle}>Sem notícias</Text>
          <Text style={styles.emptyText}>
            Notícias aparecem após registrar partidas ou ao gerar com IA.
          </Text>
          {activeSeason && (
            <TouchableOpacity
              style={[styles.emptyGenBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.12)`, borderColor: `rgba(${theme.primaryRgb},0.3)` }]}
              onPress={() => setShowGenerate(true)}
            >
              <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
              <Text style={[styles.emptyGenBtnText, { color: theme.primary }]}>Gerar primeira notícia</Text>
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

      {selected && <NewsModal item={selected} onClose={() => setSelected(null)} />}

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
});
