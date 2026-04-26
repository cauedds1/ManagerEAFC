import { useMemo, useState } from 'react';
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
type HomeFilter = 'all' | 'home' | 'away';

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

function computeCurrentWinStreak(matches: MatchRecord[]): number {
  const sorted = [...matches].sort((a, b) => b.createdAt - a.createdAt);
  let count = 0;
  for (const m of sorted) {
    if (getMatchResult(m.myScore, m.opponentScore) === 'vitoria') count++;
    else break;
  }
  return count;
}

function computeCurrentUnbeaten(matches: MatchRecord[]): number {
  const sorted = [...matches].sort((a, b) => b.createdAt - a.createdAt);
  let count = 0;
  for (const m of sorted) {
    if (getMatchResult(m.myScore, m.opponentScore) !== 'derrota') count++;
    else break;
  }
  return count;
}

function computeCurrentCleanSheets(matches: MatchRecord[]): number {
  const sorted = [...matches].sort((a, b) => b.createdAt - a.createdAt);
  let count = 0;
  for (const m of sorted) {
    if (m.opponentScore === 0) count++;
    else break;
  }
  return count;
}

function computeCurrentScoring(matches: MatchRecord[]): number {
  const sorted = [...matches].sort((a, b) => b.createdAt - a.createdAt);
  let count = 0;
  for (const m of sorted) {
    if (m.myScore > 0) count++;
    else break;
  }
  return count;
}

function computeLongest(matches: MatchRecord[], predicate: (m: MatchRecord) => boolean): number {
  const sorted = [...matches].sort((a, b) => a.createdAt - b.createdAt);
  let max = 0;
  let cur = 0;
  for (const m of sorted) {
    if (predicate(m)) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

interface StreakRowProps {
  label: string;
  current: number;
  record: number;
  color: string;
  icon: string;
  unit?: string;
}

function StreakRow({ label, current, record, color, icon, unit = 'jogos' }: StreakRowProps) {
  const isActive = current > 0;
  return (
    <View style={[styles.streakRow, { borderColor: isActive ? `${color}40` : Colors.border, backgroundColor: isActive ? `${color}07` : Colors.card }]}>
      <Text style={styles.streakIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.streakLabel}>{label}</Text>
        <View style={styles.streakMeta}>
          {isActive && (
            <View style={[styles.activePill, { backgroundColor: `${color}18`, borderColor: `${color}35` }]}>
              <Text style={[styles.activePillText, { color }]}>Em andamento</Text>
            </View>
          )}
          <Text style={styles.recordText}>Recorde: {record} {unit}</Text>
        </View>
      </View>
      <Text style={[styles.streakCount, { color: isActive ? color : Colors.mutedForeground }]}>
        {current}
      </Text>
    </View>
  );
}

export default function SequenciasScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, activeSeason } = useCareer();
  const theme = useClubTheme();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const [homeFilter, setHomeFilter] = useState<HomeFilter>('all');

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

  const allMatches: MatchRecord[] = seasonGameData?.data?.matches ?? [];

  const matches = useMemo(() => {
    if (homeFilter === 'home') return allMatches.filter((m) => m.location === 'casa');
    if (homeFilter === 'away') return allMatches.filter((m) => m.location === 'fora' || m.location === 'neutro');
    return allMatches;
  }, [allMatches, homeFilter]);

  const form = useMemo(() => {
    const sorted = [...matches].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const filled: Array<MatchResult | 'future'> = sorted.map((m) => getMatchResult(m.myScore, m.opponentScore));
    while (filled.length < 5) filled.push('future');
    return filled.slice(0, 5);
  }, [matches]);

  const currentWin = useMemo(() => computeCurrentWinStreak(matches), [matches]);
  const currentUnbeaten = useMemo(() => computeCurrentUnbeaten(matches), [matches]);
  const currentCleanSheets = useMemo(() => computeCurrentCleanSheets(matches), [matches]);
  const currentScoring = useMemo(() => computeCurrentScoring(matches), [matches]);

  const longestWin = useMemo(() => computeLongest(matches, (m) => getMatchResult(m.myScore, m.opponentScore) === 'vitoria'), [matches]);
  const longestUnbeaten = useMemo(() => computeLongest(matches, (m) => getMatchResult(m.myScore, m.opponentScore) !== 'derrota'), [matches]);
  const longestCleanSheets = useMemo(() => computeLongest(matches, (m) => m.opponentScore === 0), [matches]);
  const longestScoring = useMemo(() => computeLongest(matches, (m) => m.myScore > 0), [matches]);

  const wins = matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === 'vitoria').length;
  const draws = matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === 'empate').length;
  const losses = matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === 'derrota').length;
  const cleanSheetsTotal = matches.filter((m) => m.opponentScore === 0).length;

  const recentMatches = useMemo(
    () => [...matches].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
    [matches],
  );

  const filterBtns: Array<{ key: HomeFilter; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'home', label: 'Casa' },
    { key: 'away', label: 'Fora' },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Sequências</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterRow}>
        {filterBtns.map((b) => (
          <TouchableOpacity
            key={b.key}
            style={[styles.filterBtn, homeFilter === b.key && { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }]}
            onPress={() => setHomeFilter(b.key)}
          >
            <Text style={[styles.filterText, homeFilter === b.key && { color: theme.primary }]}>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : allMatches.length === 0 ? (
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
            <Text style={styles.sectionLabel}>FORMA RECENTE ({homeFilter === 'home' ? 'Casa' : homeFilter === 'away' ? 'Fora' : 'Geral'})</Text>
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
            <Text style={styles.sectionLabel}>SEQUÊNCIAS ATUAIS vs RECORDE</Text>
            <View style={styles.streakList}>
              <StreakRow
                label="Vitórias consecutivas"
                current={currentWin}
                record={longestWin}
                color={Colors.success}
                icon="🏆"
              />
              <StreakRow
                label="Jogos invicto"
                current={currentUnbeaten}
                record={longestUnbeaten}
                color={Colors.info}
                icon="🛡️"
              />
              <StreakRow
                label="Clean sheets (sem sofrer gol)"
                current={currentCleanSheets}
                record={longestCleanSheets}
                color="#8B5CF6"
                icon="🧤"
              />
              <StreakRow
                label="Jogos marcando gol"
                current={currentScoring}
                record={longestScoring}
                color={Colors.warning}
                icon="⚽"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ESTATÍSTICAS</Text>
            <View style={styles.recordsGrid}>
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
                <Text style={[styles.recordValue, { color: '#8B5CF6' }]}>{cleanSheetsTotal}</Text>
                <Text style={styles.recordLabel}>Clean Sheets</Text>
              </View>
              <View style={styles.recordCard}>
                <Text style={[styles.recordValue, { color: Colors.foreground }]}>{matches.length}</Text>
                <Text style={styles.recordLabel}>Total Jogos</Text>
              </View>
              <View style={styles.recordCard}>
                <Text style={[styles.recordValue, { color: Colors.foreground }]}>
                  {matches.length > 0 ? `${Math.round((wins / matches.length) * 100)}%` : '—'}
                </Text>
                <Text style={styles.recordLabel}>% Vitórias</Text>
              </View>
            </View>
          </View>

          {recentMatches.length > 0 && (
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
                          <Text style={styles.recentMeta}>
                            {m.location === 'casa' ? '🏠 ' : m.location === 'fora' ? '✈️ ' : '⚖️ '}{m.stage} · {m.tournament}
                            {m.opponentScore === 0 ? ' · 🧤' : ''}
                          </Text>
                        </View>
                        <Text style={styles.recentScore}>{m.myScore}–{m.opponentScore}</Text>
                      </View>
                    </View>
                  );
                })}
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
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  filterRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  filterBtn: {
    flex: 1, paddingVertical: 8, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card, alignItems: 'center',
  },
  filterText: { fontSize: 13, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
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
  streakList: { gap: 8 },
  streakRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: Colors.radiusLg, borderWidth: 1,
    padding: 14,
  },
  streakIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  streakLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  streakMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  activePill: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, borderWidth: 1,
  },
  activePillText: { fontSize: 10, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  recordText: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  streakCount: { fontSize: 28, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', minWidth: 36, textAlign: 'right' },
  recordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  recordCard: {
    flex: 1, minWidth: '30%',
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, alignItems: 'center', gap: 4,
  },
  recordValue: { fontSize: 28, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  recordLabel: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: Colors.radiusLg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
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
