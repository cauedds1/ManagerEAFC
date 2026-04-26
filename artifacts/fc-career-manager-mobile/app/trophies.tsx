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
import { api, type Trophy } from '@/lib/api';
import { Colors } from '@/constants/colors';

const TROPHY_TYPES = [
  { key: 'league', label: 'Liga', icon: '🏆' },
  { key: 'cup', label: 'Copa', icon: '🥇' },
  { key: 'supercup', label: 'Supercopa', icon: '🌟' },
  { key: 'continental', label: 'Continental', icon: '⭐' },
  { key: 'champions', label: 'Champions', icon: '✨' },
  { key: 'other', label: 'Outro', icon: '🏅' },
];

const TROPHY_ICONS: Record<string, string> = {
  league: '🏆', cup: '🥇', supercup: '🌟', continental: '⭐',
  champions: '✨', other: '🏅', default: '🏅',
};

function trophyIcon(type?: string, name?: string): string {
  if (type && TROPHY_ICONS[type]) return TROPHY_ICONS[type];
  if (!name) return TROPHY_ICONS.default;
  const lower = name.toLowerCase();
  if (lower.includes('liga') || lower.includes('league') || lower.includes('campeonat')) return TROPHY_ICONS.league;
  if (lower.includes('copa') || lower.includes('cup')) return TROPHY_ICONS.cup;
  if (lower.includes('super')) return TROPHY_ICONS.supercup;
  if (lower.includes('champion') || lower.includes('uefa')) return TROPHY_ICONS.champions;
  return TROPHY_ICONS.default;
}

function genId(): string {
  return `trophy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

interface TrophyGroup { name: string; trophies: Trophy[] }

function groupTrophies(trophies: Trophy[]): TrophyGroup[] {
  const map = new Map<string, Trophy[]>();
  for (const t of trophies) {
    const key = t.name;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return [...map.entries()]
    .map(([name, ts]) => ({ name, trophies: ts }))
    .sort((a, b) => b.trophies.length - a.trophies.length);
}

function AddTrophyModal({
  visible, activeSeasonLabel, onClose, onSave,
}: {
  visible: boolean;
  activeSeasonLabel: string;
  onClose: () => void;
  onSave: (t: Omit<Trophy, 'id'>) => void;
}) {
  const theme = useClubTheme();
  const [name, setName] = useState('');
  const [season, setSeason] = useState(activeSeasonLabel);
  const [type, setType] = useState('league');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), season: season.trim() || activeSeasonLabel, type });
    setName('');
    setSeason(activeSeasonLabel);
    setType('league');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Novo Troféu</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>NOME DA CONQUISTA</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Ex: Premier League, Copa do Brasil…"
                placeholderTextColor={Colors.mutedForeground}
                autoFocus
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>TEMPORADA</Text>
              <TextInput
                style={styles.textInput}
                value={season}
                onChangeText={setSeason}
                placeholder="Ex: 2024/25"
                placeholderTextColor={Colors.mutedForeground}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>TIPO</Text>
              <View style={styles.typeGrid}>
                {TROPHY_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[
                      styles.typeBtn,
                      type === t.key && { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.4)` },
                    ]}
                    onPress={() => setType(t.key)}
                  >
                    <Text style={styles.typeBtnIcon}>{t.icon}</Text>
                    <Text style={[styles.typeBtnLabel, type === t.key && { color: theme.primary }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.2)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }, !name.trim() && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!name.trim()}
            >
              <Text style={[styles.saveBtnText, { color: theme.primary }]}>Salvar Troféu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function TrophiesScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, activeSeason } = useCareer();
  const theme = useClubTheme();
  const qc = useQueryClient();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const [showAdd, setShowAdd] = useState(false);
  const [grouped, setGrouped] = useState(false);

  const { data: careerData, isLoading } = useQuery({
    queryKey: ['/api/data/career', activeCareer?.id],
    queryFn: () => activeCareer ? api.careerData.get(activeCareer.id) : null,
    enabled: !!activeCareer?.id,
    staleTime: 1000 * 60 * 5,
  });

  const trophies: Trophy[] = (careerData?.data?.trophies ?? []) as Trophy[];

  const saveMutation = useMutation({
    mutationFn: (updated: Trophy[]) => {
      if (!activeCareer) throw new Error('no career');
      return api.careerData.set(activeCareer.id, 'trophies', updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/data/career', activeCareer?.id] }),
  });

  const handleAdd = (data: Omit<Trophy, 'id'>) => {
    const newTrophy: Trophy = { ...data, id: genId() };
    saveMutation.mutate([...trophies, newTrophy]);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Excluir troféu', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: () => saveMutation.mutate(trophies.filter((t) => t.id !== id)),
      },
    ]);
  };

  const groups = useMemo(() => groupTrophies(trophies), [trophies]);

  const renderTrophy = ({ item, index }: { item: Trophy; index: number }) => {
    const icon = trophyIcon(item.type, item.name);
    const isGold = index === 0;
    const borderColor = isGold ? '#f59e0b' : index < 3 ? 'rgba(165,180,252,0.4)' : Colors.border;
    const iconBg = isGold ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.12)';
    return (
      <View style={[styles.card, { borderColor }]}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
          {item.season && <Text style={styles.cardSeason}>{item.season}</Text>}
        </View>
        {isGold && <Text style={styles.goldBadge}>⭐</Text>}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => item.id && handleDelete(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderGroup = ({ item, index }: { item: TrophyGroup; index: number }) => {
    const icon = trophyIcon(item.trophies[0].type, item.name);
    const isGold = index === 0;
    return (
      <View style={[styles.card, { borderColor: isGold ? '#f59e0b' : Colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: isGold ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.12)' }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.cardSeason} numberOfLines={1}>
            {item.trophies.map((t) => t.season).filter(Boolean).join(' · ')}
          </Text>
        </View>
        {item.trophies.length > 1 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{item.trophies.length}×</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Troféus</Text>
        <View style={styles.headerActions}>
          {trophies.length > 0 && (
            <TouchableOpacity
              style={[styles.headerBtn, grouped && { backgroundColor: `rgba(${theme.primaryRgb},0.15)` }]}
              onPress={() => setGrouped((g) => !g)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="layers-outline" size={20} color={grouped ? theme.primary : Colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowAdd(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : trophies.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 64 }}>🏆</Text>
          <Text style={styles.emptyTitle}>Vitrine vazia</Text>
          <Text style={styles.emptyText}>Toque em + para registrar sua primeira conquista!</Text>
        </View>
      ) : grouped ? (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.name}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<TrophyBanner count={trophies.length} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={renderGroup}
        />
      ) : (
        <FlatList
          data={trophies}
          keyExtractor={(item) => item.id ?? item.name}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<TrophyBanner count={trophies.length} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={renderTrophy}
        />
      )}

      <AddTrophyModal
        visible={showAdd}
        activeSeasonLabel={activeSeason?.label ?? ''}
        onClose={() => setShowAdd(false)}
        onSave={handleAdd}
      />
    </View>
  );
}

function TrophyBanner({ count }: { count: number }) {
  return (
    <View style={styles.headerBanner}>
      <Text style={styles.trophyCount}>{count}</Text>
      <Text style={styles.trophyCountLabel}>{count === 1 ? 'troféu conquistado' : 'troféus conquistados'}</Text>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 22 },
  list: { padding: 16 },
  headerBanner: {
    alignItems: 'center', paddingVertical: 24, gap: 4, marginBottom: 16,
    borderRadius: Colors.radiusLg, backgroundColor: 'rgba(245,158,11,0.06)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)',
  },
  trophyCount: { fontSize: 48, fontWeight: '700' as const, color: '#f59e0b', fontFamily: 'Inter_700Bold' },
  trophyCountLabel: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, padding: 14,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 28 },
  cardName: { fontSize: 15, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  cardSeason: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  goldBadge: { fontSize: 20 },
  deleteBtn: { padding: 6, borderRadius: 8 },
  countBadge: {
    backgroundColor: 'rgba(245,158,11,0.18)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  countBadgeText: { fontSize: 14, fontWeight: '700' as const, color: '#f59e0b', fontFamily: 'Inter_700Bold' },
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalSheet: {
    backgroundColor: Colors.backgroundLighter,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '88%',
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
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  modalBody: { padding: 20, gap: 20 },
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
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    width: '30.5%', alignItems: 'center', gap: 4,
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  typeBtnIcon: { fontSize: 22 },
  typeBtnLabel: { fontSize: 10, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  saveBtn: {
    borderRadius: Colors.radius, paddingVertical: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
});
