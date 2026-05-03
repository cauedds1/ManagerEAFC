import { useEffect, useState, type ComponentProps } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '@/contexts/AuthContext';
import { useCareer } from '@/contexts/CareerContext';
import { Colors } from '@/constants/colors';
import { api } from '@/lib/api';
import { useT, useLang, getLang } from '@/lib/i18n';
import { startCheckout, openCustomerPortal, onCheckoutReturn } from '@/lib/stripeFlow';
import { router } from 'expo-router';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function MenuItem({
  icon, label, value, onPress, destructive, trailing,
}: {
  icon: IoniconName; label: string; value?: string;
  onPress?: () => void; destructive?: boolean; trailing?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.menuIcon, destructive && styles.menuIconDestructive]}>
        <Ionicons name={icon} size={20} color={destructive ? Colors.destructive : Colors.primary} />
      </View>
      <Text style={[styles.menuLabel, destructive && styles.menuLabelDestructive]}>{label}</Text>
      {trailing ? trailing
        : value ? <Text style={styles.menuValue} numberOfLines={1}>{value}</Text>
        : onPress ? <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} /> : null}
    </TouchableOpacity>
  );
}

const PLAN_COLORS: Record<string, string> = {
  free: Colors.mutedForeground, pro: '#8B5CF6', ultra: '#F59E0B',
};

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, refresh: refreshAuth } = useAuth();
  const { activeCareer, activeSeason } = useCareer();
  const t = useT();
  const lang = useLang();
  const [referralUrl, setReferralUrl] = useState<string>('');
  const [stripeBusy, setStripeBusy] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const planKey = (user?.plan ?? 'free') as 'free' | 'pro' | 'ultra';
  const isProOrAbove = planKey === 'pro' || planKey === 'ultra';
  const planLabels: Record<string, string> = {
    free: t('plan.free'),
    pro: t('plan.pro'),
    ultra: t('plan.ultra'),
  };

  useEffect(() => {
    api.referrals.myLink().then(({ url }) => setReferralUrl(url)).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    return onCheckoutReturn(() => { void refreshAuth(); });
  }, [refreshAuth]);

  const handleUpgrade = async (plan: 'pro' | 'ultra') => {
    setStripeBusy(true);
    try {
      await startCheckout(plan, getLang());
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : 'Failed');
    } finally {
      setStripeBusy(false);
    }
  };

  const handleManageSubscription = async () => {
    setStripeBusy(true);
    try {
      await openCustomerPortal(getLang());
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : 'Failed');
    } finally {
      setStripeBusy(false);
    }
  };

  const handleCopyReferral = async () => {
    if (!referralUrl) return;
    await Clipboard.setStringAsync(referralUrl);
    Alert.alert(t('common.copied'), referralUrl);
  };

  const handleShareReferral = async () => {
    if (!referralUrl) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        const fileUri = `${FileSystem.documentDirectory}referral.txt`;
        await FileSystem.writeAsStringAsync(fileUri, referralUrl, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: t('referral.title') });
      } else {
        await Clipboard.setStringAsync(referralUrl);
        Alert.alert(t('common.copied'), referralUrl);
      }
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleLogout = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(t('perfil.logout'), t('perfil.logoutConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('perfil.logout'), style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            logout();
          },
        },
      ]);
    } else {
      if (window.confirm(t('perfil.logoutConfirm'))) logout();
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.avatarWrap}>
          <Ionicons name="person" size={36} color={Colors.primary} />
        </View>
        <Text style={styles.displayName}>{user?.name ?? '—'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>
        <View style={[styles.planBadge, { borderColor: `${PLAN_COLORS[planKey]}40`, backgroundColor: `${PLAN_COLORS[planKey]}12` }]}>
          <Ionicons name={planKey === 'ultra' ? 'diamond' : planKey === 'pro' ? 'star' : 'star-outline'} size={12} color={PLAN_COLORS[planKey]} />
          <Text style={[styles.planText, { color: PLAN_COLORS[planKey] }]}>
            {t('settings.plan')} {planLabels[planKey] ?? planKey}
          </Text>
        </View>
      </View>

      {activeCareer && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('perfil.activeCareer')}</Text>
          <View style={styles.card}>
            <MenuItem icon="football-outline" label={t('perfil.club')} value={activeCareer.clubName} />
            <View style={styles.divider} />
            <MenuItem icon="person-outline" label={t('perfil.coach')} value={activeCareer.coach?.name ?? '—'} />
            <View style={styles.divider} />
            <MenuItem icon="calendar-outline" label={t('perfil.activeSeason')} value={activeSeason?.label ?? activeCareer.season} />
            {activeCareer.clubLeague && (
              <>
                <View style={styles.divider} />
                <MenuItem icon="trophy-outline" label={t('perfil.league')} value={activeCareer.clubLeague} />
              </>
            )}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
        <View style={styles.card}>
          <MenuItem icon="mail-outline" label={t('perfil.email')} value={user?.email ?? '—'} />
          <View style={styles.divider} />
          <MenuItem icon="ribbon-outline" label={t('settings.plan')} value={planLabels[planKey]} />
        </View>
      </View>

      {!isProOrAbove ? (
        <View style={styles.upgradeCard}>
          <View style={styles.upgradeIconRow}>
            <Ionicons name="rocket" size={28} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeTitle}>{t('perfil.upgradeTitle')}</Text>
              <Text style={styles.upgradeText}>{t('perfil.upgradeText')}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.8} disabled={stripeBusy} onPress={() => handleUpgrade('pro')}>
            {stripeBusy ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Ionicons name="diamond" size={16} color="#fff" />
                <Text style={styles.upgradeBtnText}>{t('settings.upgrade')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.card}>
            <MenuItem
              icon="card-outline"
              label={t('settings.manageSubscription')}
              onPress={stripeBusy ? undefined : handleManageSubscription}
              trailing={stripeBusy ? <ActivityIndicator size="small" color={Colors.primary} /> : undefined}
            />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('perfil.referralSection')}</Text>
        <View style={styles.card}>
          <MenuItem icon="link-outline" label={t('referral.title')} value={referralUrl ? referralUrl.replace(/^https?:\/\//, '') : '—'} />
          <View style={styles.divider} />
          <MenuItem icon="copy-outline" label={t('common.copy')} onPress={handleCopyReferral} />
          <View style={styles.divider} />
          <MenuItem icon="share-outline" label={t('common.share')} onPress={handleShareReferral} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.title')}</Text>
        <View style={styles.card}>
          <MenuItem icon="settings-outline" label={t('settings.title')} onPress={() => router.push('/configuracoes')} />
          <View style={styles.divider} />
          <MenuItem icon="bug-outline" label={t('settings.bugReport')} onPress={() => router.push('/bug-report')} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.card}>
          <MenuItem icon="log-out-outline" label={t('perfil.logout')} onPress={handleLogout} destructive />
        </View>
      </View>

      <Text style={styles.version}>FC Career Manager • Mobile v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16 },
  header: { alignItems: 'center', paddingBottom: 24, gap: 6 },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4, borderWidth: 2, borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  displayName: { fontSize: 22, fontWeight: '700', color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  email: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 99, borderWidth: 1, marginTop: 4,
  },
  planText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8, paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuIcon: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconDestructive: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  menuLabel: { flex: 1, fontSize: 15, color: Colors.foreground, fontFamily: 'Inter_400Regular' },
  menuLabelDestructive: { color: Colors.destructive },
  menuValue: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', maxWidth: 180 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 64 },
  upgradeCard: {
    backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
    padding: 16, gap: 14, marginBottom: 20,
  },
  upgradeIconRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  upgradeTitle: { fontSize: 16, fontWeight: '700', color: Colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  upgradeText: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F59E0B', borderRadius: Colors.radius, paddingVertical: 12,
  },
  upgradeBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  version: { textAlign: 'center', fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 8, opacity: 0.5 },
});
