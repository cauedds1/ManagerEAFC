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

export function getWelcomeSeenKey(userId?: string | number): string {
  return userId != null ? `fc_welcome_seen_${userId}` : WELCOME_SEEN_KEY;
}

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
      const key = getWelcomeSeenKey(user?.id);
      if (Platform.OS === 'web') {
        localStorage.setItem(key, '1');
      } else {
        await SecureStore.setItemAsync(key, '1');
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

        {(() => {
          const plan = user?.plan ?? 'free';
          const planConfig: Record<string, { icon: 'star-outline' | 'star' | 'diamond'; color: string; label: string; hint: string }> = {
            free: {
              icon: 'star-outline',
              color: Colors.mutedForeground,
              label: 'Gratuito',
              hint: 'Upgrade para Pro ou Ultra para recursos avançados de IA e análise.',
            },
            pro: {
              icon: 'star',
              color: Colors.primary,
              label: 'Pro',
              hint: 'Você tem acesso à Diretoria IA, análises avançadas e múltiplas temporadas.',
            },
            ultra: {
              icon: 'diamond',
              color: '#f59e0b',
              label: 'Ultra',
              hint: 'Você tem acesso completo a todos os recursos premium do app.',
            },
          };
          const cfg = planConfig[plan] ?? planConfig.free;
          return (
            <View style={[styles.planBanner, { backgroundColor: `${cfg.color}10`, borderColor: `${cfg.color}30` }]}>
              <View style={[styles.planIconWrap, { backgroundColor: `${cfg.color}18` }]}>
                <Ionicons name={cfg.icon} size={18} color={cfg.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.planBadgeLabel, { color: cfg.color }]}>Plano {cfg.label}</Text>
                <Text style={styles.planBannerText}>{cfg.hint}</Text>
              </View>
            </View>
          );
        })()}

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
    gap: 10,
    borderRadius: Colors.radius,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  planIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  planBadgeLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  planBannerText: {
    fontSize: 12,
    color: Colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
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
