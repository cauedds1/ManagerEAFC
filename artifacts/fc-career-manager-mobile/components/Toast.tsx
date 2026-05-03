import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { playNotificationSound } from '@/lib/notificationSound';

export type ToastType = 'diretoria' | 'noticias' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  preview?: string;
}

interface ToastCtx {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

const AUTO_DISMISS_MS = 5000;

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
    if (toast.type === 'diretoria') playNotificationSound('diretoria');
    else if (toast.type === 'noticias') playNotificationSound('noticias');
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View pointerEvents="box-none" style={styles.container}>
        {toasts.map((t) => (
          <SingleToast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function SingleToast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const slide = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 240, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, slide, opacity, onDismiss]);

  const accent = toast.type === 'diretoria' ? Colors.primary
    : toast.type === 'warning' ? '#f59e0b'
    : toast.type === 'noticias' ? '#a78bfa' : Colors.foreground;

  const iconName = toast.type === 'diretoria' ? 'business-outline'
    : toast.type === 'warning' ? 'warning-outline'
    : toast.type === 'noticias' ? 'newspaper-outline' : 'information-circle-outline';

  return (
    <Animated.View
      style={[
        styles.toast,
        { borderColor: `${accent}55`, transform: [{ translateY: slide }], opacity },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
        <Ionicons name={iconName} size={18} color={accent} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: accent }]} numberOfLines={1}>{toast.title}</Text>
        {toast.preview ? <Text style={styles.preview} numberOfLines={2}>{toast.preview}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => onDismiss(toast.id)} hitSlop={10}>
        <Ionicons name="close" size={16} color={Colors.mutedForeground} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 80,
    left: 12, right: 12,
    gap: 8,
  },
  toast: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: 'rgba(18,20,28,0.97)',
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16,
    elevation: 8,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  preview: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2, lineHeight: 16 },
});
