import { useMemo, useState } from 'react';
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
import { api, getMatchResult, type MatchRecord } from '@/lib/api';
import { Colors } from '@/constants/colors';

const MAX_RIVALS = 5;

interface RivalStats {
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

function computeRivalStats(matches: MatchRecord[], rivalName: string): RivalStats {
  const ms = matches.filter((m) => m.opponent.toLowerCase().includes(rivalName.toLowerCase()));
  let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
  for (const m of ms) {
    const r = getMatchResult(m.myScore, m.opponentScore);
    if (r === 'vitoria') wins++;
    else if (r === 'empate') draws++;
    else losses++;
    gf += m.myScore;
    ga += m.opponentScore;
  }
  return { name: rivalName, played: ms.length, wins, draws, losses, goalsFor: gf, goalsAgainst: ga };
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

function RivalCard({ stats, onRemove, locked }: { stats: RivalStats; onRemove: () => void; locked?: boolean }) {
  const total = stats.played;
  const winPct = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
  const dominance = stats.wins > stats.losses ? 'vitoria' : stats.wins < stats.losses ? 'derrota' : 'empate';
  const barColor = dominance === 'vitoria' ? Colors.success : dominance === 'derrota' ? Colors.destructive : Colors.warning;

  return (
    <View style={[styles.rivalCard, { borderColor: `${barColor}25` }]}>
      <View style={[styles.rivalAccent, { backgroundColor: barColor }]} />
      <View style={styles.rivalContent}>
        <View style={styles.rivalTop}>
          <Text style={styles.rivalName} numberOfLines={1}>⚔️ {stats.name}</Text>
          {!locked && (
            <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle-outline" size={18} color={Colors.mutedForeground} />
            </TouchableOpacity>
          )}
          {locked && <Ionicons name="lock-closed-outline" size={14} color={Colors.mutedForeground} />}
        </View>
        {total === 0 ? (
          <Text style={styles.rivalNoMatches}>Sem confrontos registrados</Text>
        ) : (
          <>
            <Text style={styles.rivalRecord}>
              {total}J · {stats.wins}V {stats.draws}E {stats.losses}D · {stats.goalsFor}:{stats.goalsAgainst}
            </Text>
            <View style={styles.winBar}>
              <View style={[styles.winBarFill, { width: `${winPct}%` as `${number}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={[styles.winPctText, { color: barColor }]}>{winPct}% vitórias</Text>
          </>
        )}
      </View>
    </View>
  );
}

function FrequentRow({ rival }: { rival: RivalStats }) {
  const total = rival.played;
  const winPct = total > 0 ? Math.round((rival.wins / total) * 100) : 0;
  const result = rival.wins > rival.losses ? 'vitoria' : rival.wins < rival.losses ? 'derrota' : 'empate';
  const barColor = result === 'vitoria' ? Colors.success : result === 'derrota' ? Colors.destructive : Colors.warning;
  return (
    <View style={styles.freqRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.freqName} numberOfLines={1}>{rival.name}</Text>
        <Text style={styles.freqRecord}>
          {rival.played}P · {rival.wins}V {rival.draws}E {rival.losses}D · {rival.goalsFor}:{rival.goalsAgainst}
        </Text>
        <View style={styles.winBar}>
          <View style={[styles.winBarFill, { width: `${winPct}%` as `${number}%`, backgroundColor: barColor }]} />
        </View>
      </View>
      <Text style={[styles.freqWinPct, { color: barColor }]}>{winPct}%</Text>
    </View>
  );
}

function AddRivalModal({
  visible, onClose, onAdd, opponentSuggestions,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
  opponentSuggestions: string[];
}) {
  const theme = useClubTheme();
  const [name, setName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = useMemo(() => {
    if (!name.trim()) return opponentSuggestions.slice(0, 8);
    const q = name.trim().toLowerCase();
    return opponentSuggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  }, [name, opponentSuggestions]);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName('');
    setShowSuggestions(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Adicionar Rival</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>NOME DO CLUBE RIVAL</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={(v) => { setName(v); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Ex: Real Madrid, Manchester City…"
                placeholderTextColor={Colors.mutedForeground}
                autoFocus
                onSubmitEditing={handleAdd}
                returnKeyType="done"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <View style={styles.suggestionList}>
                  {filteredSuggestions.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.suggestionRow}
                      onPress={() => { setName(s); setShowSuggestions(false); }}
                    >
                      <Ionicons name="football-outline" size={14} color={Colors.mutedForeground} />
                      <Text style={styles.suggestionLabel}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.suggestionRow, { justifyContent: 'center' }]}
                    onPress={() => setShowSuggestions(false)}
                  >
                    <Text style={[styles.suggestionLabel, { color: Colors.mutedForeground, fontSize: 11 }]}>Fechar sugestões</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <Text style={styles.hintText}>
              Retrospecto será calculado a partir de partidas registradas.
            </Text>
          </View>
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.2)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }, !name.trim() && { opacity: 0.5 }]}
              onPress={handleAdd}
              disabled={!name.trim()}
            >
              <Text style={[styles.saveBtnText, { color: theme.primary }]}>Adicionar Rival</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function RivaisScreen() {
  const insets = useSafeAreaInsets();
  const { activeSeason } = useCareer();
  const theme = useClubTheme();
  const qc = useQueryClient();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const [showAdd, setShowAdd] = useState(false);

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

  const manualRivals: string[] = (seasonGameData?.data?.rivals ?? []) as string[];
  const rivalsLocked: boolean = !!(seasonGameData?.data?.rivalsLocked);

  const saveRivalsMutation = useMutation({
    mutationFn: (rivals: string[]) => {
      if (!activeSeason) throw new Error('no season');
      return api.seasonData.set(activeSeason.id, 'rivals', rivals.slice(0, MAX_RIVALS));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/data/season', activeSeason?.id] }),
  });

  const lockRivalsMutation = useMutation({
    mutationFn: (locked: boolean) => {
      if (!activeSeason) throw new Error('no season');
      return api.seasonData.set(activeSeason.id, 'rivalsLocked', locked);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/data/season', activeSeason?.id] }),
  });

  const handleAddRival = (name: string) => {
    if (rivalsLocked || manualRivals.includes(name) || manualRivals.length >= MAX_RIVALS) return;
    saveRivalsMutation.mutate([...manualRivals, name]);
  };

  const handleRemoveRival = (name: string) => {
    if (rivalsLocked) return;
    saveRivalsMutation.mutate(manualRivals.filter((r) => r !== name));
  };

  const handleToggleLock = () => {
    if (rivalsLocked) {
      Alert.alert('Desbloquear Rivais', 'Deseja permitir alterações na lista de rivais?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desbloquear', onPress: () => lockRivalsMutation.mutate(false) },
      ]);
    } else {
      if (manualRivals.length === 0) return;
      Alert.alert('Bloquear Rivais', 'Bloquear a lista impede alterações até desbloquear manualmente.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: () => lockRivalsMutation.mutate(true) },
      ]);
    }
  };

  const rivalStats = useMemo(
    () => manualRivals.map((name) => computeRivalStats(matches, name)),
    [manualRivals, matches]
  );

  const form5 = useMemo(() => {
    const last5 = [...matches].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const padded = Array.from({ length: 5 }, (_, i) => {
      const m = last5[i];
      return m ? getMatchResult(m.myScore, m.opponentScore) : ('future' as const);
    });
    return padded;
  }, [matches]);

  const opponentSuggestions = useMemo(
    () => [...new Set(matches.map((m) => m.opponent))].sort(),
    [matches]
  );

  const frequentOpponents: RivalStats[] = useMemo(() => {
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
    return [...map.values()].sort((a, b) => b.played - a.played).slice(0, 10);
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
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MEUS RIVAIS</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {manualRivals.length > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.addRivalBtn,
                      rivalsLocked
                        ? { backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)' }
                        : { backgroundColor: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.25)' },
                    ]}
                    onPress={handleToggleLock}
                  >
                    <Ionicons
                      name={rivalsLocked ? 'lock-closed' : 'lock-open-outline'}
                      size={14}
                      color={Colors.warning}
                    />
                    <Text style={[styles.addRivalBtnText, { color: Colors.warning }]}>
                      {rivalsLocked ? 'Bloqueado' : 'Bloquear'}
                    </Text>
                  </TouchableOpacity>
                )}
                {!rivalsLocked && manualRivals.length < MAX_RIVALS && (
                  <TouchableOpacity
                    style={[styles.addRivalBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.12)`, borderColor: `rgba(${theme.primaryRgb},0.3)` }]}
                    onPress={() => setShowAdd(true)}
                  >
                    <Ionicons name="add" size={16} color={theme.primary} />
                    <Text style={[styles.addRivalBtnText, { color: theme.primary }]}>Adicionar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {manualRivals.length === 0 ? (
              <TouchableOpacity
                style={styles.emptyRivalsCard}
                onPress={() => setShowAdd(true)}
              >
                <Text style={styles.emptyRivalsIcon}>⚔️</Text>
                <Text style={styles.emptyRivalsTitle}>Nenhum rival definido</Text>
                <Text style={styles.emptyRivalsText}>
                  Defina até {MAX_RIVALS} rivais para acompanhar o retrospecto
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.rivalsList}>
                {rivalStats.map((s) => (
                  <RivalCard
                    key={s.name}
                    stats={s}
                    locked={rivalsLocked}
                    onRemove={() => handleRemoveRival(s.name)}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FORMA RECENTE</Text>
            <View style={styles.formRow}>
              {form5.map((result, i) => (
                <FormBall key={i} result={result} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESEMPENHO GERAL</Text>
            <View style={styles.statsGrid}>
              {[
                { label: 'Jogos', value: String(matches.length) },
                { label: 'Vitórias', value: String(totalStats.wins), color: Colors.success },
                { label: 'Empates', value: String(totalStats.draws), color: Colors.warning },
                { label: 'Derrotas', value: String(totalStats.losses), color: Colors.destructive },
                { label: 'Gols Marcados', value: String(totalStats.gf) },
                { label: 'Gols Sofridos', value: String(totalStats.ga) },
              ].map(({ label, value, color }) => (
                <View key={label} style={styles.statBox}>
                  <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          {frequentOpponents.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ADVERSÁRIOS FREQUENTES</Text>
              <View style={styles.card}>
                {frequentOpponents.map((rival, idx) => (
                  <View key={rival.name}>
                    <FrequentRow rival={rival} />
                    {idx < frequentOpponents.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </View>
          )}

          {matches.length === 0 && (
            <View style={styles.center}>
              <Text style={{ fontSize: 48 }}>⚽</Text>
              <Text style={styles.emptyText}>Registre partidas para ver estatísticas de rivais.</Text>
            </View>
          )}
        </ScrollView>
      )}

      <AddRivalModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={handleAddRival}
        opponentSuggestions={opponentSuggestions}
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
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  scrollContent: { padding: 16, gap: 24 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: {
    fontSize: 13, fontWeight: '600' as const, color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8,
  },
  addRivalBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
  },
  addRivalBtnText: { fontSize: 12, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  emptyRivalsCard: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', padding: 24, gap: 8,
  },
  emptyRivalsIcon: { fontSize: 36 },
  emptyRivalsTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyRivalsText: { fontSize: 13, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  rivalsList: { gap: 10 },
  rivalCard: {
    flexDirection: 'row', backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg, borderWidth: 1, overflow: 'hidden',
  },
  rivalAccent: { width: 4 },
  rivalContent: { flex: 1, padding: 14, gap: 4 },
  rivalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rivalName: { fontSize: 15, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold', flex: 1 },
  rivalNoMatches: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  rivalRecord: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  winPctText: { fontSize: 11, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  winBar: {
    height: 4, backgroundColor: Colors.border, borderRadius: 2,
    overflow: 'hidden', marginTop: 4,
  },
  winBarFill: { height: '100%', borderRadius: 2 },
  formRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  formBall: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  formBallText: { fontSize: 14, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
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
  freqRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  freqName: { fontSize: 15, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  freqRecord: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  freqWinPct: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', minWidth: 44, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 14 },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet: {
    backgroundColor: Colors.backgroundLighter,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: Colors.border,
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
  modalBody: { padding: 20, gap: 16 },
  modalFooter: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  field: { gap: 8 },
  fieldLabel: {
    fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15,
  },
  hintText: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  saveBtn: { borderRadius: Colors.radius, paddingVertical: 14, borderWidth: 1, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  suggestionList: {
    marginTop: 4, backgroundColor: Colors.card,
    borderRadius: Colors.radius, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row' as const, alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  suggestionLabel: { fontSize: 14, color: Colors.foreground, fontFamily: 'Inter_400Regular', flex: 1 },
});
