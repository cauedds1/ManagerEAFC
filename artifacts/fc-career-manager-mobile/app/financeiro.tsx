import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type Finances } from '@/lib/api';
import { Colors } from '@/constants/colors';

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}k`;
  return `€${n}`;
}

function parseMoney(raw: string): number {
  const trimmed = raw.trim().replace(/\s/g, '');
  if (!trimmed) return 0;
  const mMatch = trimmed.match(/^([\d.,]+)\s*[Mm]$/);
  if (mMatch) {
    const base = parseFloat(mMatch[1].replace(/\./g, '').replace(',', '.'));
    return isNaN(base) ? 0 : Math.round(base * 1_000_000);
  }
  const cleaned = trimmed.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
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

function BudgetEditorModal({
  visible, finances, onClose, onSave,
}: {
  visible: boolean;
  finances: Finances | null;
  onClose: () => void;
  onSave: (f: Finances) => void;
}) {
  const theme = useClubTheme();
  const [transferBudget, setTransferBudget] = useState(
    finances?.transferBudget ? formatMoney(finances.transferBudget).replace('€', '') : ''
  );
  const [wage, setWage] = useState(
    finances?.wage ? formatMoney(finances.wage).replace('€', '') : ''
  );
  const [budget, setBudget] = useState(
    finances?.budget ? formatMoney(finances.budget).replace('€', '') : ''
  );

  const handleSave = () => {
    onSave({
      transferBudget: parseMoney(transferBudget),
      wage: parseMoney(wage),
      budget: parseMoney(budget),
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar Orçamento</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.hint}>Use M para milhões (ex: 50M = €50.000.000)</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>ORÇAMENTO TOTAL</Text>
              <View style={styles.inputRow}>
                <Text style={styles.currency}>€</Text>
                <TextInput
                  style={styles.textInput}
                  value={budget}
                  onChangeText={setBudget}
                  placeholder="Ex: 100M"
                  placeholderTextColor={Colors.mutedForeground}
                  keyboardType="default"
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>ORÇAMENTO DE TRANSFERÊNCIAS</Text>
              <View style={styles.inputRow}>
                <Text style={styles.currency}>€</Text>
                <TextInput
                  style={styles.textInput}
                  value={transferBudget}
                  onChangeText={setTransferBudget}
                  placeholder="Ex: 50M"
                  placeholderTextColor={Colors.mutedForeground}
                  keyboardType="default"
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>FOLHA SALARIAL (por semana)</Text>
              <View style={styles.inputRow}>
                <Text style={styles.currency}>€</Text>
                <TextInput
                  style={styles.textInput}
                  value={wage}
                  onChangeText={setWage}
                  placeholder="Ex: 2M"
                  placeholderTextColor={Colors.mutedForeground}
                  keyboardType="default"
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.2)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }]}
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, { color: theme.primary }]}>Salvar Orçamento</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function FinanceiroScreen() {
  const insets = useSafeAreaInsets();
  const { activeSeason } = useCareer();
  const theme = useClubTheme();
  const qc = useQueryClient();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const [showEditor, setShowEditor] = useState(false);

  const { data: seasonData, isLoading } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
    staleTime: 1000 * 60 * 5,
  });

  const finances = seasonData?.data?.finances ?? null;
  const allTransfers: Array<{ type: string; fee: number; playerName: string; club: string; salary?: number }> = (seasonData?.data?.transfers ?? []) as Array<{ type: string; fee: number; playerName: string; club: string; salary?: number }>;

  const saveMutation = useMutation({
    mutationFn: (f: Finances) => {
      if (!activeSeason) throw new Error('no season');
      return api.finances.save(activeSeason.id, f);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/data/season', activeSeason?.id] });
      setShowEditor(false);
    },
    onError: () => Alert.alert('Erro', 'Não foi possível salvar o orçamento.'),
  });

  const signings = allTransfers.filter((t) => t.type === 'in' || t.type === 'loan_in');
  const sales = allTransfers.filter((t) => t.type === 'out' || t.type === 'loan_out');

  const totalSpent = signings.filter((t) => t.type === 'in').reduce((s, t) => s + (t.fee ?? 0), 0);
  const totalEarned = sales.filter((t) => t.type === 'out').reduce((s, t) => s + (t.fee ?? 0), 0);
  const netSpend = totalSpent - totalEarned;

  const transferBudget = finances?.transferBudget ?? 0;
  const salaryBudget = finances?.wage ?? 0;
  const totalBudget = finances?.budget ?? 0;
  const budgetLeft = transferBudget > 0 ? transferBudget - netSpend : 0;
  const budgetPct = transferBudget > 0 ? (netSpend / transferBudget) * 100 : 0;

  const soldNames = new Set(sales.map((s) => s.playerName.toLowerCase().trim()));
  const activeSignings = signings.filter((t) => !soldNames.has(t.playerName.toLowerCase().trim()));
  const currentWageBill = activeSignings.reduce((s, t) => s + (t.salary ?? 0), 0);
  const wageRoom = salaryBudget > 0 ? salaryBudget - currentWageBill : 0;
  const wageOverflow = salaryBudget > 0 && currentWageBill > salaryBudget;
  const wagePct = salaryBudget > 0 ? Math.min(100, (currentWageBill / salaryBudget) * 100) : 0;

  const topEarnersBySalary = [...activeSignings]
    .filter((t) => (t.salary ?? 0) > 0)
    .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, 5);

  const topEarnersByFee = signings
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
        <TouchableOpacity style={styles.editBtn} onPress={() => setShowEditor(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="pencil-outline" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {transferBudget === 0 && salaryBudget === 0 && (
            <TouchableOpacity
              style={styles.setupBanner}
              onPress={() => setShowEditor(true)}
            >
              <Ionicons name="wallet-outline" size={20} color={Colors.warning} />
              <Text style={styles.setupBannerText}>Toque para configurar o orçamento da temporada</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
            </TouchableOpacity>
          )}

          <View style={styles.grid}>
            {totalBudget > 0 && (
              <StatCard
                icon="💰"
                label="Orçamento Total"
                value={formatMoney(totalBudget)}
                sub="disponível"
                color={Colors.info}
              />
            )}
            <StatCard
              icon="🏦"
              label="Orçamento Transf."
              value={transferBudget > 0 ? formatMoney(budgetLeft) : '—'}
              sub={transferBudget > 0 ? `de ${formatMoney(transferBudget)}` : 'Não definido'}
              color={budgetLeft < 0 ? Colors.destructive : Colors.success}
            />
            <StatCard
              icon="📥"
              label="Gasto em contrat."
              value={formatMoney(totalSpent)}
              sub={`${allTransfers.filter((t) => t.type === 'in').length} contrat.`}
              color={Colors.destructive}
            />
            <StatCard
              icon="📤"
              label="Arrecadado"
              value={totalEarned > 0 ? formatMoney(totalEarned) : '—'}
              sub={`${allTransfers.filter((t) => t.type === 'out').length} vendas`}
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
              icon={wageOverflow ? '⚠️' : '💼'}
              label="Folha atual"
              value={currentWageBill > 0 ? formatMoney(currentWageBill) + '/sem' : salaryBudget > 0 ? '€0' : '—'}
              sub={salaryBudget > 0 ? `limite: ${formatMoney(salaryBudget)}/sem` : 'sem limite definido'}
              color={wageOverflow ? Colors.destructive : Colors.info}
            />
            <StatCard
              icon={wageRoom >= 0 ? '📋' : '🔴'}
              label="Espaço salarial"
              value={salaryBudget > 0 ? formatMoney(Math.abs(wageRoom)) + '/sem' : '—'}
              sub={salaryBudget > 0 ? (wageRoom >= 0 ? 'disponível por semana' : 'acima do limite') : 'configure a folha'}
              color={wageRoom < 0 ? Colors.destructive : Colors.success}
            />
          </View>

          {transferBudget > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>USO DO ORÇAMENTO DE TRANSFERÊNCIAS</Text>
              <View style={styles.sectionCard}>
                <View style={styles.barRow}>
                  <Text style={styles.barLabel}>Transferências</Text>
                  <Text style={styles.barValue}>{formatMoney(netSpend)} / {formatMoney(transferBudget)}</Text>
                </View>
                <BarTrack pct={budgetPct} color={theme.primary} />
                <Text style={styles.barMeta}>
                  {budgetPct.toFixed(0)}% utilizado
                  {budgetLeft >= 0 ? ` · ${formatMoney(budgetLeft)} restantes` : ` · ${formatMoney(Math.abs(budgetLeft))} acima do limite`}
                </Text>
                {budgetLeft < 0 && (
                  <View style={styles.warningRow}>
                    <Ionicons name="warning-outline" size={14} color={Colors.destructive} />
                    <Text style={styles.warningText}>Orçamento de transferências estourado</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {salaryBudget > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>USO DA FOLHA SALARIAL</Text>
              <View style={styles.sectionCard}>
                <View style={styles.barRow}>
                  <Text style={styles.barLabel}>Folha atual</Text>
                  <Text style={styles.barValue}>{formatMoney(currentWageBill)} / {formatMoney(salaryBudget)}/sem</Text>
                </View>
                <BarTrack pct={wagePct} color={wageOverflow ? Colors.destructive : Colors.info} />
                <Text style={styles.barMeta}>
                  {wagePct.toFixed(0)}% da folha utilizada
                  {wageRoom >= 0 ? ` · ${formatMoney(wageRoom)}/sem disponível` : ` · ${formatMoney(Math.abs(wageRoom))}/sem acima`}
                </Text>
                {wageOverflow && (
                  <View style={styles.warningRow}>
                    <Ionicons name="warning-outline" size={14} color={Colors.destructive} />
                    <Text style={styles.warningText}>Folha salarial estourada</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {topEarnersBySalary.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MAIORES SALÁRIOS</Text>
              <View style={styles.sectionCard}>
                {topEarnersBySalary.map((t, i) => (
                  <View key={`sal_${i}`} style={[styles.earnerRow, i < topEarnersBySalary.length - 1 && styles.earnerSep]}>
                    <Text style={styles.earnerRank}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.earnerName}>{t.playerName}</Text>
                      <Text style={styles.earnerClub}>{t.club}</Text>
                    </View>
                    <Text style={[styles.earnerFee, { color: Colors.info }]}>{formatMoney(t.salary ?? 0)}/sem</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {topEarnersByFee.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MAIORES CONTRATAÇÕES</Text>
              <View style={styles.sectionCard}>
                {topEarnersByFee.map((t, i) => (
                  <View key={`fee_${i}`} style={[styles.earnerRow, i < topEarnersByFee.length - 1 && styles.earnerSep]}>
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

          {allTransfers.length === 0 && !transferBudget && (
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 48 }}>💰</Text>
              <Text style={styles.emptyTitle}>Sem movimentações</Text>
              <Text style={styles.emptyText}>Configure o orçamento e registre transferências para ver o resumo financeiro.</Text>
            </View>
          )}
        </ScrollView>
      )}

      <BudgetEditorModal
        visible={showEditor}
        finances={finances}
        onClose={() => setShowEditor(false)}
        onSave={(f) => saveMutation.mutate(f)}
      />
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
  editBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  setupBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: Colors.radius,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
    padding: 14, marginBottom: 4,
  },
  setupBannerText: { flex: 1, fontSize: 13, color: Colors.warning, fontFamily: 'Inter_400Regular' },
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
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  warningText: { fontSize: 12, color: Colors.destructive, fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const },
  earnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  earnerSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  earnerRank: { fontSize: 12, fontWeight: '700' as const, color: Colors.mutedForeground, width: 20, fontFamily: 'Inter_700Bold' },
  earnerName: { fontSize: 14, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  earnerClub: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  earnerFee: { fontSize: 14, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 22 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet: {
    backgroundColor: Colors.backgroundLighter,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  modalBody: { padding: 20, gap: 20 },
  modalFooter: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  hint: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  field: { gap: 8 },
  fieldLabel: {
    fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currency: { fontSize: 18, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  textInput: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15,
  },
  saveBtn: { borderRadius: Colors.radius, paddingVertical: 14, borderWidth: 1, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
});
