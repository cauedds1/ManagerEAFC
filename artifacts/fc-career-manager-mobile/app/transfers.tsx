import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, Modal, TextInput,
  ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type Transfer, type TransferType, type PlayerSearchResult } from '@/lib/api';
import { Colors } from '@/constants/colors';

type Tab = 'in' | 'out';

const TRANSFER_LABELS: Record<string, { icon: string; color: string; label: string }> = {
  in: { icon: '📥', color: Colors.success, label: 'Contratado' },
  out: { icon: '📤', color: Colors.destructive, label: 'Vendido' },
  loan_in: { icon: '📋', color: Colors.info, label: 'Emprestado (ent.)' },
  loan_out: { icon: '📋', color: Colors.warning, label: 'Emprestado (saí.)' },
};

const TRANSFER_TYPES: Array<{ key: TransferType; label: string; icon: string }> = [
  { key: 'in', label: 'Contratação', icon: '📥' },
  { key: 'out', label: 'Venda', icon: '📤' },
  { key: 'loan_in', label: 'Empréstimo (entrada)', icon: '🔄' },
  { key: 'loan_out', label: 'Empréstimo (saída)', icon: '🔄' },
];

function genId(): string {
  return `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function formatFee(fee: number): string {
  if (fee <= 0) return 'Grátis';
  if (fee >= 1_000_000) return `€${(fee / 1_000_000).toFixed(1)}M`;
  if (fee >= 1_000) return `€${(fee / 1_000).toFixed(0)}k`;
  return `€${fee}`;
}

function parseFee(raw: string): number {
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

function TransferCard({ item, onDelete }: { item: Transfer; onDelete: (id: string) => void }) {
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
          <View style={styles.cardActions}>
            <Text style={[styles.feeText, { color: feeColor }]}>{formatFee(item.fee)}</Text>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => onDelete(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={14} color={Colors.destructive} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

function PlayerSearchInput({
  value, onChange, onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (p: PlayerSearchResult) => void;
}) {
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPlayers = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await api.players.search(q.trim());
      setResults(data.players?.slice(0, 8) ?? []);
    } catch { setResults([]); }
    setLoading(false);
  }, []);

  const handleChange = (v: string) => {
    onChange(v);
    setOpen(true);
    setResults([]);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchPlayers(v), 400);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <View>
      <View style={styles.searchInputRow}>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Nome do jogador…"
          placeholderTextColor={Colors.mutedForeground}
          autoFocus
        />
        {loading && <ActivityIndicator size="small" color={Colors.mutedForeground} style={styles.searchSpinner} />}
      </View>
      {open && results.length > 0 && (
        <View style={styles.dropdown}>
          {results.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.dropdownItem}
              onPress={() => { onSelect(p); setOpen(false); setResults([]); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownName}>{p.name}</Text>
                <Text style={styles.dropdownMeta}>{p.position}{p.age ? ` · ${p.age} anos` : ''}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

interface NewTransferModalProps {
  visible: boolean;
  seasonLabel: string;
  onClose: () => void;
  onSave: (t: Omit<Transfer, 'id'>) => void;
}

function NewTransferModal({ visible, seasonLabel, onClose, onSave }: NewTransferModalProps) {
  const theme = useClubTheme();
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState(0);
  const [club, setClub] = useState('');
  const [type, setType] = useState<TransferType>('in');
  const [fee, setFee] = useState('');
  const [salary, setSalary] = useState('');
  const [contractYears, setContractYears] = useState('');

  const resetForm = () => {
    setPlayerName('');
    setPlayerId(0);
    setClub('');
    setType('in');
    setFee('');
    setSalary('');
    setContractYears('');
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleSave = () => {
    if (!playerName.trim() || !club.trim()) return;
    const parsedSalary = parseFee(salary);
    const parsedYears = parseInt(contractYears, 10) || undefined;
    onSave({
      playerId,
      playerName: playerName.trim(),
      club: club.trim(),
      type,
      fee: parseFee(fee),
      season: seasonLabel,
      date: new Date().toISOString().split('T')[0],
      ...(parsedSalary > 0 ? { salary: parsedSalary } : {}),
      ...(parsedYears ? { contractYears: parsedYears } : {}),
    });
    resetForm();
    onClose();
  };

  const handlePlayerSelect = (p: PlayerSearchResult) => {
    setPlayerName(p.name);
    setPlayerId(p.id);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nova Transferência</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>JOGADOR</Text>
              <PlayerSearchInput
                value={playerName}
                onChange={setPlayerName}
                onSelect={handlePlayerSelect}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>TIPO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.typeRow}>
                  {TRANSFER_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      style={[
                        styles.typeChip,
                        type === t.key && { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.4)` },
                      ]}
                      onPress={() => setType(t.key)}
                    >
                      <Text style={styles.typeChipIcon}>{t.icon}</Text>
                      <Text style={[styles.typeChipLabel, type === t.key && { color: theme.primary }]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{type === 'in' || type === 'loan_in' ? 'CLUBE DE ORIGEM' : 'CLUBE DESTINO'}</Text>
              <TextInput
                style={styles.textInput}
                value={club}
                onChangeText={setClub}
                placeholder="Nome do clube"
                placeholderTextColor={Colors.mutedForeground}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>VALOR DA TRANSFERÊNCIA</Text>
              <TextInput
                style={styles.textInput}
                value={fee}
                onChangeText={setFee}
                placeholder="Ex: 50M, 500000 (0 = Grátis)"
                placeholderTextColor={Colors.mutedForeground}
                keyboardType="default"
                autoCapitalize="characters"
              />
              {fee ? <Text style={styles.feePreview}>= {formatFee(parseFee(fee))}</Text> : null}
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>SALÁRIO / SEMANA</Text>
                <TextInput
                  style={styles.textInput}
                  value={salary}
                  onChangeText={setSalary}
                  placeholder="Ex: 80k"
                  placeholderTextColor={Colors.mutedForeground}
                  keyboardType="default"
                  autoCapitalize="characters"
                />
                {salary ? <Text style={styles.feePreview}>= {formatFee(parseFee(salary))}</Text> : null}
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>ANOS DE CONTRATO</Text>
                <TextInput
                  style={styles.textInput}
                  value={contractYears}
                  onChangeText={setContractYears}
                  placeholder="Ex: 3"
                  placeholderTextColor={Colors.mutedForeground}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: `rgba(${theme.primaryRgb},0.2)`, borderColor: `rgba(${theme.primaryRgb},0.4)` },
                (!playerName.trim() || !club.trim()) && { opacity: 0.5 },
              ]}
              onPress={handleSave}
              disabled={!playerName.trim() || !club.trim()}
            >
              <Text style={[styles.saveBtnText, { color: theme.primary }]}>Registrar Transferência</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function TransfersScreen() {
  const insets = useSafeAreaInsets();
  const { activeSeason } = useCareer();
  const theme = useClubTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('in');
  const [showNew, setShowNew] = useState(false);

  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const { data, isLoading } = useQuery({
    queryKey: ['/api/data/season/transfers', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
    staleTime: 1000 * 60 * 5,
  });

  const transfers: Transfer[] = (data?.data?.transfers ?? []) as Transfer[];

  const saveMutation = useMutation({
    mutationFn: (updated: Transfer[]) => {
      if (!activeSeason) throw new Error('no season');
      return api.transfers.save(activeSeason.id, updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/data/season/transfers', activeSeason?.id] }),
  });

  const handleAdd = (t: Omit<Transfer, 'id'>) => {
    saveMutation.mutate([...transfers, { ...t, id: genId() }]);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Excluir transferência', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: () => saveMutation.mutate(transfers.filter((t) => t.id !== id)),
      },
    ]);
  };

  const filtered = transfers.filter((t) =>
    tab === 'in' ? (t.type === 'in' || t.type === 'loan_in') : (t.type === 'out' || t.type === 'loan_out')
  );

  const spent = transfers.filter((t) => t.type === 'in').reduce((s, t) => s + (t.fee ?? 0), 0);
  const earned = transfers.filter((t) => t.type === 'out').reduce((s, t) => s + (t.fee ?? 0), 0);
  const net = spent - earned;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Transferências</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowNew(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add" size={24} color={theme.primary} />
        </TouchableOpacity>
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
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.3)`, paddingHorizontal: 20 }]}
            onPress={() => setShowNew(true)}
          >
            <Text style={[styles.saveBtnText, { color: theme.primary }]}>Registrar Transferência</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => <TransferCard item={item} onDelete={handleDelete} />}
        />
      )}

      <NewTransferModal
        visible={showNew}
        seasonLabel={activeSeason?.label ?? ''}
        onClose={() => setShowNew(false)}
        onSave={handleAdd}
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
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  summaryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 16 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, padding: 12, alignItems: 'center', gap: 4,
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
    flexDirection: 'row', backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg, borderWidth: 1,
    borderColor: Colors.border, overflow: 'hidden',
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
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  clubText: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  feeText: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  deleteBtn: { padding: 4 },
  searchInputRow: { position: 'relative' },
  searchSpinner: { position: 'absolute', right: 12, top: 12 },
  dropdown: {
    backgroundColor: '#0D0A1A', borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  dropdownName: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  dropdownMeta: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet: {
    backgroundColor: Colors.backgroundLighter,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '90%',
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
  fieldRow: { flexDirection: 'row' as const, gap: 12 },
  modalFooter: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  field: { gap: 8 },
  fieldLabel: {
    fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card, alignItems: 'center', gap: 4,
  },
  typeChipIcon: { fontSize: 18 },
  typeChipLabel: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  textInput: {
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15,
  },
  feePreview: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', fontStyle: 'italic', marginTop: 2 },
  saveBtn: { borderRadius: Colors.radius, paddingVertical: 14, borderWidth: 1, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
});
