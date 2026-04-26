import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type InjuryRecord } from '@/lib/api';
import { Colors } from '@/constants/colors';

function genId(): string {
  return `inj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function InjuryCard({
  item,
  onDischarge,
  onEdit,
}: {
  item: InjuryRecord;
  onDischarge: (i: InjuryRecord) => void;
  onEdit: (i: InjuryRecord) => void;
}) {
  const remaining = Math.max(0, item.matchesOut - (item.matchesServed ?? 0));
  const isRecovered = remaining === 0;
  const statusColor = isRecovered ? Colors.success : Colors.destructive;
  const position = item.playerPosition ?? item.position ?? null;

  return (
    <View style={[styles.card, isRecovered && styles.cardRecovered]}>
      <View style={[styles.cardLeft, { backgroundColor: isRecovered ? Colors.success : Colors.destructive }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.playerName}>{item.playerName}</Text>
            {position && <Text style={styles.positionText}>{position}</Text>}
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}30` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {isRecovered ? 'Recuperado' : 'Lesionado'}
            </Text>
          </View>
        </View>

        {item.injuryType ? (
          <Text style={styles.injuryType}>🩹 {item.injuryType}</Text>
        ) : null}

        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>
            <Text style={styles.metaLabel}>Fora: </Text>
            {item.matchesOut} {item.matchesOut === 1 ? 'jogo' : 'jogos'}
          </Text>
          {!isRecovered && (
            <Text style={[styles.metaText, { color: Colors.destructive }]}>
              <Text style={styles.metaLabel}>Restam: </Text>
              {remaining} jogo{remaining !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {!isRecovered && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(item)}>
              <Ionicons name="pencil-outline" size={14} color={Colors.mutedForeground} />
              <Text style={styles.editBtnText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dischargeBtn}
              onPress={() => onDischarge(item)}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
              <Text style={styles.dischargeBtnText}>Dar Alta</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

interface NewInjuryModalProps {
  visible: boolean;
  injury: InjuryRecord | null;
  onClose: () => void;
  onSave: (data: Partial<InjuryRecord> & { playerName: string }) => void;
}

function InjuryModal({ visible, injury, onClose, onSave }: NewInjuryModalProps) {
  const theme = useClubTheme();
  const isEdit = !!injury;
  const [playerName, setPlayerName] = useState(injury?.playerName ?? '');
  const [injuryType, setInjuryType] = useState(injury?.injuryType ?? '');
  const [matchesOut, setMatchesOut] = useState(String(injury?.matchesOut ?? ''));

  const handleSave = () => {
    const mo = parseInt(matchesOut, 10);
    if (!playerName.trim() || isNaN(mo) || mo < 1) return;
    onSave({
      playerName: playerName.trim(),
      injuryType: injuryType.trim() || 'Lesão',
      matchesOut: mo,
      matchesServed: injury?.matchesServed ?? 0,
      playerId: injury?.playerId ?? 0,
    });
    onClose();
  };

  const reset = () => {
    setPlayerName(injury?.playerName ?? '');
    setInjuryType(injury?.injuryType ?? '');
    setMatchesOut(String(injury?.matchesOut ?? ''));
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? 'Editar Lesão' : 'Nova Lesão'}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>NOME DO JOGADOR</Text>
              <TextInput
                style={styles.textInput}
                value={playerName}
                onChangeText={setPlayerName}
                placeholder="Nome do jogador"
                placeholderTextColor={Colors.mutedForeground}
                editable={!isEdit}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>TIPO DE LESÃO</Text>
              <TextInput
                style={styles.textInput}
                value={injuryType}
                onChangeText={setInjuryType}
                placeholder="Ex: Lesão muscular, Fratura…"
                placeholderTextColor={Colors.mutedForeground}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>JOGOS FORA</Text>
              <TextInput
                style={styles.textInput}
                value={matchesOut}
                onChangeText={setMatchesOut}
                placeholder="Ex: 3"
                placeholderTextColor={Colors.mutedForeground}
                keyboardType="number-pad"
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: `rgba(${theme.primaryRgb},0.2)`, borderColor: `rgba(${theme.primaryRgb},0.4)` },
                (!playerName.trim() || !matchesOut) && { opacity: 0.5 },
              ]}
              onPress={handleSave}
              disabled={!playerName.trim() || !matchesOut}
            >
              <Text style={[styles.saveBtnText, { color: theme.primary }]}>
                {isEdit ? 'Salvar Alterações' : 'Registrar Lesão'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function InjuriesScreen() {
  const insets = useSafeAreaInsets();
  const { activeSeason } = useCareer();
  const theme = useClubTheme();
  const qc = useQueryClient();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const [showModal, setShowModal] = useState(false);
  const [editingInjury, setEditingInjury] = useState<InjuryRecord | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['/api/data/season/injuries', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
    staleTime: 1000 * 60 * 5,
  });

  const injuries: InjuryRecord[] = (data?.data?.injuries ?? []) as InjuryRecord[];
  const active = injuries.filter((i) => (i.matchesServed ?? 0) < i.matchesOut);
  const recovered = injuries.filter((i) => (i.matchesServed ?? 0) >= i.matchesOut);

  const saveMutation = useMutation({
    mutationFn: (updated: InjuryRecord[]) => {
      if (!activeSeason) throw new Error('no season');
      return api.injuries.save(activeSeason.id, updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/data/season/injuries', activeSeason?.id] }),
  });

  const handleDischarge = (injury: InjuryRecord) => {
    Alert.alert(
      'Dar Alta',
      `Confirmar alta de ${injury.playerName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Dar Alta', style: 'default',
          onPress: () => {
            const updated = injuries.map((i) =>
              i.playerName === injury.playerName && i.matchesOut === injury.matchesOut
                ? { ...i, matchesServed: i.matchesOut }
                : i
            );
            saveMutation.mutate(updated);
          },
        },
      ]
    );
  };

  const handleEdit = (injury: InjuryRecord) => {
    setEditingInjury(injury);
    setShowModal(true);
  };

  const handleSaveInjury = (data: Partial<InjuryRecord> & { playerName: string }) => {
    if (editingInjury) {
      const updated = injuries.map((i) =>
        i.playerName === editingInjury.playerName && i.matchesOut === editingInjury.matchesOut
          ? { ...i, ...data }
          : i
      );
      saveMutation.mutate(updated);
    } else {
      const newInjury: InjuryRecord = {
        playerId: 0,
        playerName: data.playerName,
        injuryType: data.injuryType ?? 'Lesão',
        matchesOut: data.matchesOut ?? 1,
        matchesServed: 0,
        createdAt: Date.now(),
      };
      saveMutation.mutate([...injuries, newInjury]);
    }
    setEditingInjury(null);
  };

  const openNew = () => { setEditingInjury(null); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingInjury(null); };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Lesões</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openNew} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {active.length > 0 && (
        <View style={styles.alertBanner}>
          <Ionicons name="warning-outline" size={18} color={Colors.destructive} />
          <Text style={[styles.alertText, { color: Colors.destructive }]}>
            {active.length} jogador{active.length !== 1 ? 'es' : ''} lesionado{active.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : injuries.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🏥</Text>
          <Text style={styles.emptyTitle}>Sem lesões</Text>
          <Text style={styles.emptyText}>Toque em + para registrar uma lesão.</Text>
        </View>
      ) : (
        <FlatList
          data={injuries}
          keyExtractor={(item, i) => `${item.playerName}_${i}`}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: Colors.destructive }]}>{active.length}</Text>
                <Text style={styles.statLbl}>Ativos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: Colors.success }]}>{recovered.length}</Text>
                <Text style={styles.statLbl}>Recuperados</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{injuries.length}</Text>
                <Text style={styles.statLbl}>Total</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <InjuryCard
              item={item}
              onDischarge={handleDischarge}
              onEdit={handleEdit}
            />
          )}
        />
      )}

      <InjuryModal
        visible={showModal}
        injury={editingInjury}
        onClose={closeModal}
        onSave={handleSaveInjury}
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
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 16, marginBottom: 0,
    padding: 12, borderRadius: Colors.radius,
    backgroundColor: `${Colors.destructive}12`,
    borderWidth: 1, borderColor: `${Colors.destructive}25`,
  },
  alertText: { fontSize: 14, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4,
  },
  statVal: { fontSize: 20, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  statLbl: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  list: { padding: 16, paddingTop: 16 },
  card: {
    flexDirection: 'row', backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg, borderWidth: 1,
    borderColor: `${Colors.destructive}30`, overflow: 'hidden',
  },
  cardRecovered: { borderColor: `${Colors.success}20`, opacity: 0.75 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  positionText: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  cardLeft: { width: 4 },
  cardContent: { flex: 1, padding: 14, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  playerName: { fontSize: 16, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  statusPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  statusText: { fontSize: 11, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  injuryType: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  cardMeta: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  metaLabel: { fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: Colors.border,
  },
  editBtnText: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  dischargeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: `${Colors.success}12`, borderWidth: 1, borderColor: `${Colors.success}30`,
  },
  dischargeBtnText: { fontSize: 12, color: Colors.success, fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet: {
    backgroundColor: Colors.backgroundLighter,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '80%',
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
  saveBtn: { borderRadius: Colors.radius, paddingVertical: 14, borderWidth: 1, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
});
