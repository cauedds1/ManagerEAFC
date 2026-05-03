import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity, Platform } from 'react-native';
import { Colors } from '@/constants/colors';
import { useT } from '@/lib/i18n';

interface TickerItem {
  id: string;
  title: string;
  source?: string;
}

interface NewsTickerProps {
  items: TickerItem[];
  onPressItem?: (id: string) => void;
  accent?: string;
}

export function NewsTicker({ items, onPressItem, accent = Colors.primary }: NewsTickerProps) {
  const t = useT();
  const translateX = useRef(new Animated.Value(0)).current;

  const filtered = items.filter((i) => !!i.title);

  useEffect(() => {
    if (filtered.length === 0) return;
    const distance = filtered.length * 260;
    const duration = Math.max(8000, filtered.length * 4500);
    translateX.setValue(0);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: -distance,
        duration,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [filtered.length, translateX]);

  if (filtered.length === 0) return null;

  // duplicate for seamless loop
  const looped = [...filtered, ...filtered];

  return (
    <View style={[styles.container, { borderColor: `${accent}33` }]}>
      <View style={[styles.label, { backgroundColor: `${accent}22`, borderRightColor: `${accent}44` }]}>
        <Text style={[styles.labelText, { color: accent }]}>{t('news.ticker.label')}</Text>
      </View>
      <View style={styles.trackWrap}>
        <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
          {looped.map((item, idx) => (
            <TouchableOpacity
              key={`${item.id}-${idx}`}
              style={styles.item}
              activeOpacity={0.7}
              onPress={() => onPressItem?.(item.id)}
            >
              <View style={[styles.dot, { backgroundColor: accent }]} />
              <Text style={styles.itemText} numberOfLines={1}>
                {item.title}
              </Text>
              {item.source ? (
                <Text style={styles.sourceText} numberOfLines={1}>· {item.source}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  label: {
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
    fontFamily: 'Inter_700Bold',
  },
  trackWrap: { flex: 1, overflow: 'hidden', justifyContent: 'center' },
  track: { flexDirection: 'row', alignItems: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    maxWidth: 260,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  itemText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    fontFamily: 'Inter_500Medium',
    maxWidth: 200,
  },
  sourceText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
  },
});
