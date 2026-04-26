import { useState, useMemo } from 'react';
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
import { api } from '@/lib/api';
import { Colors } from '@/constants/colors';

interface BracketMatch {
  id: string;
  homeTeam: string;
  homeScore: number | null;
  awayTeam: string;
  awayScore: number | null;
}

interface BracketRound {
  id: string;
  name: string;
  matches: BracketMatch[];
}

interface StandingsEntry {
  id: string;
  team: string;
  points: number;
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goalsFor?: number;
  goalsAgainst?: number;
}

interface CompetitionResult {
  id: string;
  careerId: string;
  seasonId: string;
  seasonLabel: string;
  competitionName: string;
  type: 'mata-mata' | 'pontos-corridos';
  isChampion: boolean;
  bracket?: BracketRound[];
  standings?: StandingsEntry[];
  createdAt: number;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

const TYPE_OPTIONS = [
  { key: 'mata-mata' as const, label: 'Mata-mata', icon: '⚔️', desc: 'Chaves eliminatórias' },
  { key: 'pontos-corridos' as const, label: 'Pontos Corridos', icon: '📊', desc: 'Tabela de classificação' },
];

function generateBracketRounds(size: number, clubName: string): BracketRound[] {
  const rounds: BracketRound[] = [];
  let teams = size;
  const roundNames: string[] = [];
  while (teams > 1) {
    const mc = teams / 2;
    if (mc === 1) roundNames.push('Final');
    else if (mc === 2) roundNames.push('Semifinal');
    else if (mc === 4) roundNames.push('Quartas de Final');
    else if (mc === 8) roundNames.push('Oitavas de Final');
    else roundNames.push(`Rodada de ${mc * 2}`);
    rounds.push({
      id: genId('rnd'),
      name: '',
      matches: Array.from({ length: mc }, (_, i) => ({
        id: genId('bm'),
        homeTeam: mc === 1 && i === 0 ? clubName : '',
        homeScore: null,
        awayTeam: '',
        awayScore: null,
      })),
    });
    teams = mc;
  }
  return rounds.map((r, i) => ({ ...r, name: roundNames[i] }));
}

const BRACKET_SIZES = [4, 8, 16, 32] as const;

interface BracketEditorProps {
  rounds: BracketRound[];
  onChange: (rounds: BracketRound[]) => void;
  clubName: string;
}

function BracketEditor({ rounds, onChange, clubName }: BracketEditorProps) {
  const theme = useClubTheme();
  const isMyTeam = (name: string) => name.trim().toLowerCase() === clubName.trim().toLowerCase();

  const updateMatch = (roundId: string, match: BracketMatch) => {
    onChange(rounds.map((r) =>
      r.id === roundId ? { ...r, matches: r.matches.map((m) => m.id === match.id ? match : m) } : r
    ));
  };

  const updateRoundName = (roundId: string, name: string) => {
    onChange(rounds.map((r) => r.id === roundId ? { ...r, name } : r));
  };

  const addMatch = (roundId: string) => {
    onChange(rounds.map((r) =>
      r.id === roundId
        ? { ...r, matches: [...r.matches, { id: genId('bm'), homeTeam: '', homeScore: null, awayTeam: '', awayScore: null }] }
        : r
    ));
  };

  const removeMatch = (roundId: string, matchId: string) => {
    onChange(rounds.map((r) =>
      r.id === roundId ? { ...r, matches: r.matches.filter((m) => m.id !== matchId) } : r
    ));
  };

  const addRound = () => {
    onChange([...rounds, {
      id: genId('rnd'),
      name: `Rodada ${rounds.length + 1}`,
      matches: [],
    }]);
  };

  const removeRound = (roundId: string) => {
    onChange(rounds.filter((r) => r.id !== roundId));
  };

  return (
    <View style={{ gap: 12 }}>
      {rounds.map((round) => (
        <View key={round.id} style={bStyles.roundCard}>
          <View style={bStyles.roundHeader}>
            <TextInput
              style={bStyles.roundNameInput}
              value={round.name}
              onChangeText={(v) => updateRoundName(round.id, v)}
              placeholder="Nome da fase"
              placeholderTextColor={Colors.mutedForeground}
            />
            <TouchableOpacity onPress={() => removeRound(round.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
            </TouchableOpacity>
          </View>

          {round.matches.map((match) => (
            <View key={match.id} style={bStyles.matchRow}>
              <TextInput
                style={[bStyles.teamInput, isMyTeam(match.homeTeam) && { color: theme.primary }]}
                value={match.homeTeam}
                onChangeText={(v) => updateMatch(round.id, { ...match, homeTeam: v })}
                placeholder="Casa"
                placeholderTextColor={Colors.mutedForeground}
              />
              <TextInput
                style={bStyles.scoreInput}
                value={match.homeScore !== null ? String(match.homeScore) : ''}
                onChangeText={(v) => updateMatch(round.id, { ...match, homeScore: v === '' ? null : Number(v) })}
                placeholder="—"
                placeholderTextColor={Colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={bStyles.vs}>×</Text>
              <TextInput
                style={bStyles.scoreInput}
                value={match.awayScore !== null ? String(match.awayScore) : ''}
                onChangeText={(v) => updateMatch(round.id, { ...match, awayScore: v === '' ? null : Number(v) })}
                placeholder="—"
                placeholderTextColor={Colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TextInput
                style={[bStyles.teamInput, isMyTeam(match.awayTeam) && { color: theme.primary }]}
                value={match.awayTeam}
                onChangeText={(v) => updateMatch(round.id, { ...match, awayTeam: v })}
                placeholder="Fora"
                placeholderTextColor={Colors.mutedForeground}
              />
              <TouchableOpacity
                onPress={() => removeMatch(round.id, match.id)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close-circle-outline" size={16} color={Colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={bStyles.addMatchBtn} onPress={() => addMatch(round.id)}>
            <Ionicons name="add" size={14} color={Colors.mutedForeground} />
            <Text style={bStyles.addMatchText}>Adicionar partida</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={bStyles.addRoundBtn} onPress={addRound}>
        <Ionicons name="add-circle-outline" size={16} color={Colors.mutedForeground} />
        <Text style={bStyles.addRoundText}>Adicionar fase</Text>
      </TouchableOpacity>
    </View>
  );
}

interface StandingsEditorProps {
  entries: StandingsEntry[];
  onChange: (entries: StandingsEntry[]) => void;
  clubName: string;
}

function NumField({ value, onChange }: { value?: number; onChange: (n: number) => void }) {
  return (
    <TextInput
      style={sStyles.numInput}
      value={value !== undefined ? String(value) : ''}
      onChangeText={(v) => onChange(parseInt(v, 10) || 0)}
      keyboardType="number-pad"
      maxLength={3}
      placeholder="0"
      placeholderTextColor={Colors.border}
    />
  );
}

function StandingsEditor({ entries, onChange, clubName }: StandingsEditorProps) {
  const theme = useClubTheme();
  const sorted = [...entries].sort((a, b) => b.points - a.points);
  const isMyTeam = (name: string) => name.trim().toLowerCase() === clubName.trim().toLowerCase();

  const updateEntry = (updated: StandingsEntry) => {
    onChange(entries.map((e) => e.id === updated.id ? updated : e));
  };

  const addEntry = () => {
    onChange([...entries, { id: genId('st'), team: '', points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }]);
  };

  const removeEntry = (id: string) => {
    onChange(entries.filter((e) => e.id !== id));
  };

  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ gap: 4, minWidth: 420 }}>
          <View style={[sStyles.header, { paddingHorizontal: 4 }]}>
            <Text style={[sStyles.colHeader, { width: 24 }]}>#</Text>
            <Text style={[sStyles.colHeader, { flex: 1, minWidth: 80 }]}>EQUIPE</Text>
            <Text style={[sStyles.colHeader, { width: 34 }]}>J</Text>
            <Text style={[sStyles.colHeader, { width: 34 }]}>V</Text>
            <Text style={[sStyles.colHeader, { width: 34 }]}>E</Text>
            <Text style={[sStyles.colHeader, { width: 34 }]}>D</Text>
            <Text style={[sStyles.colHeader, { width: 34 }]}>GP</Text>
            <Text style={[sStyles.colHeader, { width: 34 }]}>GC</Text>
            <Text style={[sStyles.colHeader, { width: 38 }]}>PTS</Text>
            <View style={{ width: 24 }} />
          </View>
          {sorted.map((entry, idx) => (
            <View key={entry.id} style={[sStyles.row, { paddingHorizontal: 4 }]}>
              <Text style={[sStyles.pos, { width: 24 }, idx === 0 ? sStyles.posGold : idx < 3 ? sStyles.posSilver : sStyles.posNormal]}>
                {idx + 1}
              </Text>
              <TextInput
                style={[sStyles.teamInput, { flex: 1, minWidth: 80 }, isMyTeam(entry.team) && { color: theme.primary }]}
                value={entry.team}
                onChangeText={(v) => updateEntry({ ...entry, team: v })}
                placeholder="Clube"
                placeholderTextColor={Colors.mutedForeground}
              />
              <NumField value={entry.played} onChange={(n) => updateEntry({ ...entry, played: n })} />
              <NumField value={entry.wins} onChange={(n) => updateEntry({ ...entry, wins: n, points: (n * 3) + (entry.draws ?? 0) })} />
              <NumField value={entry.draws} onChange={(n) => updateEntry({ ...entry, draws: n, points: ((entry.wins ?? 0) * 3) + n })} />
              <NumField value={entry.losses} onChange={(n) => updateEntry({ ...entry, losses: n })} />
              <NumField value={entry.goalsFor} onChange={(n) => updateEntry({ ...entry, goalsFor: n })} />
              <NumField value={entry.goalsAgainst} onChange={(n) => updateEntry({ ...entry, goalsAgainst: n })} />
              <TextInput
                style={[sStyles.numInput, { width: 38, fontWeight: '700' as const }]}
                value={String(entry.points)}
                onChangeText={(v) => updateEntry({ ...entry, points: parseInt(v, 10) || 0 })}
                keyboardType="number-pad"
                maxLength={3}
              />
              <TouchableOpacity
                onPress={() => removeEntry(entry.id)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={{ width: 24, alignItems: 'center' }}
              >
                <Ionicons name="close-circle-outline" size={16} color={Colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
      <TouchableOpacity style={sStyles.addBtn} onPress={addEntry}>
        <Ionicons name="add" size={14} color={Colors.mutedForeground} />
        <Text style={sStyles.addBtnText}>Adicionar equipe</Text>
      </TouchableOpacity>
    </View>
  );
}

interface NewCompModalProps {
  visible: boolean;
  careerId: string;
  seasonId: string;
  seasonLabel: string;
  clubName: string;
  onClose: () => void;
  onSave: (c: CompetitionResult) => void;
}

function NewCompetitionModal({ visible, careerId, seasonId, seasonLabel, clubName, onClose, onSave }: NewCompModalProps) {
  const theme = useClubTheme();
  const [name, setName] = useState('');
  const [type, setType] = useState<'mata-mata' | 'pontos-corridos'>('mata-mata');
  const [isChampion, setIsChampion] = useState(false);
  const [bracket, setBracket] = useState<BracketRound[]>([]);
  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [bracketSize, setBracketSize] = useState<number | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const reset = () => {
    setName('');
    setType('mata-mata');
    setIsChampion(false);
    setBracket([]);
    setStandings([]);
    setBracketSize(null);
    setStep(1);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleNext = () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Insira o nome da competição.');
      return;
    }
    if (type === 'mata-mata' && !bracketSize) {
      Alert.alert('Atenção', 'Escolha o número de equipes ou monte manualmente.');
      return;
    }
    setStep(2);
  };

  const handleSelectBracketSize = (size: number) => {
    setBracketSize(size);
    setBracket(generateBracketRounds(size, clubName));
  };

  const handleManualBracket = () => {
    setBracketSize(-1);
    setBracket([]);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: genId('cr'),
      careerId,
      seasonId,
      seasonLabel,
      competitionName: name.trim(),
      type,
      isChampion,
      bracket: type === 'mata-mata' ? bracket : undefined,
      standings: type === 'pontos-corridos' ? standings : undefined,
      createdAt: Date.now(),
    });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={step === 2 ? () => setStep(1) : handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={step === 2 ? 'chevron-back' : 'close'} size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {step === 1 ? 'Nova Competição' : 'Editar Resultados'}
            </Text>
            <TouchableOpacity
              onPress={step === 1 ? handleNext : handleSave}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.nextBtn, { color: theme.primary }]}>
                {step === 1 ? 'Próximo' : 'Salvar'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {step === 1 ? (
              <>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>NOME DA COMPETIÇÃO</Text>
                  <TextInput
                    style={styles.textInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="Ex: Champions League, Copa do Brasil…"
                    placeholderTextColor={Colors.mutedForeground}
                    autoFocus
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>TIPO</Text>
                  <View style={{ gap: 8 }}>
                    {TYPE_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.typeCard,
                          type === opt.key && {
                            backgroundColor: `rgba(${theme.primaryRgb},0.1)`,
                            borderColor: `rgba(${theme.primaryRgb},0.4)`,
                          },
                        ]}
                        onPress={() => setType(opt.key)}
                      >
                        <Text style={styles.typeCardIcon}>{opt.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.typeCardLabel, type === opt.key && { color: theme.primary }]}>
                            {opt.label}
                          </Text>
                          <Text style={styles.typeCardDesc}>{opt.desc}</Text>
                        </View>
                        {type === opt.key && (
                          <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {type === 'mata-mata' && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>TAMANHO DO CHAVEAMENTO</Text>
                    <View style={styles.bracketSizeGrid}>
                      {BRACKET_SIZES.map((size) => (
                        <TouchableOpacity
                          key={size}
                          style={[
                            styles.bracketSizeBtn,
                            bracketSize === size && {
                              backgroundColor: `rgba(${theme.primaryRgb},0.15)`,
                              borderColor: `rgba(${theme.primaryRgb},0.4)`,
                            },
                          ]}
                          onPress={() => handleSelectBracketSize(size)}
                        >
                          <Text style={[styles.bracketSizeBtnText, bracketSize === size && { color: theme.primary }]}>
                            {size} equipas
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[
                          styles.bracketSizeBtn,
                          { borderStyle: 'dashed' },
                          bracketSize === -1 && {
                            backgroundColor: `rgba(${theme.primaryRgb},0.15)`,
                            borderColor: `rgba(${theme.primaryRgb},0.4)`,
                          },
                        ]}
                        onPress={handleManualBracket}
                      >
                        <Text style={[styles.bracketSizeBtnText, bracketSize === -1 && { color: theme.primary }]}>
                          Manual
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={styles.field}>
                  <TouchableOpacity
                    style={[
                      styles.championToggle,
                      isChampion && { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.4)' },
                    ]}
                    onPress={() => setIsChampion(!isChampion)}
                  >
                    <Text style={{ fontSize: 20 }}>{isChampion ? '🏆' : '🏅'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.championLabel, isChampion && { color: '#f59e0b' }]}>
                        Campeão desta competição
                      </Text>
                      <Text style={styles.championDesc}>Marca seu clube como vencedor</Text>
                    </View>
                    <View style={[
                      styles.toggle,
                      { backgroundColor: isChampion ? '#f59e0b' : 'rgba(255,255,255,0.12)' },
                    ]}>
                      <View style={[styles.toggleThumb, { transform: [{ translateX: isChampion ? 16 : 2 }] }]} />
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.editHint}>
                  {type === 'mata-mata'
                    ? 'Preencha os confrontos e placar de cada fase.'
                    : 'Adicione equipes e pontuações na tabela.'}
                </Text>
                {type === 'mata-mata' ? (
                  <BracketEditor rounds={bracket} onChange={setBracket} clubName={clubName} />
                ) : (
                  <StandingsEditor entries={standings} onChange={setStandings} clubName={clubName} />
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

interface CompCardProps {
  item: CompetitionResult;
  onPress: () => void;
  onDelete: () => void;
}

function CompCard({ item, onPress, onDelete }: CompCardProps) {
  const theme = useClubTheme();
  return (
    <TouchableOpacity style={styles.compCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.compCardLeft}>
        <Text style={styles.compIcon}>{item.isChampion ? '🏆' : item.type === 'mata-mata' ? '⚔️' : '📊'}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.compName} numberOfLines={1}>{item.competitionName}</Text>
        <Text style={styles.compMeta}>
          {item.seasonLabel} · {item.type === 'mata-mata' ? 'Mata-mata' : 'Pontos Corridos'}
          {item.isChampion ? ' · 🏆 Campeão' : ''}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => Alert.alert('Excluir', `Excluir "${item.competitionName}"?`, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: onDelete },
        ])}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

interface EditModalProps {
  item: CompetitionResult | null;
  clubName: string;
  onClose: () => void;
  onSave: (updated: CompetitionResult) => void;
}

function EditCompModal({ item, clubName, onClose, onSave }: EditModalProps) {
  const theme = useClubTheme();
  const [bracket, setBracket] = useState<BracketRound[]>(item?.bracket ?? []);
  const [standings, setStandings] = useState<StandingsEntry[]>(item?.standings ?? []);
  const [isChampion, setIsChampion] = useState(item?.isChampion ?? false);

  if (!item) return null;

  const handleSave = () => {
    onSave({
      ...item,
      bracket: item.type === 'mata-mata' ? bracket : undefined,
      standings: item.type === 'pontos-corridos' ? standings : undefined,
      isChampion,
    });
    onClose();
  };

  return (
    <Modal visible={!!item} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>{item.competitionName}</Text>
            <TouchableOpacity onPress={handleSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.nextBtn, { color: theme.primary }]}>Salvar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <TouchableOpacity
              style={[
                styles.championToggle,
                isChampion && { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.4)' },
              ]}
              onPress={() => setIsChampion(!isChampion)}
            >
              <Text style={{ fontSize: 20 }}>{isChampion ? '🏆' : '🏅'}</Text>
              <Text style={[styles.championLabel, isChampion && { color: '#f59e0b' }]}>
                Campeão desta competição
              </Text>
              <View style={[
                styles.toggle,
                { backgroundColor: isChampion ? '#f59e0b' : 'rgba(255,255,255,0.12)' },
              ]}>
                <View style={[styles.toggleThumb, { transform: [{ translateX: isChampion ? 16 : 2 }] }]} />
              </View>
            </TouchableOpacity>
            {item.type === 'mata-mata' ? (
              <BracketEditor rounds={bracket} onChange={setBracket} clubName={clubName} />
            ) : (
              <StandingsEditor entries={standings} onChange={setStandings} clubName={clubName} />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function CompeticoesScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, activeSeason } = useCareer();
  const theme = useClubTheme();
  const qc = useQueryClient();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<CompetitionResult | null>(null);
  const [showAllSeasons, setShowAllSeasons] = useState(false);

  const { data: careerData, isLoading } = useQuery({
    queryKey: ['/api/data/career', activeCareer?.id],
    queryFn: () => activeCareer ? api.careerData.get(activeCareer.id) : null,
    enabled: !!activeCareer?.id,
    staleTime: 1000 * 60 * 5,
  });

  const results: CompetitionResult[] = (careerData?.data?.comp_results ?? []) as CompetitionResult[];

  const saveMutation = useMutation({
    mutationFn: (updated: CompetitionResult[]) => {
      if (!activeCareer) throw new Error('no career');
      return api.careerData.set(activeCareer.id, 'comp_results', updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/data/career', activeCareer?.id] }),
  });

  const handleAdd = (comp: CompetitionResult) => {
    saveMutation.mutate([comp, ...results]);
  };

  const handleUpdate = (updated: CompetitionResult) => {
    saveMutation.mutate(results.map((r) => r.id === updated.id ? updated : r));
  };

  const handleDelete = (id: string) => {
    saveMutation.mutate(results.filter((r) => r.id !== id));
  };

  const activeSeasonLabel = activeSeason?.label ?? '';

  const filteredResults = useMemo(() => {
    if (showAllSeasons || !activeSeasonLabel) return results;
    return results.filter((r) => r.seasonLabel === activeSeasonLabel);
  }, [results, showAllSeasons, activeSeasonLabel]);

  const grouped = useMemo(() => {
    const map = new Map<string, CompetitionResult[]>();
    for (const r of filteredResults) {
      const k = r.seasonLabel;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredResults]);

  const champions = filteredResults.filter((r) => r.isChampion);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Competições</Text>
        <TouchableOpacity
          style={[styles.addBtn, !activeSeason && { opacity: 0.3 }]}
          onPress={() => activeSeason ? setShowNew(true) : Alert.alert('Sem temporada ativa', 'Ative uma temporada para registar competições.')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {results.length > 0 && activeSeasonLabel && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterTab, !showAllSeasons && { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }]}
            onPress={() => setShowAllSeasons(false)}
          >
            <Text style={[styles.filterTabText, !showAllSeasons && { color: theme.primary }]}>
              {activeSeasonLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, showAllSeasons && { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }]}
            onPress={() => setShowAllSeasons(true)}
          >
            <Text style={[styles.filterTabText, showAllSeasons && { color: theme.primary }]}>
              Todas
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : filteredResults.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 56 }}>🏟️</Text>
          <Text style={styles.emptyTitle}>Nenhuma competição</Text>
          <Text style={styles.emptyText}>
            {!showAllSeasons && activeSeasonLabel
              ? `Nenhuma competição registada em ${activeSeasonLabel}.`
              : 'Registe os resultados das competições que o seu clube participa.'}
          </Text>
          <TouchableOpacity
            style={[styles.emptyAddBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.3)` }]}
            onPress={() => setShowNew(true)}
          >
            <Ionicons name="add" size={18} color={theme.primary} />
            <Text style={[styles.emptyAddBtnText, { color: theme.primary }]}>Adicionar competição</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {champions.length > 0 && (
            <View style={styles.championsBar}>
              <Text style={styles.championsBarTitle}>🏆 {champions.length} {champions.length === 1 ? 'título conquistado' : 'títulos conquistados'}</Text>
              <Text style={styles.championsBarNames} numberOfLines={2}>
                {champions.map((c) => c.competitionName).join(' · ')}
              </Text>
            </View>
          )}

          {grouped.map(([season, list]) => (
            <View key={season} style={styles.seasonGroup}>
              <Text style={styles.groupLabel}>{season}</Text>
              {list.map((item) => (
                <CompCard
                  key={item.id}
                  item={item}
                  onPress={() => setEditing(item)}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {activeCareer && activeSeason && (
        <NewCompetitionModal
          visible={showNew}
          careerId={activeCareer.id}
          seasonId={activeSeason.id}
          seasonLabel={activeSeason.label}
          clubName={activeCareer.clubName}
          onClose={() => setShowNew(false)}
          onSave={handleAdd}
        />
      )}

      <EditCompModal
        key={editing?.id ?? 'none'}
        item={editing}
        clubName={activeCareer?.clubName ?? ''}
        onClose={() => setEditing(null)}
        onSave={handleUpdate}
      />
    </View>
  );
}

const bStyles = StyleSheet.create({
  roundCard: {
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    padding: 12, gap: 8,
  },
  roundHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  roundNameInput: {
    flex: 1, fontSize: 13, fontWeight: '700' as const,
    color: Colors.foreground, fontFamily: 'Inter_700Bold',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: 2,
  },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamInput: {
    flex: 1, backgroundColor: Colors.backgroundLighter,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 12, color: Colors.foreground, fontFamily: 'Inter_400Regular',
    borderWidth: 1, borderColor: Colors.border,
  },
  scoreInput: {
    width: 36, backgroundColor: Colors.backgroundLighter,
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 6,
    fontSize: 12, color: Colors.foreground, fontFamily: 'Inter_700Bold',
    borderWidth: 1, borderColor: Colors.border, textAlign: 'center',
  },
  vs: { fontSize: 11, color: Colors.mutedForeground, fontWeight: '700' as const },
  addMatchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, justifyContent: 'center',
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  addMatchText: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  addRoundBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, justifyContent: 'center',
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  addRoundText: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
});

const sStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 4 },
  colHeader: {
    fontSize: 10, fontWeight: '600' as const, color: Colors.mutedForeground,
    textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'Inter_600SemiBold',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: 10, padding: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  pos: { width: 22, fontSize: 13, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  posGold: { color: '#f59e0b' },
  posSilver: { color: '#94a3b8' },
  posNormal: { color: Colors.mutedForeground },
  teamInput: {
    flex: 1, fontSize: 13, color: Colors.foreground,
    fontFamily: 'Inter_400Regular',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: 2,
  },
  ptsInput: {
    width: 40, fontSize: 13, fontWeight: '700' as const, color: Colors.foreground,
    fontFamily: 'Inter_700Bold', textAlign: 'center',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 6, paddingVertical: 2,
  },
  numInput: {
    width: 34, fontSize: 12, color: Colors.foreground,
    fontFamily: 'Inter_400Regular', textAlign: 'center',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 6, paddingVertical: 2,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 10, justifyContent: 'center',
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  addBtnText: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 22 },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
  },
  emptyAddBtnText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  listContent: { padding: 16, gap: 4 },
  championsBar: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
    padding: 14, marginBottom: 16, gap: 4,
  },
  championsBarTitle: { fontSize: 14, fontWeight: '700' as const, color: '#f59e0b', fontFamily: 'Inter_700Bold' },
  championsBarNames: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  filterRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  filterTabText: {
    fontSize: 13, fontWeight: '600' as const,
    color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold',
  },
  seasonGroup: { marginBottom: 16 },
  groupLabel: {
    fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground,
    textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Inter_600SemiBold',
    marginBottom: 8, paddingHorizontal: 4,
  },
  compCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: 8,
  },
  compCardLeft: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  compIcon: { fontSize: 22 },
  compName: { fontSize: 15, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  compMeta: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet: {
    backgroundColor: Colors.backgroundLighter,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '94%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold', marginHorizontal: 8 },
  nextBtn: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  modalBody: { padding: 20, gap: 16 },
  field: { gap: 8 },
  fieldLabel: {
    fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground,
    textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Inter_600SemiBold',
  },
  textInput: {
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.foreground, fontFamily: 'Inter_400Regular',
  },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14,
  },
  typeCardIcon: { fontSize: 22 },
  typeCardLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  typeCardDesc: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  bracketSizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bracketSizeBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  bracketSizeBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  championToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  championLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold', flex: 1 },
  championDesc: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  toggle: {
    width: 36, height: 20, borderRadius: 10,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2,
  },
  editHint: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 20, marginBottom: 4 },
});
