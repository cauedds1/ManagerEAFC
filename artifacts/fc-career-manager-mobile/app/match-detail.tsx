import type { ComponentProps } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, getMatchResult, type MatchRecord } from '@/lib/api';
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

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
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

  const match: MatchRecord | undefined = seasonGameData?.data?.matches?.find(
    (m) => m.id === matchId
  );

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
});
