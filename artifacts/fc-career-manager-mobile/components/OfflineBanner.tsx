import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        await fetch('https://www.google.com/generate_204', {
          method: 'HEAD',
          signal: ctrl.signal,
          cache: 'no-store',
        });
        clearTimeout(timer);
        if (!cancelled) setOnline(true);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };

    check();
    const interval = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return online;
}

export function OfflineBanner() {
  const online = useIsOnline();
  const opacity = useRef(new Animated.Value(online ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(online ? -40 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: online ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: online ? -40 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [online, opacity, translateY]);

  return (
    <Animated.View style={[styles.banner, { opacity, transform: [{ translateY }] }]} pointerEvents="none">
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <Text style={styles.text}>Sem conexão · dados em cache</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
  },
});
