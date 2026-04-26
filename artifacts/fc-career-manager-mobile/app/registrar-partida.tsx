import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
  TextInput, Platform, Alert, ActivityIndicator, KeyboardAvoidingView, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type MatchLocation, type MatchRecord, type PlayerMatchStats, type SquadPlayer } from '@/lib/api';
import { Colors } from '@/constants/colors';

type Step = 1 | 2 | 3 | 4 | 5 | 6;
const TOTAL_STEPS = 6;

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

interface GoalRow {
  scorerName: string;
  scorerId: number | null;
  assistName: string;
  assistId: number | null;
}

type LineupRole = 'starter' | 'bench' | 'none';

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

function PlayerPickerModal({
  players,
  onSelect,
  onClose,
  title,
}: {
  players: SquadPlayer[];
  onSelect: (player: SquadPlayer) => void;
  onClose: () => void;
  title: string;
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : players;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.pickerSheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>{title}</Text>
          <TextInput
            style={styles.pickerSearch}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar jogador…"
            placeholderTextColor={Colors.mutedForeground}
          />
          <FlatList
            data={filtered}
            keyExtractor={(p) => String(p.id)}
            style={{ maxHeight: 320 }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border }} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => { onSelect(item); onClose(); }}
                activeOpacity={0.75}
              >
                <Text style={styles.pickerPlayerName}>{item.name}</Text>
                <Text style={styles.pickerPlayerPos}>{item.positionPtBr}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.pickerEmpty}>
                <Text style={styles.pickerEmptyText}>Nenhum jogador encontrado</Text>
              </View>
            }
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : {}]} numberOfLines={4}>
        {value}
      </Text>
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

  // Step 1
  const [tournament, setTournament] = useState('');
  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState<MatchLocation>('casa');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [stage, setStage] = useState('Rodada 1');

  // Step 2
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [possession, setPossession] = useState(50);
  const [observations, setObservations] = useState('');

  // Step 3: lineup
  const [lineupRoles, setLineupRoles] = useState<Record<number, LineupRole>>({});

  // Step 4: goals with squad-driven pickers
  const [goalRows, setGoalRows] = useState<GoalRow[]>([]);
  const [pickerTarget, setPickerTarget] = useState<null | { type: 'scorer' | 'assist'; goalIdx: number }>(null);

  // Step 5: ratings + MOTM
  const [playerRatings, setPlayerRatings] = useState<Record<string, number>>({});
  const [motm, setMotm] = useState<SquadPlayer | null>(null);
  const [motmPickerOpen, setMotmPickerOpen] = useState(false);

  const { data: seasonData } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
  });

  const { data: squadData } = useQuery({
    queryKey: ['/api/squad', activeCareer?.clubId],
    queryFn: () => activeCareer?.clubId ? api.squad.get(activeCareer.clubId) : null,
    enabled: !!activeCareer?.clubId,
    staleTime: 1000 * 60 * 30,
  });

  const squadPlayers = useMemo<SquadPlayer[]>(() => squadData?.players ?? [], [squadData]);

  const starterPlayers = useMemo(
    () => squadPlayers.filter((p) => lineupRoles[p.id] === 'starter'),
    [squadPlayers, lineupRoles],
  );
  const benchPlayers = useMemo(
    () => squadPlayers.filter((p) => lineupRoles[p.id] === 'bench'),
    [squadPlayers, lineupRoles],
  );

  const syncGoalRows = useCallback((newScore: number) => {
    setGoalRows((prev) => {
      if (newScore > prev.length) {
        return [...prev, ...Array.from({ length: newScore - prev.length }, () => ({
          scorerName: '', scorerId: null, assistName: '', assistId: null,
        }))];
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

  const toggleLineupRole = useCallback((playerId: number) => {
    setLineupRoles((prev) => {
      const current: LineupRole = prev[playerId] ?? 'none';
      const next: LineupRole = current === 'none' ? 'starter' : current === 'starter' ? 'bench' : 'none';
      return { ...prev, [playerId]: next };
    });
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeCareer || !activeSeason) throw new Error('Nenhuma carreira/temporada ativa');
      const existingMatches: MatchRecord[] = seasonData?.data?.matches ?? [];

      const playerIdByName: Record<string, number> = {};
      squadPlayers.forEach((p) => { playerIdByName[p.name] = p.id; });

      const playerStats: Record<string, PlayerMatchStats> = {};

      // seed lineup members into playerStats
      squadPlayers.forEach((p) => {
        const role = lineupRoles[p.id] ?? 'none';
        if (role === 'none') return;
        playerStats[p.name] = {
          startedOnBench: role === 'bench',
          rating: 0,
          goals: [],
          ownGoal: false,
          injured: false,
          substituted: false,
        };
      });

      // goals with assist linkage
      goalRows.forEach(({ scorerName, assistId }, idx) => {
        const name = scorerName.trim();
        if (!name) return;
        if (!playerStats[name]) {
          playerStats[name] = { startedOnBench: false, rating: 0, goals: [], ownGoal: false, injured: false, substituted: false };
        }
        playerStats[name].goals.push({
          id: `g_${Date.now()}_${idx}`,
          minute: 0,
          ...(assistId !== null ? { assistPlayerId: assistId } : {}),
        });
      });

      // ensure assist players exist in playerStats
      goalRows.forEach(({ assistName }) => {
        const name = assistName.trim();
        if (!name) return;
        if (!playerStats[name]) {
          playerStats[name] = { startedOnBench: false, rating: 0, goals: [], ownGoal: false, injured: false, substituted: false };
        }
      });

      // merge ratings
      Object.entries(playerRatings).forEach(([name, rating]) => {
        if (!name.trim() || rating === 0) return;
        if (playerStats[name]) {
          playerStats[name].rating = rating;
        } else {
          playerStats[name] = { startedOnBench: false, rating, goals: [], ownGoal: false, injured: false, substituted: false };
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
        starterIds: starterPlayers.map((p) => p.id),
        subIds: benchPlayers.map((p) => p.id),
        playerStats,
        matchStats: { myShots: 0, opponentShots: 0, possessionPct: possession },
        motmPlayerId: motm?.id,
        motmPlayerName: motm?.name,
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
    onError: (err: Error) => Alert.alert('Erro', err.message),
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

  const updateGoalRowPlayer = (idx: number, field: 'scorer' | 'assist', player: SquadPlayer) => {
    setGoalRows((prev) => {
      const next = [...prev];
      if (field === 'scorer') next[idx] = { ...next[idx], scorerName: player.name, scorerId: player.id };
      else next[idx] = { ...next[idx], assistName: player.name, assistId: player.id };
      return next;
    });
  };

  const clearGoalRowPlayer = (idx: number, field: 'scorer' | 'assist') => {
    setGoalRows((prev) => {
      const next = [...prev];
      if (field === 'scorer') next[idx] = { ...next[idx], scorerName: '', scorerId: null };
      else next[idx] = { ...next[idx], assistName: '', assistId: null };
      return next;
    });
  };

  const resultLabel = myScore > opponentScore ? 'VITÓRIA' : myScore < opponentScore ? 'DERROTA' : 'EMPATE';
  const resultColor = myScore > opponentScore ? Colors.success : myScore < opponentScore ? Colors.destructive : Colors.warning;

  const stepLabels = ['Informações', 'Resultado', 'Escalação', 'Gols & Assistências', 'Avaliações', 'Confirmar'];
  const stepLabel = stepLabels[step - 1];

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

        {/* ── Step 1: Informações ─────────────────────────────────── */}
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
                      location === opt.value && { backgroundColor: theme.primary, borderColor: theme.primary },
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

        {/* ── Step 2: Resultado ───────────────────────────────────── */}
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

        {/* ── Step 3: Escalação ───────────────────────────────────── */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.lineupHint}>
              Toque para alternar: <Text style={{ color: Colors.success }}>Titular</Text>{' → '}
              <Text style={{ color: Colors.warning }}>Reserva</Text>{' → '}
              <Text style={{ color: Colors.mutedForeground }}>Sem escalar</Text>
            </Text>
            <View style={styles.lineupCounter}>
              <Text style={styles.lineupCounterText}>
                {starterPlayers.length} titulares · {benchPlayers.length} reservas
              </Text>
            </View>
            {squadPlayers.length === 0 ? (
              <View style={styles.emptyStep}>
                <ActivityIndicator color={theme.primary} />
                <Text style={styles.emptyStepText}>Carregando elenco…</Text>
              </View>
            ) : (
              squadPlayers.map((p) => {
                const role: LineupRole = lineupRoles[p.id] ?? 'none';
                const roleConfig: Record<LineupRole, { label: string; color: string; icon: string }> = {
                  starter: { label: 'Titular', color: Colors.success, icon: 'checkmark-circle' },
                  bench: { label: 'Reserva', color: Colors.warning, icon: 'ellipsis-horizontal-circle' },
                  none: { label: 'Fora', color: Colors.border, icon: 'remove-circle-outline' },
                };
                const cfg = roleConfig[role];
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.lineupRow, role !== 'none' && { borderColor: `${cfg.color}50`, backgroundColor: `${cfg.color}08` }]}
                    onPress={() => toggleLineupRole(p.id)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineupPlayerName}>{p.name}</Text>
                      <Text style={styles.lineupPlayerPos}>{p.positionPtBr}{p.number ? ` · #${p.number}` : ''}</Text>
                    </View>
                    <View style={styles.lineupRoleBadge}>
                      <Ionicons name={cfg.icon as never} size={18} color={cfg.color} />
                      <Text style={[styles.lineupRoleText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ── Step 4: Gols & Assistências ─────────────────────────── */}
        {step === 4 && (
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
                    {row.scorerName ? (
                      <View style={styles.pickedPlayer}>
                        <Ionicons name="football" size={16} color={Colors.success} />
                        <Text style={styles.pickedPlayerName}>{row.scorerName}</Text>
                        <TouchableOpacity onPress={() => clearGoalRowPlayer(idx, 'scorer')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={18} color={Colors.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.pickerBtn}
                        onPress={() => setPickerTarget({ type: 'scorer', goalIdx: idx })}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="person-add-outline" size={16} color={theme.primary} />
                        <Text style={[styles.pickerBtnText, { color: theme.primary }]}>Selecionar artilheiro</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Assistência (opcional)</Text>
                    {row.assistName ? (
                      <View style={styles.pickedPlayer}>
                        <Ionicons name="hand-left" size={16} color={Colors.info} />
                        <Text style={styles.pickedPlayerName}>{row.assistName}</Text>
                        <TouchableOpacity onPress={() => clearGoalRowPlayer(idx, 'assist')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={18} color={Colors.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.pickerBtn}
                        onPress={() => setPickerTarget({ type: 'assist', goalIdx: idx })}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="person-add-outline" size={16} color={Colors.mutedForeground} />
                        <Text style={[styles.pickerBtnText, { color: Colors.mutedForeground }]}>Selecionar assistente</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── Step 5: Avaliações ──────────────────────────────────── */}
        {step === 5 && (
          <View style={styles.stepContent}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Melhor em campo (MOTM)</Text>
              {motm ? (
                <View style={styles.pickedPlayer}>
                  <Ionicons name="star" size={16} color={Colors.warning} />
                  <Text style={styles.pickedPlayerName}>{motm.name}</Text>
                  <TouchableOpacity onPress={() => setMotm(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={Colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setMotmPickerOpen(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="star-outline" size={16} color={Colors.warning} />
                  <Text style={[styles.pickerBtnText, { color: Colors.warning }]}>Selecionar destaque</Text>
                </TouchableOpacity>
              )}
            </View>

            {squadPlayers.length > 0 ? (
              <>
                <View style={styles.sectionDivider}>
                  <Text style={styles.sectionDividerText}>AVALIAÇÕES DO ELENCO (opcional · 0 = sem nota)</Text>
                </View>
                {squadPlayers.map((p) => {
                  const rating = playerRatings[p.name] ?? 0;
                  return (
                    <View key={p.id} style={styles.ratingCard}>
                      <View style={styles.ratingCardLeft}>
                        <Text style={styles.ratingPlayerName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.ratingPlayerPos}>{p.positionPtBr}</Text>
                      </View>
                      <View style={styles.ratingControls}>
                        <TouchableOpacity
                          style={styles.ratingAdj}
                          onPress={() => setPlayerRatings((prev) => ({ ...prev, [p.name]: Math.max(0, (prev[p.name] ?? 0) - 1) }))}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="remove" size={16} color={Colors.foreground} />
                        </TouchableOpacity>
                        <Text style={[
                          styles.ratingValue,
                          rating === 0 && { color: Colors.mutedForeground },
                          rating >= 8 && { color: Colors.success },
                          rating >= 6 && rating < 8 && { color: Colors.warning },
                          rating > 0 && rating < 6 && { color: Colors.destructive },
                        ]}>
                          {rating === 0 ? '—' : rating}
                        </Text>
                        <TouchableOpacity
                          style={styles.ratingAdj}
                          onPress={() => setPlayerRatings((prev) => ({ ...prev, [p.name]: Math.min(10, (prev[p.name] ?? 0) + 1) }))}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={16} color={Colors.foreground} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : (
              <View style={styles.emptyStep}>
                <ActivityIndicator color={theme.primary} />
                <Text style={styles.emptyStepText}>Carregando elenco…</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Step 6: Confirmar ───────────────────────────────────── */}
        {step === 6 && (
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
              <SummaryRow label="Placar" value={`${myScore} – ${opponentScore}`} valueColor={resultColor} />
              <View style={styles.summaryDivider} />
              <SummaryRow label="Resultado" value={resultLabel} valueColor={resultColor} />
              <View style={styles.summaryDivider} />
              <SummaryRow label="Posse" value={`${possession}%`} />
              {starterPlayers.length > 0 && (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryRow
                    label={`Escalação (${starterPlayers.length})`}
                    value={starterPlayers.map((p) => p.name).join(', ')}
                  />
                </>
              )}
              {goalRows.some((r) => r.scorerName) && (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryRow
                    label="Artilheiros"
                    value={goalRows
                      .filter((r) => r.scorerName)
                      .map((r) => r.assistName ? `${r.scorerName} (ast: ${r.assistName})` : r.scorerName)
                      .join(', ')}
                  />
                </>
              )}
              {motm && (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryRow label="MOTM" value={motm.name} />
                </>
              )}
              {Object.entries(playerRatings).filter(([, v]) => v > 0).length > 0 && (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryRow
                    label="Avaliações"
                    value={Object.entries(playerRatings).filter(([, v]) => v > 0).map(([n, r]) => `${n} ${r}/10`).join(', ')}
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

      {/* ── Bottom bar ──────────────────────────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {step < TOTAL_STEPS ? (
          <TouchableOpacity
            style={[
              styles.nextBtn,
              { backgroundColor: theme.primary },
              step === 1 && !canProceedStep1 && { opacity: 0.4 },
            ]}
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
            onPress={() => saveMutation.mutate()}
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

      {/* ── Picker modals ───────────────────────────────────────────── */}
      {pickerTarget && (
        <PlayerPickerModal
          players={squadPlayers}
          title={pickerTarget.type === 'scorer' ? 'Selecionar Artilheiro' : 'Selecionar Assistente'}
          onSelect={(player) => updateGoalRowPlayer(pickerTarget.goalIdx, pickerTarget.type, player)}
          onClose={() => setPickerTarget(null)}
        />
      )}
      {motmPickerOpen && (
        <PlayerPickerModal
          players={squadPlayers}
          title="Melhor em Campo (MOTM)"
          onSelect={(player) => { setMotm(player); setMotmPickerOpen(false); }}
          onClose={() => setMotmPickerOpen(false)}
        />
      )}
    </KeyboardAvoidingView>
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
  stepContent: { gap: 16 },
  stepHeading: { fontSize: 20, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  input: {
    backgroundColor: Colors.card, borderRadius: Colors.radius, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15,
  },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.card, borderRadius: 99, borderWidth: 1, borderColor: Colors.border,
  },
  chipText: { fontSize: 12, color: Colors.foreground, fontFamily: 'Inter_400Regular' },
  locationRow: { flexDirection: 'row', gap: 8 },
  locationChip: {
    flex: 1, alignItems: 'center', gap: 4, padding: 12,
    backgroundColor: Colors.card, borderRadius: Colors.radius, borderWidth: 1, borderColor: Colors.border,
  },
  locationLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  row: { flexDirection: 'row', gap: 12 },
  matchLabel: { fontSize: 15, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  scoreArea: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg, borderWidth: 1, borderColor: Colors.border, padding: 20,
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
  resultBadge: { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  resultBadgeText: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  possessionRow: { flexDirection: 'row', gap: 8 },
  lineupHint: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  lineupCounter: { alignSelf: 'center', marginBottom: 4 },
  lineupCounterText: { fontSize: 13, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  lineupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Colors.radius, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  lineupPlayerName: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  lineupPlayerPos: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  lineupRoleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lineupRoleText: { fontSize: 12, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  emptyStep: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyStepText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  goalCard: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12,
  },
  goalCardTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary, fontFamily: 'Inter_700Bold' },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: Colors.radius, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerBtnText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  pickedPlayer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: Colors.radius, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  pickedPlayerName: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  ratingCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Colors.radius, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  ratingCardLeft: { flex: 1, gap: 2 },
  ratingPlayerName: { fontSize: 13, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  ratingPlayerPos: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  ratingControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingAdj: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  ratingValue: { fontSize: 18, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', minWidth: 24, textAlign: 'center' },
  sectionDivider: { paddingTop: 8 },
  sectionDividerText: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
  summaryCard: { backgroundColor: Colors.card, borderRadius: Colors.radius, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  summaryLabel: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', flex: 0.45 },
  summaryValue: { fontSize: 14, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium', flex: 0.55, textAlign: 'right' },
  bottomBar: { padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Colors.radius, paddingVertical: 16 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerSheet: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  pickerHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  pickerTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  pickerSearch: {
    backgroundColor: Colors.background, borderRadius: Colors.radius, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10, color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14,
  },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 14 },
  pickerPlayerName: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  pickerPlayerPos: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  pickerEmpty: { padding: 24, alignItems: 'center' },
  pickerEmptyText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
});
