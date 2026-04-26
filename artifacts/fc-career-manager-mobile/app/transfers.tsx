import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type Transfer } from '@/lib/api';
import { Colors } from '@/constants/colors';

type Tab = 'in' | 'out';

const TRANSFER_LABELS: Record<string, { icon: string; color: string; label: string }> = {
  in: { icon: '📥', color: Colors.success, label: 'Contratado' },
  out: { icon: '📤', color: Colors.destructive, label: 'Vendido' },
  loan_in: { icon: '📋', color: Colors.info, label: 'Emprestado (entrada)' },
  loan_out: { icon: '📋', color: Colors.warning, label: 'Emprestado (saída)' },
};

function formatFee(fee: number): string {
  if (fee <= 0) return 'Grátis';
  if (fee >= 1_000_000) return `€${(fee / 1_000_000).toFixed(1)}M`;
  if (fee >= 1_000) return `€${(fee / 1_000).toFixed(0)}k`;
  return `€${fee}`;
}

function TransferCard({ item }: { item: Transfer }) {
  const cfg = TRANSFER_LABELS[item.type] ?? TRANSFER_LABELS.in;
  const isIn = item.type === 'in' || item.type === 'loan_in';
  const feeColor = isIn ? Colors.destructive : Colors.success;

  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: isIn ? Colors.success : Colors.destructive }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <View style={[styles.typePill, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}30` }]}>
            <Text style={styles.typePillEmoji}>{cfg.icon}</Text>
            <Text style={[styles.typePillText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.transferSeason}>{item.season}</Text>
        </View>
        <Text style={styles.playerName}>{item.playerName}</Text>
        <View style={styles.cardBottom}>
          <View style={styles.clubRow}>
            <Ionicons name={isIn ? 'arrow-down-outline' : 'arrow-up-outline'} size={13} color={Colors.mutedForeground} />
            <Text style={styles.clubText}>{item.club}</Text>
          </View>
          <Text style={[styles.feeText, { color: feeColor }]}>{formatFee(item.fee)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function TransfersScreen() {
  const insets = useSafeAreaInsets();
  const { activeSeason } = useCareer();
  const theme = useClubTheme();
  const [tab, setTab] = useState<Tab>('in');

  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const { data, isLoading } = useQuery({
    queryKey: ['/api/data/season/transfers', activeSeason?.id],
    queryFn: () => activeSeason ? api.transfers.list(activeSeason.id) : [],
    enabled: !!activeSeason?.id,
    staleTime: 1000 * 60 * 5,
  });

  const transfers = data ?? [];
  const filtered = transfers.filter((t) =>
    tab === 'in' ? (t.type === 'in' || t.type === 'loan_in') : (t.type === 'out' || t.type === 'loan_out')
  );

  const spent = transfers
    .filter((t) => t.type === 'in')
    .reduce((s, t) => s + (t.fee ?? 0), 0);
  const earned = transfers
    .filter((t) => t.type === 'out')
    .reduce((s, t) => s + (t.fee ?? 0), 0);
  const net = spent - earned;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Transferências</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderColor: `${Colors.destructive}30` }]}>
          <Text style={[styles.summaryValue, { color: Colors.destructive }]}>{formatFee(spent)}</Text>
          <Text style={styles.summaryLabel}>Gasto</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: `${Colors.success}30` }]}>
          <Text style={[styles.summaryValue, { color: Colors.success }]}>{formatFee(earned)}</Text>
          <Text style={styles.summaryLabel}>Arrecadado</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: `${net > 0 ? Colors.warning : Colors.success}30` }]}>
          <Text style={[styles.summaryValue, { color: net > 0 ? Colors.warning : Colors.success }]}>
            {net > 0 ? '-' : '+'}{formatFee(Math.abs(net))}
          </Text>
          <Text style={styles.summaryLabel}>Saldo</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {(['in', 'out'] as Tab[]).map((t) => {
          const label = t === 'in' ? 'Contratações' : 'Vendas';
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, active && { backgroundColor: `rgba(${theme.primaryRgb}, 0.15)`, borderColor: `rgba(${theme.primaryRgb}, 0.4)` }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, active && { color: theme.primary }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="swap-horizontal-outline" size={48} color={Colors.mutedForeground} />
          <Text style={styles.emptyText}>
            {tab === 'in' ? 'Sem contratações registradas.' : 'Sem vendas registradas.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => <TransferCard item={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: { fontSize: 16, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  summaryLabel: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card, alignItems: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardAccent: { width: 4 },
  cardContent: { flex: 1, padding: 14, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 99, borderWidth: 1,
  },
  typePillEmoji: { fontSize: 11 },
  typePillText: { fontSize: 11, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  transferSeason: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  playerName: { fontSize: 16, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clubText: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  feeText: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
});
