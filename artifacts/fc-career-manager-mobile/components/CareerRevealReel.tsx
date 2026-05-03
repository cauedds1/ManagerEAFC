import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, Animated, Easing, TouchableOpacity,
  Dimensions, Image, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useT } from '@/lib/i18n';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface CareerRevealReelProps {
  visible: boolean;
  onClose: () => void;
  clubName: string;
  clubLogoUrl?: string | null;
  coachName: string;
  coachPhotoUrl?: string | null;
  seasonLabel: string;
  accent?: string;
}

interface SceneDef {
  key: string;
  durationMs: number;
}

const SCENES: SceneDef[] = [
  { key: 'intro',   durationMs: 1300 },
  { key: 'club',    durationMs: 1700 },
  { key: 'coach',   durationMs: 1700 },
  { key: 'season',  durationMs: 1500 },
  { key: 'finale',  durationMs: 1800 },
];

export function CareerRevealReel({
  visible, onClose, clubName, clubLogoUrl, coachName, coachPhotoUrl,
  seasonLabel, accent = Colors.primary,
}: CareerRevealReelProps) {
  const t = useT();
  const [sceneIdx, setSceneIdx] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const progressAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const stopAll = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (inAnimRef.current) { inAnimRef.current.stop(); inAnimRef.current = null; }
    if (progressAnimRef.current) { progressAnimRef.current.stop(); progressAnimRef.current = null; }
  }, []);

  const animateIn = useCallback(() => {
    if (inAnimRef.current) inAnimRef.current.stop();
    opacity.setValue(0);
    scale.setValue(0.92);
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', damping: 18, stiffness: 120 }),
    ]);
    inAnimRef.current = anim;
    anim.start();
  }, [opacity, scale]);

  const advanceTo = useCallback((idx: number) => {
    stopAll();
    if (idx >= SCENES.length) {
      onClose();
      return;
    }
    setSceneIdx(idx);
    animateIn();
    progress.setValue(0);
    const progAnim = Animated.timing(progress, {
      toValue: 1,
      duration: SCENES[idx].durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressAnimRef.current = progAnim;
    progAnim.start();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    timeoutRef.current = setTimeout(() => advanceTo(idx + 1), SCENES[idx].durationMs);
  }, [animateIn, onClose, progress, stopAll]);

  useEffect(() => {
    if (!visible) {
      stopAll();
      setSceneIdx(0);
      return;
    }
    advanceTo(0);
    return () => { stopAll(); };
  }, [visible, advanceTo, stopAll]);

  const skip = () => {
    stopAll();
    onClose();
  };

  const tap = () => {
    advanceTo(sceneIdx + 1);
  };

  const scene = SCENES[sceneIdx]?.key ?? 'finale';
  const animStyle = { opacity, transform: [{ scale }] };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent onRequestClose={skip}>
      <TouchableOpacity activeOpacity={1} onPress={tap} style={styles.root}>
        <LinearGradient
          colors={[`${accent}33`, '#06060c', '#06060c']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Progress bars */}
        <View style={styles.progressRow}>
          {SCENES.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: accent,
                    width: i < sceneIdx ? '100%' : i === sceneIdx
                      ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                      : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.skipBtn} onPress={skip} hitSlop={10}>
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <Animated.View style={[styles.sceneContent, animStyle]}>
          {scene === 'intro' && (
            <>
              <Text style={[styles.kicker, { color: accent }]}>{t('reveal.kicker')}</Text>
              <Text style={styles.heroTitle}>{t('reveal.intro.title')}</Text>
              <Text style={styles.heroSub}>{t('reveal.intro.sub')}</Text>
            </>
          )}

          {scene === 'club' && (
            <>
              <Text style={[styles.kicker, { color: accent }]}>{t('reveal.club.kicker')}</Text>
              {clubLogoUrl ? (
                <Image source={{ uri: clubLogoUrl }} style={styles.crest} resizeMode="contain" />
              ) : (
                <View style={[styles.crestFallback, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
                  <Text style={[styles.crestInitial, { color: accent }]}>{clubName.charAt(0)}</Text>
                </View>
              )}
              <Text style={styles.heroTitle}>{clubName}</Text>
            </>
          )}

          {scene === 'coach' && (
            <>
              <Text style={[styles.kicker, { color: accent }]}>{t('reveal.coach.kicker')}</Text>
              {coachPhotoUrl ? (
                <Image source={{ uri: coachPhotoUrl }} style={styles.coachAvatar} />
              ) : (
                <View style={[styles.coachAvatarFallback, { borderColor: `${accent}55` }]}>
                  <Ionicons name="person" size={48} color="rgba(255,255,255,0.4)" />
                </View>
              )}
              <Text style={styles.heroTitle}>{coachName}</Text>
            </>
          )}

          {scene === 'season' && (
            <>
              <Text style={[styles.kicker, { color: accent }]}>{t('reveal.season.kicker')}</Text>
              <Text style={[styles.heroTitle, { color: accent }]}>{seasonLabel}</Text>
              <Text style={styles.heroSub}>{t('reveal.season.sub')}</Text>
            </>
          )}

          {scene === 'finale' && (
            <>
              <Text style={[styles.kicker, { color: accent }]}>{t('reveal.finale.kicker')}</Text>
              <Text style={styles.heroTitle}>{t('reveal.finale.title')}</Text>
              <Text style={styles.heroSub}>{coachName} · {clubName}</Text>
              <TouchableOpacity
                style={[styles.ctaBtn, { backgroundColor: accent }]}
                onPress={skip}
              >
                <Text style={styles.ctaText}>{t('reveal.finale.cta')}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        <Text style={styles.tapHint}>{t('reveal.tapHint')}</Text>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06060c', alignItems: 'center', justifyContent: 'center' },
  progressRow: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 16,
    padding: 6,
  },
  sceneContent: {
    width: SCREEN_W * 0.85,
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800' as const,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
    lineHeight: 38,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  crest: { width: 160, height: 160 },
  crestFallback: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  crestInitial: { fontSize: 64, fontWeight: '900' as const, fontFamily: 'Inter_700Bold' },
  coachAvatar: { width: 140, height: 140, borderRadius: 70 },
  coachAvatarFallback: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, marginTop: 8,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_600SemiBold' },
  tapHint: {
    position: 'absolute',
    bottom: 32,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});

void SCREEN_H; // mark used
