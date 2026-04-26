import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type MatchLocation, type MatchRecord } from '@/lib/api';
import { Colors } from '@/constants/colors';

type Step = 1 | 2 | 3;

const LOCATION_OPTIONS: { value: MatchLocation; label: string; icon: string }[] = [
  { value: 'casa', label: 'Casa', icon: '🏠' },
  { value: 'fora', label: 'Fora', icon: '✈️' },
  { value: 'neutro', label: 'Neutro', icon: '⚖️' },
];

const COMMON_TOURNAMENTS = [
  'Brasileirão Série A', 'Brasileirão Série B', 'Copa do Brasil',
  'Copa Libertadores', 'Premier League', 'La Liga', 'Bundesliga',
  'Serie A', 'Ligue 1', 'Amistoso',
];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.stepIndicator}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            i + 1 === current && styles.stepDotActive,
            i + 1 < current && styles.stepDotDone,
          ]}
        />
      ))}
    </View>
  );
}

function ScoreButton({ onPress, icon }: { onPress: () => void; icon: 'add' | 'remove' }) {
  return (
    <TouchableOpacity style={styles.scoreBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon === 'add' ? 'add' : 'remove'} size={22} color={Colors.foreground} />
    </TouchableOpacity>
  );
}

export default function RegistrarPartidaScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, activeSeason } = useCareer();
  const theme = useClubTheme();
  const qc = useQueryClient();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const [step, setStep] = useState<Step>(1);
  const [tournament, setTournament] = useState('');
  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState<MatchLocation>('casa');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [stage, setStage] = useState('Rodada');
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [observations, setObservations] = useState('');

  const { data: seasonData } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeCareer || !activeSeason) throw new Error('Nenhuma carreira/temporada ativa');
      const existingMatches: MatchRecord[] = seasonData?.data?.matches ?? [];

      const newMatch: MatchRecord = {
        id: `match_${Date.now()}`,
        careerId: activeCareer.id,
        season: activeSeason.label,
        date,
        tournament: tournament.trim() || 'Amistoso',
        stage: stage.trim() || 'Rodada',
        location,
        opponent: opponent.trim() || 'Adversário',
        myScore,
        opponentScore,
        starterIds: [],
        subIds: [],
        playerStats: {},
        matchStats: {
          myShots: 0,
          opponentShots: 0,
          possessionPct: 50,
        },
        observations: observations.trim() || undefined,
        createdAt: Date.now(),
      };

      await api.seasonData.set(activeSeason.id, 'matches', [...existingMatches, newMatch]);
      return newMatch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/data/season', activeSeason?.id] });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (err: Error) => {
      Alert.alert('Erro', err.message);
    },
  });

  const canProceedStep1 = opponent.trim().length > 0 && tournament.trim().length > 0;

  const handleNext = useCallback(() => {
    if (step === 1 && !canProceedStep1) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
  }, [step, canProceedStep1]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((prev) => ((prev - 1) as Step));
    } else {
      router.back();
    }
  }, [step]);

  const handleConfirm = useCallback(() => {
    if (saveMutation.isPending) return;
    saveMutation.mutate();
  }, [saveMutation]);

  const resultLabel = myScore > opponentScore ? 'VITÓRIA' : myScore < opponentScore ? 'DERROTA' : 'EMPATE';
  const resultColor = myScore > opponentScore ? Colors.success : myScore < opponentScore ? Colors.destructive : Colors.warning;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={step > 1 ? 'chevron-back' : 'close'} size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <Text style={styles.title}>Registrar Partida</Text>
          <StepIndicator current={step} total={3} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeading}>Informações da Partida</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Torneio *</Text>
              <TextInput
                style={styles.input}
                value={tournament}
                onChangeText={setTournament}
                placeholder="Ex: Brasileirão Série A"
                placeholderTextColor={Colors.mutedForeground}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {COMMON_TOURNAMENTS.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chip, tournament === t && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                      onPress={() => setTournament(t)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, tournament === t && { color: '#fff' }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Adversário *</Text>
              <TextInput
                style={styles.input}
                value={opponent}
                onChangeText={setOpponent}
                placeholder="Nome do adversário"
                placeholderTextColor={Colors.mutedForeground}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Local</Text>
              <View style={styles.locationRow}>
                {LOCATION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.locationChip,
                      location === opt.value && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                    onPress={() => setLocation(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 18 }}>{opt.icon}</Text>
                    <Text style={[styles.locationLabel, location === opt.value && { color: '#fff' }]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Data</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={Colors.mutedForeground}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Rodada / Fase</Text>
                <TextInput
                  style={styles.input}
                  value={stage}
                  onChangeText={setStage}
                  placeholder="Rodada 1"
                  placeholderTextColor={Colors.mutedForeground}
                />
              </View>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeading}>Resultado</Text>
            <Text style={styles.matchLabel}>{activeCareer?.clubName ?? 'Seu time'} vs {opponent}</Text>

            <View style={styles.scoreArea}>
              <View style={styles.scoreTeam}>
                <Text style={styles.scoreTeamName} numberOfLines={1}>{activeCareer?.clubName ?? 'Casa'}</Text>
                <View style={styles.scoreControls}>
                  <ScoreButton icon="remove" onPress={() => setMyScore((s) => Math.max(0, s - 1))} />
                  <Text style={styles.scoreDigit}>{myScore}</Text>
                  <ScoreButton icon="add" onPress={() => setMyScore((s) => s + 1)} />
                </View>
              </View>

              <Text style={styles.scoreSep}>×</Text>

              <View style={styles.scoreTeam}>
                <Text style={styles.scoreTeamName} numberOfLines={1}>{opponent || 'Adversário'}</Text>
                <View style={styles.scoreControls}>
                  <ScoreButton icon="remove" onPress={() => setOpponentScore((s) => Math.max(0, s - 1))} />
                  <Text style={styles.scoreDigit}>{opponentScore}</Text>
                  <ScoreButton icon="add" onPress={() => setOpponentScore((s) => s + 1)} />
                </View>
              </View>
            </View>

            <View style={[styles.resultBadge, { backgroundColor: `${resultColor}20`, borderColor: `${resultColor}40` }]}>
              <Text style={[styles.resultBadgeText, { color: resultColor }]}>{resultLabel}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Observações (opcional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={observations}
                onChangeText={setObservations}
                placeholder="Notas sobre a partida…"
                placeholderTextColor={Colors.mutedForeground}
                multiline
                maxLength={500}
              />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeading}>Confirmar</Text>

            <View style={styles.summaryCard}>
              <SummaryRow label="Torneio" value={tournament} />
              <View style={styles.summaryDivider} />
              <SummaryRow label="Adversário" value={opponent} />
              <View style={styles.summaryDivider} />
              <SummaryRow label="Data" value={date} />
              <View style={styles.summaryDivider} />
              <SummaryRow label="Local" value={LOCATION_OPTIONS.find((o) => o.value === location)?.label ?? location} />
              <View style={styles.summaryDivider} />
              <SummaryRow label="Rodada" value={stage} />
              <View style={styles.summaryDivider} />
              <SummaryRow
                label="Placar"
                value={`${myScore} – ${opponentScore}`}
                valueColor={resultColor}
              />
              <View style={styles.summaryDivider} />
              <SummaryRow label="Resultado" value={resultLabel} valueColor={resultColor} />
              {observations.trim() ? (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryRow label="Obs." value={observations.trim()} />
                </>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {step < 3 ? (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: theme.primary }, (!canProceedStep1 && step === 1) && { opacity: 0.4 }]}
            onPress={handleNext}
            disabled={step === 1 && !canProceedStep1}
            activeOpacity={0.8}
          >
            <Text style={styles.nextBtnText}>Próximo</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: Colors.success }]}
            onPress={handleConfirm}
            disabled={saveMutation.isPending}
            activeOpacity={0.8}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.nextBtnText}>Salvar Partida</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : {}]} numberOfLines={2}>
        {value}
      </Text>
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
  title: { fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  stepIndicator: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primary, width: 16 },
  stepDotDone: { backgroundColor: Colors.success },
  scrollContent: { padding: 20 },
  stepContent: { gap: 20 },
  stepHeading: { fontSize: 20, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  input: {
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15,
  },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.card, borderRadius: 99,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipText: { fontSize: 12, color: Colors.foreground, fontFamily: 'Inter_400Regular' },
  locationRow: { flexDirection: 'row', gap: 8 },
  locationChip: {
    flex: 1, alignItems: 'center', gap: 4, padding: 12,
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
  },
  locationLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  row: { flexDirection: 'row', gap: 12 },
  matchLabel: {
    fontSize: 15, color: Colors.mutedForeground,
    fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: -8,
  },
  scoreArea: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border, padding: 20,
  },
  scoreTeam: { flex: 1, alignItems: 'center', gap: 16 },
  scoreTeamName: { fontSize: 13, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  scoreControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreDigit: { fontSize: 42, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold', minWidth: 48, textAlign: 'center' },
  scoreSep: { fontSize: 24, color: Colors.mutedForeground, fontFamily: 'Inter_700Bold' },
  resultBadge: {
    alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 99, borderWidth: 1,
  },
  resultBadgeText: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  summaryCard: {
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 13, gap: 12,
  },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  summaryLabel: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', flex: 0.45 },
  summaryValue: { fontSize: 14, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium', flex: 0.55, textAlign: 'right' },
  bottomBar: {
    padding: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: Colors.radius, paddingVertical: 16,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
});
