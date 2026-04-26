import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCareer } from '@/contexts/CareerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Colors } from '@/constants/colors';

function suggestNextLabel(existingLabels: string[]): string {
  if (!existingLabels.length) {
    const y = new Date().getFullYear();
    return `${y}/${String(y + 1).slice(2)}`;
  }
  const last = existingLabels[existingLabels.length - 1];
  const m = last.match(/^(\d{4})\/(\d{2})$/);
  if (m) {
    const start = parseInt(m[1], 10) + 1;
    return `${start}/${String(start + 1).slice(2)}`;
  }
  const numMatch = last.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10) + 1;
    return last.replace(/\d+/, String(num));
  }
  const y = new Date().getFullYear();
  return `${y}/${String(y + 1).slice(2)}`;
}

const COMPETITION_PRESETS = [
  { id: 'liga_nacional', label: 'Campeonato Nacional', icon: 'trophy-outline' as const, color: Colors.primary },
  { id: 'copa_nacional', label: 'Copa Nacional', icon: 'ribbon-outline' as const, color: Colors.success },
  { id: 'liga_campeoes', label: 'Liga dos Campeões', icon: 'star-outline' as const, color: '#f59e0b' },
  { id: 'liga_europa', label: 'Liga Europa', icon: 'globe-outline' as const, color: Colors.info },
  { id: 'conference', label: 'Conference League', icon: 'globe-outline' as const, color: Colors.success },
  { id: 'supercopa', label: 'Supercopa', icon: 'flash-outline' as const, color: '#f59e0b' },
  { id: 'copa_liga', label: 'Copa da Liga', icon: 'shield-outline' as const, color: Colors.destructive },
  { id: 'amistoso', label: 'Amistosos', icon: 'football-outline' as const, color: Colors.mutedForeground },
];

type Step = 'label' | 'competitions' | 'confirm';
const ALL_STEPS: Step[] = ['label', 'competitions', 'confirm'];
const STEP_LABELS: Record<Step, string> = {
  label: 'Nome',
  competitions: 'Competições',
  confirm: 'Confirmar',
};

export default function NovaTemporadaScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, loadSeasons, setActiveSeason } = useCareer();
  const qc = useQueryClient();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [step, setStep] = useState<Step>('label');
  const [label, setLabel] = useState('');
  const [selectedComps, setSelectedComps] = useState<Set<string>>(new Set(['liga_nacional', 'copa_nacional']));
  const [setAsActive, setSetAsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: seasons } = useQuery({
    queryKey: ['/api/careers', activeCareer?.id, 'seasons'],
    queryFn: () => activeCareer ? api.careers.seasons(activeCareer.id) : Promise.resolve([]),
    enabled: !!activeCareer,
  });

  useEffect(() => {
    if (seasons) {
      const labels = seasons.map((s) => s.label);
      setLabel(suggestNextLabel(labels));
    }
  }, [seasons]);

  const stepIndex = ALL_STEPS.indexOf(step);

  const goBack = () => {
    if (step === 'label') {
      router.back();
    } else {
      setStep(ALL_STEPS[stepIndex - 1]);
    }
  };

  const toggleComp = (id: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedComps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNextLabel = () => {
    if (!label.trim()) {
      setError('Digite um nome para a temporada');
      return;
    }
    setError('');
    setStep('competitions');
  };

  const handleNextComps = () => {
    setError('');
    setStep('confirm');
  };

  const handleCreate = async () => {
    if (!activeCareer) return;
    if (!label.trim()) {
      setError('Digite um nome para a temporada');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { id } = await api.careers.createSeason(activeCareer.id, label.trim(), setAsActive);

      if (selectedComps.size > 0) {
        const competitions = COMPETITION_PRESETS
          .filter((c) => selectedComps.has(c.id))
          .map((c) => ({ id: c.id, name: c.label, type: 'league' as const, standings: [], matches: [] }));
        await api.seasonData.set(id, 'comp_results' as never, competitions);
      }

      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      await loadSeasons(activeCareer.id);
      await qc.invalidateQueries({ queryKey: ['/api/careers', activeCareer.id, 'seasons'] });
      if (setAsActive) {
        const updated = await api.careers.seasons(activeCareer.id);
        const newSeason = updated.find((s) => s.id === id);
        if (newSeason) setActiveSeason(newSeason);
      }
      Alert.alert(
        'Temporada criada!',
        `"${label.trim()}" foi criada com ${selectedComps.size} competição(ões)${setAsActive ? ' e definida como ativa' : ''}.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar temporada';
      setError(msg);
      setSaving(false);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    }
  };

  if (!activeCareer) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topPad }]}>
        <Text style={styles.emptyText}>Nenhuma carreira selecionada</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Temporada</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.stepBar}>
        {ALL_STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[
              styles.stepDot,
              i < stepIndex ? styles.stepDotDone
              : s === step ? styles.stepDotActive
              : styles.stepDotInactive,
            ]}>
              {i < stepIndex ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : (
                <Text style={[styles.stepNum, s === step && styles.stepNumActive]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, s === step && styles.stepLabelActive]}>
              {STEP_LABELS[s]}
            </Text>
            {i < ALL_STEPS.length - 1 && (
              <View style={[styles.stepLine, i < stepIndex && styles.stepLineDone]} />
            )}
          </View>
        ))}
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={14} color={Colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 'label' && (
          <>
            <Text style={styles.stepTitle}>Nome da nova temporada</Text>
            <View style={styles.careerBadge}>
              <Ionicons name="football" size={14} color={Colors.primary} />
              <Text style={styles.careerBadgeText}>{activeCareer.clubName}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nome da temporada</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="Ex: 2025/26, Temporada 3"
                placeholderTextColor={Colors.mutedForeground}
                returnKeyType="done"
                onSubmitEditing={handleNextLabel}
                autoFocus
              />
              <Text style={styles.fieldHint}>
                Sugestão automática baseada nas temporadas anteriores. Pode usar qualquer formato.
              </Text>
            </View>
            {seasons && seasons.length > 0 && (
              <View style={styles.existingSeasons}>
                <Text style={styles.existingTitle}>Temporadas anteriores</Text>
                {seasons.map((s) => (
                  <View key={s.id} style={styles.seasonRow}>
                    <Ionicons
                      name={s.isActive ? 'radio-button-on' : 'radio-button-off'}
                      size={14}
                      color={s.isActive ? Colors.primary : Colors.mutedForeground}
                    />
                    <Text style={[styles.seasonRowLabel, s.isActive && styles.seasonRowLabelActive]}>
                      {s.label}
                    </Text>
                    {s.isActive && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Ativa</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.nextBtn} onPress={handleNextLabel} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Próximo</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {step === 'competitions' && (
          <>
            <Text style={styles.stepTitle}>Selecione as competições</Text>
            <Text style={styles.stepSubtitle}>
              Escolha as competições que você participará em {label.trim()}. Você pode adicionar mais depois.
            </Text>
            <View style={styles.compGrid}>
              {COMPETITION_PRESETS.map((comp) => {
                const selected = selectedComps.has(comp.id);
                return (
                  <TouchableOpacity
                    key={comp.id}
                    style={[
                      styles.compCard,
                      selected && { borderColor: comp.color, backgroundColor: `${comp.color}12` },
                    ]}
                    onPress={() => toggleComp(comp.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.compCheck, selected && { backgroundColor: comp.color, borderColor: comp.color }]}>
                      {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <View style={[styles.compIcon, { backgroundColor: `${comp.color}18` }]}>
                      <Ionicons name={comp.icon} size={20} color={comp.color} />
                    </View>
                    <Text style={[styles.compLabel, selected && { color: comp.color }]} numberOfLines={2}>
                      {comp.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.compHint}>
              {selectedComps.size > 0
                ? `${selectedComps.size} competição(ões) selecionada(s)`
                : 'Nenhuma competição selecionada — você pode adicionar depois'}
            </Text>
            <TouchableOpacity style={styles.nextBtn} onPress={handleNextComps} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Próximo</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {step === 'confirm' && (
          <>
            <Text style={styles.stepTitle}>Confirmar criação</Text>
            <View style={styles.confirmCard}>
              <View style={styles.confirmRow}>
                <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.confirmRowLabel}>Nova temporada</Text>
                  <Text style={styles.confirmRowValue}>{label.trim()}</Text>
                </View>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <Ionicons name="football-outline" size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.confirmRowLabel}>Clube</Text>
                  <Text style={styles.confirmRowValue}>{activeCareer.clubName}</Text>
                </View>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <Ionicons name="trophy-outline" size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.confirmRowLabel}>Competições</Text>
                  <Text style={styles.confirmRowValue}>
                    {selectedComps.size > 0
                      ? COMPETITION_PRESETS.filter((c) => selectedComps.has(c.id)).map((c) => c.label).join(', ')
                      : 'Nenhuma (adicionar depois)'}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setSetAsActive((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Definir como temporada ativa</Text>
                <Text style={styles.toggleHint}>
                  Todas as partidas e dados serão registrados nesta temporada.
                </Text>
              </View>
              <View style={[styles.toggle, setAsActive && styles.toggleOn]}>
                <View style={[styles.toggleThumb, setAsActive && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextBtn, saving && styles.disabled]}
              onPress={handleCreate}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>Criar temporada</Text>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: Colors.mutedForeground, fontSize: 15, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  backBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Colors.radius },
  backBtnText: { color: '#fff', fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  stepBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.success },
  stepDotInactive: { backgroundColor: Colors.muted, borderWidth: 1, borderColor: Colors.border },
  stepNum: { fontSize: 10, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: 10, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginLeft: 4 },
  stepLabelActive: { color: Colors.primary, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  stepLine: { flex: 1, height: 1, backgroundColor: Colors.border, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: Colors.success },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: Colors.radiusSm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: { color: Colors.destructive, fontSize: 13, fontFamily: 'Inter_400Regular' },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  stepTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  stepSubtitle: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 20, lineHeight: 20 },
  careerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    alignSelf: 'flex-start',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  careerBadgeText: { fontSize: 13, color: Colors.primary, fontFamily: 'Inter_500Medium', fontWeight: '500' as const },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.mutedForeground, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Colors.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.foreground,
    fontFamily: 'Inter_400Regular',
  },
  fieldHint: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 6 },
  existingSeasons: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  existingTitle: { fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  seasonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seasonRowLabel: { flex: 1, fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  seasonRowLabelActive: { color: Colors.foreground, fontWeight: '500' as const, fontFamily: 'Inter_500Medium' },
  activeBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  activeBadgeText: { fontSize: 10, color: Colors.primary, fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const },
  compGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  compCard: {
    width: '47%',
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 8,
    position: 'relative',
  },
  compCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  compIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium', lineHeight: 17 },
  compHint: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 20 },
  confirmCard: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    overflow: 'hidden',
  },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 14 },
  confirmDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 48 },
  confirmRowLabel: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  confirmRowValue: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 20,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  toggleHint: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.muted,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: Colors.primary },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Colors.radius,
    paddingVertical: 16,
    marginTop: 8,
  },
  disabled: { opacity: 0.6 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
});
