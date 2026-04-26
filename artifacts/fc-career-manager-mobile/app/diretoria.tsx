import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, TextInput, KeyboardAvoidingView,
  ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api, type DiretoraaMember, type CareerGameData } from '@/lib/api';
import { Colors } from '@/constants/colors';

interface ChatMessage {
  id: string;
  text: string;
  fromBoard: boolean;
  memberName?: string;
  createdAt: number;
  read?: boolean;
}

function satisfactionColor(s: number): string {
  if (s >= 80) return Colors.success;
  if (s >= 60) return Colors.warning;
  return Colors.destructive;
}

function MemberAvatar({ member, size = 36 }: { member?: DiretoraaMember; size?: number }) {
  const initials = member
    ? member.name.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '🏢';
  return (
    <View style={[
      styles.memberAvatarSmall,
      { width: size, height: size, borderRadius: size / 2 }
    ]}>
      <Text style={[styles.memberAvatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

function ChatBubble({ msg, members }: { msg: ChatMessage; members: DiretoraaMember[] }) {
  const member = members.find((m) => m.name === msg.memberName);
  const isBoard = msg.fromBoard;
  const timeStr = new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (isBoard) {
    return (
      <View style={styles.bubbleRowLeft}>
        <MemberAvatar member={member} />
        <View style={{ flex: 1, maxWidth: '80%' }}>
          {msg.memberName && (
            <Text style={styles.senderName}>{msg.memberName}</Text>
          )}
          <View style={styles.bubbleLeft}>
            <Text style={styles.bubbleTextLeft}>{msg.text}</Text>
          </View>
          <Text style={styles.bubbleTime}>{timeStr}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.bubbleRowRight}>
      <View style={{ flex: 1, maxWidth: '80%', alignItems: 'flex-end' }}>
        <Text style={styles.senderNameRight}>Você</Text>
        <View style={styles.bubbleRight}>
          <Text style={styles.bubbleTextRight}>{msg.text}</Text>
        </View>
        <Text style={styles.bubbleTimeRight}>{timeStr}</Text>
      </View>
    </View>
  );
}

export default function DiretoraScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer } = useCareer();
  const theme = useClubTheme();
  const qc = useQueryClient();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const listRef = useRef<FlatList>(null);
  const [message, setMessage] = useState('');
  const [selectedMember, setSelectedMember] = useState<DiretoraaMember | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['/api/data/career/diretoria', activeCareer?.id],
    queryFn: () => activeCareer ? api.careerData.get(activeCareer.id) : null,
    enabled: !!activeCareer?.id,
    staleTime: 1000 * 60 * 5,
  });

  const members: DiretoraaMember[] = data?.data?.diretoria_members ?? [];
  const rawNotifications = data?.data?.diretoria_notifications ?? [];

  const chatMessages: ChatMessage[] = rawNotifications
    .map((n) => ({
      id: n.id,
      text: n.message,
      fromBoard: true,
      createdAt: n.createdAt,
      read: n.read,
    }))
    .sort((a, b) => a.createdAt - b.createdAt);

  const avgSat = members.length > 0
    ? Math.round(members.reduce((s, m) => s + m.satisfaction, 0) / members.length)
    : null;

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 200);
    }
  }, [chatMessages.length]);

  const markReadMutation = useMutation({
    mutationFn: async () => {
      if (!activeCareer || !data) return;
      const updated = rawNotifications.map((n) => ({ ...n, read: true }));
      await api.careerData.set(activeCareer.id, 'diretoria_notifications', updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/data/career/diretoria', activeCareer?.id] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!activeCareer || !data) return;
      const newMsg = {
        id: `msg_${Date.now()}`,
        message: text,
        read: true,
        createdAt: Date.now(),
        fromCoach: true,
      };
      const updated = [...rawNotifications, newMsg as unknown as typeof rawNotifications[0]];
      await api.careerData.set(activeCareer.id, 'diretoria_notifications', updated);
    },
    onSuccess: () => {
      setMessage('');
      qc.invalidateQueries({ queryKey: ['/api/data/career/diretoria', activeCareer?.id] });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
  });

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || sendMutation.isPending) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMutation.mutate(trimmed);
  }, [message, sendMutation]);

  const unreadCount = rawNotifications.filter((n) => !n.read).length;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={topPad + 10}
    >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>Diretoria</Text>
          {avgSat !== null && (
            <Text style={[styles.satSub, { color: satisfactionColor(avgSat) }]}>
              Satisfação: {avgSat}%
            </Text>
          )}
        </View>
        <View style={{ width: 40 }}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.unreadBtn}
              onPress={() => markReadMutation.mutate()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.unreadBadge}>{unreadCount}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {members.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.memberStrip}
        >
          {members.map((m) => {
            const satColor = satisfactionColor(m.satisfaction);
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.memberChip, selectedMember?.id === m.id && { borderColor: theme.primary }]}
                onPress={() => setSelectedMember(selectedMember?.id === m.id ? null : m)}
                activeOpacity={0.7}
              >
                <MemberAvatar member={m} size={32} />
                <View style={{ alignItems: 'center', gap: 1 }}>
                  <Text style={styles.memberChipName} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
                  <Text style={[styles.memberChipSat, { color: satColor }]}>{m.satisfaction}%</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : chatMessages.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🏢</Text>
          <Text style={styles.emptyTitle}>Sem mensagens</Text>
          <Text style={styles.emptyText}>
            Mensagens da diretoria aparecerão aqui. Envie uma mensagem para iniciar o diálogo.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={chatMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.chatList, { paddingBottom: 12 }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => <ChatBubble msg={item} members={members} />}
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          placeholder={selectedMember ? `Mensagem para ${selectedMember.name}…` : 'Escreva uma mensagem…'}
          placeholderTextColor={Colors.mutedForeground}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: message.trim() ? theme.primary : Colors.card }
          ]}
          onPress={handleSend}
          disabled={!message.trim() || sendMutation.isPending}
          activeOpacity={0.75}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color={message.trim() ? '#fff' : Colors.mutedForeground} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  title: { fontSize: 17, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  satSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  unreadBtn: {
    backgroundColor: Colors.destructive,
    borderRadius: 99, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  unreadBadge: { fontSize: 11, fontWeight: '700' as const, color: '#fff', fontFamily: 'Inter_700Bold' },
  memberStrip: {
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  memberChip: {
    alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, minWidth: 60,
  },
  memberChipName: { fontSize: 10, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  memberChipSat: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  memberAvatarSmall: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { fontWeight: '700' as const, color: '#8B5CF6', fontFamily: 'Inter_700Bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 22 },
  chatList: { padding: 16 },
  bubbleRowLeft: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-end',
  },
  bubbleRowRight: {
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  bubbleLeft: {
    backgroundColor: Colors.card,
    borderRadius: 18, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleRight: {
    backgroundColor: '#8B5CF6',
    borderRadius: 18, borderBottomRightRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleTextLeft: { fontSize: 14, color: Colors.foreground, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  bubbleTextRight: { fontSize: 14, color: '#fff', fontFamily: 'Inter_400Regular', lineHeight: 20 },
  senderName: { fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold', marginLeft: 4, marginBottom: 3 },
  senderNameRight: { fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold', marginRight: 4, marginBottom: 3 },
  bubbleTime: { fontSize: 10, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 3, marginLeft: 4 },
  bubbleTimeRight: { fontSize: 10, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 3, marginRight: 4 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1, backgroundColor: Colors.card,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 10,
    color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
});
