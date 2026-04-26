import type { ComponentProps } from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  Image, TouchableOpacity, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, getMatchResult, type Season, type MatchRecord } from '@/lib/api';
import { Colors } from '@/constants/colors';
import { queryClient } from '@/lib/queryClient';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function SkeletonCard({ height = 100 }: { height?: number }) {
  return (
    <View style={[styles.skeletonCard, { height }]} />
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: IoniconName;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { borderColor: `${color}30` }]}>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function computeSeasonStats(matches: MatchRecord[]) {
  let won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;
  for (const m of matches) {
    const result = getMatchResult(m.myScore, m.opponentScore);
    if (result === 'vitoria') won++;
    else if (result === 'empate') drawn++;
    else lost++;
    goalsFor += m.myScore;
    goalsAgainst += m.opponentScore;
  }
  return { played: matches.length, won, drawn, lost, goalsFor, goalsAgainst };
}

function computeTotalAssists(playerStats: import('@/lib/api').PlayerSeasonStats[]): number {
  return playerStats.reduce((sum, p) => sum + (p.assists ?? 0), 0);
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, activeSeason, loadSeasons } = useCareer();
  const theme = useClubTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const { data: seasons, isLoading: seasonsLoading } = useQuery({
    queryKey: ['/api/careers', activeCareer?.id, 'seasons'],
    queryFn: () => activeCareer ? api.careers.seasons(activeCareer.id) : Promise.resolve([]),
    enabled: !!activeCareer,
  });

  const currentSeason: Season | undefined = activeSeason
    ?? seasons?.find((s) => s.isActive)
    ?? seasons?.[seasons.length - 1];

  const { data: seasonGameData, isLoading: gameDataLoading } = useQuery({
    queryKey: ['/api/data/season', currentSeason?.id],
    queryFn: () => currentSeason ? api.seasonData.get(currentSeason.id) : null,
    enabled: !!currentSeason?.id,
    staleTime: 1000 * 60 * 5,
  });

  const matches: MatchRecord[] = useMemo(
    () => seasonGameData?.data?.matches ?? [],
    [seasonGameData]
  );

  const stats = useMemo(() => computeSeasonStats(matches), [matches]);

  const playerStats = seasonGameData?.data?.player_stats ?? [];
  const totalAssists = useMemo(() => computeTotalAssists(playerStats), [playerStats]);

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => b.createdAt - a.createdAt),
    [matches]
  );

  const lastMatch: MatchRecord | undefined = sortedMatches[0];

  const scheduledMatches = seasonGameData?.data?.scheduled_matches ?? [];
  const nextMatch = scheduledMatches.length > 0 ? scheduledMatches[0] : undefined;

  const leaguePos = seasonGameData?.data?.league_position;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/careers'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/data/season', currentSeason?.id] });
    if (activeCareer) {
      await loadSeasons(activeCareer.id);
    }
    setRefreshing(false);
  }, [activeCareer, loadSeasons, currentSeason?.id]);

  if (!activeCareer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Nenhuma carreira selecionada</Text>
        <TouchableOpacity style={styles.selectBtn} onPress={() => router.push('/career-select')}>
          <Text style={styles.selectBtnText}>Selecionar carreira</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const isLoading = seasonsLoading || gameDataLoading;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Club header with gradient */}
      <LinearGradient
        colors={[
          `rgba(${theme.primaryRgb}, 0.18)`,
          `rgba(${theme.secondaryRgb ?? theme.primaryRgb}, 0.06)`,
          Colors.background,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            borderBottomColor: `rgba(${theme.primaryRgb}, 0.2)`,
          },
        ]}
      >
        <View style={styles.headerInner}>
          <View style={styles.clubInfoRow}>
            {activeCareer.clubLogo && !logoError ? (
              <Image
                source={{ uri: activeCareer.clubLogo }}
                style={styles.clubLogo}
                onError={() => setLogoError(true)}
              />
            ) : (
              <View style={[styles.clubLogoFallback, { backgroundColor: `rgba(${theme.primaryRgb}, 0.2)` }]}>
                <Ionicons name="football" size={28} color={theme.primary} />
              </View>
            )}
            <View style={styles.clubText}>
              <Text style={styles.clubName} numberOfLines={1}>{activeCareer.clubName}</Text>
              <Text style={styles.clubLeague} numberOfLines={1}>
                {activeCareer.clubLeague ?? 'Liga'} • {currentSeason?.label ?? activeCareer.season}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/nova-temporada')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changeCareerBtn}
              onPress={() => router.push('/career-select')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="swap-horizontal" size={20} color={Colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.coachRow}>
          <Ionicons name="person-circle-outline" size={18} color={Colors.mutedForeground} />
          <Text style={styles.coachName}>
            Treinador: {activeCareer.coach?.name ?? 'Desconhecido'}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {/* Season stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Temporada</Text>
          {isLoading ? (
            <View style={styles.statsGrid}>
              {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} height={88} />)}
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <StatCard
                label="Partidas"
                value={stats.played}
                icon="football-outline"
                color={theme.primary}
              />
              <StatCard
                label="Vitórias"
                value={stats.won}
                icon="trophy-outline"
                color={Colors.success}
              />
              <StatCard
                label="Gols"
                value={stats.goalsFor}
                icon="flash-outline"
                color={Colors.warning}
              />
              <StatCard
                label="Posição"
                value={leaguePos?.position != null ? `${leaguePos.position}º` : '—'}
                icon="podium-outline"
                color={Colors.info}
              />
            </View>
          )}
        </View>

        {/* Record bar */}
        {!isLoading && stats.played > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>G / A / Aproveitamento</Text>
            <View style={styles.recordCard}>
              <View style={styles.recordItem}>
                <Text style={[styles.recordNum, { color: Colors.success }]}>{stats.won}</Text>
                <Text style={styles.recordLabel}>V</Text>
              </View>
              <View style={styles.recordDivider} />
              <View style={styles.recordItem}>
                <Text style={[styles.recordNum, { color: Colors.mutedForeground }]}>{stats.drawn}</Text>
                <Text style={styles.recordLabel}>E</Text>
              </View>
              <View style={styles.recordDivider} />
              <View style={styles.recordItem}>
                <Text style={[styles.recordNum, { color: Colors.destructive }]}>{stats.lost}</Text>
                <Text style={styles.recordLabel}>D</Text>
              </View>
              <View style={styles.recordDivider} />
              <View style={styles.recordItem}>
                <Text style={[styles.recordNum, { color: Colors.warning }]}>{stats.goalsFor}</Text>
                <Text style={styles.recordLabel}>Gols</Text>
              </View>
              <View style={styles.recordDivider} />
              <View style={styles.recordItem}>
                <Text style={[styles.recordNum, { color: Colors.info }]}>{totalAssists}</Text>
                <Text style={styles.recordLabel}>Assist.</Text>
              </View>
            </View>
          </View>
        )}

        {/* Last match */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Última Partida</Text>
          {isLoading ? (
            <SkeletonCard height={80} />
          ) : lastMatch ? (
            (() => {
              const result = getMatchResult(lastMatch.myScore, lastMatch.opponentScore);
              const resultColor =
                result === 'vitoria' ? Colors.success :
                result === 'derrota' ? Colors.destructive :
                Colors.mutedForeground;
              const resultLabel =
                result === 'vitoria' ? 'V' :
                result === 'derrota' ? 'D' : 'E';
              return (
                <TouchableOpacity
                  style={[styles.matchCard, { borderColor: `${resultColor}30` }]}
                  onPress={() => router.push('/(tabs)/matches')}
                  activeOpacity={0.8}
                >
                  <View style={styles.matchCardInner}>
                    <View style={[styles.resultBadge, { backgroundColor: `${resultColor}20`, borderColor: `${resultColor}40` }]}>
                      <Text style={[styles.resultBadgeText, { color: resultColor }]}>{resultLabel}</Text>
                    </View>
                    <View style={styles.matchInfo}>
                      <Text style={styles.matchOpponent} numberOfLines={1}>vs {lastMatch.opponent}</Text>
                      <Text style={styles.matchMeta}>{lastMatch.tournament} • {lastMatch.date}</Text>
                    </View>
                    <Text style={styles.matchScore}>
                      {lastMatch.myScore}–{lastMatch.opponentScore}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })()
          ) : (
            <View style={[styles.matchCard, { borderColor: `rgba(${theme.primaryRgb}, 0.2)` }]}>
              <View style={styles.matchCardInner}>
                <Ionicons name="football-outline" size={24} color={Colors.mutedForeground} />
                <Text style={styles.noDataText}>
                  Nenhuma partida registrada.{'\n'}Vá para Partidas para adicionar.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Next match */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Próxima Partida</Text>
          {isLoading ? (
            <SkeletonCard height={80} />
          ) : nextMatch ? (
            <View style={[styles.matchCard, { borderColor: `rgba(${theme.primaryRgb}, 0.3)` }]}>
              <View style={styles.matchCardInner}>
                <View style={[styles.resultBadge, { backgroundColor: `rgba(${theme.primaryRgb}, 0.15)`, borderColor: `rgba(${theme.primaryRgb}, 0.35)` }]}>
                  <Ionicons name="calendar" size={18} color={theme.primary} />
                </View>
                <View style={styles.matchInfo}>
                  <Text style={styles.matchOpponent} numberOfLines={1}>vs {nextMatch.opponent}</Text>
                  <Text style={styles.matchMeta}>
                    {nextMatch.tournament} • {nextMatch.date} • {nextMatch.location === 'casa' ? 'Casa' : nextMatch.location === 'fora' ? 'Fora' : 'Neutro'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
              </View>
            </View>
          ) : (
            <View style={[styles.matchCard, { borderColor: `rgba(${theme.primaryRgb}, 0.2)` }]}>
              <View style={styles.matchCardInner}>
                <Ionicons name="calendar-outline" size={24} color={Colors.mutedForeground} />
                <Text style={styles.noDataText}>Nenhuma partida agendada.</Text>
              </View>
            </View>
          )}
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acesso Rápido</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: `rgba(${theme.primaryRgb}, 0.1)`, borderColor: `rgba(${theme.primaryRgb}, 0.25)` }]}
              onPress={() => router.push('/(tabs)/matches')}
            >
              <Ionicons name="football" size={22} color={theme.primary} />
              <Text style={[styles.quickActionLabel, { color: theme.primary }]}>Partidas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: `rgba(34, 197, 94, 0.1)`, borderColor: `rgba(34, 197, 94, 0.25)` }]}
              onPress={() => router.push('/(tabs)/squad')}
            >
              <Ionicons name="people" size={22} color={Colors.success} />
              <Text style={[styles.quickActionLabel, { color: Colors.success }]}>Elenco</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: `rgba(245, 158, 11, 0.1)`, borderColor: `rgba(245, 158, 11, 0.25)` }]}
              onPress={() => router.push('/(tabs)/news')}
            >
              <Ionicons name="newspaper" size={22} color={Colors.warning} />
              <Text style={[styles.quickActionLabel, { color: Colors.warning }]}>Notícias</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: Colors.mutedForeground, fontSize: 16, marginBottom: 16, fontFamily: 'Inter_400Regular' },
  selectBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Colors.radius },
  selectBtnText: { color: '#fff', fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  clubInfoRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  clubLogo: { width: 48, height: 48, borderRadius: 8 },
  clubLogoFallback: { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  clubText: { flex: 1 },
  clubName: { fontSize: 18, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  clubLeague: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  changeCareerBtn: { padding: 4 },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coachName: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1,
    padding: 14,
    alignItems: 'flex-start',
    gap: 8,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  skeletonCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.muted,
    borderRadius: Colors.radius,
    opacity: 0.5,
  },
  recordCard: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-around',
  },
  recordItem: { alignItems: 'center', gap: 4 },
  recordNum: { fontSize: 22, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  recordLabel: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  recordDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  matchCard: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1,
    overflow: 'hidden',
  },
  matchCardInner: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBadgeText: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  matchInfo: { flex: 1 },
  matchOpponent: { fontSize: 15, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  matchMeta: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  matchScore: { fontSize: 18, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  noDataText: { color: Colors.mutedForeground, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  quickActions: { flexDirection: 'row', gap: 10 },
  quickActionBtn: {
    flex: 1,
    borderRadius: Colors.radius,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  quickActionLabel: { fontSize: 12, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
});
