import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useT } from '@/lib/i18n';
import { useOnboardingHint } from '@/hooks/useOnboardingHint';

interface CuriosityTeaserProps {
  /** Stable storage key (e.g. 'after_match_diretoria'). */
  triggerKey: string | null;
  /** Optional override accent. */
  accent?: string;
  onCta?: () => void;
  /**
   * i18n keys: `teaser.<triggerKey>.headline`, `.sub`, `.preview`, `.cta`.
   */
}

export function CuriosityTeaser({ triggerKey, accent = Colors.primary, onCta }: CuriosityTeaserProps) {
  const t = useT();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const [shouldShow, dismiss] = useOnboardingHint(triggerKey ? `teaser_${triggerKey}` : 'noop');

  const visible = !!triggerKey && shouldShow;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(translateY, { toValue: 20, duration: 250, useNativeDriver: Platform.OS !== 'web' }),
      ]).start(() => dismiss());
    }, 9000);
    return () => clearTimeout(timer);
  }, [visible, opacity, translateY, dismiss]);

  if (!visible || !triggerKey) return null;

  const headline = t(`teaser.${triggerKey}.headline`);
  const sub = t(`teaser.${triggerKey}.sub`);
  const preview = t(`teaser.${triggerKey}.preview`);
  const cta = t(`teaser.${triggerKey}.cta`);
  if (!headline || headline === `teaser.${triggerKey}.headline`) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ translateY }], borderColor: `${accent}33` },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.row}>
        <Text style={styles.headline} numberOfLines={2}>{headline}</Text>
        <TouchableOpacity onPress={dismiss} hitSlop={8}>
          <Ionicons name="close" size={14} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>
      {preview && preview !== `teaser.${triggerKey}.preview` ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewText} numberOfLines={2}>{preview}</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={[styles.cta, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}
        onPress={() => { onCta?.(); dismiss(); }}
        activeOpacity={0.85}
      >
        <Text style={[styles.ctaText, { color: accent }]} numberOfLines={1}>
          {cta && cta !== `teaser.${triggerKey}.cta` ? cta : t('common.discover')}
        </Text>
        <Ionicons name="arrow-forward" size={12} color={accent} />
      </TouchableOpacity>
      {sub && sub !== `teaser.${triggerKey}.sub` ? (
        <Text style={styles.subText}>{sub}</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    right: 12,
    width: 260,
    backgroundColor: 'rgba(14,12,24,0.97)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
    zIndex: 450,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headline: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 16,
  },
  previewBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  previewText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
    fontFamily: 'Inter_400Regular',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  ctaText: {
    fontSize: 11,
    fontWeight: '700' as const,
    fontFamily: 'Inter_600SemiBold',
  },
  subText: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 10,
    lineHeight: 13,
    fontFamily: 'Inter_400Regular',
  },
});
