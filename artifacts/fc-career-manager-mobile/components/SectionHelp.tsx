import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useT } from '@/lib/i18n';
import { useOnboardingHint } from '@/hooks/useOnboardingHint';

interface SectionHelpProps {
  /**
   * Stable section key. Used both as the i18n base key (e.g. `help.<section>.title`)
   * and as the dismissal key for `useOnboardingHint`.
   */
  section: string;
  /** Optional accent color (defaults to Colors.primary). */
  accent?: string;
  /** Show a small pulsing dot until the user opens it once. */
  hintFirstTime?: boolean;
}

export function SectionHelp({ section, accent = Colors.primary, hintFirstTime = true }: SectionHelpProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [shouldHint, dismissHint] = useOnboardingHint(`help_${section}`);
  const showHint = hintFirstTime && shouldHint;

  const title = t(`help.${section}.title`);
  const body = t(`help.${section}.body`);
  const tip = t(`help.${section}.tip`);

  // If the dictionary returns the key unchanged, treat as missing content.
  if (!title || title === `help.${section}.title`) return null;

  const handleOpen = () => {
    setOpen(true);
    if (showHint) dismissHint();
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.iconBtn, { borderColor: open ? `${accent}55` : 'rgba(255,255,255,0.12)', backgroundColor: open ? `${accent}22` : 'rgba(255,255,255,0.05)' }]}
        onPress={handleOpen}
        activeOpacity={0.7}
        accessibilityLabel={t('help.openLabel')}
      >
        <Ionicons name="information-circle-outline" size={14} color={open ? accent : 'rgba(255,255,255,0.5)'} />
        {showHint ? <View style={[styles.hintDot, { backgroundColor: accent }]} /> : null}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.panel, { borderColor: `${accent}33` }]} onPress={() => {}}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{title}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.bodyText}>{body}</Text>
              {tip && tip !== `help.${section}.tip` ? (
                <View style={[styles.tipBox, { backgroundColor: `${accent}14`, borderColor: `${accent}33` }]}>
                  <Ionicons name="bulb-outline" size={14} color={accent} />
                  <Text style={[styles.tipText, { color: accent }]}>{tip}</Text>
                </View>
              ) : null}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  hintDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: '#0E0C18',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700' as const,
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  bodyText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  tipBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    marginTop: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter_500Medium',
  },
});
