import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, Platform, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { getApiUrl, TOKEN_KEY } from '@/lib/api';
import * as SecureStore from 'expo-secure-store';
import { useT, getLang } from '@/lib/i18n';

export default function BugReportScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickScreenshot = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.error'), getLang() === 'en' ? 'Gallery permission denied.' : 'Permissão à galeria negada.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      setScreenshotUri(result.assets[0].uri);
    }
  };

  const submit = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert(t('common.error'), getLang() === 'en' ? 'Please fill in both fields.' : 'Preencha ambos os campos.');
      return;
    }
    setSubmitting(true);
    try {
      const token = Platform.OS === 'web'
        ? localStorage.getItem(TOKEN_KEY)
        : await SecureStore.getItemAsync(TOKEN_KEY);
      const ctx = {
        platform: Platform.OS,
        appVersion: Application.default?.expoConfig?.version ?? '1.0.0',
        lang: getLang(),
        screenshot: screenshotUri ? `attached:${screenshotUri.split('/').slice(-1)[0]}` : null,
      };
      const fullDescription = screenshotUri
        ? `[${subject.trim()}]\n\n${description.trim()}\n\n[Screenshot anexada pelo usuário]`
        : `[${subject.trim()}]\n\n${description.trim()}`;
      const res = await fetch(`${getApiUrl()}/api/bug-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          description: fullDescription,
          page: `mobile:bug-report ${JSON.stringify(ctx)}`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      Alert.alert(t('bugReport.sent'), t('bugReport.thanks'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('bugReport.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.label}>{t('bugReport.subject')}</Text>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          maxLength={120}
          style={styles.input}
          placeholder=""
          placeholderTextColor={Colors.mutedForeground}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>{t('bugReport.description')}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={8}
          maxLength={2000}
          style={[styles.input, styles.textarea]}
          placeholder=""
          placeholderTextColor={Colors.mutedForeground}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>
          {getLang() === 'en' ? 'SCREENSHOT (OPTIONAL)' : 'CAPTURA DE TELA (OPCIONAL)'}
        </Text>
        <TouchableOpacity onPress={pickScreenshot} style={styles.attachBtn}>
          {screenshotUri ? (
            <Image source={{ uri: screenshotUri }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <>
              <Ionicons name="image-outline" size={20} color={Colors.mutedForeground} />
              <Text style={styles.attachText}>
                {getLang() === 'en' ? 'Attach screenshot' : 'Anexar captura'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        {screenshotUri ? (
          <TouchableOpacity onPress={() => setScreenshotUri(null)} style={{ alignSelf: 'flex-end', padding: 6 }}>
            <Text style={{ color: Colors.destructive, fontSize: 12 }}>
              {getLang() === 'en' ? 'Remove' : 'Remover'}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={submit} disabled={submitting} style={[styles.submit, submitting && { opacity: 0.6 }]}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('bugReport.send')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  headerTitle: { color: Colors.foreground, fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  content: { padding: 16 },
  label: { color: Colors.mutedForeground, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  input: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, color: Colors.foreground, fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Inter_400Regular',
  },
  textarea: { minHeight: 160, textAlignVertical: 'top' },
  attachBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed', borderRadius: 12, padding: 12, justifyContent: 'center',
  },
  attachText: { color: Colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' },
  thumb: { width: '100%', height: 160, borderRadius: 8 },
  submit: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 24,
  },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});
