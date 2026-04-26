import type { ComponentProps } from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, getMatchResult, type MatchRecord } from '@/lib/api';
import { Colors } from '@/constants/colors';
import { queryClient } from '@/lib/queryClient';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const LOCATION_LABELS: Record<string, string> = {
  casa: 'Casa',
  fora: 'Fora',
  neutro: 'Neutro',
};

const RESULT_CONFIG = {
  vitoria: { label: 'V', color: Colors.success },
  empate:  { label: 'E', color: Colors.mutedForeground },
  derrota: { label: 'D', color: Colors.destructive },
};

function MatchRow({
  match,
  seasonId,
  onPress,
}: {
  match: MatchRecord;
  seasonId: string;
  onPress: () => void;
}) {
  const result = getMatchResult(match.myScore, match.opponentScore);
  const cfg = RESULT_CONFIG[result];
  return (
    <TouchableOpacity style={styles.matchRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.resultChip, { backgroundColor: `${cfg.color}20`, borderColor: `${cfg.color}40` }]}>
        <Text style={[styles.resultChipText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
      <View style={styles.matchRowBody}>
        <Text style={styles.opponentText} numberOfLines={1}>vs {match.opponent}</Text>
        <Text style={styles.matchMeta} numberOfLines={1}>
          {match.tournament} • {LOCATION_LABELS[match.location] ?? match.location} • {match.date}
        </Text>
      </View>
      <Text style={styles.scoreText}>
        {match.myScore}–{match.opponentScore}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function EmptyState({ primary }: { primary: string }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconWrap, { backgroundColor: `rgba(139, 92, 246, 0.1)` }]}>
        <Ionicons name="football-outline" size={40} color={primary} />
      </View>
      <Text style={styles.emptyTitle}>Nenhuma partida registrada</Text>
      <Text style={styles.emptyText}>
        As partidas registradas no app principal aparecerão aqui.
      </Text>
    </View>
  );
}

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, activeSeason } = useCareer();
  const theme = useClubTheme();
  const [refreshing, setRefreshing] = useState(false);

  const { data: seasons } = useQuery({
    queryKey: ['/api/careers', activeCareer?.id, 'seasons'],
    queryFn: () => activeCareer ? api.careers.seasons(activeCareer.id) : Promise.resolve([]),
    enabled: !!activeCareer,
  });

  const currentSeason = activeSeason
    ?? seasons?.find((s) => s.isActive)
    ?? seasons?.[seasons.length - 1];

  const { data: seasonGameData, isLoading } = useQuery({
    queryKey: ['/api/data/season', currentSeason?.id],
    queryFn: () => currentSeason ? api.seasonData.get(currentSeason.id) : null,
    enabled: !!currentSeason?.id,
    staleTime: 1000 * 60 * 5,
  });

  const matches: MatchRecord[] = useMemo(() => {
    const list = seasonGameData?.data?.matches ?? [];
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [seasonGameData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/data/season', currentSeason?.id] });
    setRefreshing(false);
  }, [currentSeason?.id]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Partidas</Text>
          {currentSeason && (
            <Text style={styles.subtitle}>{currentSeason.label}</Text>
          )}
        </View>
        {!isLoading && (
          <Text style={styles.countText}>{matches.length} partida{matches.length !== 1 ? 's' : ''}</Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonRow} />
          ))}
        </View>
      ) : !activeCareer || !currentSeason ? (
        <View style={styles.centeredMsg}>
          <Text style={styles.emptyText}>Selecione uma carreira para ver as partidas.</Text>
        </View>
      ) : matches.length === 0 ? (
        <EmptyState primary={theme.primary} />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MatchRow
              match={item}
              seasonId={currentSeason.id}
              onPress={() =>
                router.push({
                  pathname: '/match-detail',
                  params: { matchId: item.id, seasonId: currentSeason.id },
                })
              }
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  countText: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  loadingWrap: { padding: 16, gap: 10 },
  skeletonRow: {
    height: 62,
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    opacity: 0.5,
  },
  centeredMsg: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 21 },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  resultChip: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultChipText: {
    fontSize: 13,
    fontWeight: '700' as const,
    fontFamily: 'Inter_700Bold',
  },
  matchRowBody: { flex: 1 },
  opponentText: { fontSize: 15, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  matchMeta: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  scoreText: { fontSize: 15, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 52,
  },
});
