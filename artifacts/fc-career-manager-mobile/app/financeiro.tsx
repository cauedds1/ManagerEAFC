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
import { api } from '@/lib/api';
import { Colors } from '@/constants/colors';

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}k`;
  return `€${n}`;
}

function BarTrack({ pct, color }: { pct: number; color: string }) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const barColor = pct >= 90 ? Colors.destructive : pct >= 70 ? Colors.warning : color;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${clampedPct}%`, backgroundColor: barColor }]} />
    </View>
  );
}

interface StatCardProps { label: string; value: string; sub: string; icon: string; color: string }
function StatCard({ label, value, sub, icon, color }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

export default function FinanceiroScreen() {
  const insets = useSafeAreaInsets();
  const { activeSeason } = useCareer();
  const theme = useClubTheme();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const { data: seasonData, isLoading } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
    staleTime: 1000 * 60 * 5,
  });

  const finances = seasonData?.data?.finances;
  const transfers = seasonData?.data?.transfers ?? [];

  const totalSpent = transfers.filter((t) => t.type === 'in').reduce((s, t) => s + t.fee, 0);
  const totalEarned = transfers.filter((t) => t.type === 'out').reduce((s, t) => s + t.fee, 0);
  const netSpend = totalSpent - totalEarned;

  const transferBudget = finances?.transferBudget ?? 0;
  const weeklyWage = finances?.wage ?? 0;
  const budgetLeft = transferBudget > 0 ? transferBudget - netSpend : 0;
  const budgetPct = transferBudget > 0 ? (netSpend / transferBudget) * 100 : 0;

  const topEarners = transfers
    .filter((t) => t.type === 'in')
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 5);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Financeiro</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            <StatCard
              icon="🏦"
              label="Orçamento restante"
              value={transferBudget > 0 ? formatMoney(budgetLeft) : '—'}
              sub={transferBudget > 0 ? `de ${formatMoney(transferBudget)}` : 'Não definido'}
              color={budgetLeft < 0 ? Colors.destructive : Colors.success}
            />
            <StatCard
              icon="📥"
              label="Gasto em contratações"
              value={formatMoney(totalSpent)}
              sub={`${transfers.filter((t) => t.type === 'in').length} contrat.`}
              color={Colors.destructive}
            />
            <StatCard
              icon="📤"
              label="Arrecadado em vendas"
              value={totalEarned > 0 ? formatMoney(totalEarned) : '—'}
              sub={`${transfers.filter((t) => t.type === 'out').length} vendas`}
              color={Colors.success}
            />
            <StatCard
              icon="📊"
              label="Saldo líquido"
              value={formatMoney(Math.abs(netSpend))}
              sub={netSpend > 0 ? 'Gasto líquido' : netSpend < 0 ? 'Superávit' : 'Equilibrado'}
              color={netSpend > 0 ? Colors.warning : netSpend < 0 ? Colors.success : Colors.mutedForeground}
            />
            <StatCard
              icon="💼"
              label="Folha salarial"
              value={weeklyWage > 0 ? formatMoney(weeklyWage) : '—'}
              sub="por semana"
              color={Colors.info}
            />
          </View>

          {transferBudget > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>USO DO ORÇAMENTO</Text>
              <View style={styles.sectionCard}>
                <View style={styles.barRow}>
                  <Text style={styles.barLabel}>Transferências</Text>
                  <Text style={styles.barValue}>{formatMoney(netSpend)} / {formatMoney(transferBudget)}</Text>
                </View>
                <BarTrack pct={budgetPct} color={theme.primary} />
                <Text style={styles.barMeta}>
                  {budgetPct.toFixed(0)}% utilizado{budgetLeft >= 0 ? ` · ${formatMoney(budgetLeft)} restantes` : ''}
                </Text>
              </View>
            </View>
          )}

          {topEarners.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MAIORES CONTRATAÇÕES</Text>
              <View style={styles.sectionCard}>
                {topEarners.map((t, i) => (
                  <View key={t.id} style={[styles.earnerRow, i < topEarners.length - 1 && styles.earnerSep]}>
                    <Text style={styles.earnerRank}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.earnerName}>{t.playerName}</Text>
                      <Text style={styles.earnerClub}>{t.club}</Text>
                    </View>
                    <Text style={[styles.earnerFee, { color: Colors.destructive }]}>{formatMoney(t.fee)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {transfers.length === 0 && (
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 48 }}>💰</Text>
              <Text style={styles.emptyTitle}>Sem movimentações</Text>
              <Text style={styles.emptyText}>Registre transferências para ver o resumo financeiro.</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%', flexGrow: 1,
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 4,
  },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  statSub: { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular' },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground,
    textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Inter_600SemiBold', paddingHorizontal: 2,
  },
  sectionCard: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 8,
  },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barLabel: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  barValue: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  barTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barMeta: { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular' },
  earnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  earnerSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  earnerRank: { fontSize: 12, fontWeight: '700' as const, color: Colors.mutedForeground, width: 20, fontFamily: 'Inter_700Bold' },
  earnerName: { fontSize: 14, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  earnerClub: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  earnerFee: { fontSize: 14, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 22 },
});
