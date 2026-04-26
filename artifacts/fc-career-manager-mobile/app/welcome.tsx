import { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';

export const WELCOME_SEEN_KEY = 'fc_welcome_seen';

const FEATURES = [
  { icon: 'football-outline' as const, label: 'Partidas', desc: 'Registre resultados e estatísticas', color: Colors.primary },
  { icon: 'people-outline' as const, label: 'Elenco', desc: 'Gerencie seus jogadores', color: Colors.success },
  { icon: 'trophy-outline' as const, label: 'Troféus', desc: 'Conquistas e histórico', color: '#f59e0b' },
  { icon: 'stats-chart-outline' as const, label: 'Estatísticas', desc: 'Análise completa da temporada', color: Colors.info },
];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 100 }),
    ]).start();
  }, []);

  const handleStart = async () => {
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(WELCOME_SEEN_KEY, '1');
      } else {
        await SecureStore.setItemAsync(WELCOME_SEEN_KEY, '1');
      }
    } catch {}
    router.replace('/career-select');
  };

  const firstName = user?.name?.split(' ')[0] ?? 'Treinador';

  return (
    <LinearGradient
      colors={[`rgba(139, 92, 246, 0.18)`, `rgba(139, 92, 246, 0.04)`, Colors.background]}
      style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
    >
      <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.heroSection}>
          <View style={styles.logoWrap}>
            <Ionicons name="football" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Bem-vindo,</Text>
          <Text style={styles.name}>{firstName}!</Text>
          <Text style={styles.subtitle}>
            Gerencie sua carreira no FC Career Manager.{'\n'}Acompanhe cada detalhe da sua jornada.
          </Text>
        </View>

        <View style={styles.featuresGrid}>
          {FEATURES.map((f) => (
            <View key={f.label} style={[styles.featureCard, { borderColor: `${f.color}25` }]}>
              <View style={[styles.featureIcon, { backgroundColor: `${f.color}18` }]}>
                <Ionicons name={f.icon} size={22} color={f.color} />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

        {user?.plan === 'free' && (
          <View style={styles.planBanner}>
            <Ionicons name="rocket-outline" size={16} color="#f59e0b" />
            <Text style={styles.planBannerText}>
              Você está no plano <Text style={{ color: '#f59e0b', fontFamily: 'Inter_600SemiBold' }}>Gratuito</Text>.
              Upgrade para Pro ou Ultra para recursos avançados.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
          <Text style={styles.startBtnText}>Começar</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  heroSection: { alignItems: 'center', gap: 8, marginBottom: 8 },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  title: { fontSize: 28, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 32, fontWeight: '700' as const, color: Colors.primary, fontFamily: 'Inter_700Bold', marginTop: -4 },
  subtitle: {
    fontSize: 15,
    color: Colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 16,
  },
  featureCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  featureDesc: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  planBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: Colors.radius,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    padding: 12,
    marginBottom: 8,
  },
  planBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Colors.radius,
    paddingVertical: 16,
    marginTop: 8,
  },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
});
