// PORTED FROM artifacts/fc-career-manager/src/components/UpgradePrompt.tsx —
// adapted for React Native: native View/Text, opens checkout via stripeFlow.

import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { type Plan, getPlanLabel } from '@/lib/userPlan';
import { startCheckout, type RequiredPlan } from '@/lib/stripeFlow';
import { getLang, t } from '@/lib/i18n';

interface UpgradePromptProps {
  currentPlan: Plan;
  requiredPlan: RequiredPlan;
  featureName: string;
  description?: string;
  compact?: boolean;
  onUpgraded?: () => void;
}

export function UpgradePrompt({ currentPlan, requiredPlan, featureName, description, compact, onUpgraded }: UpgradePromptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const accent = requiredPlan === 'ultra' ? '#f59e0b' : '#7c5cfc';

  const handleUpgrade = async () => {
    setError('');
    setLoading(true);
    try {
      await startCheckout(requiredPlan, getLang());
      onUpgraded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('upgrade.error'));
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <View style={[styles.compactCard, { backgroundColor: `${accent}10`, borderColor: `${accent}33` }]}>
          <View style={[styles.compactIcon, { backgroundColor: `${accent}22` }]}>
            <Ionicons name="lock-closed" size={16} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.compactTitle}>{featureName}</Text>
            <Text style={styles.compactHint}>
              {t('upgrade.requiredPlan')} <Text style={{ color: accent, fontWeight: '700' }}>{getPlanLabel(requiredPlan)}</Text>
            </Text>
          </View>
          <TouchableOpacity onPress={handleUpgrade} disabled={loading} style={[styles.compactBtn, { backgroundColor: `${accent}30`, borderColor: `${accent}55` }]}>
            {loading
              ? <ActivityIndicator size="small" color={accent} />
              : <Text style={[styles.compactBtnText, { color: accent }]}>{t('upgrade.cta')}</Text>}
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.fullWrap}>
      <View style={[styles.fullIcon, { backgroundColor: `${accent}1a`, borderColor: `${accent}33` }]}>
        <Ionicons name="lock-closed" size={28} color={accent} />
      </View>
      <View style={[styles.planPill, { backgroundColor: `${accent}1f`, borderColor: `${accent}40` }]}>
        <Text style={[styles.planPillText, { color: accent }]}>{getPlanLabel(requiredPlan)} {t('upgrade.requiredPlan')}</Text>
      </View>
      <Text style={styles.featureName}>{featureName}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}

      <TouchableOpacity onPress={handleUpgrade} disabled={loading} style={[styles.cta, { backgroundColor: accent }]}>
        {loading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.ctaText}>{t('upgrade.cta')} →</Text>}
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={[styles.currentCard, { backgroundColor: `${accent}0d`, borderColor: `${accent}26` }]}>
        <Text style={styles.currentLabel}>{t('upgrade.currentPlan')}</Text>
        <Text style={styles.currentValue}>{getPlanLabel(currentPlan)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullWrap: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  fullIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  planPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, borderWidth: 1 },
  planPillText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  featureName: { color: Colors.foreground, fontSize: 18, fontWeight: '700', textAlign: 'center', fontFamily: 'Inter_700Bold' },
  description: { color: Colors.mutedForeground, fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 18 },
  cta: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, marginTop: 4 },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  errorText: { color: '#f87171', fontSize: 12, marginTop: 6, textAlign: 'center' },
  currentCard: { width: '100%', maxWidth: 320, padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 8 },
  currentLabel: { fontSize: 11, color: Colors.mutedForeground, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  currentValue: { color: Colors.foreground, fontSize: 14, fontWeight: '700', marginTop: 4, fontFamily: 'Inter_700Bold' },

  compactWrap: { gap: 4 },
  compactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  compactIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  compactTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  compactHint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  compactBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  compactBtnText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});
