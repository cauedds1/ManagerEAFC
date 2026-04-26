import type { ComponentProps } from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity, Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
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

interface MatchSection {
  title: string;
  stage: string;
  data: MatchRecord[];
}

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

function EmptyState({ primary, onRegister }: { primary: string; onRegister: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconWrap, { backgroundColor: `rgba(139, 92, 246, 0.1)` }]}>
        <Ionicons name="football-outline" size={40} color={primary} />
      </View>
      <Text style={styles.emptyTitle}>Nenhuma partida registrada</Text>
      <Text style={styles.emptyText}>
        Registre sua primeira partida para começar a acompanhar o progresso.
      </Text>
      <TouchableOpacity
        style={[styles.registerBtn, { backgroundColor: primary }]}
        onPress={onRegister}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.registerBtnText}>Registrar Partida</Text>
      </TouchableOpacity>
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

  const sections: MatchSection[] = useMemo(() => {
    const list = seasonGameData?.data?.matches ?? [];
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);

    const grouped = new Map<string, MatchRecord[]>();
    for (const m of sorted) {
      const key = m.stage || 'Rodada';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(m);
    }

    return [...grouped.entries()].map(([stage, matches]) => ({
      title: stage,
      stage,
      data: matches,
    }));
  }, [seasonGameData]);

  const totalMatches = sections.reduce((s, sec) => s + sec.data.length, 0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/data/season', currentSeason?.id] });
    setRefreshing(false);
  }, [currentSeason?.id]);

  const handleRegister = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/registrar-partida');
  }, []);

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
          <Text style={styles.countText}>{totalMatches} partida{totalMatches !== 1 ? 's' : ''}</Text>
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
      ) : sections.length === 0 ? (
        <EmptyState primary={theme.primary} onRegister={handleRegister} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
              <Text style={styles.sectionHeaderCount}>
                {section.data.length} jogo{section.data.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
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
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
        />
      )}

      {currentSeason && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + 20 }]}
          onPress={handleRegister}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
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
  registerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: Colors.radius, marginTop: 8,
  },
  registerBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sectionHeaderText: {
    fontSize: 13, fontWeight: '600' as const, color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8,
  },
  sectionHeaderCount: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
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
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
