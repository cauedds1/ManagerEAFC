import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, FlatList, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCareer } from '@/contexts/CareerContext';
import { api, type Club } from '@/lib/api';
import { getClubColors } from '@/lib/clubColors';
import { Colors } from '@/constants/colors';

type Step = 'club' | 'coach' | 'season';

const STEPS: Step[] = ['club', 'coach', 'season'];
const STEP_LABELS: Record<Step, string> = {
  club: 'Clube',
  coach: 'Treinador',
  season: 'Temporada',
};

export default function CareerCreateScreen() {
  const insets = useSafeAreaInsets();
  const { setActiveCareer, loadSeasons } = useCareer();
  const [step, setStep] = useState<Step>('club');
  const [search, setSearch] = useState('');
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [coachName, setCoachName] = useState('');
  const [seasonLabel, setSeasonLabel] = useState('Temporada 1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: clubsData, isLoading: clubsLoading } = useQuery({
    queryKey: ['/api/clubs'],
    queryFn: () => api.clubs.list(),
    staleTime: 1000 * 60 * 30,
  });

  const filteredClubs = useMemo(() => {
    if (!clubsData?.clubs) return [];
    if (!search.trim()) return clubsData.clubs.slice(0, 40);
    const q = search.toLowerCase();
    return clubsData.clubs
      .filter((c) => c.name.toLowerCase().includes(q) || (c.league ?? '').toLowerCase().includes(q))
      .slice(0, 40);
  }, [clubsData?.clubs, search]);

  const stepIndex = STEPS.indexOf(step);

  const goBack = () => {
    if (stepIndex === 0) {
      router.back();
    } else {
      setStep(STEPS[stepIndex - 1]);
    }
  };

  const handleClubSelect = (club: Club) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedClub(club);
    setStep('coach');
  };

  const handleCoachNext = () => {
    if (!coachName.trim()) {
      setError('Digite o nome do treinador');
      return;
    }
    setError('');
    setStep('season');
  };

  const handleCreate = async () => {
    if (!selectedClub || !coachName.trim() || !seasonLabel.trim()) {
      setError('Preencha todos os campos');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const clubColors = getClubColors(selectedClub.name);
      const { id } = await api.careers.create({
        coach: { name: coachName.trim() },
        clubId: selectedClub.id,
        clubName: selectedClub.name,
        clubLogo: selectedClub.logo,
        clubLeague: selectedClub.league,
        clubCountry: selectedClub.country,
        clubPrimary: clubColors.primary,
        clubSecondary: clubColors.secondary,
        season: seasonLabel.trim(),
      });

      const freshCareer = {
        id,
        coach: { name: coachName.trim() },
        clubId: selectedClub.id,
        clubName: selectedClub.name,
        clubLogo: selectedClub.logo,
        clubLeague: selectedClub.league,
        clubCountry: selectedClub.country,
        clubPrimary: clubColors.primary,
        clubSecondary: clubColors.secondary,
        season: seasonLabel.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await api.careers.createSeason(id, seasonLabel.trim(), true);

      setActiveCareer(freshCareer);
      await loadSeasons(id);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar carreira';
      setError(msg);
      setSaving(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Carreira</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                i < stepIndex
                  ? styles.stepDotDone
                  : i === stepIndex
                  ? styles.stepDotActive
                  : styles.stepDotInactive,
              ]}
            >
              {i < stepIndex ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : (
                <Text style={[styles.stepDotText, i === stepIndex && styles.stepDotTextActive]}>
                  {i + 1}
                </Text>
              )}
            </View>
            <Text style={[styles.stepLabel, i === stepIndex && styles.stepLabelActive]}>
              {STEP_LABELS[s]}
            </Text>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, i < stepIndex && styles.stepLineDone]} />
            )}
          </View>
        ))}
      </View>

      {/* Error */}
      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={14} color={Colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Step content */}
      {step === 'club' && (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Escolha o clube</Text>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={Colors.mutedForeground} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar clube ou liga..."
              placeholderTextColor={Colors.mutedForeground}
              autoCorrect={false}
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={Colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          {clubsLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
          ) : filteredClubs.length === 0 ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>Nenhum clube encontrado</Text>
              <Text style={styles.noResultsHint}>
                A lista de clubes é carregada automaticamente do servidor.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredClubs}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const colors = getClubColors(item.name);
                return (
                  <TouchableOpacity
                    style={styles.clubItem}
                    onPress={() => handleClubSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.clubColorDot, { backgroundColor: colors.primary }]} />
                    <View style={styles.clubItemText}>
                      <Text style={styles.clubItemName}>{item.name}</Text>
                      <Text style={styles.clubItemLeague}>{item.league}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      )}

      {step === 'coach' && (
        <ScrollView
          style={styles.stepContent}
          contentContainerStyle={[styles.formContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepTitle}>Seu treinador</Text>
          {selectedClub && (
            <View style={styles.selectedClubBadge}>
              <Ionicons name="football" size={14} color={Colors.primary} />
              <Text style={styles.selectedClubName}>{selectedClub.name}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Nome do treinador</Text>
            <TextInput
              style={styles.input}
              value={coachName}
              onChangeText={setCoachName}
              placeholder="Ex: José Mourinho"
              placeholderTextColor={Colors.mutedForeground}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleCoachNext}
            />
          </View>

          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleCoachNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Próximo</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 'season' && (
        <ScrollView
          style={styles.stepContent}
          contentContainerStyle={[styles.formContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepTitle}>Temporada inicial</Text>
          {selectedClub && (
            <View style={styles.selectedClubBadge}>
              <Ionicons name="football" size={14} color={Colors.primary} />
              <Text style={styles.selectedClubName}>{selectedClub.name} • {coachName}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Nome da temporada</Text>
            <TextInput
              style={styles.input}
              value={seasonLabel}
              onChangeText={setSeasonLabel}
              placeholder="Ex: Temporada 1, 2024/25"
              placeholderTextColor={Colors.mutedForeground}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <Text style={styles.fieldHint}>Você pode renomear e criar novas temporadas depois.</Text>
          </View>

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
                <Text style={styles.nextBtnText}>Criar carreira</Text>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.success },
  stepDotInactive: { backgroundColor: Colors.muted, borderWidth: 1, borderColor: Colors.border },
  stepDotText: { fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  stepDotTextActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginLeft: 4 },
  stepLabelActive: { color: Colors.primary, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  stepLine: { flex: 1, height: 1, backgroundColor: Colors.border, marginHorizontal: 6 },
  stepLineDone: { backgroundColor: Colors.success },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    backgroundColor: `rgba(239, 68, 68, 0.1)`,
    borderRadius: Colors.radiusSm,
    borderWidth: 1,
    borderColor: `rgba(239, 68, 68, 0.3)`,
  },
  errorText: { color: Colors.destructive, fontSize: 13, fontFamily: 'Inter_400Regular' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    gap: 8,
  },
  searchIcon: {},
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.foreground, fontFamily: 'Inter_400Regular' },
  noResults: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  noResultsText: { fontSize: 16, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  noResultsHint: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  clubColorDot: { width: 12, height: 12, borderRadius: 6 },
  clubItemText: { flex: 1 },
  clubItemName: { fontSize: 15, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  clubItemLeague: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  formContent: { paddingHorizontal: 20, paddingTop: 8 },
  selectedClubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `rgba(139, 92, 246, 0.1)`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    alignSelf: 'flex-start',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `rgba(139, 92, 246, 0.25)`,
  },
  selectedClubName: { fontSize: 13, color: Colors.primary, fontFamily: 'Inter_500Medium', fontWeight: '500' as const },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '500' as const, color: Colors.foregroundMuted, marginBottom: 6, fontFamily: 'Inter_500Medium' },
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
