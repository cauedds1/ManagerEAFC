import { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions,
  Platform, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useT } from '@/lib/i18n';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export interface ReelMoment {
  id: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  date?: number;
  shareText?: string;
}

interface ReelsModalProps {
  visible: boolean;
  moments: ReelMoment[];
  onClose: () => void;
  accent?: string;
}

export function ReelsModal({ visible, moments, onClose, accent = Colors.primary }: ReelsModalProps) {
  const t = useT();
  const [activeIdx, setActiveIdx] = useState(0);

  const onShare = async (m: ReelMoment) => {
    try {
      const text = m.shareText || `${m.title}${m.subtitle ? `\n\n${m.subtitle}` : ''}`;
      await Share.share({ message: text });
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <FlatList
          data={moments}
          keyExtractor={(m) => m.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.y / SCREEN_H);
            setActiveIdx(idx);
          }}
          renderItem={({ item }) => (
            <View style={styles.page}>
              <LinearGradient
                colors={[`${accent}44`, '#06060c', '#06060c', `${accent}22`]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.content}>
                {item.emoji ? <Text style={styles.emoji}>{item.emoji}</Text> : null}
                <Text style={[styles.kicker, { color: accent }]}>{t('reels.momentLabel')}</Text>
                <Text style={styles.title}>{item.title}</Text>
                {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
                {item.date ? (
                  <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
                ) : null}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: `${accent}55` }]}
                  onPress={() => onShare(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-social-outline" size={20} color={accent} />
                  <Text style={[styles.actionText, { color: accent }]}>{t('reels.share')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        {moments.length > 1 ? (
          <View style={styles.dots}>
            {moments.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === activeIdx ? accent : 'rgba(255,255,255,0.3)' },
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06060c' },
  page: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: { alignItems: 'center', gap: 14 },
  emoji: { fontSize: 64 },
  kicker: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800' as const,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
    lineHeight: 34,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  date: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  actions: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionText: { fontSize: 13, fontWeight: '700' as const, fontFamily: 'Inter_600SemiBold' },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    position: 'absolute',
    top: 60,
    left: 16,
    flexDirection: 'row',
    gap: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
