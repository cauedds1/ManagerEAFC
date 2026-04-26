import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  RefreshControl, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useCareer } from '@/contexts/CareerContext';
import { api, type Career } from '@/lib/api';
import { getClubColors } from '@/lib/clubColors';
import { queryClient } from '@/lib/queryClient';
import { Colors } from '@/constants/colors';

function CareerCard({ career, onPress, onDelete }: {
  career: Career;
  onPress: () => void;
  onDelete: () => void;
}) {
  const [logoErr, setLogoErr] = useState(false);
  const colors = career.clubPrimary && career.clubSecondary
    ? { primary: career.clubPrimary, secondary: career.clubSecondary }
    : getClubColors(career.clubName);

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Excluir carreira no ${career.clubName}?`)) onDelete();
      return;
    }
    Alert.alert(
      'Excluir carreira',
      `Tem certeza que quer excluir a carreira no ${career.clubName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: `${colors.primary}35` }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Colored accent bar — primary → secondary gradient */}
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.cardAccent}
      />

      <View style={styles.cardBody}>
        <View style={styles.cardLeft}>
          {career.clubLogo && !logoErr ? (
            <Image
              source={{ uri: career.clubLogo }}
              style={styles.clubLogo}
              onError={() => setLogoErr(true)}
            />
          ) : (
            <View style={[styles.clubLogoFallback, { backgroundColor: `${colors.primary}25` }]}>
              <Ionicons name="football" size={22} color={colors.primary} />
            </View>
          )}
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.clubName} numberOfLines={1}>{career.clubName}</Text>
          <Text style={styles.leagueName} numberOfLines={1}>
            {career.clubLeague ?? 'Liga'}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={12} color={Colors.mutedForeground} />
            <Text style={styles.metaText} numberOfLines={1}>{career.coach?.name}</Text>
            <Text style={styles.separator}>•</Text>
            <Text style={styles.metaText}>{career.season}</Text>
          </View>
        </View>

        <View style={styles.cardRight}>
          <View style={[styles.badge, { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40` }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>Ativo</Text>
          </View>
          <TouchableOpacity
            onPress={handleDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CareerSelectScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { setActiveCareer, loadSeasons } = useCareer();
  const [refreshing, setRefreshing] = useState(false);

  const { data: careers = [], isLoading } = useQuery({
    queryKey: ['/api/careers'],
    queryFn: () => api.careers.list(),
    enabled: !!user,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['/api/careers'] });
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar as carreiras. Tente novamente.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleSelect = useCallback(async (career: Career) => {
    try {
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      setActiveCareer(career);
      router.replace('/(tabs)');
      await loadSeasons(career.id);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar a carreira. Tente novamente.');
    }
  }, [setActiveCareer, loadSeasons]);

  const handleDelete = useCallback(async (career: Career) => {
    try {
      await api.careers.delete(career.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['/api/careers'] }).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Erro', msg);
      }
    }
  }, []);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Minhas Carreiras</Text>
          <Text style={styles.subtitle}>{careers.length} carreira{careers.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push('/career-create')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newBtnText}>Nova</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : careers.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="football-outline" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Nenhuma carreira</Text>
          <Text style={styles.emptyText}>
            Comece criando sua primeira carreira como técnico.
          </Text>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => router.push('/career-create')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.createBtnText}>Criar carreira</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={careers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CareerCard
              career={item}
              onPress={() => handleSelect(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Colors.radius,
  },
  newBtnText: { color: '#fff', fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: `rgba(139, 92, 246, 0.12)`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 15, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: Colors.radius,
    marginTop: 8,
  },
  createBtnText: { color: '#fff', fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  list: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  cardLeft: {},
  clubLogo: { width: 48, height: 48, borderRadius: 8 },
  clubLogoFallback: { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1, gap: 2 },
  clubName: { fontSize: 15, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  leagueName: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  separator: { fontSize: 11, color: Colors.mutedForeground },
  cardRight: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  deleteBtn: { padding: 2 },
});
