import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type InjuryRecord } from '@/lib/api';
import { Colors } from '@/constants/colors';

function InjuryCard({ item }: { item: InjuryRecord }) {
  const remaining = Math.max(0, item.matchesOut - (item.matchesServed ?? 0));
  const isRecovered = remaining === 0;
  const statusColor = isRecovered ? Colors.success : Colors.destructive;
  const position = item.playerPosition ?? item.position ?? null;
  const returnInfo = item.returnDate ?? item.expectedReturn ?? null;

  return (
    <View style={[styles.card, isRecovered && styles.cardRecovered]}>
      <View style={[styles.cardLeft, { backgroundColor: isRecovered ? Colors.success : Colors.destructive }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.playerName}>{item.playerName}</Text>
            {position && (
              <Text style={styles.positionText}>{position}</Text>
            )}
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
          {returnInfo && (
            <Text style={[styles.metaText, { color: Colors.warning }]}>
              <Text style={styles.metaLabel}>Previsão: </Text>
              {returnInfo}
            </Text>
          )}
          {!isRecovered && !returnInfo && remaining > 0 && (
            <Text style={[styles.metaText, { color: Colors.mutedForeground }]}>
              <Text style={styles.metaLabel}>Previsão: </Text>
              ~{remaining} {remaining === 1 ? 'partida' : 'partidas'}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function InjuriesScreen() {
  const insets = useSafeAreaInsets();
  const { activeSeason } = useCareer();
  const theme = useClubTheme();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const { data, isLoading } = useQuery({
    queryKey: ['/api/data/season/injuries', activeSeason?.id],
    queryFn: () => activeSeason ? api.injuries.list(activeSeason.id) : [],
    enabled: !!activeSeason?.id,
    staleTime: 1000 * 60 * 5,
  });

  const injuries = data ?? [];
  const active = injuries.filter((i) => (i.matchesServed ?? 0) < i.matchesOut);
  const recovered = injuries.filter((i) => (i.matchesServed ?? 0) >= i.matchesOut);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Lesões</Text>
        <View style={{ width: 40 }} />
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
          <Text style={styles.emptyText}>Nenhuma lesão registrada nesta temporada.</Text>
        </View>
      ) : (
        <FlatList
          data={injuries}
          keyExtractor={(_, i) => String(i)}
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
          renderItem={({ item }) => <InjuryCard item={item} />}
        />
      )}
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
});
