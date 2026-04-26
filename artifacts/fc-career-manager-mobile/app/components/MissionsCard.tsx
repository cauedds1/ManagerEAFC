import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { Colors } from '@/constants/colors';

type Plan = 'free' | 'pro' | 'ultra';
type MissionId =
  | 'free_log_match' | 'free_gen_news' | 'free_view_squad' | 'free_set_rivals'
  | 'pro_setup_diretoria' | 'pro_save_momento' | 'pro_gen_3_news'
  | 'ultra_auto_news' | 'ultra_rumor' | 'ultra_portal';

interface MissionDef {
  id: MissionId;
  plan: Plan;
  icon: string;
  title: string;
  desc: string;
  rewardDesc: string;
  dataKey?: string;
  target?: number;
}

const MISSIONS: MissionDef[] = [
  {
    id: 'free_log_match',
    plan: 'free',
    icon: '⚽',
    title: 'Registre sua 1ª Partida',
    desc: 'Registre o resultado de uma partida da temporada.',
    rewardDesc: 'Histórico de partidas desbloqueado!',
    dataKey: 'matches',
    target: 1,
  },
  {
    id: 'free_gen_news',
    plan: 'free',
    icon: '📰',
    title: 'Gere sua 1ª Notícia',
    desc: 'Gere uma notícia sobre o clube com IA.',
    rewardDesc: 'Feed de notícias ativado!',
    dataKey: 'news',
    target: 1,
  },
  {
    id: 'free_view_squad',
    plan: 'free',
    icon: '👥',
    title: 'Explore o Elenco',
    desc: 'Visualize o elenco do seu clube.',
    rewardDesc: 'Seção de elenco explorada!',
  },
  {
    id: 'free_set_rivals',
    plan: 'free',
    icon: '🔥',
    title: 'Defina seus Rivais',
    desc: 'Adicione pelo menos um rival ao seu clube.',
    rewardDesc: 'Rivalidades ativadas!',
    dataKey: 'rivals',
    target: 1,
  },
  {
    id: 'pro_setup_diretoria',
    plan: 'pro',
    icon: '🏢',
    title: 'Monte sua Diretoria',
    desc: 'Adicione um membro à diretoria.',
    rewardDesc: 'Diretoria configurada!',
    dataKey: 'diretoria_members',
    target: 1,
  },
  {
    id: 'pro_save_momento',
    plan: 'pro',
    icon: '📸',
    title: 'Salve um Momento',
    desc: 'Registre um momento especial da temporada.',
    rewardDesc: 'Álbum de momentos ativo!',
    dataKey: 'momentos',
    target: 1,
  },
  {
    id: 'pro_gen_3_news',
    plan: 'pro',
    icon: '✨',
    title: 'Gere 3 Notícias',
    desc: 'Use a IA para gerar ao menos 3 notícias.',
    rewardDesc: 'Jornalismo em massa!',
    dataKey: 'news',
    target: 3,
  },
  {
    id: 'ultra_auto_news',
    plan: 'ultra',
    icon: '🤖',
    title: 'Auto-Notícia Ativada',
    desc: 'Receba uma notícia gerada automaticamente após uma partida.',
    rewardDesc: 'Motor de notícias ativo!',
    dataKey: 'news',
    target: 1,
  },
  {
    id: 'ultra_rumor',
    plan: 'ultra',
    icon: '🕵️',
    title: 'Gere um Rumor',
    desc: 'Gere um rumor de mercado de transferências.',
    rewardDesc: 'Bastidores revelados!',
    dataKey: 'news',
    target: 5,
  },
  {
    id: 'ultra_portal',
    plan: 'ultra',
    icon: '📡',
    title: 'Crie um Portal',
    desc: 'Crie um portal personalizado nas configurações.',
    rewardDesc: 'Imprensa personalizada!',
    dataKey: 'portals',
    target: 1,
  },
];

function getMissionsForPlan(plan: Plan): MissionDef[] {
  return MISSIONS.filter((m) => m.plan === plan);
}

async function getMissionKey(careerId: string, missionId: MissionId): Promise<boolean> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(`fc_mission_${careerId}_${missionId}`) === '1';
  }
  const val = await SecureStore.getItemAsync(`fc_mission_${careerId}_${missionId}`);
  return val === '1';
}

async function setMissionComplete(careerId: string, missionId: MissionId): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(`fc_mission_${careerId}_${missionId}`, '1');
    return;
  }
  await SecureStore.setItemAsync(`fc_mission_${careerId}_${missionId}`, '1');
}

export interface MissionsCardData {
  matches?: unknown[];
  news?: unknown[];
  rivals?: string[];
  diretoria_members?: unknown[];
  momentos?: unknown[];
  portals?: unknown[];
}

interface MissionsCardProps {
  careerId: string;
  plan: Plan;
  data?: MissionsCardData;
  compact?: boolean;
}

export default function MissionsCard({ careerId, plan, data, compact }: MissionsCardProps) {
  const theme = useClubTheme();
  const [completions, setCompletions] = useState<Record<MissionId, boolean>>({} as Record<MissionId, boolean>);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);

  const missions = getMissionsForPlan(plan);

  const getDataCount = useCallback((mission: MissionDef): number => {
    if (!data || !mission.dataKey) return 0;
    const key = mission.dataKey as keyof MissionsCardData;
    const arr = data[key] as unknown[] | undefined;
    return Array.isArray(arr) ? arr.length : 0;
  }, [data]);

  const checkDataCondition = useCallback((mission: MissionDef): boolean => {
    const count = getDataCount(mission);
    if (count === 0) return false;
    return count >= (mission.target ?? 1);
  }, [getDataCount]);

  const loadCompletions = useCallback(async () => {
    if (!careerId) return;
    const result: Partial<Record<MissionId, boolean>> = {};
    for (const m of missions) {
      const fromStore = await getMissionKey(careerId, m.id);
      const fromData = checkDataCondition(m);
      result[m.id] = fromStore || fromData;
      if (fromData && !fromStore) {
        await setMissionComplete(careerId, m.id);
      }
    }
    setCompletions(result as Record<MissionId, boolean>);
    setLoading(false);
  }, [careerId, missions, checkDataCondition]);

  useEffect(() => {
    loadCompletions();
  }, [loadCompletions]);

  if (missions.length === 0) return null;

  const doneCount = missions.filter((m) => completions[m.id]).length;
  const allDone = doneCount === missions.length;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.cardTitle}>🎯 Missões</Text>
          <View style={[styles.progressPill, { backgroundColor: allDone ? `${Colors.success}22` : `rgba(${theme.primaryRgb},0.12)` }]}>
            <Text style={[styles.progressText, { color: allDone ? Colors.success : theme.primary }]}>
              {doneCount}/{missions.length}
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.mutedForeground}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.list}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : (
            missions.map((m, idx) => {
              const done = !!completions[m.id];
              const prevDone = idx === 0 || !!completions[missions[idx - 1].id];
              const locked = !prevDone && !done;
              const count = getDataCount(m);
              const target = m.target ?? 0;
              const hasProgress = !done && target > 1 && count > 0;
              const progressPct = target > 0 ? Math.min(count / target, 1) : 0;
              return (
                <View
                  key={m.id}
                  style={[
                    styles.missionRow,
                    done && styles.missionDone,
                    locked && { opacity: 0.45 },
                    idx < missions.length - 1 && styles.missionRowBorder,
                  ]}
                >
                  <View style={[styles.iconWrap, done && { backgroundColor: `${Colors.success}20` }]}>
                    <Text style={styles.missionIcon}>{done ? '✅' : locked ? '🔒' : m.icon}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[styles.missionTitle, done && { color: Colors.mutedForeground, textDecorationLine: 'line-through' }, { flex: 1 }]}>
                        {m.title}
                      </Text>
                      {target > 0 && !done && (
                        <Text style={styles.progressCount}>{Math.min(count, target)}/{target}</Text>
                      )}
                    </View>
                    {done ? (
                      <Text style={styles.rewardText}>🏅 {m.rewardDesc}</Text>
                    ) : (
                      <Text style={styles.missionDesc}>{m.desc}</Text>
                    )}
                    {hasProgress && (
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
          {allDone && (
            <View style={[styles.allDoneBanner, { backgroundColor: `${Colors.success}15` }]}>
              <Text style={styles.allDoneText}>🎉 Todas as missões concluídas!</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  progressPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
  },
  progressText: { fontSize: 12, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  list: { borderTopWidth: 1, borderTopColor: Colors.border },
  loadingRow: { alignItems: 'center', paddingVertical: 16 },
  missionRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  missionRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  missionDone: { backgroundColor: 'rgba(255,255,255,0.02)' },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.backgroundLighter,
    alignItems: 'center', justifyContent: 'center',
  },
  missionIcon: { fontSize: 18 },
  missionTitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  missionDesc: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  rewardText: { fontSize: 12, color: Colors.success, fontFamily: 'Inter_400Regular' },
  progressCount: { fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold', marginLeft: 6 },
  progressBar: {
    height: 4, borderRadius: 2, backgroundColor: Colors.border, overflow: 'hidden',
  },
  progressFill: {
    height: 4, borderRadius: 2, backgroundColor: Colors.success,
  },
  allDoneBanner: {
    padding: 12, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  allDoneText: { fontSize: 14, fontWeight: '600' as const, color: Colors.success, fontFamily: 'Inter_600SemiBold' },
});
