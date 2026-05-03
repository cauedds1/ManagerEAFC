import { useState, useEffect, type ComponentProps } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  Alert, Switch, Linking, Image, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useCareer } from '@/contexts/CareerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, PORTAL_TONES, type CustomPortal, type PortalTone, getApiUrl, TOKEN_KEY } from '@/lib/api';
import { Colors } from '@/constants/colors';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { setLang as setI18nLang, useT, useLang } from '@/lib/i18n';
import { onCheckoutReturn } from '@/lib/stripeFlow';
import { setSoundEnabled as persistSoundEnabled } from '@/lib/notificationSound';
import { getOpenAIKey, setOpenAIKey } from '@/lib/openaiKeyStorage';
import { startCheckout, openCustomerPortal } from '@/lib/stripeFlow';

async function loadPref(key: string, fallback: string): Promise<string> {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(key) ?? fallback;
    return (await SecureStore.getItemAsync(key)) ?? fallback;
  } catch { return fallback; }
}

async function savePref(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {}
}

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
  icon, iconColor, label, value, onPress, trailing, destructive,
}: {
  icon: IoniconName; iconColor?: string; label: string; value?: string;
  onPress?: () => void; trailing?: React.ReactNode; destructive?: boolean;
}) {
  const color = destructive ? Colors.destructive : (iconColor ?? Colors.primary);
  return (
    <>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
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
  icon, iconColor, label, hint, value, onToggle,
}: {
  icon: IoniconName; iconColor?: string; label: string; hint?: string;
  value: boolean; onToggle: (v: boolean) => void;
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

type PortalSource = 'tnt' | 'espn' | 'fanpage';

const FIXED_PORTALS: { source: PortalSource; name: string; handle: string; defaultPhoto: string | null }[] = [
  { source: 'tnt',     name: 'TNT Sports',  handle: '@tntsports',  defaultPhoto: null },
  { source: 'espn',    name: 'ESPN Brasil',  handle: '@espnbrasil', defaultPhoto: null },
  { source: 'fanpage', name: 'FanPage',      handle: '@oficial',    defaultPhoto: null },
];

async function uploadPortalPhoto(uri: string, careerId: string): Promise<string | null> {
  try {
    const token = Platform.OS === 'web'
      ? localStorage.getItem(TOKEN_KEY)
      : await SecureStore.getItemAsync(TOKEN_KEY);
    const blob = await (await fetch(uri)).blob();
    const ext = uri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    const mime = `image/${ext}`;
    const name = `portal_${Date.now()}.${ext}`;
    const urlRes = await fetch(
      `${getApiUrl()}/api/storage/uploads/request-url?folder=portals`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name, size: blob.size, contentType: mime }),
      },
    );
    if (!urlRes.ok) return null;
    const { uploadURL, objectPath } = (await urlRes.json()) as { uploadURL: string; objectPath: string };
    const putRes = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': mime }, body: blob });
    if (!putRes.ok) return null;
    return `${getApiUrl()}/api/storage/uploads/file/${objectPath}`;
  } catch {
    return null;
  }
}

function planLabelFor(plan: string, tr: (k: string) => string): string {
  if (plan === 'pro') return tr('plan.pro');
  if (plan === 'ultra') return tr('plan.ultra');
  if (plan === 'free') return tr('plan.free');
  return plan;
}
const PLAN_COLORS: Record<string, string> = { free: Colors.mutedForeground, pro: Colors.primary, ultra: '#f59e0b' };
const PLAN_ICONS: Record<string, 'star-outline' | 'star' | 'diamond'> = { free: 'star-outline', pro: 'star', ultra: 'diamond' };

interface NewPortalForm {
  name: string;
  description: string;
  tone: PortalTone;
}

export default function ConfiguracoesScreen() {
  const insets = useSafeAreaInsets();
  const { user, refresh: refreshAuth } = useAuth();
  const tr = useT();
  const lang = useLang();
  const [referralUrl, setReferralUrl] = useState<string>('');
  const { activeCareer, activeSeason, loadSeasons } = useCareer();
  const qc = useQueryClient();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [aiEnabled, setAiEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [language, setLanguage] = useState<'pt' | 'en'>('pt');
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [openaiKey, setOpenaiKeyState] = useState('');
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showNewPortal, setShowNewPortal] = useState(false);
  const [newPortal, setNewPortal] = useState<NewPortalForm>({ name: '', description: '', tone: 'jornalistico' });
  const [savingPortal, setSavingPortal] = useState(false);
  const [uploadingPortalId, setUploadingPortalId] = useState<string | null>(null);
  const [uploadingFixedSource, setUploadingFixedSource] = useState<PortalSource | null>(null);

  const planKey = user?.plan ?? 'free';
  const planLabel = planLabelFor(planKey, tr);
  const planColor = PLAN_COLORS[planKey] ?? Colors.mutedForeground;
  const planIcon = PLAN_ICONS[planKey] ?? 'star-outline';
  const isProOrAbove = planKey === 'pro' || planKey === 'ultra';

  const prefKey = (k: string) => `fc_pref_${user?.id ?? 'guest'}_${k}`;

  useEffect(() => {
    const load = async () => {
      const [ai, sound, lang] = await Promise.all([
        loadPref(prefKey('ai_enabled'), '1'),
        loadPref(prefKey('sound_enabled'), '1'),
        loadPref(prefKey('language'), 'pt'),
      ]);
      setAiEnabled(ai === '1');
      setSoundEnabled(sound === '1');
      setLanguage(lang as 'pt' | 'en');
      const k = await getOpenAIKey();
      setOpenaiKeyState(k);
      setPrefsLoaded(true);
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const toggleAi = (v: boolean) => {
    setAiEnabled(v);
    void savePref(prefKey('ai_enabled'), v ? '1' : '0');
  };

  const toggleSound = (v: boolean) => {
    setSoundEnabled(v);
    void savePref(prefKey('sound_enabled'), v ? '1' : '0');
    void persistSoundEnabled(v);
  };

  const changeLanguage = (lang: 'pt' | 'en') => {
    setLanguage(lang);
    void savePref(prefKey('language'), lang);
    void setI18nLang(lang);
  };

  const { data: aiUsage } = useQuery({
    queryKey: ['/api/noticias/ai-usage'],
    queryFn: () => api.aiUsage.get(),
    staleTime: 60_000,
  });

  const { data: subscription } = useQuery({
    queryKey: ['/api/stripe/subscription'],
    queryFn: () => api.stripeMobile.subscription(),
    enabled: isProOrAbove,
  });

  const handleSaveOpenAIKey = async () => {
    await setOpenAIKey(openaiKey);
    Alert.alert(tr('settings.byok.saved'));
  };

  const handleClearOpenAIKey = async () => {
    await setOpenAIKey('');
    setOpenaiKeyState('');
    Alert.alert(tr('settings.byok.cleared'));
  };

  useEffect(() => {
    api.referrals.myLink().then(({ url }) => setReferralUrl(url)).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    return onCheckoutReturn(() => { void refreshAuth(); });
  }, [refreshAuth]);

  const handleCopyReferral = async () => {
    try {
      const url = referralUrl || (await api.referrals.myLink()).url;
      if (!referralUrl) setReferralUrl(url);
      await Clipboard.setStringAsync(url);
      Alert.alert(tr('common.copied'), url);
    } catch (err) {
      Alert.alert(tr('common.error'), err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleShareReferral = async () => {
    try {
      const url = referralUrl || (await api.referrals.myLink()).url;
      if (!referralUrl) setReferralUrl(url);
      if (await Sharing.isAvailableAsync()) {
        const fileUri = `${FileSystem.documentDirectory}referral.txt`;
        await FileSystem.writeAsStringAsync(fileUri, url, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: tr('settings.referral') });
      } else {
        await Clipboard.setStringAsync(url);
        Alert.alert(tr('common.copied'), url);
      }
    } catch (err) {
      Alert.alert(tr('common.error'), err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleExportCareer = async () => {
    if (!activeCareer) return;
    setExporting(true);
    try {
      const token = Platform.OS === 'web'
        ? localStorage.getItem(TOKEN_KEY)
        : await SecureStore.getItemAsync(TOKEN_KEY);
      const res = await fetch(`${getApiUrl()}/api/careers/${activeCareer.id}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.text();
      const fileName = `career_${activeCareer.id}_${Date.now()}.json`;
      const uri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: tr('settings.exportSubject') });
      } else {
        Alert.alert(tr('settings.exportSuccess'), uri);
      }
    } catch (err) {
      Alert.alert(tr('settings.exportError'), err instanceof Error ? err.message : 'Failed');
    } finally {
      setExporting(false);
    }
  };

  const handleStartCheckout = async (plan: 'pro' | 'ultra') => {
    setOpeningCheckout(true);
    try {
      await startCheckout(plan, language);
    } catch (err) {
      Alert.alert(tr('common.error'), err instanceof Error ? err.message : 'Failed');
    } finally {
      setOpeningCheckout(false);
    }
  };

  const handleOpenPortal = async () => {
    setOpeningPortal(true);
    try {
      await openCustomerPortal(language);
    } catch (err) {
      Alert.alert(tr('common.error'), err instanceof Error ? err.message : 'Failed');
    } finally {
      setOpeningPortal(false);
    }
  };

  const { data: portals, isLoading: portalsLoading } = useQuery({
    queryKey: ['/api/careers', activeCareer?.id, 'portals'],
    queryFn: () => activeCareer ? api.portals.list(activeCareer.id) : Promise.resolve([]),
    enabled: !!activeCareer,
  });

  const { data: careerGameData } = useQuery({
    queryKey: ['/api/data/career', activeCareer?.id],
    queryFn: () => activeCareer ? api.careerData.get(activeCareer.id) : null,
    enabled: !!activeCareer,
  });

  const fixedPortalPhoto = (source: PortalSource): string | null => {
    if (!careerGameData?.data) return null;
    return (careerGameData.data[`portal_photo_${source}` as `portal_photo_${PortalSource}`] as string | null | undefined) ?? null;
  };

  const handleLanguage = () => {
    Alert.alert(tr('settings.language'), '', [
      { text: tr('settings.language.portuguese'), onPress: () => changeLanguage('pt') },
      { text: tr('settings.language.english'),    onPress: () => changeLanguage('en') },
      { text: tr('common.cancel'), style: 'cancel' },
    ]);
  };

  const handleSupport = () => {
    Linking.openURL('mailto:suporte@fccareermanager.app').catch(() => {
      Alert.alert(tr('settings.support'), 'suporte@fccareermanager.app');
    });
  };

  const handleUpgrade = () => {
    Alert.alert(
      tr('settings.upgrade'),
      '',
      [
        { text: 'Pro', onPress: () => handleStartCheckout('pro') },
        { text: 'Ultra', onPress: () => handleStartCheckout('ultra') },
        { text: tr('common.cancel'), style: 'cancel' },
      ]
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
          onPress: () => Alert.alert('Exclusão solicitada', 'Entraremos em contato pelo e-mail cadastrado para confirmar.'),
        },
      ]
    );
  };

  const handleFinalizeSeasonConfirm = () => {
    if (!activeCareer) {
      Alert.alert('Carreira não selecionada', 'Selecione uma carreira primeiro.');
      return;
    }
    if (!activeSeason) {
      Alert.alert('Nenhuma temporada ativa', 'Não há temporada ativa para finalizar.');
      return;
    }
    Alert.alert(
      'Finalizar temporada',
      `Deseja finalizar "${activeSeason.label}"? Esta ação não pode ser desfeita e a temporada ficará como encerrada no histórico.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.careers.finalizeSeason(activeSeason.id);
              await loadSeasons(activeCareer.id);
              await qc.invalidateQueries({ queryKey: ['/api/careers', activeCareer.id, 'seasons'] });
              if (Platform.OS !== 'web') {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
              Alert.alert(
                'Temporada finalizada',
                `"${activeSeason.label}" foi encerrada. Crie uma nova temporada para continuar.`,
                [{ text: 'OK' }]
              );
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Erro ao finalizar a temporada.';
              Alert.alert('Erro', msg);
            }
          },
        },
      ]
    );
  };

  const handleFixedPortalPhotoChange = async (source: PortalSource) => {
    if (!activeCareer) return;
    setUploadingFixedSource(source);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à galeria para escolher uma foto.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        const uploaded = await uploadPortalPhoto(uri, activeCareer.id);
        if (uploaded) {
          const key = `portal_photo_${source}` as `portal_photo_${PortalSource}`;
          await api.careerData.set(activeCareer.id, key, uploaded);
          await qc.invalidateQueries({ queryKey: ['/api/data/career', activeCareer.id] });
          if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar a foto do portal.');
    } finally {
      setUploadingFixedSource(null);
    }
  };

  const handlePortalPhotoChange = async (portal: CustomPortal) => {
    if (!activeCareer) return;
    setUploadingPortalId(portal.id);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à galeria para escolher uma foto.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        const uploaded = await uploadPortalPhoto(uri, activeCareer.id);
        if (uploaded) {
          await api.portals.update(activeCareer.id, portal.id, { photo: uploaded });
          await qc.invalidateQueries({ queryKey: ['/api/careers', activeCareer.id, 'portals'] });
          if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar a foto do portal.');
    } finally {
      setUploadingPortalId(null);
    }
  };

  const handleDeletePortal = (portal: CustomPortal) => {
    if (!activeCareer) return;
    Alert.alert(
      'Excluir portal',
      `Deseja excluir o portal "${portal.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await api.portals.delete(activeCareer.id, portal.id);
            await qc.invalidateQueries({ queryKey: ['/api/careers', activeCareer.id, 'portals'] });
          },
        },
      ]
    );
  };

  const handleCreatePortal = async () => {
    if (!activeCareer) return;
    if (!newPortal.name.trim()) {
      Alert.alert('Nome obrigatório', 'Digite o nome do portal.');
      return;
    }
    setSavingPortal(true);
    try {
      await api.portals.create(activeCareer.id, {
        name: newPortal.name.trim(),
        description: newPortal.description.trim() || `Portal ${newPortal.name.trim()}`,
        tone: newPortal.tone,
      });
      await qc.invalidateQueries({ queryKey: ['/api/careers', activeCareer.id, 'portals'] });
      setNewPortal({ name: '', description: '', tone: 'jornalistico' });
      setShowNewPortal(false);
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Alert.alert('Erro', 'Não foi possível criar o portal.');
    } finally {
      setSavingPortal(false);
    }
  };

  const toneInfo = (tone: PortalTone) => PORTAL_TONES.find((t) => t.id === tone);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{tr('settings.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* PORTAIS */}
        {activeCareer && (
          <Section title="Portais de Notícias">
            <>
              <Text style={styles.portalGroupLabel}>Portais padrão</Text>
              {FIXED_PORTALS.map((fp, idx) => {
                const photo = fixedPortalPhoto(fp.source);
                const isUploading = uploadingFixedSource === fp.source;
                return (
                  <View key={fp.source}>
                    <View style={styles.portalRow}>
                      <TouchableOpacity
                        style={styles.portalAvatar}
                        onPress={() => handleFixedPortalPhotoChange(fp.source)}
                        disabled={isUploading}
                        activeOpacity={0.8}
                      >
                        {isUploading ? (
                          <ActivityIndicator color={Colors.primary} />
                        ) : photo ? (
                          <Image source={{ uri: photo }} style={styles.portalAvatarImg} />
                        ) : (
                          <View style={[styles.portalAvatarDefault, { backgroundColor: fp.source === 'tnt' ? '#e03c31' : fp.source === 'espn' ? '#d00' : Colors.primary }]}>
                            <Text style={styles.portalAvatarLetter}>
                              {fp.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.portalCameraIcon}>
                          <Ionicons name="camera" size={10} color="#fff" />
                        </View>
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.portalName} numberOfLines={1}>{fp.name}</Text>
                        <Text style={styles.portalTone}>{fp.handle}</Text>
                      </View>
                      {photo && (
                        <TouchableOpacity
                          onPress={async () => {
                            if (!activeCareer) return;
                            const key = `portal_photo_${fp.source}` as `portal_photo_${PortalSource}`;
                            await api.careerData.set(activeCareer.id, key, null);
                            await qc.invalidateQueries({ queryKey: ['/api/data/career', activeCareer.id] });
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={18} color={Colors.mutedForeground} />
                        </TouchableOpacity>
                      )}
                    </View>
                    {idx < FIXED_PORTALS.length - 1 && <View style={styles.rowDivider} />}
                  </View>
                );
              })}

              <View style={[styles.rowDivider, { marginLeft: 0, marginTop: 8 }]} />
              <Text style={[styles.portalGroupLabel, { marginTop: 8 }]}>Portais personalizados</Text>

              {portalsLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.primary} size="small" />
                  <Text style={styles.loadingText}>Carregando…</Text>
                </View>
              ) : (!portals || portals.length === 0) ? (
                <View style={styles.emptyPortals}>
                  <Text style={styles.emptyPortalsHint}>
                    Crie portais personalizados com nome, tom e estilo únicos para gerar notícias diferentes.
                  </Text>
                </View>
              ) : portals.map((portal) => {
                const tone = toneInfo(portal.tone);
                const isUploading = uploadingPortalId === portal.id;
                return (
                  <View key={portal.id} style={styles.portalRow}>
                    <TouchableOpacity
                      style={styles.portalAvatar}
                      onPress={() => handlePortalPhotoChange(portal)}
                      disabled={isUploading}
                      activeOpacity={0.8}
                    >
                      {isUploading ? (
                        <ActivityIndicator color={Colors.primary} />
                      ) : portal.photo ? (
                        <Image source={{ uri: portal.photo }} style={styles.portalAvatarImg} />
                      ) : (
                        <View style={styles.portalAvatarDefault}>
                          <Text style={styles.portalAvatarLetter}>
                            {portal.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.portalCameraIcon}>
                        <Ionicons name="camera" size={10} color="#fff" />
                      </View>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.portalName} numberOfLines={1}>{portal.name}</Text>
                      <Text style={styles.portalTone}>{tone?.emoji} {tone?.label}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeletePortal(portal)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {(portals?.length ?? 0) < 3 && (
                <>
                  <View style={styles.rowDivider} />
                  <TouchableOpacity
                    style={styles.addPortalBtn}
                    onPress={() => setShowNewPortal(true)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: `${Colors.success}18` }]}>
                      <Ionicons name="add" size={20} color={Colors.success} />
                    </View>
                    <Text style={[styles.rowLabel, { color: Colors.success }]}>Adicionar portal</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
                  </TouchableOpacity>
                </>
              )}
            </>
          </Section>
        )}

        {/* TEMPORADA */}
        {activeCareer && (
          <Section title="Temporada">
            <Row
              icon="calendar-outline"
              iconColor={Colors.info}
              label="Temporada ativa"
              value={activeSeason?.label ?? activeCareer.season}
            />
            <Row
              icon="add-circle-outline"
              iconColor={Colors.success}
              label="Nova temporada"
              onPress={() => router.push('/nova-temporada')}
            />
            <Row
              icon="flag-outline"
              iconColor={Colors.warning}
              label="Finalizar temporada"
              onPress={handleFinalizeSeasonConfirm}
            />
          </Section>
        )}

        {/* IA */}
        <Section title="Inteligência Artificial">
          <ToggleRow
            icon="sparkles-outline"
            iconColor={Colors.warning}
            label="IA ativada"
            hint="Notícias geradas por IA, análises e Diretoria"
            value={prefsLoaded ? aiEnabled : true}
            onToggle={toggleAi}
          />
          <Row
            icon="chatbubble-ellipses-outline"
            iconColor={Colors.info}
            label="Diretoria IA"
            value={isProOrAbove ? 'Ativada' : 'Requer Pro'}
            onPress={isProOrAbove ? undefined : handleUpgrade}
          />
        </Section>

        {/* SOM */}
        <Section title="Som e Haptics">
          <ToggleRow
            icon="volume-high-outline"
            iconColor={Colors.success}
            label="Som e vibrações"
            hint="Feedback tátil ao registrar partidas e ações"
            value={prefsLoaded ? soundEnabled : true}
            onToggle={toggleSound}
          />
        </Section>

        {/* IDIOMA */}
        <Section title={tr('settings.language')}>
          <Row
            icon="language-outline"
            iconColor={Colors.info}
            label={tr('settings.language')}
            value={lang === 'pt' ? `🇧🇷 ${tr('settings.language.portuguese')}` : `🇺🇸 ${tr('settings.language.english')}`}
            onPress={handleLanguage}
          />
        </Section>

        {/* CONTA */}
        <Section title={tr('settings.account')}>
          <Row
            icon="person-outline"
            label="E-mail"
            value={user?.email ?? '—'}
          />
          <Row
            icon={planIcon}
            iconColor={planColor}
            label={tr('settings.plan')}
            value={planLabel}
            trailing={
              <View style={[styles.planBadge, { backgroundColor: `${planColor}18`, borderColor: `${planColor}35` }]}>
                <Ionicons name={planIcon} size={10} color={planColor} />
                <Text style={[styles.planBadgeText, { color: planColor }]}>{planLabel}</Text>
              </View>
            }
          />
          {!isProOrAbove ? (
            <Row
              icon="rocket-outline"
              iconColor="#f59e0b"
              label={openingCheckout ? tr('settings.openingCheckout') : tr('settings.upgrade')}
              onPress={openingCheckout ? undefined : handleUpgrade}
            />
          ) : (
            <Row
              icon="card-outline"
              iconColor={Colors.primary}
              label={openingPortal ? tr('settings.openingPortal') : tr('settings.manageSubscription')}
              value={subscription?.subscription?.product_name ?? undefined}
              onPress={openingPortal ? undefined : handleOpenPortal}
            />
          )}
        </Section>

        {/* USO DE IA */}
        <Section title={tr('settings.aiUsage')}>
          <Row
            icon="analytics-outline"
            iconColor={Colors.warning}
            label={tr('settings.aiUsage')}
            value={aiUsage ? `${aiUsage.aiUsageToday} / ${aiUsage.aiUsageLimit > 9999 ? '∞' : aiUsage.aiUsageLimit}` : '—'}
          />
          {isProOrAbove ? (
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
              <Text style={{ color: Colors.mutedForeground, fontSize: 12 }}>{tr('settings.byok.title')}</Text>
              <TextInput
                value={openaiKey}
                onChangeText={setOpenaiKeyState}
                placeholder={tr('settings.byok.placeholder')}
                placeholderTextColor={Colors.mutedForeground}
                autoCapitalize="none"
                secureTextEntry
                style={{
                  backgroundColor: Colors.background, borderColor: Colors.border, borderWidth: 1,
                  borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: Colors.foreground,
                }}
              />
              <Text style={{ color: Colors.mutedForeground, fontSize: 11 }}>{tr('settings.byok.hint')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={handleSaveOpenAIKey} style={{ flex: 1, backgroundColor: Colors.primary, padding: 10, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>{tr('common.save')}</Text>
                </TouchableOpacity>
                {openaiKey ? (
                  <TouchableOpacity onPress={handleClearOpenAIKey} style={{ flex: 1, backgroundColor: Colors.muted, padding: 10, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: Colors.foreground, fontWeight: '600' }}>{tr('common.close')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}
        </Section>

        {/* SUPORTE */}
        <Section title={tr('settings.support')}>
          <Row
            icon="bug-outline"
            iconColor={Colors.warning}
            label={tr('settings.bugReport')}
            onPress={() => router.push('/bug-report')}
          />
          <Row
            icon="mail-outline"
            iconColor={Colors.info}
            label={tr('settings.support.email')}
            value="E-mail"
            onPress={handleSupport}
          />
        </Section>

        {/* COMUNIDADE */}
        <Section title={tr('settings.referral')}>
          <Row
            icon="link-outline"
            iconColor={Colors.success}
            label={tr('referral.title')}
            value={referralUrl ? referralUrl.replace(/^https?:\/\//, '') : '—'}
          />
          <Row
            icon="copy-outline"
            iconColor={Colors.info}
            label={tr('common.copy')}
            onPress={handleCopyReferral}
          />
          <Row
            icon="share-outline"
            iconColor={Colors.success}
            label={tr('common.share')}
            onPress={handleShareReferral}
          />
          {activeCareer ? (
            <Row
              icon="cloud-download-outline"
              iconColor={Colors.info}
              label={exporting ? tr('common.loading') : tr('settings.export')}
              onPress={exporting ? undefined : handleExportCareer}
            />
          ) : null}
        </Section>

        {/* ZONA DE PERIGO */}
        <Section title="Zona de perigo">
          <Row
            icon="trash-outline"
            label="Excluir conta"
            destructive
            onPress={handleDeleteAccount}
          />
        </Section>
      </ScrollView>

      {/* MODAL: Novo portal */}
      <Modal
        visible={showNewPortal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewPortal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowNewPortal(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Novo portal</Text>
            <TouchableOpacity onPress={handleCreatePortal} disabled={savingPortal}>
              {savingPortal ? (
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <Text style={styles.modalSave}>Criar</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nome do portal *</Text>
              <TextInput
                style={styles.input}
                value={newPortal.name}
                onChangeText={(v) => setNewPortal((p) => ({ ...p, name: v }))}
                placeholder="Ex: Folha do Torcedor"
                placeholderTextColor={Colors.mutedForeground}
                autoFocus
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Descrição</Text>
              <TextInput
                style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                value={newPortal.description}
                onChangeText={(v) => setNewPortal((p) => ({ ...p, description: v }))}
                placeholder="Como este portal cobre as notícias…"
                placeholderTextColor={Colors.mutedForeground}
                multiline
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Tom de escrita</Text>
              <View style={styles.toneGrid}>
                {PORTAL_TONES.map((t) => {
                  const selected = newPortal.tone === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.toneChip, selected && styles.toneChipSelected]}
                      onPress={() => setNewPortal((p) => ({ ...p, tone: t.id }))}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.toneEmoji}>{t.emoji}</Text>
                      <Text style={[styles.toneLabel, selected && styles.toneLabelSelected]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  loadingText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  emptyPortals: { alignItems: 'center', padding: 24, gap: 8 },
  emptyPortalsText: { fontSize: 15, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  emptyPortalsHint: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  portalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  portalGroupLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  portalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  portalAvatarDefault: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  portalAvatarLetter: { fontSize: 18, fontWeight: '700' as const, color: '#fff', fontFamily: 'Inter_700Bold' },
  portalCameraIcon: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.card,
  },
  portalName: { fontSize: 14, fontWeight: '500' as const, color: Colors.foreground, fontFamily: 'Inter_500Medium' },
  portalTone: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  addPortalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
  },
  planBadgeText: { fontSize: 11, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCancel: { fontSize: 16, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  modalTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  modalSave: { fontSize: 16, color: Colors.primary, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, color: Colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Colors.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.foreground,
    fontFamily: 'Inter_400Regular',
  },
  toneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Colors.radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  toneChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  toneEmoji: { fontSize: 14 },
  toneLabel: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  toneLabelSelected: { color: Colors.primary, fontWeight: '500' as const, fontFamily: 'Inter_500Medium' },
});
