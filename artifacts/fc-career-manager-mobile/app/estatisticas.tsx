import { useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
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

interface AggregatedStats {
  playerId: number;
  name: string;
  positionPtBr: string;
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  gPlusA: number;
  hatTricks: number;
  penaltyScored: number;
  penaltyMissed: number;
  shots: number;
  shotsOnTarget: number;
  finishingPct: number;
  totalPasses: number;
  avgPassAccuracy: number;
  dribbles: number;
  recoveries: number;
  turnovers: number;
  yellowCards: number;
  redCards: number;
  avgRating: number;
  motmCount: number;
  saves: number;
  goalsConceded: number;
  penaltySaved: number;
}

type SortKey = keyof Omit<AggregatedStats, 'name' | 'positionPtBr'>;

const POS_GROUP: Record<string, StatsTab> = {
  GOL: 'goleiro', DEF: 'defesa', MID: 'inter', ATA: 'ataque',
};

const TAB_LABELS: Record<StatsTab, string> = {
  ataque: 'Ataque', inter: 'Intermediário', defesa: 'Defesa', goleiro: 'Goleiro',
};

interface ColDef { key: SortKey; label: string; width: number }

const COLS: Record<StatsTab, ColDef[]> = {
  ataque: [
    { key: 'apps',          label: 'JO',     width: 40 },
    { key: 'starts',        label: 'TIT',    width: 44 },
    { key: 'goals',         label: 'GL',     width: 40 },
    { key: 'assists',       label: 'AS',     width: 40 },
    { key: 'gPlusA',        label: 'G+A',    width: 44 },
    { key: 'hatTricks',     label: 'HAT',    width: 44 },
    { key: 'penaltyScored', label: 'PM',     width: 40 },
    { key: 'penaltyMissed', label: 'PE',     width: 40 },
    { key: 'shots',         label: 'FIN',    width: 44 },
    { key: 'finishingPct',  label: 'FIN%',   width: 48 },
    { key: 'motmCount',     label: 'MOTM',   width: 48 },
    { key: 'avgRating',     label: 'NOTA',   width: 48 },
  ],
  inter: [
    { key: 'apps',            label: 'JO',     width: 40 },
    { key: 'totalPasses',     label: 'PAS',    width: 48 },
    { key: 'avgPassAccuracy', label: 'PAS%',   width: 48 },
    { key: 'assists',         label: 'DEC',    width: 44 },
    { key: 'dribbles',        label: 'DRI',    width: 44 },
    { key: 'recoveries',      label: 'REC',    width: 44 },
    { key: 'yellowCards',     label: 'AM',     width: 40 },
    { key: 'avgRating',       label: 'NOTA',   width: 48 },
  ],
  defesa: [
    { key: 'apps',        label: 'JO',     width: 40 },
    { key: 'starts',      label: 'TIT',    width: 44 },
    { key: 'recoveries',  label: 'REC',    width: 44 },
    { key: 'turnovers',   label: 'PDB',    width: 44 },
    { key: 'yellowCards', label: 'AM',     width: 40 },
    { key: 'redCards',    label: 'VE',     width: 40 },
    { key: 'goals',       label: 'GL',     width: 40 },
    { key: 'avgRating',   label: 'NOTA',   width: 48 },
  ],
  goleiro: [
    { key: 'apps',          label: 'JO',     width: 40 },
    { key: 'saves',         label: 'DEF',    width: 44 },
    { key: 'goalsConceded', label: 'GS',     width: 44 },
    { key: 'penaltySaved',  label: 'PD',     width: 44 },
    { key: 'yellowCards',   label: 'AM',     width: 40 },
    { key: 'avgRating',     label: 'NOTA',   width: 48 },
  ],
};

const DEFAULT_SORT: Record<StatsTab, SortKey> = {
  ataque: 'goals', inter: 'assists', defesa: 'recoveries', goleiro: 'saves',
};

const NAME_COL_WIDTH = 136;
const ROW_HEIGHT = 46;

function fmtVal(key: SortKey, v: number): string {
  if (key === 'avgRating')     return v > 0 ? v.toFixed(1) : '—';
  if (key === 'avgPassAccuracy') return v > 0 ? `${Math.round(v)}%` : '—';
  if (key === 'finishingPct')  return v > 0 ? `${Math.round(v)}%` : '—';
  return v === 0 ? '—' : String(v);
}

function cellColor(key: SortKey, v: number): string | undefined {
  if (key === 'avgRating' && v > 0) {
    if (v > 8.5) return Colors.success;
    if (v > 7)   return '#34d399';
    if (v >= 6)  return Colors.warning;
    return Colors.destructive;
  }
  if ((key === 'goals' || key === 'gPlusA' || key === 'hatTricks') && v > 0) return Colors.success;
  if (key === 'assists' && v > 0) return Colors.info;
  if (key === 'yellowCards' && v > 0) return Colors.warning;
  if (key === 'redCards' && v > 0) return Colors.destructive;
  if (key === 'penaltyMissed' && v > 0) return Colors.destructive;
  if ((key === 'penaltyScored' || key === 'saves' || key === 'penaltySaved') && v > 0) return Colors.success;
  if (key === 'motmCount' && v > 0) return '#fbbf24';
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

  const leftScrollRef = useRef<ScrollView>(null);
  const rightScrollRef = useRef<ScrollView>(null);

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

  const apiStatByPlayerId = useMemo<Map<number, PlayerSeasonStats>>(() => {
    const m = new Map<number, PlayerSeasonStats>();
    apiStats.forEach((s) => m.set(s.playerId, s));
    return m;
  }, [apiStats]);

  const aggregated = useMemo<AggregatedStats[]>(() => {
    const map = new Map<number, AggregatedStats>();

    squadPlayers.forEach((p) => {
      const s = apiStatByPlayerId.get(p.id);
      const goals = s?.goals ?? 0;
      const assists = s?.assists ?? 0;
      map.set(p.id, {
        playerId: p.id,
        name: p.name,
        positionPtBr: p.positionPtBr,
        apps: s?.appearances ?? 0,
        starts: 0,
        goals,
        assists,
        gPlusA: goals + assists,
        hatTricks: 0,
        penaltyScored: 0,
        penaltyMissed: 0,
        shots: 0,
        shotsOnTarget: 0,
        finishingPct: 0,
        totalPasses: 0,
        avgPassAccuracy: 0,
        dribbles: 0,
        recoveries: 0,
        turnovers: 0,
        yellowCards: s?.yellowCards ?? 0,
        redCards: s?.redCards ?? 0,
        avgRating: s?.avgRating ?? 0,
        motmCount: 0,
        saves: 0,
        goalsConceded: 0,
        penaltySaved: 0,
      });
    });

    const passAccSums = new Map<number, { sum: number; count: number }>();

    matches.forEach((match) => {
      if (match.motmPlayerId != null) {
        const e = map.get(match.motmPlayerId);
        if (e) e.motmCount += 1;
      }
      const starterSet = new Set(match.starterIds ?? []);

      Object.entries(match.playerStats ?? {}).forEach(([pName, ms]: [string, PlayerMatchStats]) => {
        const player = squadPlayers.find((p) => p.name === pName);
        if (!player) return;
        const e = map.get(player.id);
        if (!e) return;

        if (starterSet.has(player.id)) e.starts += 1;
        if (ms.shots)         e.shots += ms.shots;
        if (ms.shotsOnTarget) e.shotsOnTarget += ms.shotsOnTarget;
        if (ms.passes)        e.totalPasses += ms.passes;
        if (ms.dribbles)      e.dribbles += ms.dribbles;
        if (ms.recoveries)    e.recoveries += ms.recoveries;
        if (ms.turnovers)     e.turnovers += ms.turnovers;
        if (ms.penaltyScored) e.penaltyScored += ms.penaltyScored;
        if (ms.penaltyMissed) e.penaltyMissed += ms.penaltyMissed;
        if (ms.saves)         e.saves += ms.saves;
        if (ms.goalsConceded) e.goalsConceded += ms.goalsConceded;
        if (ms.penaltySaved)  e.penaltySaved += ms.penaltySaved;
        if (ms.passAccuracy && ms.passAccuracy > 0) {
          const acc = passAccSums.get(player.id) ?? { sum: 0, count: 0 };
          acc.sum += ms.passAccuracy;
          acc.count += 1;
          passAccSums.set(player.id, acc);
        }
        const playerGoals = ms.goals?.length ?? 0;
        if (playerGoals >= 3) e.hatTricks += 1;
      });
    });

    passAccSums.forEach((acc, playerId) => {
      const e = map.get(playerId);
      if (e && acc.count > 0) e.avgPassAccuracy = acc.sum / acc.count;
    });

    map.forEach((e) => {
      if (e.shots > 0 && e.shotsOnTarget > 0) {
        e.finishingPct = Math.round((e.shotsOnTarget / e.shots) * 100);
      }
    });

    return Array.from(map.values());
  }, [squadPlayers, matches, apiStatByPlayerId]);

  const filteredAndSorted = useMemo<AggregatedStats[]>(() => {
    const filtered = aggregated.filter((p) => POS_GROUP[p.positionPtBr] === activeTab);
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortAsc ? av - bv : bv - av;
    });
  }, [aggregated, activeTab, sortKey, sortAsc]);

  const columns = COLS[activeTab];

  const handleTabChange = (tab: StatsTab) => {
    setActiveTab(tab);
    setSortKey(DEFAULT_SORT[tab]);
    setSortAsc(false);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const isLoading = seasonLoading || squadLoading;

  const syncLeftScroll = (y: number) => {
    leftScrollRef.current?.scrollTo({ y, animated: false });
  };

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
        <View style={styles.tableContainer}>
          {/* ── Fixed left name column ─── */}
          <View style={styles.namePane} pointerEvents="none">
            <View style={[styles.nameHeaderCell, styles.headerRow]}>
              <Text style={styles.headerText}>Jogador</Text>
            </View>
            <ScrollView ref={leftScrollRef} scrollEnabled={false} showsVerticalScrollIndicator={false}>
              {filteredAndSorted.map((item, i) => (
                <View key={item.playerId} style={[styles.nameCell, { height: ROW_HEIGHT }, i % 2 === 1 && styles.rowAlt]}>
                  <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.playerPos}>{item.positionPtBr}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* ── Horizontally scrollable metrics ─── */}
          <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View>
              {/* Metric headers */}
              <View style={[styles.headerRow, { flexDirection: 'row' }]}>
                {columns.map((col) => {
                  const isActive = sortKey === col.key;
                  return (
                    <TouchableOpacity
                      key={col.key}
                      style={[styles.metricHeaderCell, { width: col.width }]}
                      onPress={() => handleSort(col.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.headerText, isActive && { color: theme.primary }]}>{col.label}</Text>
                      {isActive && (
                        <Ionicons name={sortAsc ? 'chevron-up' : 'chevron-down'} size={9} color={theme.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Metric rows — vertical scroll synced with name column */}
              <ScrollView
                ref={rightScrollRef}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                onScroll={(e) => syncLeftScroll(e.nativeEvent.contentOffset.y)}
                contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
              >
                {filteredAndSorted.map((item, i) => (
                  <View key={item.playerId} style={[styles.metricRow, { height: ROW_HEIGHT }, i % 2 === 1 && styles.rowAlt]}>
                    {columns.map((col) => {
                      const v = item[col.key] as number;
                      const color = cellColor(col.key, v);
                      const isSorted = sortKey === col.key;
                      return (
                        <View key={col.key} style={[styles.metricCell, { width: col.width }]}>
                          <Text style={[
                            styles.cellValue,
                            color ? { color } : undefined,
                            isSorted ? { fontFamily: 'Inter_700Bold' } : undefined,
                          ]}>
                            {fmtVal(col.key, v)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
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
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  tableContainer: { flex: 1, flexDirection: 'row' },
  namePane: {
    width: NAME_COL_WIDTH,
    borderRightWidth: 1, borderRightColor: Colors.border,
    backgroundColor: Colors.background,
  },
  headerRow: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    height: 38, alignItems: 'center', paddingHorizontal: 8,
  },
  nameHeaderCell: { justifyContent: 'center' },
  nameCell: { paddingHorizontal: 8, justifyContent: 'center', backgroundColor: Colors.background },
  playerName: { fontSize: 12, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  playerPos: { fontSize: 10, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  metricHeaderCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  metricRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background },
  rowAlt: { backgroundColor: Colors.card },
  metricCell: { alignItems: 'center', justifyContent: 'center' },
  headerText: { fontSize: 10, fontWeight: '700' as const, color: Colors.mutedForeground, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  cellValue: { fontSize: 12, color: Colors.foreground, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
