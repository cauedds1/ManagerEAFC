import { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, getMatchResult, type MatchRecord } from '@/lib/api';
import { Colors } from '@/constants/colors';

type MatchResult = 'vitoria' | 'empate' | 'derrota';

function FormBall({ result }: { result: MatchResult | 'future' }) {
  const cfg: Record<string, { color: string; label: string }> = {
    vitoria: { color: Colors.success, label: 'V' },
    empate: { color: Colors.mutedForeground, label: 'E' },
    derrota: { color: Colors.destructive, label: 'D' },
    future: { color: Colors.border, label: '·' },
  };
  const c = cfg[result] ?? cfg.future;
  return (
    <View style={[styles.formBall, { backgroundColor: `${c.color}20`, borderColor: c.color }]}>
      <Text style={[styles.formBallText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

interface StreakInfo {
  type: 'vitoria' | 'invicto' | 'derrota' | 'sem_vitoria';
  count: number;
  label: string;
  color: string;
}

function computeCurrentStreak(matches: MatchRecord[]): StreakInfo | null {
  if (matches.length === 0) return null;
  const sorted = [...matches].sort((a, b) => b.createdAt - a.createdAt);
  const latest = getMatchResult(sorted[0].myScore, sorted[0].opponentScore);

  let count = 0;
  for (const m of sorted) {
    const r = getMatchResult(m.myScore, m.opponentScore);
    if (latest === 'vitoria' && r === 'vitoria') count++;
    else if (latest === 'empate' && r === 'empate') count++;
    else if (latest === 'derrota' && r === 'derrota') count++;
    else break;
  }

  const cfg: Record<string, { label: string; color: string }> = {
    vitoria: { label: 'Sequência de Vitórias', color: Colors.success },
    empate: { label: 'Sequência de Empates', color: Colors.warning },
    derrota: { label: 'Sequência de Derrotas', color: Colors.destructive },
  };
  return { type: latest as StreakInfo['type'], count, label: cfg[latest].label, color: cfg[latest].color };
}

function computeUnbeatenStreak(matches: MatchRecord[]): number {
  const sorted = [...matches].sort((a, b) => b.createdAt - a.createdAt);
  let count = 0;
  for (const m of sorted) {
    if (getMatchResult(m.myScore, m.opponentScore) !== 'derrota') count++;
    else break;
  }
  return count;
}

function computeLongestWinStreak(matches: MatchRecord[]): number {
  const sorted = [...matches].sort((a, b) => a.createdAt - b.createdAt);
  let max = 0;
  let cur = 0;
  for (const m of sorted) {
    if (getMatchResult(m.myScore, m.opponentScore) === 'vitoria') {
      cur++;
      max = Math.max(max, cur);
    } else {
      cur = 0;
    }
  }
  return max;
}

function computeLongestUnbeaten(matches: MatchRecord[]): number {
  const sorted = [...matches].sort((a, b) => a.createdAt - b.createdAt);
  let max = 0;
  let cur = 0;
  for (const m of sorted) {
    if (getMatchResult(m.myScore, m.opponentScore) !== 'derrota') {
      cur++;
      max = Math.max(max, cur);
    } else {
      cur = 0;
    }
  }
  return max;
}

export default function SequenciasScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, activeSeason } = useCareer();
  const theme = useClubTheme();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;

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

  const matches: MatchRecord[] = seasonGameData?.data?.matches ?? [];

  const form = useMemo(() => {
    const sorted = [...matches].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
    const filled: Array<MatchResult | 'future'> = sorted.map((m) => getMatchResult(m.myScore, m.opponentScore));
    while (filled.length < 5) filled.push('future');
    return filled.slice(0, 5);
  }, [matches]);

  const currentStreak = useMemo(() => computeCurrentStreak(matches), [matches]);
  const unbeatenStreak = useMemo(() => computeUnbeatenStreak(matches), [matches]);
  const longestWin = useMemo(() => computeLongestWinStreak(matches), [matches]);
  const longestUnbeaten = useMemo(() => computeLongestUnbeaten(matches), [matches]);

  const recentMatches = useMemo(
    () => [...matches].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
    [matches],
  );

  const wins = matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === 'vitoria').length;
  const draws = matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === 'empate').length;
  const losses = matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === 'derrota').length;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Sequências</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="trending-up-outline" size={48} color={Colors.mutedForeground} />
          <Text style={styles.emptyTitle}>Sem partidas ainda</Text>
          <Text style={styles.emptyText}>Registre partidas para ver suas sequências.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FORMA RECENTE</Text>
            <View style={styles.formCard}>
              <View style={styles.formRow}>
                {form.map((r, i) => <FormBall key={i} result={r} />)}
              </View>
              <View style={styles.formLegend}>
                <Text style={[styles.legendDot, { color: Colors.success }]}>● V = Vitória</Text>
                <Text style={[styles.legendDot, { color: Colors.mutedForeground }]}>● E = Empate</Text>
                <Text style={[styles.legendDot, { color: Colors.destructive }]}>● D = Derrota</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SEQUÊNCIA ATUAL</Text>
            {currentStreak ? (
              <View style={[styles.streakCard, { borderColor: `${currentStreak.color}40`, backgroundColor: `${currentStreak.color}08` }]}>
                <Text style={[styles.streakCount, { color: currentStreak.color }]}>{currentStreak.count}</Text>
                <Text style={[styles.streakLabel, { color: currentStreak.color }]}>{currentStreak.label}</Text>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.noDataText}>Nenhuma sequência ativa</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INVICTO</Text>
            <View style={[styles.streakCard, {
              borderColor: unbeatenStreak > 0 ? `${Colors.info}40` : Colors.border,
              backgroundColor: unbeatenStreak > 0 ? `${Colors.info}08` : Colors.card,
            }]}>
              <Text style={[styles.streakCount, { color: unbeatenStreak > 0 ? Colors.info : Colors.mutedForeground }]}>
                {unbeatenStreak}
              </Text>
              <Text style={[styles.streakLabel, { color: unbeatenStreak > 0 ? Colors.info : Colors.mutedForeground }]}>
                {unbeatenStreak === 1 ? 'Jogo sem derrota' : 'Jogos sem derrota'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RECORDES DA TEMPORADA</Text>
            <View style={styles.recordsGrid}>
              <View style={styles.recordCard}>
                <Text style={[styles.recordValue, { color: Colors.success }]}>{longestWin}</Text>
                <Text style={styles.recordLabel}>Maior Seq. de Vitórias</Text>
              </View>
              <View style={styles.recordCard}>
                <Text style={[styles.recordValue, { color: Colors.info }]}>{longestUnbeaten}</Text>
                <Text style={styles.recordLabel}>Maior Seq. Invicto</Text>
              </View>
              <View style={styles.recordCard}>
                <Text style={[styles.recordValue, { color: Colors.success }]}>{wins}</Text>
                <Text style={styles.recordLabel}>Vitórias</Text>
              </View>
              <View style={styles.recordCard}>
                <Text style={[styles.recordValue, { color: Colors.warning }]}>{draws}</Text>
                <Text style={styles.recordLabel}>Empates</Text>
              </View>
              <View style={styles.recordCard}>
                <Text style={[styles.recordValue, { color: Colors.destructive }]}>{losses}</Text>
                <Text style={styles.recordLabel}>Derrotas</Text>
              </View>
              <View style={styles.recordCard}>
                <Text style={[styles.recordValue, { color: Colors.foreground }]}>{matches.length}</Text>
                <Text style={styles.recordLabel}>Total de Jogos</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ÚLTIMAS PARTIDAS</Text>
            <View style={styles.card}>
              {recentMatches.map((m, idx) => {
                const r = getMatchResult(m.myScore, m.opponentScore);
                const resultCfg = {
                  vitoria: { label: 'V', color: Colors.success },
                  empate: { label: 'E', color: Colors.warning },
                  derrota: { label: 'D', color: Colors.destructive },
                }[r];
                return (
                  <View key={m.id}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.recentRow}>
                      <View style={[styles.resultChip, { backgroundColor: `${resultCfg.color}20` }]}>
                        <Text style={[styles.resultChipText, { color: resultCfg.color }]}>{resultCfg.label}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recentOpponent} numberOfLines={1}>vs {m.opponent}</Text>
                        <Text style={styles.recentMeta}>{m.stage} · {m.tournament}</Text>
                      </View>
                      <Text style={styles.recentScore}>{m.myScore}–{m.opponentScore}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  scroll: { padding: 16, gap: 24 },
  section: { gap: 10 },
  sectionLabel: {
    fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8,
  },
  formCard: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border,
    padding: 20, gap: 16, alignItems: 'center',
  },
  formRow: { flexDirection: 'row', gap: 10 },
  formBall: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  formBallText: { fontSize: 14, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  formLegend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  legendDot: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  card: { backgroundColor: Colors.card, borderRadius: Colors.radiusLg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  streakCard: {
    borderRadius: Colors.radiusLg, borderWidth: 1,
    padding: 24, alignItems: 'center', gap: 6,
  },
  streakCount: { fontSize: 48, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  streakLabel: { fontSize: 14, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  recordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  recordCard: {
    flex: 1, minWidth: '30%',
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, alignItems: 'center', gap: 4,
  },
  recordValue: { fontSize: 28, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  recordLabel: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  noDataText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', padding: 16, textAlign: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  resultChip: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  resultChipText: { fontSize: 12, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  recentOpponent: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  recentMeta: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  recentScore: { fontSize: 14, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
});
