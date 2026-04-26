import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError('Preencha todos os campos');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/career-select');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta';
      setError(msg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Ionicons name="football" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Criar conta</Text>
          <Text style={styles.subtitle}>Comece sua jornada como técnico</Text>
        </View>

        <View style={styles.form}>
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor={Colors.mutedForeground}
              autoCapitalize="words"
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={Colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={Colors.mutedForeground}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={Colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.registerBtn, loading && styles.disabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerBtnText}>Criar conta</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginHint}>Já tem conta? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.loginLink}>Entrar</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: `rgba(139, 92, 246, 0.12)`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `rgba(139, 92, 246, 0.2)`,
  },
  title: { fontSize: 28, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  subtitle: { fontSize: 15, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  form: { flex: 1 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `rgba(239, 68, 68, 0.1)`,
    borderWidth: 1,
    borderColor: `rgba(239, 68, 68, 0.3)`,
    borderRadius: Colors.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: { color: Colors.destructive, fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500' as const, color: Colors.foregroundMuted, marginBottom: 6, fontFamily: 'Inter_500Medium' },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Colors.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.foreground,
    fontFamily: 'Inter_400Regular',
  },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  registerBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Colors.radius,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  disabled: { opacity: 0.6 },
  registerBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginHint: { color: Colors.mutedForeground, fontSize: 14, fontFamily: 'Inter_400Regular' },
  loginLink: { color: Colors.primary, fontSize: 14, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
});
