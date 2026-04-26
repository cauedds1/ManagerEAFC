import type { ComponentProps } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useCareer } from '@/contexts/CareerContext';
import { Colors } from '@/constants/colors';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function MenuItem({
  icon,
  label,
  value,
  onPress,
  destructive,
}: {
  icon: IoniconName;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.menuIcon, destructive && styles.menuIconDestructive]}>
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? Colors.destructive : Colors.primary}
        />
      </View>
      <Text style={[styles.menuLabel, destructive && styles.menuLabelDestructive]}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.menuValue}>{value}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
      ) : null}
    </TouchableOpacity>
  );
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  pro: 'Pro',
  ultra: 'Ultra',
};

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { activeCareer, activeSeason } = useCareer();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Deseja sair da sua conta?')) {
        logout();
      }
      return;
    }
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar + header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.avatarWrap}>
          <Ionicons name="person" size={36} color={Colors.primary} />
        </View>
        <Text style={styles.displayName}>{user?.name ?? '—'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>
        <View style={styles.planBadge}>
          <Ionicons name="star" size={12} color={Colors.warning} />
          <Text style={styles.planText}>{PLAN_LABELS[user?.plan ?? 'free'] ?? user?.plan}</Text>
        </View>
      </View>

      {/* Career info */}
      {activeCareer && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Carreira Ativa</Text>
          <View style={styles.card}>
            <MenuItem
              icon="football-outline"
              label="Clube"
              value={activeCareer.clubName}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="person-outline"
              label="Treinador"
              value={activeCareer.coach?.name ?? '—'}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="calendar-outline"
              label="Temporada ativa"
              value={activeSeason?.label ?? activeCareer.season}
            />
          </View>
        </View>
      )}

      {/* Account section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conta</Text>
        <View style={styles.card}>
          <MenuItem icon="mail-outline" label="E-mail" value={user?.email ?? '—'} />
          <View style={styles.divider} />
          <MenuItem icon="ribbon-outline" label="Plano" value={PLAN_LABELS[user?.plan ?? 'free']} />
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <View style={styles.card}>
          <MenuItem
            icon="log-out-outline"
            label="Sair da conta"
            onPress={handleLogout}
            destructive
          />
        </View>
      </View>

      <Text style={styles.version}>FC Career Manager • Mobile</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16 },
  header: {
    alignItems: 'center',
    paddingBottom: 24,
    gap: 6,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `rgba(139, 92, 246, 0.15)`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 2,
    borderColor: `rgba(139, 92, 246, 0.3)`,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.foreground,
    fontFamily: 'Inter_700Bold',
  },
  email: {
    fontSize: 14,
    color: Colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `rgba(245, 158, 11, 0.12)`,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: `rgba(245, 158, 11, 0.3)`,
    marginTop: 4,
  },
  planText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.warning,
    fontFamily: 'Inter_600SemiBold',
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
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
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: `rgba(139, 92, 246, 0.1)`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconDestructive: {
    backgroundColor: `rgba(239, 68, 68, 0.1)`,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: Colors.foreground,
    fontFamily: 'Inter_400Regular',
  },
  menuLabelDestructive: {
    color: Colors.destructive,
  },
  menuValue: {
    fontSize: 14,
    color: Colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    maxWidth: 160,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 64,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
    opacity: 0.5,
  },
});
