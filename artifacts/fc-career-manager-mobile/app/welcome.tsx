import { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { useT } from '@/lib/i18n';

export const WELCOME_SEEN_KEY = 'fc_welcome_seen';

export function getWelcomeSeenKey(userId?: string | number): string {
  return userId != null ? `fc_welcome_seen_${userId}` : WELCOME_SEEN_KEY;
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const t = useT();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 100 }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const persistSeen = async () => {
    try {
      const key = getWelcomeSeenKey(user?.id);
      if (Platform.OS === 'web') localStorage.setItem(key, '1');
      else await SecureStore.setItemAsync(key, '1');
    } catch {}
  };

  const handleStart = async () => {
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    await persistSeen();
    router.replace('/career-select');
  };

  const handleLogin = async () => {
    await persistSeen();
    router.replace('/(auth)');
  };

  const firstName = user?.name?.split(' ')[0] ?? t('landing.coachFallback');

  const FEATURES: Array<{ icon: keyof typeof Ionicons.glyphMap; titleKey: string; descKey: string; color: string }> = [
    { icon: 'sparkles-outline',     titleKey: 'landing.feature.ai.title',       descKey: 'landing.feature.ai.desc',       color: Colors.primary },
    { icon: 'newspaper-outline',    titleKey: 'landing.feature.news.title',     descKey: 'landing.feature.news.desc',     color: Colors.info },
    { icon: 'people-outline',       titleKey: 'landing.feature.community.title',descKey: 'landing.feature.community.desc',color: Colors.success },
    { icon: 'trophy-outline',       titleKey: 'landing.feature.trophies.title', descKey: 'landing.feature.trophies.desc', color: '#f59e0b' },
  ];

  const STEPS: Array<{ titleKey: string; descKey: string }> = [
    { titleKey: 'landing.step1.title', descKey: 'landing.step1.desc' },
    { titleKey: 'landing.step2.title', descKey: 'landing.step2.desc' },
    { titleKey: 'landing.step3.title', descKey: 'landing.step3.desc' },
  ];

  return (
    <LinearGradient
      colors={['rgba(139, 92, 246, 0.18)', 'rgba(139, 92, 246, 0.04)', Colors.background]}
      style={[styles.container, { paddingTop: insets.top + 24 }]}
    >
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <ScrollView
          contentContainerStyle={[styles.inner, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <View style={styles.logoWrap}>
              <Ionicons name="football" size={44} color={Colors.primary} />
            </View>
            <Text style={styles.kicker}>{t('landing.kicker')}</Text>
            <Text style={styles.title}>{t('landing.title')}</Text>
            <Text style={styles.heroName}>{firstName}</Text>
            <Text style={styles.subtitle}>{t('landing.subtitle')}</Text>
          </View>

          <View style={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <View key={f.titleKey} style={[styles.featureCard, { borderColor: `${f.color}25` }]}>
                <View style={[styles.featureIcon, { backgroundColor: `${f.color}18` }]}>
                  <Ionicons name={f.icon} size={20} color={f.color} />
                </View>
                <Text style={styles.featureLabel}>{t(f.titleKey)}</Text>
                <Text style={styles.featureDesc}>{t(f.descKey)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.stepsSection}>
            <Text style={styles.sectionLabel}>{t('landing.howItWorks')}</Text>
            {STEPS.map((s, i) => (
              <View key={s.titleKey} style={styles.stepRow}>
                <View style={styles.stepNumWrap}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{t(s.titleKey)}</Text>
                  <Text style={styles.stepDesc}>{t(s.descKey)}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.communityCard}>
            <View style={[styles.liveDot, { backgroundColor: Colors.success }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.communityTitle}>{t('landing.community.title')}</Text>
              <Text style={styles.communitySub}>{t('landing.community.sub')}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>{t('landing.cta.start')}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>

          {!user ? (
            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} activeOpacity={0.7}>
              <Text style={styles.loginBtnText}>{t('landing.cta.login')}</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingHorizontal: 20, gap: 18 },
  heroSection: { alignItems: 'center', gap: 6, marginTop: 4 },
  logoWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  kicker: {
    color: Colors.primary, fontSize: 11, fontWeight: '800' as const,
    letterSpacing: 1.6, textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  title: {
    fontSize: 26, fontWeight: '700' as const, color: Colors.foreground,
    fontFamily: 'Inter_700Bold', textAlign: 'center',
  },
  heroName: {
    fontSize: 30, fontWeight: '700' as const, color: Colors.primary,
    fontFamily: 'Inter_700Bold', marginTop: -4,
  },
  subtitle: {
    fontSize: 14, color: Colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center', lineHeight: 21, marginTop: 6,
    paddingHorizontal: 8,
  },
  featuresGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  featureCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, padding: 12, gap: 5,
  },
  featureIcon: {
    width: 36, height: 36, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  featureLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  featureDesc: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 15 },
  stepsSection: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 12,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '800' as const,
    color: Colors.mutedForeground, letterSpacing: 1.2,
    textTransform: 'uppercase', fontFamily: 'Inter_700Bold',
  },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumWrap: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: `${Colors.primary}22`,
    borderWidth: 1, borderColor: `${Colors.primary}55`,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNum: { color: Colors.primary, fontSize: 12, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  stepTitle: { color: Colors.foreground, fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  stepDesc: { color: Colors.mutedForeground, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  communityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: Colors.radius, padding: 12,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  communityTitle: { color: Colors.foreground, fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  communitySub: { color: Colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primary,
    borderRadius: Colors.radius, paddingVertical: 16,
    marginTop: 4,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  loginBtn: { alignItems: 'center', paddingVertical: 10 },
  loginBtnText: { color: Colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium' },
});
