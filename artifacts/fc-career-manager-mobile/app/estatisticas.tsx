import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type SquadPlayer, type PlayerSeasonStats, type MatchRecord, type PlayerMatchStats } from '@/lib/api';
import { Colors } from '@/constants/colors';

type StatsTab = 'ataque' | 'inter' | 'defesa' | 'goleiro';

interface AggregatedPlayerStats {
  playerId: number;
  name: string;
  positionPtBr: string;
  apps: number;
  goals: number;
  assists: number;
  avgRating: number;
  yellowCards: number;
  redCards: number;
  totalShots: number;
  totalPasses: number;
  totalDribbles: number;
  totalRecoveries: number;
  motmCount: number;
}

const POS_GROUP: Record<string, StatsTab> = {
  GOL: 'goleiro',
  DEF: 'defesa',
  MID: 'inter',
  ATA: 'ataque',
};

const TAB_LABELS: Record<StatsTab, string> = {
  ataque: 'Ataque',
  inter: 'Intermediário',
  defesa: 'Defesa',
  goleiro: 'Goleiro',
};

function ratingColor(r: number): string {
  if (r >= 8.5) return Colors.info;
  if (r >= 7.5) return Colors.success;
  if (r >= 6.5) return Colors.warning;
  return '#f87171';
}

type SortKey = 'name' | 'apps' | 'goals' | 'assists' | 'avgRating' | 'yellowCards' | 'redCards' | 'totalShots' | 'totalPasses' | 'totalDribbles' | 'totalRecoveries' | 'motmCount';

const TAB_COLUMNS: Record<StatsTab, { key: SortKey; label: string; minWidth?: number }[]> = {
  ataque: [
    { key: 'name', label: 'Jogador', minWidth: 120 },
    { key: 'apps', label: 'JO' },
    { key: 'goals', label: 'GL' },
    { key: 'assists', label: 'AS' },
    { key: 'totalShots', label: 'FIN' },
    { key: 'motmCount', label: 'MOTM' },
    { key: 'avgRating', label: 'NOTA' },
  ],
  inter: [
    { key: 'name', label: 'Jogador', minWidth: 120 },
    { key: 'apps', label: 'JO' },
    { key: 'assists', label: 'AS' },
    { key: 'totalPasses', label: 'PAS' },
    { key: 'totalDribbles', label: 'DRI' },
    { key: 'totalRecoveries', label: 'REC' },
    { key: 'avgRating', label: 'NOTA' },
  ],
  defesa: [
    { key: 'name', label: 'Jogador', minWidth: 120 },
    { key: 'apps', label: 'JO' },
    { key: 'totalRecoveries', label: 'REC' },
    { key: 'yellowCards', label: 'AM' },
    { key: 'redCards', label: 'VE' },
    { key: 'goals', label: 'GL' },
    { key: 'avgRating', label: 'NOTA' },
  ],
  goleiro: [
    { key: 'name', label: 'Jogador', minWidth: 120 },
    { key: 'apps', label: 'JO' },
    { key: 'avgRating', label: 'NOTA' },
    { key: 'yellowCards', label: 'AM' },
    { key: 'redCards', label: 'VE' },
    { key: 'motmCount', label: 'MOTM' },
  ],
};

const DEFAULT_SORT: Record<StatsTab, SortKey> = {
  ataque: 'goals',
  inter: 'totalPasses',
  defesa: 'totalRecoveries',
  goleiro: 'avgRating',
};

function formatVal(key: SortKey, val: number): string {
  if (key === 'avgRating') return val > 0 ? val.toFixed(1) : '—';
  if (val === 0) return '—';
  return String(val);
}

function valColor(key: SortKey, val: number): string | undefined {
  if (key === 'avgRating' && val > 0) return ratingColor(val);
  if (key === 'goals' && val > 0) return Colors.success;
  if (key === 'assists' && val > 0) return Colors.info;
  if (key === 'yellowCards' && val > 0) return Colors.warning;
  if (key === 'redCards' && val > 0) return Colors.destructive;
  return undefined;
}

export default function EstatisticasScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, activeSeason } = useCareer();
  const theme = useClubTheme();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const [activeTab, setActiveTab] = useState<StatsTab>('ataque');
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT.ataque);
  const [sortAsc, setSortAsc] = useState(false);

  const { data: seasonData, isLoading: seasonLoading } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
  });

  const { data: squadData, isLoading: squadLoading } = useQuery({
    queryKey: ['/api/squad', activeCareer?.clubId],
    queryFn: () => activeCareer?.clubId ? api.squad.get(activeCareer.clubId) : null,
    enabled: !!activeCareer?.clubId,
    staleTime: 1000 * 60 * 30,
  });

  const squadPlayers = useMemo<SquadPlayer[]>(() => squadData?.players ?? [], [squadData]);
  const matches = useMemo<MatchRecord[]>(() => seasonData?.data?.matches ?? [], [seasonData]);
  const apiStats = useMemo<PlayerSeasonStats[]>(() => seasonData?.data?.player_stats ?? [], [seasonData]);

  const playerById = useMemo<Map<number, SquadPlayer>>(() => {
    const m = new Map<number, SquadPlayer>();
    squadPlayers.forEach((p) => m.set(p.id, p));
    return m;
  }, [squadPlayers]);

  const apiStatByName = useMemo<Map<string, PlayerSeasonStats>>(() => {
    const m = new Map<string, PlayerSeasonStats>();
    apiStats.forEach((s) => {
      const p = playerById.get(s.playerId);
      if (p) m.set(p.name, s);
    });
    return m;
  }, [apiStats, playerById]);

  const aggregated = useMemo<AggregatedPlayerStats[]>(() => {
    const map = new Map<string, AggregatedPlayerStats>();

    squadPlayers.forEach((p) => {
      const apiStat = apiStatByName.get(p.name);
      map.set(p.name, {
        playerId: p.id,
        name: p.name,
        positionPtBr: p.positionPtBr,
        apps: apiStat?.appearances ?? 0,
        goals: apiStat?.goals ?? 0,
        assists: apiStat?.assists ?? 0,
        avgRating: apiStat?.avgRating ?? 0,
        yellowCards: apiStat?.yellowCards ?? 0,
        redCards: apiStat?.redCards ?? 0,
        totalShots: 0,
        totalPasses: 0,
        totalDribbles: 0,
        totalRecoveries: 0,
        motmCount: 0,
      });
    });

    matches.forEach((match) => {
      if (match.motmPlayerName) {
        const entry = map.get(match.motmPlayerName);
        if (entry) entry.motmCount += 1;
      }
      Object.entries(match.playerStats ?? {}).forEach(([playerName, ms]: [string, PlayerMatchStats]) => {
        const entry = map.get(playerName);
        if (!entry) return;
        if (ms.shots) entry.totalShots += ms.shots;
        if (ms.passes) entry.totalPasses += ms.passes;
        if (ms.dribbles) entry.totalDribbles += ms.dribbles;
        if (ms.recoveries) entry.totalRecoveries += ms.recoveries;
      });
    });

    return Array.from(map.values());
  }, [squadPlayers, matches, apiStatByName]);

  const filteredAndSorted = useMemo<AggregatedPlayerStats[]>(() => {
    const tabGroup = activeTab;
    const filtered = aggregated.filter((p) => {
      const group = POS_GROUP[p.positionPtBr];
      return group === tabGroup;
    });

    return [...filtered].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      if (sortKey === 'name') {
        return sortAsc
          ? (a.name).localeCompare(b.name)
          : (b.name).localeCompare(a.name);
      }
      return sortAsc ? av - bv : bv - av;
    });
  }, [aggregated, activeTab, sortKey, sortAsc]);

  const columns = TAB_COLUMNS[activeTab];

  const handleTabChange = (tab: StatsTab) => {
    setActiveTab(tab);
    setSortKey(DEFAULT_SORT[tab]);
    setSortAsc(false);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const isLoading = seasonLoading || squadLoading;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Estatísticas</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        {(Object.keys(TAB_LABELS) as StatsTab[]).map((tab) => {
          const active = tab === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, active && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
              onPress={() => handleTabChange(tab)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, active && { color: theme.primary, fontFamily: 'Inter_700Bold' }]}>
                {TAB_LABELS[tab]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : !activeSeason ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={48} color={Colors.mutedForeground} />
          <Text style={styles.emptyText}>Selecione uma temporada para ver as estatísticas.</Text>
        </View>
      ) : filteredAndSorted.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="stats-chart-outline" size={48} color={Colors.mutedForeground} />
          <Text style={styles.emptyText}>Nenhum jogador nesta posição.</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.tableHeader}>
              {columns.map((col) => {
                const isActive = sortKey === col.key;
                return (
                  <TouchableOpacity
                    key={col.key}
                    style={[styles.headerCell, col.minWidth ? { width: col.minWidth } : styles.numCell]}
                    onPress={() => handleSort(col.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.headerText, isActive && { color: theme.primary }]}>
                      {col.label}
                    </Text>
                    {isActive && (
                      <Ionicons
                        name={sortAsc ? 'chevron-up' : 'chevron-down'}
                        size={10}
                        color={theme.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <FlatList
              data={filteredAndSorted}
              keyExtractor={(item) => String(item.playerId)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              ItemSeparatorComponent={() => <View style={styles.rowSep} />}
              renderItem={({ item, index }) => (
                <View style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
                  {columns.map((col) => {
                    if (col.key === 'name') {
                      return (
                        <View key="name" style={[styles.nameCell, { width: col.minWidth }]}>
                          <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.playerPos}>{item.positionPtBr}</Text>
                        </View>
                      );
                    }
                    const val = item[col.key] as number;
                    const color = valColor(col.key, val);
                    const isSorted = sortKey === col.key;
                    return (
                      <View key={col.key} style={styles.numCell}>
                        <Text style={[
                          styles.cellValue,
                          color ? { color } : {},
                          isSorted && { fontFamily: 'Inter_700Bold' },
                        ]}>
                          {formatVal(col.key, val)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            />
          </View>
        </ScrollView>
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 12, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerCell: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  numCell: { width: 44, alignItems: 'center' },
  headerText: { fontSize: 11, fontWeight: '700' as const, color: Colors.mutedForeground, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  tableRowAlt: { backgroundColor: Colors.card },
  rowSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  nameCell: { justifyContent: 'center', paddingRight: 8 },
  playerName: { fontSize: 13, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  playerPos: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  cellValue: { fontSize: 13, color: Colors.foreground, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
