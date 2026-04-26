import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, Modal, TextInput,
  ScrollView, Alert, Image, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type SquadPlayer, type MomentoMeta } from '@/lib/api';
import { Colors } from '@/constants/colors';

interface Momento extends MomentoMeta {
  localUri?: string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = (SCREEN_WIDTH - 16 * 2 - 8) / 2;

function genId(): string {
  return `mo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function uriCacheKey(seasonId: string): string {
  return `fc_momentos_uris_v1_${seasonId}`;
}

async function loadUriCache(seasonId: string): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(uriCacheKey(seasonId));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function saveUriCache(seasonId: string, cache: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(uriCacheKey(seasonId), JSON.stringify(cache));
}

function formatDate(raw: string): string {
  if (!raw.trim()) return '—';
  return raw.trim();
}

function PlayerInitials({ name, size = 28 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <View style={[piStyles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[piStyles.text, { fontSize: Math.max(8, size * 0.38) }]}>{initials}</Text>
    </View>
  );
}

const piStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139,92,246,0.25)' },
  text: { fontWeight: '700' as const, color: '#fff', fontFamily: 'Inter_700Bold' },
});

interface PlayerSelectorProps {
  squad: SquadPlayer[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}

function PlayerSelector({ squad, selectedIds, onToggle }: PlayerSelectorProps) {
  const [search, setSearch] = useState('');
  const theme = useClubTheme();

  const filtered = useMemo(() => {
    if (!search.trim()) return squad;
    return squad.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [squad, search]);

  return (
    <View style={psStyles.container}>
      <TextInput
        style={psStyles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Filtrar jogadores…"
        placeholderTextColor={Colors.mutedForeground}
      />
      <ScrollView style={psStyles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {filtered.map((p) => {
          const selected = selectedIds.includes(p.id);
          return (
            <TouchableOpacity
              key={p.id}
              style={[
                psStyles.row,
                selected && { backgroundColor: `rgba(${theme.primaryRgb},0.1)`, borderColor: `rgba(${theme.primaryRgb},0.3)` },
              ]}
              onPress={() => onToggle(p.id)}
            >
              <PlayerInitials name={p.name} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={[psStyles.name, selected && { color: theme.primary }]}>{p.name}</Text>
                <Text style={psStyles.pos}>{p.positionPtBr ?? p.position}</Text>
              </View>
              {selected && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const psStyles = StyleSheet.create({
  container: { gap: 8 },
  search: {
    backgroundColor: Colors.card, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, color: Colors.foreground, fontFamily: 'Inter_400Regular',
  },
  list: { maxHeight: 200 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 4,
  },
  name: { fontSize: 13, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  pos: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
});

interface AddModalProps {
  visible: boolean;
  squad: SquadPlayer[];
  onClose: () => void;
  onSave: (m: Omit<MomentoMeta, 'id' | 'createdAt'>, localUri: string) => Promise<void>;
}

function AddMomentoModal({ visible, squad, onClose, onSave }: AddModalProps) {
  const theme = useClubTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gameDate, setGameDate] = useState('');
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setDescription('');
    setGameDate('');
    setPickedUri(null);
    setSelectedPlayerIds([]);
    setShowPlayerPicker(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Permita acesso à galeria para escolher uma foto.');
      return;
    }
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.75,
      });
      if (!result.canceled && result.assets.length > 0) setPickedUri(result.assets[0].uri);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar a imagem.');
    } finally {
      setPicking(false);
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Permita acesso à câmera para tirar uma foto.');
      return;
    }
    setPicking(true);
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.75 });
      if (!result.canceled && result.assets.length > 0) setPickedUri(result.assets[0].uri);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a câmera.');
    } finally {
      setPicking(false);
    }
  };

  const togglePlayer = (id: number) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Atenção', 'Insira um título para o momento.'); return; }
    if (!pickedUri) { Alert.alert('Atenção', 'Selecione uma foto para o momento.'); return; }
    setSaving(true);
    try {
      await onSave(
        {
          title: title.trim(),
          description: description.trim(),
          gameDate: gameDate.trim(),
          playerIds: selectedPlayerIds.length > 0 ? selectedPlayerIds : undefined,
        },
        pickedUri,
      );
      reset();
      onClose();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o momento.');
    } finally {
      setSaving(false);
    }
  };

  const taggedPlayers = squad.filter((p) => selectedPlayerIds.includes(p.id));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Novo Momento</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {pickedUri ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: pickedUri }} style={styles.previewImage} resizeMode="cover" />
                <TouchableOpacity style={styles.previewRemoveBtn} onPress={() => setPickedUri(null)}>
                  <Ionicons name="close-circle" size={28} color={Colors.destructive} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoBtns}>
                <TouchableOpacity
                  style={[styles.photoBtn, { borderColor: `rgba(${theme.primaryRgb},0.3)` }]}
                  onPress={handlePickPhoto}
                  disabled={picking}
                >
                  {picking ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="images-outline" size={28} color={theme.primary} />}
                  <Text style={[styles.photoBtnText, { color: theme.primary }]}>Galeria</Text>
                </TouchableOpacity>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    style={[styles.photoBtn, { borderColor: 'rgba(255,255,255,0.12)' }]}
                    onPress={handleTakePhoto}
                    disabled={picking}
                  >
                    <Ionicons name="camera-outline" size={28} color={Colors.foreground} />
                    <Text style={[styles.photoBtnText, { color: Colors.foreground }]}>Câmera</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>TÍTULO *</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Gol da virada, Primeiro título…"
                placeholderTextColor={Colors.mutedForeground}
                autoFocus
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>DATA / JOGO</Text>
              <TextInput
                style={styles.textInput}
                value={gameDate}
                onChangeText={setGameDate}
                placeholder="Ex: 12/05/2025 ou Jornada 38"
                placeholderTextColor={Colors.mutedForeground}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>DESCRIÇÃO</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Descreva este momento especial…"
                placeholderTextColor={Colors.mutedForeground}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {squad.length > 0 && (
              <View style={styles.field}>
                <TouchableOpacity
                  style={styles.playerTagHeader}
                  onPress={() => setShowPlayerPicker(!showPlayerPicker)}
                >
                  <Text style={styles.fieldLabel}>JOGADORES ENVOLVIDOS</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {taggedPlayers.slice(0, 4).map((p) => (
                      <PlayerInitials key={p.id} name={p.name} size={24} />
                    ))}
                    {taggedPlayers.length > 4 && (
                      <Text style={styles.morePlayersText}>+{taggedPlayers.length - 4}</Text>
                    )}
                    <Ionicons
                      name={showPlayerPicker ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={Colors.mutedForeground}
                    />
                  </View>
                </TouchableOpacity>
                {showPlayerPicker && (
                  <PlayerSelector
                    squad={squad}
                    selectedIds={selectedPlayerIds}
                    onToggle={togglePlayer}
                  />
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: `rgba(${theme.primaryRgb},0.2)`, borderColor: `rgba(${theme.primaryRgb},0.4)` },
                saving && { opacity: 0.6 },
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={theme.primary} />
                : <Text style={[styles.saveBtnText, { color: theme.primary }]}>Salvar Momento</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface DetailModalProps {
  momento: Momento | null;
  squad: SquadPlayer[];
  onClose: () => void;
  onDelete: (id: string) => void;
}

function DetailModal({ momento, squad, onClose, onDelete }: DetailModalProps) {
  if (!momento) return null;
  const taggedPlayers = momento.playerIds
    ? squad.filter((p) => momento.playerIds!.includes(p.id))
    : [];

  return (
    <Modal visible={!!momento} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.detailOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.detailSheet}>
          {momento.localUri ? (
            <Image source={{ uri: momento.localUri }} style={styles.detailImage} resizeMode="contain" />
          ) : (
            <View style={[styles.detailImage, styles.detailImagePlaceholder]}>
              <Ionicons name="image-outline" size={48} color={Colors.mutedForeground} />
              <Text style={{ color: Colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 8 }}>
                Foto disponível apenas no dispositivo original
              </Text>
            </View>
          )}
          <ScrollView contentContainerStyle={styles.detailInfo}>
            <Text style={styles.detailTitle}>{momento.title}</Text>
            {momento.gameDate ? (
              <Text style={styles.detailDate}>🗓 {formatDate(momento.gameDate)}</Text>
            ) : null}
            {momento.description ? (
              <Text style={styles.detailDesc}>{momento.description}</Text>
            ) : null}
            {taggedPlayers.length > 0 && (
              <View style={styles.taggedPlayers}>
                {taggedPlayers.map((p) => (
                  <View key={p.id} style={styles.taggedPlayerChip}>
                    <PlayerInitials name={p.name} size={20} />
                    <Text style={styles.taggedPlayerName}>{p.name.split(' ')[0]}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.detailActions}>
              <TouchableOpacity onPress={onClose} style={styles.detailCloseBtn}>
                <Text style={styles.detailCloseBtnText}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Excluir momento', 'Tem certeza?', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Excluir', style: 'destructive', onPress: () => { onDelete(momento.id); onClose(); } },
                  ]);
                }}
                style={styles.detailDeleteBtn}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
                <Text style={styles.detailDeleteBtnText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          <TouchableOpacity style={styles.detailCloseIcon} onPress={onClose}>
            <Ionicons name="close" size={22} color={Colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function MomentosScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, activeSeason } = useCareer();
  const theme = useClubTheme();
  const qc = useQueryClient();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Momento | null>(null);
  const [uriCache, setUriCache] = useState<Record<string, string>>({});
  const [uriCacheLoaded, setUriCacheLoaded] = useState(false);

  const { data: squadData } = useQuery({
    queryKey: ['/api/squad', activeCareer?.clubId],
    queryFn: () => activeCareer ? api.squad.get(activeCareer.clubId) : null,
    enabled: !!activeCareer?.clubId,
    staleTime: 1000 * 60 * 10,
  });
  const squad: SquadPlayer[] = squadData?.players ?? [];

  const { data: seasonData, isLoading } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
  });

  const apiMomentos: MomentoMeta[] = (seasonData?.data?.momentos ?? []) as MomentoMeta[];

  useEffect(() => {
    if (!activeSeason?.id) return;
    setUriCacheLoaded(false);
    loadUriCache(activeSeason.id).then((cache) => {
      setUriCache(cache);
      setUriCacheLoaded(true);
    });
  }, [activeSeason?.id]);

  const momentos: Momento[] = useMemo(
    () => apiMomentos.map((m) => ({ ...m, localUri: uriCache[m.id] })),
    [apiMomentos, uriCache],
  );

  const saveMutation = useMutation({
    mutationFn: (updated: MomentoMeta[]) => {
      if (!activeSeason) throw new Error('no season');
      return api.seasonData.set(activeSeason.id, 'momentos', updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/data/season', activeSeason?.id] }),
  });

  const handleSave = useCallback(async (data: Omit<MomentoMeta, 'id' | 'createdAt'>, localUri: string) => {
    if (!activeSeason?.id) return;
    const newMeta: MomentoMeta = { ...data, id: genId(), createdAt: new Date().toISOString() };
    const updatedMetas = [newMeta, ...apiMomentos];
    await saveMutation.mutateAsync(updatedMetas);
    const newCache = { ...uriCache, [newMeta.id]: localUri };
    setUriCache(newCache);
    await saveUriCache(activeSeason.id, newCache);
  }, [activeSeason?.id, apiMomentos, uriCache, saveMutation]);

  const handleDelete = useCallback(async (id: string) => {
    if (!activeSeason?.id) return;
    const updatedMetas = apiMomentos.filter((m) => m.id !== id);
    await saveMutation.mutateAsync(updatedMetas);
    const newCache = { ...uriCache };
    delete newCache[id];
    setUriCache(newCache);
    await saveUriCache(activeSeason.id, newCache);
    setSelected(null);
  }, [activeSeason?.id, apiMomentos, uriCache, saveMutation]);

  const isDataLoading = isLoading || !uriCacheLoaded;

  const renderItem = ({ item }: { item: Momento }) => (
    <TouchableOpacity
      style={[styles.gridItem, { width: ITEM_SIZE, height: ITEM_SIZE }]}
      onPress={() => setSelected(item)}
      activeOpacity={0.85}
    >
      {item.localUri ? (
        <Image source={{ uri: item.localUri }} style={styles.gridImage} resizeMode="cover" />
      ) : (
        <View style={[styles.gridImage, styles.gridImagePlaceholder]}>
          <Ionicons name="image-outline" size={32} color={Colors.mutedForeground} />
        </View>
      )}
      <View style={styles.gridOverlay}>
        <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
        {item.gameDate ? (
          <Text style={styles.gridDate} numberOfLines={1}>{formatDate(item.gameDate)}</Text>
        ) : null}
        {item.playerIds && item.playerIds.length > 0 && (
          <View style={styles.gridPlayerRow}>
            {item.playerIds.slice(0, 3).map((id) => {
              const p = squad.find((s) => s.id === id);
              return p ? <PlayerInitials key={id} name={p.name} size={16} /> : null;
            })}
            {item.playerIds.length > 3 && (
              <Text style={styles.gridMorePlayers}>+{item.playerIds.length - 3}</Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Momentos</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {!activeSeason ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Nenhuma temporada ativa</Text>
        </View>
      ) : isDataLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : momentos.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 56 }}>📸</Text>
          <Text style={styles.emptyTitle}>Nenhum momento ainda</Text>
          <Text style={styles.emptyText}>Guarde fotos e memórias especiais da sua temporada.</Text>
          <TouchableOpacity
            style={[styles.emptyAddBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.3)` }]}
            onPress={() => setShowAdd(true)}
          >
            <Ionicons name="add" size={18} color={theme.primary} />
            <Text style={[styles.emptyAddBtnText, { color: theme.primary }]}>Adicionar momento</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={momentos}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          ListHeaderComponent={
            <Text style={styles.seasonLabel}>
              {activeSeason.label} · {momentos.length} {momentos.length === 1 ? 'momento' : 'momentos'}
            </Text>
          }
        />
      )}

      <AddMomentoModal
        visible={showAdd}
        squad={squad}
        onClose={() => setShowAdd(false)}
        onSave={handleSave}
      />

      <DetailModal
        momento={selected}
        squad={squad}
        onClose={() => setSelected(null)}
        onDelete={handleDelete}
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
  seasonLabel: {
    fontSize: 12, color: Colors.mutedForeground,
    fontFamily: 'Inter_400Regular', marginBottom: 12, paddingHorizontal: 4,
  },
  grid: { padding: 16 },
  row: { gap: 8, marginBottom: 8 },
  gridItem: { borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.card },
  gridImage: { width: '100%', height: '100%', position: 'absolute' },
  gridImagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  gridOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 8, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  gridTitle: { fontSize: 13, fontWeight: '600' as const, color: '#fff', fontFamily: 'Inter_600SemiBold', lineHeight: 18 },
  gridDate: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  gridPlayerRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  gridMorePlayers: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter_400Regular' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet: {
    backgroundColor: Colors.backgroundLighter,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '94%',
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
  modalTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  modalBody: { padding: 20, gap: 16 },
  photoBtns: { flexDirection: 'row', gap: 12 },
  photoBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 24, borderRadius: 16, borderWidth: 1.5, backgroundColor: Colors.card,
  },
  photoBtnText: { fontSize: 14, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  previewWrap: { borderRadius: 16, overflow: 'hidden', height: 200, position: 'relative' },
  previewImage: { width: '100%', height: '100%' },
  previewRemoveBtn: { position: 'absolute', top: 8, right: 8 },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground,
    textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Inter_600SemiBold',
  },
  playerTagHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  morePlayersText: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  textInput: {
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.foreground, fontFamily: 'Inter_400Regular',
  },
  textArea: { minHeight: 80, paddingTop: 12 },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn: { borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  detailOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.9)' },
  detailSheet: {
    backgroundColor: Colors.backgroundLighter,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '88%', overflow: 'hidden',
  },
  detailImage: { width: '100%', height: 280, backgroundColor: '#000' },
  detailImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  detailInfo: { padding: 20, gap: 8 },
  detailTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  detailDate: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  detailDesc: { fontSize: 14, color: Colors.foreground, fontFamily: 'Inter_400Regular', lineHeight: 22, opacity: 0.8 },
  taggedPlayers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  taggedPlayerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(139,92,246,0.12)', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)',
  },
  taggedPlayerName: { fontSize: 12, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  detailActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  detailCloseBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  detailCloseBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  detailDeleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, backgroundColor: `${Colors.destructive}15`,
    borderWidth: 1, borderColor: `${Colors.destructive}30`,
  },
  detailDeleteBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.destructive, fontFamily: 'Inter_600SemiBold' },
  detailCloseIcon: {
    position: 'absolute', top: 12, right: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
});
