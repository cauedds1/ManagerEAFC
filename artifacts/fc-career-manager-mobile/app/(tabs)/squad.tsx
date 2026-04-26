import type { ComponentProps } from 'react';
import {
  useState, useCallback, useMemo, useEffect,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, ScrollView, Image, Platform, RefreshControl, ActivityIndicator,
  LayoutChangeEvent, KeyboardAvoidingView, Pressable, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type SquadPlayer, type PlayerSeasonStats, type InjuryRecord, type Season, type Transfer } from '@/lib/api';
import { Colors } from '@/constants/colors';
import {
  type FormationKey, FORMATION_GROUPS, getFormationPositions, getFormationLabel,
  DEFAULT_FORMATION, pickBestEleven,
} from '@/lib/formations';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type PosFilter = 'Todos' | 'GOL' | 'DEF' | 'MID' | 'ATA';
type SquadTab = 'campo' | 'lista' | 'saidas';

const POS_CONFIG: Record<string, { color: string; bg: string }> = {
  GOL: { color: '#f59e0b', bg: 'rgba(245,158,11,0.18)' },
  DEF: { color: '#60a5fa', bg: 'rgba(59,130,246,0.18)' },
  MID: { color: '#34d399', bg: 'rgba(16,185,129,0.18)' },
  ATA: { color: '#f87171', bg: 'rgba(239,68,68,0.18)' },
};

const POSITION_FILTERS: PosFilter[] = ['Todos', 'GOL', 'DEF', 'MID', 'ATA'];
const POSITIONS: PosFilter[] = ['GOL', 'DEF', 'MID', 'ATA'];

function ratingColor(r: number): string {
  if (r >= 8.5) return '#60a5fa';
  if (r >= 7.5) return '#34d399';
  if (r >= 6.5) return '#fbbf24';
  return '#f87171';
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PlayerPhoto({ src, name, size = 44 }: { src: string; name: string; size?: number }) {
  const [err, setErr] = useState(!src);
  if (!err && src) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <View style={[styles.photoFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.photoInitials, { fontSize: size * 0.32 }]}>{getInitials(name)}</Text>
    </View>
  );
}

const MOOD_CONFIG: Record<string, { label: string; color: string }> = {
  excelente:    { label: 'Excelente',    color: '#34d399' },
  bom:          { label: 'Bom',          color: '#a3e635' },
  neutro:       { label: 'Neutro',       color: '#94a3b8' },
  insatisfeito: { label: 'Insatisfeito', color: '#fb923c' },
  irritado:     { label: 'Irritado',     color: '#f87171' },
};

const FAN_CONFIG: Record<string, { label: string; color: string }> = {
  idolo:      { label: 'Ídolo',      color: '#fbbf24' },
  querido:    { label: 'Querido',    color: '#34d399' },
  neutro:     { label: 'Neutro',     color: '#94a3b8' },
  contestado: { label: 'Contestado', color: '#fb923c' },
  vaiado:     { label: 'Vaiado',     color: '#f87171' },
};

function PlayerBottomSheet({
  player,
  stats,
  injury,
  inLineup,
  motmCount,
  salary,
  onClose,
  onSaveEdit,
}: {
  player: SquadPlayer;
  stats?: PlayerSeasonStats;
  injury?: InjuryRecord;
  inLineup: boolean;
  motmCount?: number;
  salary?: number;
  onClose: () => void;
  onSaveEdit?: (updates: { name?: string; number?: number | null; overallRating?: number }) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const posCfg = POS_CONFIG[player.positionPtBr] ?? POS_CONFIG.MID;
  const isCustom = player.id < 0;
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(player.name);
  const [editNumber, setEditNumber] = useState(player.number != null ? String(player.number) : '');
  const [editOvr, setEditOvr] = useState(player.overallRating ?? 75);
  const [saving, setSaving] = useState(false);

  const statItems = [
    { label: 'Partidas', value: stats?.appearances ?? 0, icon: 'football-outline' as IoniconName },
    { label: 'Gols', value: stats?.goals ?? 0, icon: 'flash-outline' as IoniconName, color: Colors.success },
    { label: 'Assist.', value: stats?.assists ?? 0, icon: 'git-branch-outline' as IoniconName, color: Colors.info },
    { label: 'Média', value: stats?.avgRating ? stats.avgRating.toFixed(1) : '—', icon: 'star-outline' as IoniconName, color: stats?.avgRating ? ratingColor(stats.avgRating) : Colors.mutedForeground },
    { label: 'Amarelos', value: stats?.yellowCards ?? 0, icon: 'card-outline' as IoniconName, color: Colors.warning },
    { label: 'Vermelhos', value: stats?.redCards ?? 0, icon: 'card-outline' as IoniconName, color: Colors.destructive },
    { label: 'Minutos', value: stats?.totalMinutes ?? 0, icon: 'time-outline' as IoniconName },
    { label: 'MOTM', value: motmCount ?? 0, icon: 'trophy-outline' as IoniconName, color: Colors.warning },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheetContainer, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <PlayerPhoto src={player.photo} name={player.name} size={64} />
            <View style={styles.sheetPlayerInfo}>
              <View style={styles.sheetNameRow}>
                <Text style={styles.sheetPlayerName} numberOfLines={1}>{player.name}</Text>
                {inLineup && (
                  <View style={styles.lineupBadge}>
                    <Text style={styles.lineupBadgeText}>Titular</Text>
                  </View>
                )}
              </View>
              <View style={styles.sheetBadges}>
                <View style={[styles.posBadge, { backgroundColor: posCfg.bg }]}>
                  <Text style={[styles.posBadgeText, { color: posCfg.color }]}>{player.positionPtBr}</Text>
                </View>
                {player.overallRating != null && (
                  <View style={[styles.posBadge, { backgroundColor: 'rgba(139,92,246,0.18)' }]}>
                    <Text style={[styles.posBadgeText, { color: Colors.primary }]}>OVR {player.overallRating}</Text>
                  </View>
                )}
                {player.number != null && (
                  <Text style={styles.shirtNum}>#{player.number}</Text>
                )}
                <Text style={styles.ageText}>{player.age} anos</Text>
                {player.nationality ? (
                  <Text style={styles.ageText}>{player.nationality}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.sheetDivider} />

          <Text style={styles.sheetSectionLabel}>Esta Temporada</Text>
          <View style={styles.statsGrid}>
            {statItems.map((item) => (
              <View key={item.label} style={styles.statCell}>
                <Text style={[styles.statValue, item.color ? { color: item.color } : {}]}>
                  {item.value}
                </Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {(stats?.mood || stats?.fanMoral || salary != null) && (
            <>
              <View style={styles.sheetDivider} />
              <Text style={styles.sheetSectionLabel}>Status do Jogador</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {stats?.mood && (() => {
                  const cfg = MOOD_CONFIG[stats.mood] ?? MOOD_CONFIG.neutro;
                  return (
                    <View style={[styles.statCell, { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: `${cfg.color}12` }]}>
                      <Ionicons name="happy-outline" size={16} color={cfg.color} />
                      <View>
                        <Text style={[styles.statLabel, { marginBottom: 0 }]}>Humor</Text>
                        <Text style={[styles.statValue, { fontSize: 14, color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>
                  );
                })()}
                {stats?.fanMoral && (() => {
                  const cfg = FAN_CONFIG[stats.fanMoral] ?? FAN_CONFIG.neutro;
                  return (
                    <View style={[styles.statCell, { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: `${cfg.color}12` }]}>
                      <Ionicons name="people-outline" size={16} color={cfg.color} />
                      <View>
                        <Text style={[styles.statLabel, { marginBottom: 0 }]}>Torcida</Text>
                        <Text style={[styles.statValue, { fontSize: 14, color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>
                  );
                })()}
                {salary != null && salary > 0 && (
                  <View style={[styles.statCell, { flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
                    <Ionicons name="cash-outline" size={16} color={Colors.success} />
                    <View>
                      <Text style={[styles.statLabel, { marginBottom: 0 }]}>Salário</Text>
                      <Text style={[styles.statValue, { fontSize: 14, color: Colors.success }]}>
                        {salary >= 1000000 ? `€${(salary / 1000000).toFixed(1)}M` : `€${(salary / 1000).toFixed(0)}K`}/sem
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}

          {injury && (() => {
            const remaining = Math.max(0, injury.matchesOut - (injury.matchesServed ?? 0));
            const isRecovered = remaining === 0;
            const injColor = isRecovered ? Colors.success : Colors.destructive;
            return (
              <>
                <View style={styles.sheetDivider} />
                <Text style={styles.sheetSectionLabel}>Status Médico</Text>
                <View style={[styles.injuryBanner, { backgroundColor: `${injColor}12`, borderColor: `${injColor}30` }]}>
                  <Ionicons name={isRecovered ? 'checkmark-circle' : 'medkit'} size={18} color={injColor} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.injuryStatusText, { color: injColor }]}>
                      {isRecovered ? 'Recuperado' : 'Lesionado'}
                      {injury.injuryType ? ` — ${injury.injuryType}` : ''}
                    </Text>
                    {!isRecovered && (
                      <Text style={styles.injuryReturnText}>
                        Previsão: {injury.returnDate ?? injury.expectedReturn ?? `~${remaining} jogo${remaining !== 1 ? 's' : ''}`}
                      </Text>
                    )}
                  </View>
                </View>
              </>
            );
          })()}

          {isCustom && onSaveEdit && (
            <>
              <View style={styles.sheetDivider} />
              {!editMode ? (
                <TouchableOpacity
                  style={[styles.closeBtn, { borderColor: Colors.primary }]}
                  onPress={() => setEditMode(true)}
                >
                  <Text style={[styles.closeBtnText, { color: Colors.primary }]}>Editar jogador</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <Text style={styles.sheetSectionLabel}>Editar Jogador</Text>
                  <View style={[styles.addField]}>
                    <Text style={styles.addLabel}>Nome</Text>
                    <TextInput
                      style={styles.addInput}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Nome do jogador"
                      placeholderTextColor={Colors.mutedForeground}
                    />
                  </View>
                  <View style={[styles.addField]}>
                    <Text style={styles.addLabel}>Número da camisa</Text>
                    <TextInput
                      style={styles.addInput}
                      value={editNumber}
                      onChangeText={setEditNumber}
                      placeholder="Ex: 10"
                      placeholderTextColor={Colors.mutedForeground}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={[styles.addField]}>
                    <Text style={styles.addLabel}>OVR (1–99)</Text>
                    <View style={styles.ovrStepper}>
                      <TouchableOpacity style={styles.ovrStepBtn} onPress={() => setEditOvr((v) => Math.max(1, v - 1))}>
                        <Text style={styles.ovrStepTxt}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.ovrValue}>{editOvr}</Text>
                      <TouchableOpacity style={styles.ovrStepBtn} onPress={() => setEditOvr((v) => Math.min(99, v + 1))}>
                        <Text style={styles.ovrStepTxt}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.closeBtn, { flex: 1 }]}
                      onPress={() => {
                        setEditMode(false);
                        setEditName(player.name);
                        setEditNumber(player.number != null ? String(player.number) : '');
                        setEditOvr(player.overallRating ?? 75);
                      }}
                    >
                      <Text style={styles.closeBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, { flex: 1, paddingVertical: 14, opacity: saving ? 0.6 : 1 }]}
                      disabled={saving}
                      onPress={async () => {
                        setSaving(true);
                        try {
                          await onSaveEdit({
                            name: editName.trim() || player.name,
                            number: editNumber.trim() ? Number(editNumber.trim()) : null,
                            overallRating: editOvr,
                          });
                          setEditMode(false);
                        } catch {
                          Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      <Text style={styles.saveBtnText}>{saving ? 'Salvando…' : 'Salvar'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Fechar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function FormationModal({
  current,
  onSelect,
  onClose,
}: {
  current: FormationKey;
  onSelect: (k: FormationKey) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheetContainer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.modalTitle}>Escolher Formação</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            {FORMATION_GROUPS.map((group) => (
              <View key={group.label}>
                <Text style={styles.formationGroupLabel}>{group.label}</Text>
                <View style={styles.formationGrid}>
                  {group.formations.map((f) => (
                    <TouchableOpacity
                      key={f.key}
                      style={[
                        styles.formationChip,
                        current === f.key && styles.formationChipActive,
                      ]}
                      onPress={() => { onSelect(f.key); onClose(); }}
                    >
                      <Text style={[styles.formationChipText, current === f.key && styles.formationChipTextActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function PlayerPickerModal({
  players,
  excludeIds,
  onSelect,
  onClose,
}: {
  players: SquadPlayer[];
  excludeIds: number[];
  onSelect: (p: SquadPlayer) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
  const available = players.filter(
    (p) => !excludeIds.includes(p.id) &&
      (search.trim() === '' || p.name.toLowerCase().includes(search.toLowerCase())),
  );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.pickerContainer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.modalTitle}>Selecionar Jogador</Text>
          <View style={styles.pickerSearch}>
            <Ionicons name="search-outline" size={16} color={Colors.mutedForeground} />
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="Buscar..."
              placeholderTextColor={Colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
          <FlatList
            data={available}
            keyExtractor={(p) => String(p.id)}
            style={{ maxHeight: 340 }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const cfg = POS_CONFIG[item.positionPtBr] ?? POS_CONFIG.MID;
              return (
                <TouchableOpacity style={styles.pickerRow} onPress={() => { onSelect(item); onClose(); }}>
                  <PlayerPhoto src={item.photo} name={item.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.playerAge}>{item.age} anos{item.number != null ? ` · #${item.number}` : ''}</Text>
                  </View>
                  <View style={[styles.posBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.posBadgeText, { color: cfg.color }]}>{item.positionPtBr}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function AddPlayerSheet({
  careerId,
  onSaved,
  onClose,
}: {
  careerId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [pos, setPos] = useState<PosFilter>('MID');
  const [age, setAge] = useState('');
  const [ovr, setOvr] = useState(75);
  const [number, setNumber] = useState('');
  const [photo, setPhoto] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length > 1;

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
        setPhotoBase64(`data:image/jpeg;base64,${asset.base64}`);
        setPhoto('');
      } else if (asset.uri) {
        setPhoto(asset.uri);
        setPhotoBase64('');
      }
    }
  };

  const displayPhoto = photoBase64 || photo.trim();

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await api.careers.addManualPlayer(careerId, {
        name: name.trim(),
        age: parseInt(age, 10) || 20,
        position: pos,
        positionPtBr: pos,
        overallRating: ovr,
        number: number ? parseInt(number, 10) : undefined,
        photo: displayPhoto || '',
      });
      onSaved();
      onClose();
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar o jogador. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheetContainer, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Adicionar Jogador</Text>

            <View style={styles.addField}>
              <Text style={styles.addLabel}>Nome *</Text>
              <TextInput
                style={styles.addInput}
                value={name}
                onChangeText={setName}
                placeholder="Nome do jogador"
                placeholderTextColor={Colors.mutedForeground}
              />
            </View>

            <View style={styles.addRow}>
              <View style={[styles.addField, { flex: 1 }]}>
                <Text style={styles.addLabel}>Posição</Text>
                <View style={styles.posRow}>
                  {POSITIONS.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.posPill, pos === p && { backgroundColor: POS_CONFIG[p].bg, borderColor: POS_CONFIG[p].color }]}
                      onPress={() => setPos(p)}
                    >
                      <Text style={[styles.posPillText, pos === p && { color: POS_CONFIG[p].color }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.addRow}>
              <View style={[styles.addField, { flex: 1 }]}>
                <Text style={styles.addLabel}>Idade</Text>
                <TextInput
                  style={styles.addInput}
                  value={age}
                  onChangeText={setAge}
                  placeholder="20"
                  placeholderTextColor={Colors.mutedForeground}
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.addField, { flex: 1 }]}>
                <Text style={styles.addLabel}>OVR (1–99)</Text>
                <View style={styles.ovrStepper}>
                  <TouchableOpacity
                    style={styles.ovrStepBtn}
                    onPress={() => setOvr((v) => Math.max(1, v - 1))}
                  >
                    <Text style={styles.ovrStepTxt}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.ovrValue}>{ovr}</Text>
                  <TouchableOpacity
                    style={styles.ovrStepBtn}
                    onPress={() => setOvr((v) => Math.min(99, v + 1))}
                  >
                    <Text style={styles.ovrStepTxt}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.addField, { flex: 1 }]}>
                <Text style={styles.addLabel}>Camisa</Text>
                <TextInput
                  style={styles.addInput}
                  value={number}
                  onChangeText={setNumber}
                  placeholder="9"
                  placeholderTextColor={Colors.mutedForeground}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.addField}>
              <Text style={styles.addLabel}>Foto</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {displayPhoto ? (
                  <Image source={{ uri: displayPhoto }} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.muted }} />
                ) : (
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.muted, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="person" size={24} color={Colors.mutedForeground} />
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.closeBtn, { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }]}
                  onPress={pickPhoto}
                >
                  <Ionicons name="image-outline" size={18} color={Colors.mutedForeground} />
                  <Text style={styles.closeBtnText}>
                    {displayPhoto ? 'Trocar foto' : 'Escolher da galeria'}
                  </Text>
                </TouchableOpacity>
              </View>
              {!photoBase64 && (
                <TextInput
                  style={[styles.addInput, { marginTop: 6 }]}
                  value={photo}
                  onChangeText={(t) => { setPhoto(t); setPhotoBase64(''); }}
                  placeholder="ou cole uma URL de foto..."
                  placeholderTextColor={Colors.mutedForeground}
                  autoCapitalize="none"
                />
              )}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, !valid && { opacity: 0.4 }]}
              onPress={save}
              disabled={!valid || saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Salvar Jogador</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

function SeasonPickerModal({
  seasons,
  active,
  onSelect,
  onClose,
}: {
  seasons: Season[];
  active: Season | null;
  onSelect: (s: Season) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheetContainer, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.modalTitle}>Temporadas</Text>
          {seasons.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.seasonRow, s.id === active?.id && styles.seasonRowActive]}
              onPress={() => { onSelect(s); onClose(); }}
            >
              <Text style={[styles.seasonLabel, s.id === active?.id && styles.seasonLabelActive]}>{s.label}</Text>
              {s.isActive && <Text style={styles.seasonActivePill}>Ativa</Text>}
              {s.id === active?.id && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
            </TouchableOpacity>
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const SLOT = 52;
const PITCH_W = 320;
const PITCH_H = 420;

function SquadPitch({
  allPlayers,
  formation,
  lineup,
  onSlotPress,
}: {
  allPlayers: SquadPlayer[];
  formation: FormationKey;
  lineup: number[];
  onSlotPress: (slotIndex: number, currentPlayerId: number) => void;
}) {
  const [pitchW, setPitchW] = useState(300);
  const pitchH = pitchW * (PITCH_H / PITCH_W);
  const positions = getFormationPositions(formation);
  const playerMap = useMemo(() => {
    const m = new Map<number, SquadPlayer>();
    for (const p of allPlayers) m.set(p.id, p);
    return m;
  }, [allPlayers]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setPitchW(e.nativeEvent.layout.width);
  }, []);

  const scaleX = pitchW / PITCH_W;
  const scaleY = pitchH / PITCH_H;

  return (
    <View style={[styles.pitch, { height: pitchH }]} onLayout={onLayout}>
      {/* Field markings */}
      <View style={[styles.pitchLine, styles.halfwayLine, { top: pitchH / 2 - 1, width: pitchW }]} />
      <View style={[styles.pitchCircle, {
        width: pitchW * 0.35, height: pitchW * 0.35, borderRadius: pitchW * 0.175,
        top: pitchH / 2 - pitchW * 0.175, left: pitchW / 2 - pitchW * 0.175,
      }]} />
      <View style={[styles.pitchBox, {
        width: pitchW * 0.55, height: pitchH * 0.15,
        top: 0, left: pitchW * 0.225, borderBottomWidth: 1, borderTopWidth: 0,
      }]} />
      <View style={[styles.pitchBox, {
        width: pitchW * 0.55, height: pitchH * 0.15,
        bottom: 0, left: pitchW * 0.225, borderTopWidth: 1, borderBottomWidth: 0,
      }]} />

      {positions.map((coord, i) => {
        const [cx, cy] = coord;
        const pid = lineup[i] ?? 0;
        const player = pid ? playerMap.get(pid) : undefined;
        const cfg = player ? (POS_CONFIG[player.positionPtBr] ?? POS_CONFIG.MID) : null;
        const left = cx * scaleX - SLOT / 2;
        const top = cy * scaleY - SLOT / 2;

        return (
          <TouchableOpacity
            key={i}
            style={[styles.slotWrapper, { left, top }]}
            onPress={() => onSlotPress(i, pid)}
            activeOpacity={0.75}
          >
            {player ? (
              <View style={[styles.slotFilled, { borderColor: cfg?.color ?? '#888' }]}>
                <PlayerPhoto src={player.photo} name={player.name} size={SLOT - 4} />
              </View>
            ) : (
              <View style={styles.slotEmpty}>
                <Ionicons name="add" size={20} color="rgba(255,255,255,0.3)" />
              </View>
            )}
            {player && (
              <View style={styles.slotLabel}>
                <Text style={styles.slotName} numberOfLines={1}>
                  {player.name.split(' ')[0]}
                </Text>
                {player.overallRating != null && (
                  <Text style={styles.slotOvr}>{player.overallRating}</Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function SquadScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, activeSeason, setActiveSeason } = useCareer();
  const theme = useClubTheme();
  const qc = useQueryClient();

  const [tab, setTab] = useState<SquadTab>('campo');
  const [formation, setFormation] = useState<FormationKey>(DEFAULT_FORMATION);
  const [lineup, setLineup] = useState<number[]>(Array(11).fill(0));
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState<PosFilter>('Todos');
  const [selectedPlayer, setSelectedPlayer] = useState<SquadPlayer | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showFormation, setShowFormation] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);
  const [slotAction, setSlotAction] = useState<{ slotIndex: number; playerId: number } | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: squadData, isLoading: squadLoading } = useQuery({
    queryKey: ['/api/squad', activeCareer?.clubId],
    queryFn: () => activeCareer?.clubId ? api.squad.get(activeCareer.clubId) : null,
    enabled: !!activeCareer?.clubId,
    staleTime: 1000 * 60 * 30,
  });

  const { data: careerGameData, isLoading: careerDataLoading } = useQuery({
    queryKey: ['/api/data/career', activeCareer?.id],
    queryFn: () => activeCareer ? api.careerData.get(activeCareer.id) : null,
    enabled: !!activeCareer?.id,
  });

  const { data: seasonData } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: seasons } = useQuery({
    queryKey: ['/api/careers', activeCareer?.id, 'seasons'],
    queryFn: () => activeCareer ? api.careers.seasons(activeCareer.id) : null,
    enabled: !!activeCareer?.id,
  });

  const allPlayers = useMemo<SquadPlayer[]>(() => {
    const base = squadData?.players ?? [];
    const custom = careerGameData?.data?.customPlayers ?? [];
    const ids = new Set(base.map((p) => p.id));
    return [...base, ...custom.filter((p) => !ids.has(p.id))];
  }, [squadData, careerGameData]);

  const formerPlayers = useMemo<SquadPlayer[]>(
    () => (careerGameData?.data?.formerPlayers ?? []) as SquadPlayer[],
    [careerGameData],
  );

  useEffect(() => {
    setFormation((careerGameData?.data?.formation as FormationKey | undefined) ?? DEFAULT_FORMATION);
    setLineup(careerGameData?.data?.lineup ?? Array(11).fill(0));
  }, [careerGameData]);

  const statsMap = useMemo<Map<number, PlayerSeasonStats>>(() => {
    const map = new Map<number, PlayerSeasonStats>();
    for (const s of seasonData?.data?.player_stats ?? []) {
      map.set(s.playerId, s);
    }
    return map;
  }, [seasonData]);

  const injuryMap = useMemo<Map<number, InjuryRecord>>(() => {
    const map = new Map<number, InjuryRecord>();
    for (const inj of (seasonData?.data?.injuries ?? []) as InjuryRecord[]) {
      const remaining = Math.max(0, inj.matchesOut - (inj.matchesServed ?? 0));
      if (remaining > 0) map.set(inj.playerId, inj);
    }
    return map;
  }, [seasonData]);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPlayers.filter((p) => {
      const matchesPos = posFilter === 'Todos' || p.positionPtBr === posFilter;
      const matchesSearch = !q || p.name.toLowerCase().includes(q);
      return matchesPos && matchesSearch;
    });
  }, [allPlayers, search, posFilter]);

  const benchPlayers = useMemo(
    () => allPlayers.filter((p) => !lineup.includes(p.id)),
    [allPlayers, lineup],
  );

  const saveLineupAndFormation = useCallback(async (newLineup: number[], newFormation: FormationKey) => {
    if (!activeCareer) return;
    await api.careerData.set(activeCareer.id, 'lineup', newLineup);
    await api.careerData.set(activeCareer.id, 'formation', newFormation);
    await qc.invalidateQueries({ queryKey: ['/api/data/career', activeCareer.id] });
  }, [activeCareer, qc]);

  const handleFormationChange = useCallback((f: FormationKey) => {
    setFormation(f);
    saveLineupAndFormation(lineup, f);
  }, [lineup, saveLineupAndFormation]);

  const handleAutoFill = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newLineup = pickBestEleven(allPlayers, formation);
    setLineup(newLineup);
    saveLineupAndFormation(newLineup, formation);
  }, [allPlayers, formation, saveLineupAndFormation]);

  const handleSlotPress = useCallback((slotIndex: number, currentPlayerId: number) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    if (currentPlayerId) {
      setSlotAction({ slotIndex, playerId: currentPlayerId });
    } else {
      setPickerSlot(slotIndex);
    }
  }, []);

  const handleRemoveFromSlot = useCallback((slotIndex: number) => {
    const newLineup = [...lineup];
    newLineup[slotIndex] = 0;
    setLineup(newLineup);
    setSlotAction(null);
    saveLineupAndFormation(newLineup, formation);
  }, [lineup, formation, saveLineupAndFormation]);

  const handlePickerSelect = useCallback((player: SquadPlayer) => {
    if (pickerSlot === null) return;
    const newLineup = [...lineup];
    const existingSlot = newLineup.indexOf(player.id);
    const displaced = newLineup[pickerSlot];
    if (existingSlot !== -1) {
      newLineup[existingSlot] = displaced || 0;
    }
    newLineup[pickerSlot] = player.id;
    setLineup(newLineup);
    setPickerSlot(null);
    saveLineupAndFormation(newLineup, formation);
  }, [pickerSlot, lineup, formation, saveLineupAndFormation]);

  const motmCountMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const m of seasonData?.data?.matches ?? []) {
      if (m.motmPlayerId != null) {
        map.set(m.motmPlayerId, (map.get(m.motmPlayerId) ?? 0) + 1);
      }
    }
    return map;
  }, [seasonData]);

  const salaryMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const po of careerGameData?.data?.playerOverrides ?? []) {
      if (po.salary != null) map.set(po.playerId, po.salary);
    }
    return map;
  }, [careerGameData]);

  const handleSavePlayerEdit = useCallback(async (player: SquadPlayer, updates: { name?: string; number?: number | null; overallRating?: number }) => {
    if (!activeCareer) return;
    const customPlayers = careerGameData?.data?.customPlayers ?? [];
    const updated = customPlayers.map((p) =>
      p.id === player.id ? { ...p, ...updates } : p
    );
    await api.careerData.set(activeCareer.id, 'customPlayers', updated);
    await qc.invalidateQueries({ queryKey: ['/api/data/career', activeCareer.id] });
  }, [activeCareer, careerGameData, qc]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['/api/squad', activeCareer?.clubId] });
    await qc.invalidateQueries({ queryKey: ['/api/data/career', activeCareer?.id] });
    setRefreshing(false);
  }, [activeCareer, qc]);

  const isLoading = squadLoading || careerDataLoading;
  const lineupSet = new Set(lineup.filter((id) => id !== 0));

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Elenco</Text>
          {!isLoading && (
            <Text style={styles.subtitle}>{allPlayers.length} jogadores</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.statsNavBtn}
            onPress={() => router.push('/estatisticas')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="stats-chart-outline" size={18} color={Colors.mutedForeground} />
          </TouchableOpacity>
          {seasons && seasons.length > 1 && (
            <TouchableOpacity
              style={styles.seasonBtn}
              onPress={() => setShowSeasonPicker(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="calendar-outline" size={16} color={Colors.mutedForeground} />
              <Text style={styles.seasonBtnText} numberOfLines={1}>
                {activeSeason?.label ?? 'Temporada'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={Colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sub-tabs */}
      <View style={styles.subTabBar}>
        {(['campo', 'lista', 'saidas'] as SquadTab[]).map((t) => {
          const labels: Record<SquadTab, string> = { campo: 'Campo', lista: 'Lista', saidas: 'Saídas' };
          const active = t === tab;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.subTab, active && styles.subTabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.subTabText, active && styles.subTabTextActive]}>{labels[t]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!activeCareer ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Selecione uma carreira para ver o elenco.</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : (
        <>
          {tab === 'campo' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
              }
            >
              {/* Formation toolbar */}
              <View style={styles.formationToolbar}>
                <TouchableOpacity style={styles.formationBtn} onPress={() => setShowFormation(true)}>
                  <Ionicons name="grid-outline" size={16} color={theme.primary} />
                  <Text style={[styles.formationBtnText, { color: theme.primary }]}>{getFormationLabel(formation)}</Text>
                  <Ionicons name="chevron-down" size={14} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.autoBtn} onPress={handleAutoFill}>
                  <Ionicons name="flash" size={14} color="#fff" />
                  <Text style={styles.autoBtnText}>Auto</Text>
                </TouchableOpacity>
              </View>

              {/* Pitch */}
              <View style={styles.pitchWrapper}>
                <SquadPitch
                  allPlayers={allPlayers}
                  formation={formation}
                  lineup={lineup}
                  onSlotPress={handleSlotPress}
                />
              </View>

              {/* Bench */}
              <View style={styles.benchSection}>
                <Text style={styles.sectionTitle}>Banco ({benchPlayers.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.benchScroll}>
                  {benchPlayers.map((p) => {
                    const cfg = POS_CONFIG[p.positionPtBr] ?? POS_CONFIG.MID;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.benchCard}
                        onPress={() => setSelectedPlayer(p)}
                        activeOpacity={0.75}
                      >
                        <PlayerPhoto src={p.photo} name={p.name} size={40} />
                        <Text style={styles.benchName} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
                        <View style={[styles.posBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={[styles.posBadgeText, { color: cfg.color }]}>{p.positionPtBr}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {benchPlayers.length === 0 && (
                    <Text style={styles.emptyText}>Todos jogadores estão no XI.</Text>
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          )}

          {tab === 'lista' && (
            <View style={{ flex: 1 }}>
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color={Colors.mutedForeground} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar jogador..."
                  placeholderTextColor={Colors.mutedForeground}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={Colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {POSITION_FILTERS.map((p) => {
                  const active = posFilter === p;
                  const cfg = p !== 'Todos' ? POS_CONFIG[p] : null;
                  const ac = cfg?.color ?? theme.primary;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.filterChip, active && { backgroundColor: `${ac}22`, borderColor: `${ac}55` }]}
                      onPress={() => setPosFilter(p)}
                    >
                      <Text style={[styles.filterChipText, active && { color: ac }]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {filteredPlayers.length === 0 ? (
                <View style={styles.center}>
                  <Ionicons name="people-outline" size={48} color={Colors.mutedForeground} />
                  <Text style={styles.emptyText}>Nenhum jogador encontrado.</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredPlayers}
                  keyExtractor={(p) => String(p.id)}
                  contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
                  }
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                  renderItem={({ item }) => {
                    const stats = statsMap.get(item.id);
                    const posCfg = POS_CONFIG[item.positionPtBr] ?? POS_CONFIG.MID;
                    const inLu = lineupSet.has(item.id);
                    return (
                      <TouchableOpacity
                        style={styles.playerRow}
                        onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setSelectedPlayer(item); }}
                        activeOpacity={0.75}
                      >
                        <PlayerPhoto src={item.photo} name={item.name} size={44} />
                        <View style={styles.playerInfo}>
                          <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.playerAge}>{item.age} anos{item.number != null ? ` · #${item.number}` : ''}</Text>
                        </View>
                        <View style={styles.playerRight}>
                          {stats && stats.appearances > 0 && (
                            <Text style={[styles.ratingText, { color: ratingColor(stats.avgRating) }]}>
                              {stats.avgRating.toFixed(1)}
                            </Text>
                          )}
                          {inLu && (
                            <View style={styles.lineupDot} />
                          )}
                          <View style={[styles.posBadge, { backgroundColor: posCfg.bg }]}>
                            <Text style={[styles.posBadgeText, { color: posCfg.color }]}>{item.positionPtBr}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}

              {/* FAB */}
              <TouchableOpacity
                style={[styles.fab, { bottom: insets.bottom + 16, backgroundColor: theme.primary }]}
                onPress={() => setShowAddPlayer(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {tab === 'saidas' && (() => {
            const transfers: Transfer[] = seasonData?.data?.transfers ?? [];
            const outTransfers = transfers.filter((t) => t.type === 'out' || t.type === 'loan_out');
            const transferPlayerIds = new Set(outTransfers.map((t) => t.playerId));

            type ExitEntry = {
              key: string;
              name: string;
              positionPtBr: string;
              age: number;
              photo: string;
              reason: string;
              date: string;
              reasonColor: string;
            };

            const exitList: ExitEntry[] = [
              ...outTransfers.map((t) => ({
                key: `t-${t.id}`,
                name: t.playerName,
                positionPtBr: 'MID',
                age: 0,
                photo: '',
                reason: t.type === 'loan_out' ? 'Emprestado' : 'Vendido',
                date: t.date,
                reasonColor: t.type === 'loan_out' ? Colors.info : Colors.warning,
              })),
              ...formerPlayers
                .filter((p) => !transferPlayerIds.has(p.id))
                .map((p) => ({
                  key: `f-${p.id}`,
                  name: p.name,
                  positionPtBr: p.positionPtBr,
                  age: p.age,
                  photo: p.photo,
                  reason: 'Removido',
                  date: '—',
                  reasonColor: Colors.mutedForeground,
                })),
            ];

            return (
              <FlatList
                data={exitList}
                keyExtractor={(e) => e.key}
                contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.center}>
                    <Ionicons name="exit-outline" size={48} color={Colors.mutedForeground} />
                    <Text style={styles.emptyText}>Nenhum jogador saiu do elenco ainda.</Text>
                  </View>
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item }) => {
                  const posCfg = POS_CONFIG[item.positionPtBr] ?? POS_CONFIG.MID;
                  return (
                    <View style={styles.playerRow}>
                      <PlayerPhoto src={item.photo} name={item.name} size={44} />
                      <View style={styles.playerInfo}>
                        <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.playerAge}>{item.date !== '—' ? item.date : item.age > 0 ? `${item.age} anos` : '—'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.posBadge, { backgroundColor: `${item.reasonColor}22` }]}>
                          <Text style={[styles.posBadgeText, { color: item.reasonColor }]}>{item.reason}</Text>
                        </View>
                        <View style={[styles.posBadge, { backgroundColor: posCfg.bg }]}>
                          <Text style={[styles.posBadgeText, { color: posCfg.color }]}>{item.positionPtBr}</Text>
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            );
          })()}
        </>
      )}

      {selectedPlayer && (
        <PlayerBottomSheet
          player={selectedPlayer}
          stats={statsMap.get(selectedPlayer.id)}
          injury={injuryMap.get(selectedPlayer.id)}
          inLineup={lineupSet.has(selectedPlayer.id)}
          motmCount={motmCountMap.get(selectedPlayer.id)}
          salary={salaryMap.get(selectedPlayer.id)}
          onClose={() => setSelectedPlayer(null)}
          onSaveEdit={selectedPlayer.id < 0 ? (updates) => handleSavePlayerEdit(selectedPlayer, updates) : undefined}
        />
      )}

      {showFormation && (
        <FormationModal
          current={formation}
          onSelect={handleFormationChange}
          onClose={() => setShowFormation(false)}
        />
      )}

      {pickerSlot !== null && (
        <PlayerPickerModal
          players={allPlayers}
          excludeIds={pickerSlot !== null ? [lineup[pickerSlot]].filter(Boolean) : []}
          onSelect={handlePickerSelect}
          onClose={() => setPickerSlot(null)}
        />
      )}

      {showAddPlayer && activeCareer && (
        <AddPlayerSheet
          careerId={activeCareer.id}
          onSaved={() => qc.invalidateQueries({ queryKey: ['/api/data/career', activeCareer.id] })}
          onClose={() => setShowAddPlayer(false)}
        />
      )}

      {showSeasonPicker && seasons && (
        <SeasonPickerModal
          seasons={seasons}
          active={activeSeason}
          onSelect={setActiveSeason}
          onClose={() => setShowSeasonPicker(false)}
        />
      )}

      {slotAction && (() => {
        const player = allPlayers.find((p) => p.id === slotAction.playerId);
        return (
          <Modal transparent animationType="fade" visible onRequestClose={() => setSlotAction(null)}>
            <Pressable style={styles.slotOverlay} onPress={() => setSlotAction(null)}>
              <Pressable style={styles.slotSheet} onPress={(e) => e.stopPropagation()}>
                <Text style={styles.slotSheetTitle}>{player?.name ?? 'Jogador'}</Text>
                <TouchableOpacity
                  style={styles.slotAction}
                  onPress={() => { setSlotAction(null); if (player) setSelectedPlayer(player); }}
                >
                  <Ionicons name="person-outline" size={20} color={Colors.foreground} />
                  <Text style={styles.slotActionText}>Ver detalhes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.slotAction}
                  onPress={() => { setPickerSlot(slotAction.slotIndex); setSlotAction(null); }}
                >
                  <Ionicons name="swap-horizontal-outline" size={20} color={Colors.foreground} />
                  <Text style={styles.slotActionText}>Trocar jogador</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.slotAction}
                  onPress={() => handleRemoveFromSlot(slotAction.slotIndex)}
                >
                  <Ionicons name="remove-circle-outline" size={20} color={Colors.destructive} />
                  <Text style={[styles.slotActionText, { color: Colors.destructive }]}>Remover do XI</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.slotCancel} onPress={() => setSlotAction(null)}>
                  <Text style={styles.slotCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statsNavBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  seasonBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  seasonBtnText: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', maxWidth: 100 },
  subTabBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  subTab: {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  subTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  subTabText: { fontSize: 13, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  subTabTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  formationToolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
  },
  formationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Colors.radius, paddingHorizontal: 12, paddingVertical: 8,
  },
  formationBtnText: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', flex: 1 },
  autoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, borderRadius: Colors.radius,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  autoBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },

  pitchWrapper: { marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', marginBottom: 4 },
  pitch: {
    backgroundColor: '#1a5c2a', position: 'relative', overflow: 'hidden',
  },
  pitchLine: { position: 'absolute', height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  halfwayLine: {},
  pitchCircle: {
    position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'transparent',
  },
  pitchBox: {
    position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'transparent',
  },
  slotWrapper: {
    position: 'absolute', width: SLOT, alignItems: 'center',
  },
  slotFilled: {
    width: SLOT, height: SLOT, borderRadius: SLOT / 2,
    borderWidth: 2, overflow: 'hidden', backgroundColor: Colors.card,
  },
  slotEmpty: {
    width: SLOT, height: SLOT, borderRadius: SLOT / 2,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  slotLabel: {
    marginTop: 3, backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, maxWidth: 64,
  },
  slotName: { fontSize: 9, color: '#fff', fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  slotOvr: { fontSize: 8, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_400Regular', textAlign: 'center' },

  benchSection: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 10 },
  benchScroll: { gap: 10, paddingVertical: 4 },
  benchCard: {
    alignItems: 'center', gap: 5, width: 64,
    backgroundColor: Colors.card, borderRadius: Colors.radius, borderWidth: 1, borderColor: Colors.border,
    padding: 8,
  },
  benchName: { fontSize: 10, color: Colors.foreground, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12,
    height: 44, backgroundColor: Colors.card,
    borderRadius: Colors.radius, borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  searchIcon: {},
  searchInput: { flex: 1, color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  filterChipText: { fontSize: 13, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  photoFallback: { backgroundColor: 'rgba(139,92,246,0.15)', alignItems: 'center', justifyContent: 'center' },
  photoInitials: { fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 15, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  playerAge: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  playerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontSize: 13, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  lineupDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  posBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  posBadgeText: { fontSize: 11, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 56 },
  fab: {
    position: 'absolute', right: 20, width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  sheetContainer: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
  },
  pickerContainer: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: '80%',
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: {
    fontSize: 16, fontWeight: '700' as const, color: Colors.foreground,
    fontFamily: 'Inter_700Bold', marginBottom: 16, textAlign: 'center',
  },
  sheetHeader: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 20 },
  sheetPlayerInfo: { flex: 1 },
  sheetNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sheetPlayerName: { fontSize: 18, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold', flexShrink: 1 },
  lineupBadge: { backgroundColor: `${Colors.success}22`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  lineupBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.success, fontFamily: 'Inter_600SemiBold' },
  sheetBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  shirtNum: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  ageText: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  sheetDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 16 },
  sheetSectionLabel: {
    fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground,
    textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Inter_600SemiBold', marginBottom: 12,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  statCell: {
    flex: 1, minWidth: '28%', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Colors.radius, borderWidth: 1, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  closeBtn: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Colors.radius,
    paddingVertical: 14, alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  injuryBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: Colors.radius, borderWidth: 1, padding: 12, marginBottom: 4,
  },
  injuryStatusText: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  injuryReturnText: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },

  formationGroupLabel: {
    fontSize: 12, fontWeight: '600' as const, color: Colors.mutedForeground,
    textTransform: 'uppercase', letterSpacing: 0.7, fontFamily: 'Inter_600SemiBold', marginTop: 12, marginBottom: 8,
  },
  formationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formationChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: Colors.border,
  },
  formationChipActive: { backgroundColor: `${Colors.primary}22`, borderColor: Colors.primary },
  formationChipText: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  formationChipTextActive: { color: Colors.primary, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },

  pickerSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Colors.border,
    borderRadius: Colors.radius, paddingHorizontal: 12, height: 40, marginBottom: 12,
  },
  pickerSearchInput: { flex: 1, color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },

  addField: { marginBottom: 12 },
  addRow: { flexDirection: 'row', gap: 10 },
  addLabel: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  addInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Colors.border,
    borderRadius: Colors.radius, paddingHorizontal: 12, height: 42,
    color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14,
  },
  posRow: { flexDirection: 'row', gap: 6 },
  posPill: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  posPillText: { fontSize: 12, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Colors.radius,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },

  seasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  seasonRowActive: { backgroundColor: `${Colors.primary}0A` },
  seasonLabel: { flex: 1, fontSize: 15, color: Colors.foreground, fontFamily: 'Inter_400Regular' },
  seasonLabelActive: { color: Colors.primary, fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const },
  seasonActivePill: {
    fontSize: 11, color: Colors.success, fontFamily: 'Inter_600SemiBold',
    backgroundColor: `${Colors.success}18`, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },

  slotOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  slotSheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32,
  },
  slotSheetTitle: {
    fontSize: 16, fontWeight: '700' as const, color: Colors.foreground,
    fontFamily: 'Inter_700Bold', textAlign: 'center', paddingVertical: 12,
    marginBottom: 4, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  slotAction: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: `${Colors.border}55`,
  },
  slotActionText: {
    fontSize: 15, color: Colors.foreground, fontFamily: 'Inter_400Regular',
  },
  slotCancel: {
    marginTop: 12, paddingVertical: 12, borderRadius: Colors.radius,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center',
  },
  slotCancelText: {
    fontSize: 15, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const,
  },

  ovrStepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Colors.border,
    borderRadius: Colors.radius, height: 42, overflow: 'hidden',
  },
  ovrStepBtn: {
    width: 40, height: 42, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ovrStepTxt: { fontSize: 20, color: Colors.foreground, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  ovrValue: {
    flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' as const,
    color: Colors.primary, fontFamily: 'Inter_700Bold',
  },
});
