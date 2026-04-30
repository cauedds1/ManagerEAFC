import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, getMatchResult, type MatchRecord, type PlayerMatchStats } from '@/lib/api';
import { Colors } from '@/constants/colors';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const LOCATION_LABELS: Record<string, string> = {
  casa: 'Casa',
  fora: 'Fora',
  neutro: 'Neutro',
};

const RESULT_CONFIG = {
  vitoria: { label: 'Vitória', color: Colors.success, icon: 'trophy' as IoniconName },
  empate:  { label: 'Empate',  color: Colors.mutedForeground, icon: 'remove-circle' as IoniconName },
  derrota: { label: 'Derrota', color: Colors.destructive, icon: 'close-circle' as IoniconName },
};

const SECTOR_LABELS: Record<'GOL' | 'DEF' | 'MID' | 'ATA', string> = {
  GOL: 'Goleiro',
  DEF: 'Defensores',
  MID: 'Meio-campistas',
  ATA: 'Atacantes',
};

const SECTOR_COLORS: Record<'GOL' | 'DEF' | 'MID' | 'ATA', string> = {
  GOL: Colors.warning,
  DEF: Colors.info,
  MID: Colors.success,
  ATA: Colors.destructive,
};

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ratingColor(r: number): string {
  if (r >= 8) return Colors.success;
  if (r >= 6) return Colors.warning;
  return Colors.destructive;
}

function PlayerStatsRow({ name, stats }: { name: string; stats: PlayerMatchStats }) {
  const goalCount = stats.goals?.length ?? 0;
  return (
    <View style={styles.playerRow}>
      <View style={styles.playerRowLeft}>
        <Text style={styles.playerName} numberOfLines={1}>{name}</Text>
        <View style={styles.playerBadges}>
          {goalCount > 0 && (
            <View style={[styles.badge, { backgroundColor: `${Colors.success}18`, borderColor: `${Colors.success}30` }]}>
              <Text style={[styles.badgeText, { color: Colors.success }]}>
                ⚽ {goalCount > 1 ? `x${goalCount}` : 'Gol'}
              </Text>
            </View>
          )}
          {stats.yellowCard && (
            <View style={[styles.badge, { backgroundColor: `${Colors.warning}18`, borderColor: `${Colors.warning}30` }]}>
              <Text style={[styles.badgeText, { color: Colors.warning }]}>🟨</Text>
            </View>
          )}
          {stats.redCard && (
            <View style={[styles.badge, { backgroundColor: `${Colors.destructive}18`, borderColor: `${Colors.destructive}30` }]}>
              <Text style={[styles.badgeText, { color: Colors.destructive }]}>🟥</Text>
            </View>
          )}
        </View>
      </View>
      {stats.rating > 0 && (
        <View style={[styles.ratingChip, { backgroundColor: `${ratingColor(stats.rating)}18` }]}>
          <Text style={[styles.ratingText, { color: ratingColor(stats.rating) }]}>{stats.rating}</Text>
        </View>
      )}
    </View>
  );
}

export default function MatchDetailScreen() {
  const { matchId, seasonId } = useLocalSearchParams<{ matchId: string; seasonId: string }>();
  const insets = useSafeAreaInsets();
  const theme = useClubTheme();
  const { activeCareer } = useCareer();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: seasonGameData, isLoading } = useQuery({
    queryKey: ['/api/data/season', seasonId],
    queryFn: () => api.seasonData.get(seasonId),
    enabled: !!seasonId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: squadData } = useQuery({
    queryKey: ['/api/squad', activeCareer?.clubId],
    queryFn: () => activeCareer?.clubId ? api.squad.get(activeCareer.clubId) : null,
    enabled: !!activeCareer?.clubId,
    staleTime: 1000 * 60 * 30,
  });

  const match: MatchRecord | undefined = seasonGameData?.data?.matches?.find(
    (m) => m.id === matchId
  );

  // Resolve player names + positions: snapshot wins (immutable past matches),
  // then fall back to current squad. This mirrors the web behaviour and means
  // future Elenco changes don't alter how the match is displayed.
  const playerInfo = useMemo<Map<number, { name: string; positionPtBr?: string; number?: number }>>(() => {
    const map = new Map<number, { name: string; positionPtBr?: string; number?: number }>();
    (squadData?.players ?? []).forEach((p) =>
      map.set(p.id, { name: p.name, positionPtBr: (p as { positionPtBr?: string }).positionPtBr, number: (p as { number?: number }).number }),
    );
    if (match?.playerSnapshot) {
      for (const [idStr, snap] of Object.entries(match.playerSnapshot)) {
        map.set(Number(idStr), { name: snap.name, positionPtBr: snap.positionPtBr, number: snap.number });
      }
    }
    return map;
  }, [squadData, match?.playerSnapshot]);

  const playerIdToName = useMemo<Map<number, string>>(() => {
    const map = new Map<number, string>();
    playerInfo.forEach((info, id) => map.set(id, info.name));
    return map;
  }, [playerInfo]);

  // Group starters by sector for a cleaner, formation-aware lineup view.
  const startersBySector = useMemo(() => {
    const buckets: Record<'GOL' | 'DEF' | 'MID' | 'ATA', { id: number; name: string; number?: number }[]> = {
      GOL: [], DEF: [], MID: [], ATA: [],
    };
    for (const id of match?.starterIds ?? []) {
      if (id === 0) continue;
      const info = playerInfo.get(id);
      const pos = info?.positionPtBr;
      const sector: 'GOL' | 'DEF' | 'MID' | 'ATA' =
        pos === 'GOL' || pos === 'DEF' || pos === 'MID' || pos === 'ATA' ? pos : 'MID';
      buckets[sector].push({ id, name: info?.name ?? `Jogador #${id}`, number: info?.number });
    }
    return buckets;
  }, [match?.starterIds, playerInfo]);

  if (!seasonId || !matchId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Partida não encontrada</Text>
      </View>
    );
  }

  const result = match ? getMatchResult(match.myScore, match.opponentScore) : null;
  const resultCfg = result ? RESULT_CONFIG[result] : null;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes da Partida</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <Ionicons name="time-outline" size={32} color={Colors.mutedForeground} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : !match ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Partida não encontrada</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Score card */}
          <View
            style={[
              styles.scoreCard,
              { borderColor: `${resultCfg?.color ?? Colors.border}30` },
            ]}
          >
            {/* Result badge */}
            {resultCfg && (
              <View style={[styles.resultBadge, { backgroundColor: `${resultCfg.color}15` }]}>
                <Ionicons name={resultCfg.icon} size={18} color={resultCfg.color} />
                <Text style={[styles.resultLabel, { color: resultCfg.color }]}>
                  {resultCfg.label}
                </Text>
              </View>
            )}

            {/* Score */}
            <View style={styles.scoreRow}>
              <Text style={styles.teamName} numberOfLines={1}>
                {activeCareer?.clubName ?? 'Nós'}
              </Text>
              <View style={styles.scoreWrap}>
                <Text style={styles.score}>{match.myScore}</Text>
                <Text style={styles.scoreSep}>–</Text>
                <Text style={styles.score}>{match.opponentScore}</Text>
              </View>
              <Text style={styles.teamName} numberOfLines={1}>{match.opponent}</Text>
            </View>

            {/* Meta */}
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Ionicons name="calendar-outline" size={12} color={Colors.mutedForeground} />
                <Text style={styles.metaText}>{match.date}</Text>
              </View>
              <View style={styles.metaDot} />
              <View style={styles.metaChip}>
                <Ionicons name="trophy-outline" size={12} color={Colors.mutedForeground} />
                <Text style={styles.metaText}>{match.tournament}</Text>
              </View>
              <View style={styles.metaDot} />
              <View style={styles.metaChip}>
                <Ionicons name="location-outline" size={12} color={Colors.mutedForeground} />
                <Text style={styles.metaText}>{LOCATION_LABELS[match.location] ?? match.location}</Text>
              </View>
            </View>
          </View>

          {/* Match stats */}
          {match.matchStats && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Estatísticas da Partida</Text>
              <View style={styles.card}>
                <StatRow
                  label="Finalizações"
                  value={`${match.matchStats.myShots} – ${match.matchStats.opponentShots}`}
                />
                <View style={styles.divider} />
                <StatRow
                  label="Posse de bola"
                  value={`${match.matchStats.possessionPct}%`}
                />
                {match.matchStats.penaltyGoals != null && (
                  <>
                    <View style={styles.divider} />
                    <StatRow label="Gols de pênalti" value={match.matchStats.penaltyGoals} />
                  </>
                )}
              </View>
            </View>
          )}

          {/* Match details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detalhes</Text>
            <View style={styles.card}>
              <StatRow label="Fase / Rodada" value={match.stage} />
              {match.motmPlayerName && (
                <>
                  <View style={styles.divider} />
                  <StatRow label="Craque da Partida" value={match.motmPlayerName} />
                </>
              )}
              {match.tablePositionBefore != null && (
                <>
                  <View style={styles.divider} />
                  <StatRow label="Posição antes da partida" value={`${match.tablePositionBefore}º`} />
                </>
              )}
            </View>
          </View>

          {/* Lineup — grouped by sector so the formation reads at a glance */}
          {((match.starterIds?.length ?? 0) > 0 || (match.subIds?.length ?? 0) > 0) && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Escalação</Text>
                {match.formation && (
                  <View style={styles.formationChip}>
                    <Ionicons name="grid-outline" size={11} color={Colors.mutedForeground} />
                    <Text style={styles.formationChipText}>{match.formation}</Text>
                  </View>
                )}
              </View>
              <View style={styles.card}>
                {(['GOL', 'DEF', 'MID', 'ATA'] as const).map((sector) => {
                  const players = startersBySector[sector];
                  if (players.length === 0) return null;
                  return (
                    <View key={sector} style={styles.sectorBlock}>
                      <Text style={styles.sectorLabel}>{SECTOR_LABELS[sector]}</Text>
                      {players.map((p) => (
                        <View key={p.id} style={styles.lineupRow}>
                          <View style={[styles.lineupBadge, { backgroundColor: `${SECTOR_COLORS[sector]}20` }]}>
                            <Text style={[styles.lineupBadgeText, { color: SECTOR_COLORS[sector] }]}>
                              {p.number != null ? p.number : sector[0]}
                            </Text>
                          </View>
                          <Text style={styles.lineupName}>{p.name}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
                {(match.subIds ?? []).length > 0 && (
                  <View style={styles.sectorBlock}>
                    <Text style={styles.sectorLabel}>Reservas</Text>
                    {(match.subIds ?? []).map((id) => {
                      const info = playerInfo.get(id);
                      const name = info?.name ?? `Jogador #${id}`;
                      return (
                        <View key={id} style={styles.lineupRow}>
                          <View style={[styles.lineupBadge, { backgroundColor: `${Colors.warning}15` }]}>
                            <Text style={[styles.lineupBadgeText, { color: Colors.warning }]}>R</Text>
                          </View>
                          <Text style={styles.lineupName}>{name}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Goals & Assists + Ratings */}
          {match.playerStats && Object.keys(match.playerStats).length > 0 && (() => {
            const entries = Object.entries(match.playerStats as Record<string, PlayerMatchStats>);
            const scorers = entries.filter(([, s]) => (s.goals?.length ?? 0) > 0);
            const withRatings = entries.filter(([, s]) => s.rating > 0);
            return (
              <>
                {scorers.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Artilheiros & Assistências</Text>
                    <View style={styles.card}>
                      {scorers.map(([pidStr, s], idx) => {
                        const playerName = playerIdToName.get(Number(pidStr)) ?? `Jogador #${pidStr}`;
                        const assists = s.goals
                          .filter((g) => g.assistPlayerId != null)
                          .map((g) => playerIdToName.get(g.assistPlayerId!) ?? `#${g.assistPlayerId}`)
                          .filter((v, i, arr) => arr.indexOf(v) === i);
                        return (
                          <View key={pidStr}>
                            {idx > 0 && <View style={styles.divider} />}
                            <View style={styles.playerRow}>
                              <View style={styles.playerRowLeft}>
                                <Text style={styles.playerName}>{playerName}</Text>
                                <View style={styles.playerBadges}>
                                  <View style={[styles.badge, { backgroundColor: `${Colors.success}18`, borderColor: `${Colors.success}30` }]}>
                                    <Text style={[styles.badgeText, { color: Colors.success }]}>
                                      ⚽ {s.goals.length > 1 ? `x${s.goals.length}` : 'Gol'}
                                    </Text>
                                  </View>
                                  {assists.length > 0 && (
                                    <View style={[styles.badge, { backgroundColor: `${Colors.info}18`, borderColor: `${Colors.info}30` }]}>
                                      <Text style={[styles.badgeText, { color: Colors.info }]}>
                                        🤝 {assists.join(', ')}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                              {s.rating > 0 && (
                                <View style={[styles.ratingChip, { backgroundColor: `${ratingColor(s.rating)}18` }]}>
                                  <Text style={[styles.ratingText, { color: ratingColor(s.rating) }]}>{s.rating}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
                {withRatings.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Avaliações dos Jogadores</Text>
                    <View style={styles.card}>
                      {withRatings
                        .sort(([, a], [, b]) => b.rating - a.rating)
                        .map(([pidStr, s], idx) => {
                          const playerName = playerIdToName.get(Number(pidStr)) ?? `Jogador #${pidStr}`;
                          return (
                            <View key={pidStr}>
                              {idx > 0 && <View style={styles.divider} />}
                              <PlayerStatsRow name={playerName} stats={s} />
                            </View>
                          );
                        })}
                    </View>
                  </View>
                )}
              </>
            );
          })()}

          {/* Observations */}
          {match.observations && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Observações</Text>
              <View style={styles.card}>
                <Text style={styles.observations}>{match.observations}</Text>
              </View>
            </View>
          )}
        </ScrollView>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.foreground,
    fontFamily: 'Inter_600SemiBold',
  },
  scroll: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { color: Colors.mutedForeground, fontSize: 15, fontFamily: 'Inter_400Regular' },
  errorText: { color: Colors.mutedForeground, fontSize: 15, fontFamily: 'Inter_400Regular' },
  scoreCard: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    borderWidth: 1,
    margin: 16,
    padding: 20,
    gap: 16,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.foreground,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  scoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  score: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: Colors.foreground,
    fontFamily: 'Inter_700Bold',
  },
  scoreSep: {
    fontSize: 28,
    color: Colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.mutedForeground },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statLabel: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  statValue: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 16 },
  observations: {
    fontSize: 14,
    color: Colors.foreground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    padding: 16,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  playerRowLeft: { flex: 1, gap: 4 },
  playerName: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  playerBadges: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  ratingChip: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  ratingText: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  lineupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 11,
  },
  lineupBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  lineupBadgeText: { fontSize: 11, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  lineupName: { flex: 1, fontSize: 14, color: Colors.foreground, fontFamily: 'Inter_400Regular' },
  lineupSubLabel: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 8,
  },
  formationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: `${Colors.mutedForeground}15`,
  },
  formationChipText: {
    fontSize: 11, color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5,
  },
  sectorBlock: { paddingTop: 6, paddingBottom: 4 },
  sectorLabel: {
    fontSize: 10, color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold', letterSpacing: 1,
    textTransform: 'uppercase' as const,
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2,
  },
});
