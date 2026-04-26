import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api } from '@/lib/api';
import { Colors } from '@/constants/colors';

interface Trophy {
  id?: string;
  name?: string;
  tournament?: string;
  season?: string;
  date?: string;
  type?: string;
}

const TROPHY_ICONS: Record<string, string> = {
  league: '🏆',
  cup: '🥇',
  supercup: '🌟',
  continental: '⭐',
  champions: '✨',
  default: '🏅',
};

function trophyIcon(type?: string, name?: string): string {
  if (type && TROPHY_ICONS[type]) return TROPHY_ICONS[type];
  if (!name) return TROPHY_ICONS.default;
  const lower = name.toLowerCase();
  if (lower.includes('liga') || lower.includes('league') || lower.includes('campeonat')) return TROPHY_ICONS.league;
  if (lower.includes('copa') || lower.includes('cup')) return TROPHY_ICONS.cup;
  if (lower.includes('super')) return TROPHY_ICONS.supercup;
  if (lower.includes('champion') || lower.includes('uefa')) return TROPHY_ICONS.champions;
  return TROPHY_ICONS.default;
}

function TrophyCard({ item, index }: { item: Trophy; index: number }) {
  const icon = trophyIcon(item.type, item.name);
  const isGold = index < 1;
  const borderColor = isGold ? '#f59e0b' : index < 3 ? 'rgba(165,180,252,0.4)' : Colors.border;
  const iconBg = isGold ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.12)';

  return (
    <View style={[styles.card, { borderColor }]}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name ?? 'Conquista'}</Text>
        {item.tournament && item.tournament !== item.name && (
          <Text style={styles.cardTournament} numberOfLines={1}>{item.tournament}</Text>
        )}
        {item.season && (
          <Text style={styles.cardSeason}>{item.season}</Text>
        )}
      </View>
      {isGold && <Text style={styles.goldBadge}>⭐</Text>}
    </View>
  );
}

export default function TrophiesScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer } = useCareer();
  const theme = useClubTheme();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const { data: careerData, isLoading } = useQuery({
    queryKey: ['/api/data/career', activeCareer?.id],
    queryFn: () => activeCareer ? api.careerData.get(activeCareer.id) : null,
    enabled: !!activeCareer?.id,
    staleTime: 1000 * 60 * 5,
  });

  const trophies: Trophy[] = (careerData?.data?.trophies as Trophy[] | undefined) ?? [];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Troféus</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : trophies.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 64 }}>🏆</Text>
          <Text style={styles.emptyTitle}>Vitrine vazia</Text>
          <Text style={styles.emptyText}>
            Seus troféus aparecerão aqui conforme você vence competições. Bora!
          </Text>
        </View>
      ) : (
        <FlatList
          data={trophies}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerBanner}>
              <Text style={styles.trophyCount}>{trophies.length}</Text>
              <Text style={styles.trophyCountLabel}>
                {trophies.length === 1 ? 'troféu conquistado' : 'troféus conquistados'}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item, index }) => <TrophyCard item={item} index={index} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 22 },
  list: { padding: 16 },
  headerBanner: {
    alignItems: 'center', paddingVertical: 24, gap: 4, marginBottom: 16,
    borderRadius: Colors.radiusLg, backgroundColor: 'rgba(245,158,11,0.06)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)',
  },
  trophyCount: { fontSize: 48, fontWeight: '700' as const, color: '#f59e0b', fontFamily: 'Inter_700Bold' },
  trophyCountLabel: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, padding: 14,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 28 },
  cardName: { fontSize: 15, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  cardTournament: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  cardSeason: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  goldBadge: { fontSize: 20 },
});
