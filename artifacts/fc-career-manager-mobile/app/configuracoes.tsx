import { useState, type ComponentProps } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, Switch, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  iconColor,
  label,
  value,
  onPress,
  trailing,
  destructive,
}: {
  icon: IoniconName;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
}) {
  const color = destructive ? Colors.destructive : (iconColor ?? Colors.primary);
  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        <View style={[styles.rowIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.rowLabel, destructive && { color: Colors.destructive }]}>{label}</Text>
        {trailing ?? (value ? (
          <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
        ) : null)}
      </TouchableOpacity>
      <View style={styles.rowDivider} />
    </>
  );
}

function ToggleRow({
  icon,
  iconColor,
  label,
  hint,
  value,
  onToggle,
}: {
  icon: IoniconName;
  iconColor?: string;
  label: string;
  hint?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  const color = iconColor ?? Colors.primary;
  return (
    <>
      <View style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>{label}</Text>
          {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={(v) => {
            if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onToggle(v);
          }}
          trackColor={{ false: Colors.muted, true: Colors.primary }}
          thumbColor="#fff"
        />
      </View>
      <View style={styles.rowDivider} />
    </>
  );
}

const PLAN_LABELS: Record<string, string> = { free: 'Gratuito', pro: 'Pro', ultra: 'Ultra' };
const PLAN_COLORS: Record<string, string> = { free: Colors.mutedForeground, pro: Colors.primary, ultra: '#f59e0b' };

export default function ConfiguracoesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [aiEnabled, setAiEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [language, setLanguage] = useState<'pt' | 'en'>('pt');

  const planKey = user?.plan ?? 'free';
  const planLabel = PLAN_LABELS[planKey] ?? planKey;
  const planColor = PLAN_COLORS[planKey] ?? Colors.mutedForeground;
  const isProOrAbove = planKey === 'pro' || planKey === 'ultra';

  const handleLanguage = () => {
    Alert.alert(
      'Idioma',
      'Selecione o idioma do aplicativo',
      [
        { text: 'Português (BR)', onPress: () => setLanguage('pt') },
        { text: 'English', onPress: () => setLanguage('en') },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const handleSupport = () => {
    Linking.openURL('mailto:suporte@fccareermanager.app').catch(() => {
      Alert.alert('Suporte', 'Entre em contato: suporte@fccareermanager.app');
    });
  };

  const handleInvite = () => {
    Alert.alert(
      'Convidar amigos',
      'Compartilhe o FC Career Manager com seus amigos!',
      [{ text: 'OK' }]
    );
  };

  const handleUpgrade = () => {
    Alert.alert(
      'Upgrade de plano',
      'Para fazer upgrade, acesse fc.replit.app no seu navegador.',
      [{ text: 'OK' }]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir conta',
      'Esta ação é irreversível. Todos os seus dados serão apagados permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => Alert.alert('Exclusão solicitada', 'Entraremos em contato pelo e-mail cadastrado para confirmar a exclusão.'),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurações</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Inteligência Artificial">
          <ToggleRow
            icon="sparkles-outline"
            iconColor={Colors.warning}
            label="IA ativada"
            hint="Notícias geradas por IA, análises e Diretoria"
            value={aiEnabled}
            onToggle={setAiEnabled}
          />
          <Row
            icon="chatbubble-ellipses-outline"
            iconColor={Colors.info}
            label="Diretoria IA"
            value={isProOrAbove ? 'Ativada' : 'Requer Pro'}
            onPress={isProOrAbove ? undefined : handleUpgrade}
          />
        </Section>

        <Section title="Som e Haptics">
          <ToggleRow
            icon="volume-high-outline"
            iconColor={Colors.success}
            label="Som e vibrações"
            hint="Feedback tátil ao registrar partidas e ações"
            value={soundEnabled}
            onToggle={setSoundEnabled}
          />
        </Section>

        <Section title="Idioma">
          <Row
            icon="language-outline"
            iconColor={Colors.info}
            label="Idioma do app"
            value={language === 'pt' ? '🇧🇷 Português (BR)' : '🇺🇸 English'}
            onPress={handleLanguage}
          />
        </Section>

        <Section title="Conta">
          <Row
            icon="person-outline"
            label="E-mail"
            value={user?.email ?? '—'}
          />
          <Row
            icon="ribbon-outline"
            iconColor={planColor}
            label="Plano atual"
            value={planLabel}
          />
          {!isProOrAbove && (
            <Row
              icon="rocket-outline"
              iconColor="#f59e0b"
              label="Fazer upgrade"
              onPress={handleUpgrade}
            />
          )}
        </Section>

        <Section title="Suporte">
          <Row
            icon="help-circle-outline"
            iconColor={Colors.info}
            label="Central de ajuda"
            onPress={handleSupport}
          />
          <Row
            icon="mail-outline"
            iconColor={Colors.info}
            label="Falar com suporte"
            value="suporte@fccareermanager.app"
            onPress={handleSupport}
          />
          <Row
            icon="star-outline"
            iconColor="#f59e0b"
            label="Avaliar o app"
            onPress={() => Alert.alert('Avalie-nos', 'Obrigado! Avalie na App Store / Google Play.')}
          />
        </Section>

        <Section title="Comunidade">
          <Row
            icon="person-add-outline"
            iconColor={Colors.success}
            label="Convidar amigos"
            onPress={handleInvite}
          />
        </Section>

        <Section title="Zona de perigo">
          <Row
            icon="trash-outline"
            label="Excluir conta"
            destructive
            onPress={handleDeleteAccount}
          />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 24 },
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
  card: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, color: Colors.foreground, fontFamily: 'Inter_400Regular' },
  rowValue: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', maxWidth: 160, textAlign: 'right' },
  rowHint: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 62 },
});
