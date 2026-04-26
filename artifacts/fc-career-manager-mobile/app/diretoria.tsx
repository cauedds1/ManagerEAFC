import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type DiretoraaMember, type DiretoraaMeeting } from '@/lib/api';
import { Colors } from '@/constants/colors';

function satisfactionColor(s: number): string {
  if (s >= 80) return Colors.success;
  if (s >= 60) return Colors.warning;
  return Colors.destructive;
}

function SatisfactionBar({ value }: { value: number }) {
  const color = satisfactionColor(value);
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.min(100, value)}%`, backgroundColor: color }]} />
    </View>
  );
}

function MemberCard({ member }: { member: DiretoraaMember }) {
  const satColor = satisfactionColor(member.satisfaction);
  const initials = member.name.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <View style={styles.memberCard}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberInitials}>{initials}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.memberTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberRole}>{member.role}</Text>
          </View>
          <View style={[styles.satBadge, { backgroundColor: `${satColor}18`, borderColor: `${satColor}30` }]}>
            <Text style={[styles.satText, { color: satColor }]}>{member.satisfaction}%</Text>
          </View>
        </View>
        <SatisfactionBar value={member.satisfaction} />
        {member.goals && (
          <Text style={styles.memberGoals} numberOfLines={2}>🎯 {member.goals}</Text>
        )}
      </View>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

function MeetingCard({ meeting, memberMap }: { meeting: DiretoraaMeeting; memberMap: Map<string, DiretoraaMember> }) {
  const member = memberMap.get(meeting.memberId);
  return (
    <View style={styles.meetingCard}>
      <View style={styles.meetingHeader}>
        <View style={styles.meetingMeta}>
          <Ionicons name="calendar-outline" size={13} color={Colors.mutedForeground} />
          <Text style={styles.meetingDate}>{formatDate(meeting.date)}</Text>
          {member && <Text style={styles.meetingMember}>· {member.name}</Text>}
        </View>
      </View>
      <Text style={styles.meetingTopic}>{meeting.topic}</Text>
      {meeting.outcome && (
        <Text style={styles.meetingOutcome}>💬 {meeting.outcome}</Text>
      )}
    </View>
  );
}

export default function DiretoraScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer } = useCareer();
  const theme = useClubTheme();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const { data, isLoading } = useQuery({
    queryKey: ['/api/data/career/diretoria', activeCareer?.id],
    queryFn: () => activeCareer ? api.diretoria.get(activeCareer.id) : null,
    enabled: !!activeCareer?.id,
    staleTime: 1000 * 60 * 5,
  });

  const members: DiretoraaMember[] = data?.members ?? [];
  const meetings: DiretoraaMeeting[] = [...(data?.meetings ?? [])].sort((a, b) => b.createdAt - a.createdAt);
  const notifications = data?.notifications?.filter((n) => !n.read) ?? [];

  const memberMap = new Map<string, DiretoraaMember>(members.map((m) => [m.id, m]));
  const avgSat = members.length > 0
    ? Math.round(members.reduce((s, m) => s + m.satisfaction, 0) / members.length)
    : null;

  const sections = [
    { key: 'header', type: 'header' as const },
    ...(members.length > 0 ? [{ key: 'membersTitle', type: 'membersTitle' as const }] : []),
    ...members.map((m) => ({ key: `member-${m.id}`, type: 'member' as const, member: m })),
    ...(meetings.length > 0 ? [{ key: 'meetingsTitle', type: 'meetingsTitle' as const }] : []),
    ...meetings.map((m) => ({ key: `meeting-${m.id}`, type: 'meeting' as const, meeting: m })),
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Diretoria</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : members.length === 0 && meetings.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🏢</Text>
          <Text style={styles.emptyTitle}>Sem dados</Text>
          <Text style={styles.emptyText}>
            Configure a diretoria no aplicativo web para ver membros e reuniões aqui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.headerCard}>
                  {notifications.length > 0 && (
                    <View style={styles.notifBanner}>
                      <Ionicons name="notifications-outline" size={15} color={Colors.warning} />
                      <Text style={styles.notifText}>{notifications.length} notificaç{notifications.length !== 1 ? 'ões' : 'ão'} pendente{notifications.length !== 1 ? 's' : ''}</Text>
                    </View>
                  )}
                  {avgSat !== null && (
                    <View style={styles.satOverview}>
                      <Text style={styles.satOverviewLabel}>Satisfação média da diretoria</Text>
                      <Text style={[styles.satOverviewVal, { color: satisfactionColor(avgSat) }]}>{avgSat}%</Text>
                    </View>
                  )}
                </View>
              );
            }
            if (item.type === 'membersTitle') {
              return <Text style={styles.sectionLabel}>MEMBROS</Text>;
            }
            if (item.type === 'member' && item.member) {
              return <MemberCard member={item.member} />;
            }
            if (item.type === 'meetingsTitle') {
              return <Text style={[styles.sectionLabel, { marginTop: 8 }]}>REUNIÕES</Text>;
            }
            if (item.type === 'meeting' && item.meeting) {
              return <MeetingCard meeting={item.meeting} memberMap={memberMap} />;
            }
            return null;
          }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 22 },
  list: { padding: 16, gap: 0 },
  headerCard: { marginBottom: 8, gap: 8 },
  notifBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: Colors.radius,
    backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
  },
  notifText: { fontSize: 13, color: Colors.warning, fontFamily: 'Inter_400Regular' },
  satOverview: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Colors.radius, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 12,
  },
  satOverviewLabel: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  satOverviewVal: { fontSize: 20, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  sectionLabel: {
    fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground,
    textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Inter_600SemiBold',
    paddingHorizontal: 2, paddingVertical: 8,
  },
  memberCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  memberAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(139,92,246,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  memberInitials: { fontSize: 16, fontWeight: '700' as const, color: '#8B5CF6', fontFamily: 'Inter_700Bold' },
  memberTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  memberName: { fontSize: 15, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  memberRole: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  satBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1,
  },
  satText: { fontSize: 12, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  memberGoals: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  barTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  meetingCard: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 6,
  },
  meetingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meetingMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meetingDate: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  meetingMember: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  meetingTopic: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  meetingOutcome: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});
