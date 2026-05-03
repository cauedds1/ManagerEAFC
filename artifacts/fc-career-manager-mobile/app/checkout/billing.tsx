import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useT } from '@/lib/i18n';

export default function CheckoutBillingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Ionicons name="card-outline" size={72} color={Colors.info} />
      <Text style={styles.title}>{t('checkout.billing.title')}</Text>
      <Text style={styles.body}>{t('checkout.billing.body')}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/configuracoes')}>
        <Text style={styles.btnText}>{t('checkout.back')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: Colors.background },
  title: { color: Colors.foreground, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { color: Colors.mutedForeground, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  btn: { marginTop: 16, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
