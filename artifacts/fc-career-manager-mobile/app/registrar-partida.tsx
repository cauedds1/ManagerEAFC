import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type MatchLocation, type MatchRecord, type PlayerMatchStats } from '@/lib/api';
import { Colors } from '@/constants/colors';

type Step = 1 | 2 | 3 | 4 | 5;

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

const TOTAL_STEPS = 5;

interface GoalRow { scorer: string; assist: string }
interface RatingRow { playerName: string; rating: number }

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

function RatingPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.ratingRow}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <TouchableOpacity
          key={n}
          style={[styles.ratingBtn, value === n && styles.ratingBtnActive]}
          onPress={() => onChange(n)}
          activeOpacity={0.7}
        >
          <Text style={[styles.ratingBtnText, value === n && styles.ratingBtnTextActive]}>{n}</Text>
        </TouchableOpacity>
      ))}
    </View>
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
  const [stage, setStage] = useState('Rodada 1');

  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [possession, setPossession] = useState(50);
  const [observations, setObservations] = useState('');

  const [goalRows, setGoalRows] = useState<GoalRow[]>([]);

  const [ratingRows, setRatingRows] = useState<RatingRow[]>([{ playerName: '', rating: 7 }]);
  const [motm, setMotm] = useState('');

  const { data: seasonData } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
  });

  const syncGoalRows = useCallback((newScore: number) => {
    setGoalRows((prev) => {
      if (newScore > prev.length) {
        return [...prev, ...Array.from({ length: newScore - prev.length }, () => ({ scorer: '', assist: '' }))];
      }
      return prev.slice(0, newScore);
    });
  }, []);

  const handleMyScoreChange = useCallback((delta: number) => {
    setMyScore((s) => {
      const next = Math.max(0, s + delta);
      syncGoalRows(next);
      return next;
    });
  }, [syncGoalRows]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeCareer || !activeSeason) throw new Error('Nenhuma carreira/temporada ativa');
      const existingMatches: MatchRecord[] = seasonData?.data?.matches ?? [];

      const playerStats: Record<string, PlayerMatchStats> = {};

      goalRows.forEach(({ scorer, assist }, idx) => {
        const name = scorer.trim();
        if (!name) return;
        if (!playerStats[name]) {
          playerStats[name] = {
            startedOnBench: false, rating: 7, goals: [], ownGoal: false, injured: false, substituted: false,
          };
        }
        playerStats[name].goals.push({ id: `g_${Date.now()}_${idx}`, minute: 0 });

        if (assist.trim()) {
          const asst = assist.trim();
          if (!playerStats[asst]) {
            playerStats[asst] = {
              startedOnBench: false, rating: 7, goals: [], ownGoal: false, injured: false, substituted: false,
            };
          }
        }
      });

      ratingRows.forEach(({ playerName, rating }) => {
        const name = playerName.trim();
        if (!name) return;
        if (playerStats[name]) {
          playerStats[name].rating = rating;
        } else {
          playerStats[name] = {
            startedOnBench: false, rating, goals: [], ownGoal: false, injured: false, substituted: false,
          };
        }
      });

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
        playerStats,
        matchStats: {
          myShots: 0,
          opponentShots: 0,
          possessionPct: possession,
        },
        motmPlayerName: motm.trim() || undefined,
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
    setStep((prev) => (prev < TOTAL_STEPS ? ((prev + 1) as Step) : prev));
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

  const updateGoalRow = (idx: number, field: keyof GoalRow, value: string) => {
    setGoalRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const updateRatingRow = (idx: number, field: keyof RatingRow, value: string | number) => {
    setRatingRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addRatingRow = () => {
    if (ratingRows.length < 11) setRatingRows((prev) => [...prev, { playerName: '', rating: 7 }]);
  };

  const removeRatingRow = (idx: number) => {
    setRatingRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const stepLabel = [
    'Informações', 'Resultado', 'Gols & Assistências', 'Avaliações', 'Confirmar',
  ][step - 1];

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
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepHeading}>{stepLabel}</Text>

        {step === 1 && (
          <View style={styles.stepContent}>
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
            <Text style={styles.matchLabel}>{activeCareer?.clubName ?? 'Seu time'} vs {opponent}</Text>

            <View style={styles.scoreArea}>
              <View style={styles.scoreTeam}>
                <Text style={styles.scoreTeamName} numberOfLines={1}>{activeCareer?.clubName ?? 'Casa'}</Text>
                <View style={styles.scoreControls}>
                  <ScoreButton icon="remove" onPress={() => handleMyScoreChange(-1)} />
                  <Text style={styles.scoreDigit}>{myScore}</Text>
                  <ScoreButton icon="add" onPress={() => handleMyScoreChange(1)} />
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
              <Text style={styles.fieldLabel}>Posse de bola — {possession}%</Text>
              <View style={styles.possessionRow}>
                {[30, 40, 50, 60, 70].map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.chip, possession === v && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => setPossession(v)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, possession === v && { color: '#fff' }]}>{v}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
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
            {myScore === 0 ? (
              <View style={styles.emptyStep}>
                <Ionicons name="football-outline" size={48} color={Colors.mutedForeground} />
                <Text style={styles.emptyStepText}>Nenhum gol marcado nesta partida.</Text>
                <Text style={[styles.emptyStepText, { fontSize: 12 }]}>Volte e ajuste o placar se necessário.</Text>
              </View>
            ) : (
              goalRows.map((row, idx) => (
                <View key={idx} style={styles.goalCard}>
                  <Text style={styles.goalCardTitle}>Gol {idx + 1}</Text>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Artilheiro</Text>
                    <TextInput
                      style={styles.input}
                      value={row.scorer}
                      onChangeText={(v) => updateGoalRow(idx, 'scorer', v)}
                      placeholder="Nome do jogador"
                      placeholderTextColor={Colors.mutedForeground}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Assistência (opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={row.assist}
                      onChangeText={(v) => updateGoalRow(idx, 'assist', v)}
                      placeholder="Nome do assistente"
                      placeholderTextColor={Colors.mutedForeground}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContent}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Melhor em campo (MOTM)</Text>
              <TextInput
                style={styles.input}
                value={motm}
                onChangeText={setMotm}
                placeholder="Nome do destaque"
                placeholderTextColor={Colors.mutedForeground}
              />
            </View>

            <View style={styles.sectionDivider}>
              <Text style={styles.sectionDividerText}>AVALIAÇÕES DOS JOGADORES</Text>
            </View>

            {ratingRows.map((row, idx) => (
              <View key={idx} style={styles.ratingCard}>
                <View style={styles.ratingCardHeader}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={row.playerName}
                    onChangeText={(v) => updateRatingRow(idx, 'playerName', v)}
                    placeholder={`Jogador ${idx + 1}`}
                    placeholderTextColor={Colors.mutedForeground}
                  />
                  {ratingRows.length > 1 && (
                    <TouchableOpacity onPress={() => removeRatingRow(idx)} style={styles.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={20} color={Colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>
                <RatingPicker value={row.rating} onChange={(v) => updateRatingRow(idx, 'rating', v)} />
              </View>
            ))}

            {ratingRows.length < 11 && (
              <TouchableOpacity style={styles.addRowBtn} onPress={addRatingRow} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
                <Text style={[styles.addRowBtnText, { color: theme.primary }]}>Adicionar jogador</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {step === 5 && (
          <View style={styles.stepContent}>
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
              <View style={styles.summaryDivider} />
              <SummaryRow label="Posse" value={`${possession}%`} />
              {goalRows.some((r) => r.scorer.trim()) && (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryRow
                    label="Artilheiros"
                    value={goalRows.filter((r) => r.scorer.trim()).map((r) => r.scorer.trim()).join(', ')}
                  />
                </>
              )}
              {motm.trim() ? (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryRow label="MOTM" value={motm.trim()} />
                </>
              ) : null}
              {ratingRows.filter((r) => r.playerName.trim()).length > 0 && (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryRow
                    label="Avaliações"
                    value={ratingRows
                      .filter((r) => r.playerName.trim())
                      .map((r) => `${r.playerName.trim()} ${r.rating}/10`)
                      .join(', ')}
                  />
                </>
              )}
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
        {step < TOTAL_STEPS ? (
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
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : {}]} numberOfLines={3}>
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
  stepHeading: {
    fontSize: 20, fontWeight: '700' as const, color: Colors.foreground,
    fontFamily: 'Inter_700Bold', marginBottom: 8,
  },
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
    fontFamily: 'Inter_400Regular', textAlign: 'center',
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
  possessionRow: { flexDirection: 'row', gap: 8 },
  emptyStep: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyStepText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  goalCard: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12,
  },
  goalCardTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary, fontFamily: 'Inter_700Bold' },
  ratingCard: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 10,
  },
  ratingCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeBtn: { padding: 4 },
  ratingRow: { flexDirection: 'row', gap: 4, flexWrap: 'nowrap' },
  ratingBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 6,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  ratingBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  ratingBtnText: { fontSize: 12, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  ratingBtnTextActive: { color: '#fff', fontWeight: '700' as const },
  addRowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', paddingVertical: 14,
    borderRadius: Colors.radius, borderWidth: 1.5,
    borderColor: Colors.primary, borderStyle: 'dashed',
  },
  addRowBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const },
  sectionDivider: { paddingVertical: 4 },
  sectionDividerText: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
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
