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

interface RivalStats {
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

function FormBall({ result }: { result: 'vitoria' | 'empate' | 'derrota' | 'future' }) {
  const cfg = {
    vitoria: { color: Colors.success, label: 'V' },
    empate: { color: Colors.mutedForeground, label: 'E' },
    derrota: { color: Colors.destructive, label: 'D' },
    future: { color: Colors.border, label: '·' },
  }[result];
  return (
    <View style={[styles.formBall, { backgroundColor: `${cfg.color}25`, borderColor: `${cfg.color}60` }]}>
      <Text style={[styles.formBallText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function StreakCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={[styles.streakCard, { borderColor: `${color}30`, backgroundColor: `${color}0D` }]}>
      <Text style={{ fontSize: 28 }}>{icon}</Text>
      <Text style={[styles.streakValue, { color }]}>{value}</Text>
      <Text style={styles.streakLabel}>{label}</Text>
    </View>
  );
}

function RivalRow({ rival }: { rival: RivalStats }) {
  const total = rival.played;
  const winPct = total > 0 ? Math.round((rival.wins / total) * 100) : 0;
  const result = rival.wins > rival.losses ? 'vitoria' : rival.wins < rival.losses ? 'derrota' : 'empate';
  const barColor = result === 'vitoria' ? Colors.success : result === 'derrota' ? Colors.destructive : Colors.warning;
  return (
    <View style={styles.rivalRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rivalName} numberOfLines={1}>{rival.name}</Text>
        <Text style={styles.rivalRecord}>
          {rival.played}P · {rival.wins}V {rival.draws}E {rival.losses}D · {rival.goalsFor}:{rival.goalsAgainst}
        </Text>
        <View style={styles.winBar}>
          <View style={[styles.winBarFill, { width: `${winPct}%` as `${number}%`, backgroundColor: barColor }]} />
        </View>
      </View>
      <Text style={[styles.winPct, { color: barColor }]}>{winPct}%</Text>
    </View>
  );
}

export default function RivaisScreen() {
  const insets = useSafeAreaInsets();
  const { activeSeason, activeCareer } = useCareer();
  const theme = useClubTheme();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const { data: seasonGameData, isLoading } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
    staleTime: 1000 * 60 * 5,
  });

  const matches: MatchRecord[] = useMemo(
    () => [...(seasonGameData?.data?.matches ?? [])].sort((a, b) => a.createdAt - b.createdAt),
    [seasonGameData]
  );

  const form5 = useMemo(() => {
    const last5 = matches.slice(-5);
    const padded = Array.from({ length: 5 }, (_, i) => {
      const m = last5[i];
      return m ? getMatchResult(m.myScore, m.opponentScore) : ('future' as const);
    });
    return padded;
  }, [matches]);

  const { currentStreak, maxWinStreak, maxLossStreak } = useMemo(() => {
    let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
    for (const m of matches) {
      const r = getMatchResult(m.myScore, m.opponentScore);
      if (r === 'vitoria') { curWin++; curLoss = 0; maxWin = Math.max(maxWin, curWin); }
      else if (r === 'derrota') { curLoss++; curWin = 0; maxLoss = Math.max(maxLoss, curLoss); }
      else { curWin = 0; curLoss = 0; }
    }

    // compute current streak by scanning backwards from the latest match
    let currentStreakStr = '0';
    if (matches.length > 0) {
      const lastResult = getMatchResult(
        matches[matches.length - 1].myScore,
        matches[matches.length - 1].opponentScore,
      );
      let streak = 0;
      for (let i = matches.length - 1; i >= 0; i--) {
        if (getMatchResult(matches[i].myScore, matches[i].opponentScore) === lastResult) streak++;
        else break;
      }
      const label = lastResult === 'vitoria' ? 'V' : lastResult === 'derrota' ? 'D' : 'E';
      currentStreakStr = `${streak}${label}`;
    }

    return { currentStreak: currentStreakStr, maxWinStreak: maxWin, maxLossStreak: maxLoss };
  }, [matches]);

  const rivals: RivalStats[] = useMemo(() => {
    const map = new Map<string, RivalStats>();
    for (const m of matches) {
      if (!map.has(m.opponent)) {
        map.set(m.opponent, { name: m.opponent, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });
      }
      const s = map.get(m.opponent)!;
      s.played++;
      s.goalsFor += m.myScore;
      s.goalsAgainst += m.opponentScore;
      const r = getMatchResult(m.myScore, m.opponentScore);
      if (r === 'vitoria') s.wins++;
      else if (r === 'empate') s.draws++;
      else s.losses++;
    }
    return [...map.values()].sort((a, b) => b.played - a.played).slice(0, 15);
  }, [matches]);

  const totalStats = useMemo(() => {
    const wins = matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === 'vitoria').length;
    const draws = matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === 'empate').length;
    const losses = matches.filter((m) => getMatchResult(m.myScore, m.opponentScore) === 'derrota').length;
    const gf = matches.reduce((s, m) => s + m.myScore, 0);
    const ga = matches.reduce((s, m) => s + m.opponentScore, 0);
    return { wins, draws, losses, gf, ga };
  }, [matches]);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Rivais & Sequências</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Forma Recente</Text>
            <View style={styles.formRow}>
              {form5.map((result, i) => (
                <FormBall key={i} result={result} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sequências</Text>
            <View style={styles.streakRow}>
              <StreakCard
                label="Sequência Atual"
                value={currentStreak}
                color={currentStreak.includes('V') ? Colors.success : currentStreak.includes('D') ? Colors.destructive : Colors.mutedForeground}
                icon={currentStreak.includes('V') ? '🔥' : currentStreak.includes('D') ? '🥶' : '⚖️'}
              />
              <StreakCard
                label="Maior Vitórias"
                value={`${maxWinStreak}V`}
                color={Colors.success}
                icon="🏆"
              />
              <StreakCard
                label="Maior Derrotas"
                value={`${maxLossStreak}D`}
                color={Colors.destructive}
                icon="⚠️"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Desempenho Geral</Text>
            <View style={styles.statsGrid}>
              {[
                { label: 'Jogos', value: String(matches.length) },
                { label: 'Vitórias', value: String(totalStats.wins), color: Colors.success },
                { label: 'Empates', value: String(totalStats.draws), color: Colors.warning },
                { label: 'Derrotas', value: String(totalStats.losses), color: Colors.destructive },
                { label: 'Gols Feitos', value: String(totalStats.gf) },
                { label: 'Gols Sofridos', value: String(totalStats.ga) },
              ].map(({ label, value, color }) => (
                <View key={label} style={styles.statBox}>
                  <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          {rivals.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Adversários Frequentes</Text>
              <View style={styles.card}>
                {rivals.map((rival, idx) => (
                  <View key={rival.name}>
                    <RivalRow rival={rival} />
                    {idx < rivals.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </View>
          )}

          {matches.length === 0 && (
            <View style={styles.center}>
              <Text style={{ fontSize: 48 }}>⚽</Text>
              <Text style={styles.emptyTitle}>Sem partidas ainda</Text>
              <Text style={styles.emptyText}>Registre partidas para ver rivais e sequências.</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  scrollContent: { padding: 16, gap: 20 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600' as const, color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8,
  },
  formRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  formBall: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  formBallText: { fontSize: 14, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  streakRow: { flexDirection: 'row', gap: 10 },
  streakCard: {
    flex: 1, alignItems: 'center', gap: 4, padding: 14,
    borderRadius: Colors.radius, borderWidth: 1,
  },
  streakValue: { fontSize: 22, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  streakLabel: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: {
    flex: 1, minWidth: '28%', alignItems: 'center', gap: 2,
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border, padding: 12,
  },
  statValue: { fontSize: 22, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', color: Colors.foreground },
  statLabel: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  card: {
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  rivalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  rivalName: { fontSize: 15, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  rivalRecord: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  winBar: {
    height: 3, backgroundColor: Colors.border, borderRadius: 2, marginTop: 6,
    overflow: 'hidden',
  },
  winBarFill: { height: '100%', borderRadius: 2 },
  winPct: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', minWidth: 44, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular' },
});
