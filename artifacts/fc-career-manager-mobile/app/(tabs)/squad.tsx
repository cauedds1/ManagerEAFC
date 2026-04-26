import type { ComponentProps } from 'react';
import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, ScrollView, Image, Platform, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type SquadPlayer, type PlayerSeasonStats, type InjuryRecord } from '@/lib/api';
import { Colors } from '@/constants/colors';
import { queryClient } from '@/lib/queryClient';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type PosFilter = 'Todos' | 'GOL' | 'DEF' | 'MID' | 'ATA';

const POS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  GOL: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'GK' },
  DEF: { color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', label: 'DEF' },
  MID: { color: '#34d399', bg: 'rgba(16,185,129,0.15)', label: 'MID' },
  ATA: { color: '#f87171', bg: 'rgba(239,68,68,0.15)', label: 'ATA' },
};

const POSITION_FILTERS: PosFilter[] = ['Todos', 'GOL', 'DEF', 'MID', 'ATA'];

function ratingColor(r: number): string {
  if (r >= 8.5) return '#60a5fa';
  if (r >= 7.5) return '#34d399';
  if (r >= 6.5) return '#fbbf24';
  return '#f87171';
}

function PlayerPhoto({ src, name, size = 44 }: { src: string; name: string; size?: number }) {
  const [err, setErr] = useState(!src);
  if (!err && src) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setErr(true)}
      />
    );
  }
  const initials = name.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <View style={[styles.photoFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.photoInitials, { fontSize: size * 0.3 }]}>{initials}</Text>
    </View>
  );
}

function PlayerBottomSheet({
  player,
  stats,
  injury,
  onClose,
}: {
  player: SquadPlayer;
  stats?: PlayerSeasonStats;
  injury?: InjuryRecord;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const posCfg = POS_CONFIG[player.positionPtBr] ?? POS_CONFIG.MID;

  const statItems = [
    { label: 'Partidas', value: stats?.appearances ?? 0, icon: 'football-outline' as IoniconName },
    { label: 'Gols', value: stats?.goals ?? 0, icon: 'flash-outline' as IoniconName, color: Colors.success },
    { label: 'Assist.', value: stats?.assists ?? 0, icon: 'git-branch-outline' as IoniconName, color: Colors.info },
    { label: 'Média', value: stats?.avgRating ? stats.avgRating.toFixed(1) : '—', icon: 'star-outline' as IoniconName, color: ratingColor(stats?.avgRating ?? 0) },
    { label: 'Amarelos', value: stats?.yellowCards ?? 0, icon: 'card-outline' as IoniconName, color: Colors.warning },
    { label: 'Vermelhos', value: stats?.redCards ?? 0, icon: 'card-outline' as IoniconName, color: Colors.destructive },
  ];

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheetContainer, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <PlayerPhoto src={player.photo} name={player.name} size={64} />
            <View style={styles.sheetPlayerInfo}>
              <Text style={styles.sheetPlayerName}>{player.name}</Text>
              <View style={styles.sheetBadges}>
                <View style={[styles.posBadge, { backgroundColor: posCfg.bg }]}>
                  <Text style={[styles.posBadgeText, { color: posCfg.color }]}>{player.positionPtBr}</Text>
                </View>
                {player.number != null && (
                  <Text style={styles.shirtNum}>#{player.number}</Text>
                )}
                <Text style={styles.ageText}>{player.age} anos</Text>
              </View>
            </View>
          </View>

          <View style={styles.sheetDivider} />

          <Text style={styles.sheetSectionLabel}>Esta Temporada</Text>
          <View style={styles.statsGrid}>
            {statItems.map((item) => (
              <View key={item.label} style={styles.statCell}>
                <Text style={[styles.statValue, item.color ? { color: item.color } : {}]}>
                  {item.value}
                </Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {injury && (() => {
            const remaining = Math.max(0, injury.matchesOut - (injury.matchesServed ?? 0));
            const isRecovered = remaining === 0;
            const injColor = isRecovered ? Colors.success : Colors.destructive;
            return (
              <>
                <View style={styles.sheetDivider} />
                <Text style={styles.sheetSectionLabel}>Status Médico</Text>
                <View style={[styles.injuryBanner, { backgroundColor: `${injColor}12`, borderColor: `${injColor}30` }]}>
                  <Ionicons name={isRecovered ? 'checkmark-circle' : 'medkit'} size={18} color={injColor} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.injuryStatusText, { color: injColor }]}>
                      {isRecovered ? 'Recuperado' : 'Lesionado'}
                      {injury.injuryType ? ` — ${injury.injuryType}` : ''}
                    </Text>
                    {!isRecovered && (
                      <Text style={styles.injuryReturnText}>
                        Previsão: {injury.returnDate ?? injury.expectedReturn ?? `~${remaining} jogo${remaining !== 1 ? 's' : ''}`}
                      </Text>
                    )}
                  </View>
                </View>
              </>
            );
          })()}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Fechar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function SquadScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, activeSeason } = useCareer();
  const theme = useClubTheme();
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState<PosFilter>('Todos');
  const [selectedPlayer, setSelectedPlayer] = useState<SquadPlayer | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const searchRef = useRef<TextInput>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: squadData, isLoading: squadLoading } = useQuery({
    queryKey: ['/api/squad', activeCareer?.clubId],
    queryFn: () => activeCareer?.clubId ? api.squad.get(activeCareer.clubId) : null,
    enabled: !!activeCareer?.clubId,
    staleTime: 1000 * 60 * 30,
  });

  const { data: careerGameData } = useQuery({
    queryKey: ['/api/data/career', activeCareer?.id],
    queryFn: () => activeCareer ? api.careerData.get(activeCareer.id) : null,
    enabled: !!activeCareer?.id,
  });

  const { data: seasonData } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
    staleTime: 1000 * 60 * 5,
  });

  const allPlayers = useMemo<SquadPlayer[]>(() => {
    const base = squadData?.players ?? [];
    const custom = careerGameData?.data?.customPlayers ?? [];
    const ids = new Set(base.map((p) => p.id));
    return [...base, ...custom.filter((p) => !ids.has(p.id))];
  }, [squadData, careerGameData]);

  const statsMap = useMemo<Map<number, PlayerSeasonStats>>(() => {
    const map = new Map<number, PlayerSeasonStats>();
    for (const s of seasonData?.data?.player_stats ?? []) {
      map.set(s.playerId, s);
    }
    return map;
  }, [seasonData]);

  const injuryMap = useMemo<Map<number, InjuryRecord>>(() => {
    const map = new Map<number, InjuryRecord>();
    for (const inj of (seasonData?.data?.injuries ?? []) as InjuryRecord[]) {
      const remaining = Math.max(0, inj.matchesOut - (inj.matchesServed ?? 0));
      if (remaining > 0) map.set(inj.playerId, inj);
    }
    return map;
  }, [seasonData]);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPlayers.filter((p) => {
      const matchesPos = posFilter === 'Todos' || p.positionPtBr === posFilter;
      const matchesSearch = !q || p.name.toLowerCase().includes(q);
      return matchesPos && matchesSearch;
    });
  }, [allPlayers, search, posFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/squad', activeCareer?.clubId] });
    setRefreshing(false);
  }, [activeCareer?.clubId]);

  const handlePlayerPress = (player: SquadPlayer) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setSelectedPlayer(player);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Elenco</Text>
          {!squadLoading && (
            <Text style={styles.subtitle}>{filteredPlayers.length} jogadores</Text>
          )}
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={Colors.mutedForeground} style={styles.searchIcon} />
        <TextInput
          ref={searchRef}
          style={styles.searchInput}
          placeholder="Buscar jogador..."
          placeholderTextColor={Colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={Colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {POSITION_FILTERS.map((pos) => {
          const active = posFilter === pos;
          const cfg = pos !== 'Todos' ? POS_CONFIG[pos] : null;
          const activeColor = cfg?.color ?? theme.primary;
          return (
            <TouchableOpacity
              key={pos}
              style={[
                styles.filterChip,
                active && { backgroundColor: `${activeColor}22`, borderColor: `${activeColor}55` },
              ]}
              onPress={() => setPosFilter(pos)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, active && { color: activeColor }]}>{pos}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {squadLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : !activeCareer ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Selecione uma carreira para ver o elenco.</Text>
        </View>
      ) : filteredPlayers.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color={Colors.mutedForeground} />
          <Text style={styles.emptyText}>Nenhum jogador encontrado.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPlayers}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const stats = statsMap.get(item.id);
            const posCfg = POS_CONFIG[item.positionPtBr] ?? POS_CONFIG.MID;
            return (
              <TouchableOpacity
                style={styles.playerRow}
                onPress={() => handlePlayerPress(item)}
                activeOpacity={0.75}
              >
                <PlayerPhoto src={item.photo} name={item.name} size={44} />
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.playerAge}>{item.age} anos</Text>
                </View>
                <View style={styles.playerRight}>
                  {stats && stats.appearances > 0 && (
                    <View style={styles.ratingWrap}>
                      <Text style={[styles.ratingText, { color: ratingColor(stats.avgRating) }]}>
                        {stats.avgRating.toFixed(1)}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.posBadge, { backgroundColor: posCfg.bg }]}>
                    <Text style={[styles.posBadgeText, { color: posCfg.color }]}>{item.positionPtBr}</Text>
                  </View>
                  {item.number != null && (
                    <Text style={styles.shirtNumSmall}>#{item.number}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {selectedPlayer && (
        <PlayerBottomSheet
          player={selectedPlayer}
          stats={statsMap.get(selectedPlayer.id)}
          injury={injuryMap.get(selectedPlayer.id)}
          onClose={() => setSelectedPlayer(null)}
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    color: Colors.foreground,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  photoFallback: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitials: { fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 15, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  playerAge: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  playerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingWrap: { paddingHorizontal: 6, paddingVertical: 2 },
  ratingText: { fontSize: 13, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  posBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posBadgeText: { fontSize: 11, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  shirtNumSmall: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', minWidth: 24, textAlign: 'right' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 56 },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheetContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetPlayerInfo: { flex: 1 },
  sheetPlayerName: { fontSize: 18, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  sheetBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  shirtNum: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  ageText: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  sheetDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 16 },
  sheetSectionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  statCell: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Colors.radius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  closeBtn: {
    borderWidth: 1,
    borderRadius: Colors.radius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  injuryBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: Colors.radius, borderWidth: 1,
    padding: 12, marginBottom: 4,
  },
  injuryStatusText: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  injuryReturnText: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
