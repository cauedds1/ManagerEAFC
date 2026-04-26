import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  ScrollView, Platform, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type NewsItem } from '@/lib/api';
import { Colors } from '@/constants/colors';
import { queryClient } from '@/lib/queryClient';

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  vitoria: { icon: '🏆', color: Colors.success, label: 'Vitória' },
  derrota: { icon: '😔', color: Colors.destructive, label: 'Derrota' },
  empate: { icon: '🤝', color: Colors.warning, label: 'Empate' },
  lesao: { icon: '🤕', color: Colors.destructive, label: 'Lesão' },
  transferencia: { icon: '🔄', color: Colors.info, label: 'Transferência' },
  geral: { icon: '📰', color: Colors.mutedForeground, label: 'Notícia' },
};

function getTypeCfg(type?: string) {
  if (!type) return TYPE_CONFIG.geral;
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.geral;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function NewsModal({ item, onClose }: { item: NewsItem; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const cfg = getTypeCfg(item.type);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalContainer, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.sheetHandle} />
          <View style={[styles.typeChip, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}33` }]}>
            <Text style={styles.typeChipEmoji}>{cfg.icon}</Text>
            <Text style={[styles.typeChipText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.modalHeadline}>{item.headline}</Text>
          <Text style={styles.modalDate}>{formatDate(item.createdAt)}</Text>
          <View style={styles.modalDivider} />
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
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

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const { activeSeason } = useCareer();
  const theme = useClubTheme();
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Notícias</Text>
        {!isLoading && news.length > 0 && (
          <Text style={styles.subtitle}>{news.length} notícia{news.length !== 1 ? 's' : ''}</Text>
        )}
      </View>

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
            As notícias da carreira aparecerão aqui após cada partida registrada.
          </Text>
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
                <View style={styles.cardTop}>
                  <View style={[styles.typeChip, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}33` }]}>
                    <Text style={styles.typeChipEmoji}>{cfg.icon}</Text>
                    <Text style={[styles.typeChipText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  iconWrap: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
  },
  typeChipEmoji: { fontSize: 12 },
  typeChipText: { fontSize: 11, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  cardDate: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  headline: { fontSize: 15, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold', lineHeight: 22 },
  preview: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  readMoreText: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  separator: { height: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  modalContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  sheetHandle: {
    width: 40, height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalHeadline: { fontSize: 17, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold', lineHeight: 26 },
  modalDate: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  modalDivider: { height: 1, backgroundColor: Colors.border },
  modalBody: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  closeBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Colors.radius, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  closeBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
});
