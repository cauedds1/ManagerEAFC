import type { ComponentProps } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { Colors } from '@/constants/colors';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface MenuItemProps {
  icon: IoniconName;
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  color?: string;
}

function MenuItem({ icon, label, subtitle, onPress, destructive, color }: MenuItemProps) {
  const itemColor = destructive ? Colors.destructive : color ?? Colors.foreground;
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconWrap, { backgroundColor: `${itemColor}18` }]}>
        <Ionicons name={icon} size={20} color={itemColor} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, { color: itemColor }]}>{label}</Text>
        {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
      </View>
      {!destructive && (
        <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
      )}
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { activeCareer, setActiveCareer } = useCareer();
  const theme = useClubTheme();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      logout();
      router.replace('/(auth)/login');
      return;
    }
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleChangeCareer = () => {
    router.push('/career-select');
  };

  const planBadge = user?.plan === 'ultra' ? '✦ Ultra' : user?.plan === 'pro' ? '★ Pro' : 'Free';
  const planColor = user?.plan === 'ultra' ? Colors.warning : user?.plan === 'pro' ? theme.primary : Colors.mutedForeground;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingBottom: insets.bottom + 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header */}
      <View style={[styles.profileCard, { borderColor: `rgba(${theme.primaryRgb}, 0.2)` }]}>
        <View style={[styles.avatar, { backgroundColor: `rgba(${theme.primaryRgb}, 0.15)` }]}>
          <Text style={[styles.avatarText, { color: theme.primary }]}>
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name ?? 'Usuário'}</Text>
          <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
          <View style={[styles.planBadge, { backgroundColor: `${planColor}20`, borderColor: `${planColor}40` }]}>
            <Text style={[styles.planText, { color: planColor }]}>{planBadge}</Text>
          </View>
        </View>
      </View>

      <Section title="Carreira">
        {activeCareer && (
          <MenuItem
            icon="swap-horizontal-outline"
            label="Trocar carreira"
            subtitle={activeCareer.clubName}
            onPress={handleChangeCareer}
            color={theme.primary}
          />
        )}
        <MenuItem
          icon="add-circle-outline"
          label="Nova carreira"
          onPress={() => router.push('/career-create')}
          color={Colors.success}
        />
        <MenuItem
          icon="grid-outline"
          label="Todas as carreiras"
          onPress={() => router.push('/career-select')}
        />
      </Section>

      <Section title="Conta">
        <MenuItem
          icon="person-outline"
          label="Perfil"
          subtitle={user?.email}
          onPress={() => {}}
        />
      </Section>

      <Section title="Sessão">
        <MenuItem
          icon="log-out-outline"
          label="Sair"
          onPress={handleLogout}
          destructive
        />
      </Section>

      <Text style={styles.version}>FC Career Manager Mobile v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    borderWidth: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 16, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  profileEmail: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  planBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
  },
  planText: { fontSize: 11, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  sectionContent: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', fontWeight: '500' as const },
  menuSubtitle: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  version: {
    textAlign: 'center',
    color: Colors.mutedForeground,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 32,
    paddingHorizontal: 16,
  },
});
