import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { Colors } from '@/constants/colors';

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useClubTheme();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Partidas</Text>
      </View>
      <View style={styles.empty}>
        <View style={[styles.iconWrap, { backgroundColor: `rgba(${theme.primaryRgb}, 0.12)` }]}>
          <Ionicons name="football-outline" size={40} color={theme.primary} />
        </View>
        <Text style={styles.emptyTitle}>Partidas em breve</Text>
        <Text style={styles.emptyText}>
          O gerenciamento completo de partidas estará disponível em breve.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  iconWrap: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
});
