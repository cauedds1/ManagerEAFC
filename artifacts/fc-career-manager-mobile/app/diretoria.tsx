import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, TextInput, KeyboardAvoidingView,
  ScrollView, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCareer } from '@/contexts/CareerContext';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { api } from '@/lib/api';
import { Colors } from '@/constants/colors';

interface StoredMemberProfile {
  id: string;
  name: string;
  roleLabel?: string;
  role?: string;
  description?: string;
  mood?: string;
  patience?: number;
  satisfaction?: number;
  avatarColor?: string;
}

interface BoardNotification {
  id: string;
  message: string;
  read: boolean;
  createdAt: number;
  memberName?: string;
}

interface LocalMessage {
  id: string;
  text: string;
  fromBoard: boolean;
  memberName?: string;
  createdAt: number;
}

const ROLES = [
  { key: 'president', label: 'Presidente' },
  { key: 'sporting_director', label: 'Diretor Esportivo' },
  { key: 'cfo', label: 'Diretor Financeiro' },
  { key: 'technical_director', label: 'Diretor Técnico' },
  { key: 'vice_president', label: 'Vice-Presidente' },
  { key: 'marketing', label: 'Diretor de Marketing' },
  { key: 'other', label: 'Outro' },
];

const PERSONALITIES = ['exigente', 'paciente', 'ambicioso', 'conservador', 'impulsivo', 'equilibrado'];

function genId(): string {
  return `dm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function satisfactionColor(s: number): string {
  if (s >= 80) return Colors.success;
  if (s >= 60) return Colors.warning;
  return Colors.destructive;
}

function MemberAvatar({ member, size = 36 }: { member?: StoredMemberProfile; size?: number }) {
  const initials = member
    ? member.name.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '🏢';
  return (
    <View style={[styles.memberAvatarSmall, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.memberAvatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

function ChatBubble({ msg, members }: { msg: LocalMessage; members: StoredMemberProfile[] }) {
  const member = members.find((m) => m.name === msg.memberName);
  const timeStr = new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (msg.fromBoard) {
    return (
      <View style={styles.bubbleRowLeft}>
        <MemberAvatar member={member} />
        <View style={{ flex: 1, maxWidth: '80%' }}>
          {msg.memberName && <Text style={styles.senderName}>{msg.memberName}</Text>}
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

interface MemberManagementModalProps {
  visible: boolean;
  members: StoredMemberProfile[];
  careerClubName: string;
  careerClubLeague?: string;
  onClose: () => void;
  onSave: (members: StoredMemberProfile[]) => void;
}

function MemberManagementModal({
  visible, members, careerClubName, careerClubLeague, onClose, onSave,
}: MemberManagementModalProps) {
  const theme = useClubTheme();
  const [panel, setPanel] = useState<'list' | 'add' | 'ai'>('list');

  const [name, setName] = useState('');
  const [roleLabel, setRoleLabel] = useState('Presidente');
  const [patience, setPatience] = useState('70');
  const [personality, setPersonality] = useState('equilibrado');

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiRole, setAiRole] = useState('Presidente');
  const [aiPersonality, setAiPersonality] = useState('exigente');

  const resetAdd = () => { setName(''); setPatience('70'); };

  const handleAdd = () => {
    if (!name.trim()) return;
    const newMember: StoredMemberProfile = {
      id: genId(),
      name: name.trim(),
      roleLabel,
      description: '',
      mood: 'neutro',
      patience: Math.min(100, Math.max(0, parseInt(patience, 10) || 70)),
      satisfaction: 70,
    };
    onSave([...members, newMember]);
    resetAdd();
    setPanel('list');
  };

  const handleDelete = (id: string) => {
    Alert.alert('Remover membro', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: () => onSave(members.filter((m) => m.id !== id)),
      },
    ]);
  };

  const handleAIGenerate = async () => {
    setAiGenerating(true);
    try {
      const result = await api.diretoria.generateMember({
        roleLabel: aiRole,
        personalityStyle: aiPersonality,
        clubName: careerClubName,
        clubLeague: careerClubLeague,
      });
      const newMember: StoredMemberProfile = {
        id: genId(),
        name: result.name,
        roleLabel: aiRole,
        description: result.description,
        mood: 'neutro',
        patience: result.patience ?? 60,
        satisfaction: 70,
      };
      onSave([...members, newMember]);
      setPanel('list');
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o membro. Tente novamente.');
    }
    setAiGenerating(false);
  };

  const handleClose = () => { resetAdd(); setPanel('list'); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={panel !== 'list' ? () => setPanel('list') : handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={panel !== 'list' ? 'chevron-back' : 'close'}
                size={22}
                color={Colors.mutedForeground}
              />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {panel === 'list' ? 'Gerenciar Diretoria' : panel === 'add' ? 'Novo Membro' : 'Gerar com IA'}
            </Text>
            <View style={{ width: 22 }} />
          </View>

          {panel === 'list' && (
            <>
              <ScrollView contentContainerStyle={styles.memberList}>
                {members.length === 0 && (
                  <View style={styles.emptyMembers}>
                    <Text style={{ fontSize: 36 }}>🏢</Text>
                    <Text style={styles.emptyMembersText}>Nenhum membro adicionado</Text>
                  </View>
                )}
                {members.map((m) => (
                  <View key={m.id} style={styles.memberListRow}>
                    <MemberAvatar member={m} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberListName}>{m.name}</Text>
                      <Text style={styles.memberListRole}>{m.roleLabel ?? m.role ?? 'Membro'}</Text>
                    </View>
                    <View style={styles.memberListMeta}>
                      <Text style={[styles.memberSat, { color: satisfactionColor(m.satisfaction ?? 70) }]}>
                        {m.satisfaction ?? 70}%
                      </Text>
                      <TouchableOpacity onPress={() => handleDelete(m.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.memberListFooter}>
                <TouchableOpacity
                  style={[styles.addMemberBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.12)`, borderColor: `rgba(${theme.primaryRgb},0.3)` }]}
                  onPress={() => setPanel('add')}
                >
                  <Ionicons name="person-add-outline" size={18} color={theme.primary} />
                  <Text style={[styles.addMemberBtnText, { color: theme.primary }]}>Adicionar manualmente</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addMemberBtn, { backgroundColor: 'rgba(139,92,246,0.1)', borderColor: 'rgba(139,92,246,0.3)' }]}
                  onPress={() => setPanel('ai')}
                >
                  <Ionicons name="sparkles-outline" size={18} color="#8B5CF6" />
                  <Text style={[styles.addMemberBtnText, { color: '#8B5CF6' }]}>Gerar com IA</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {panel === 'add' && (
            <>
              <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>NOME</Text>
                  <TextInput
                    style={styles.textInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="Nome do dirigente"
                    placeholderTextColor={Colors.mutedForeground}
                    autoFocus
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>CARGO</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {ROLES.map((r) => (
                        <TouchableOpacity
                          key={r.key}
                          style={[styles.chip, roleLabel === r.label && { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }]}
                          onPress={() => setRoleLabel(r.label)}
                        >
                          <Text style={[styles.chipText, roleLabel === r.label && { color: theme.primary }]}>{r.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>PERSONALIDADE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {PERSONALITIES.map((p) => (
                        <TouchableOpacity
                          key={p}
                          style={[styles.chip, personality === p && { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }]}
                          onPress={() => setPersonality(p)}
                        >
                          <Text style={[styles.chipText, personality === p && { color: theme.primary }]}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>PACIÊNCIA (0-100)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={patience}
                    onChangeText={setPatience}
                    keyboardType="number-pad"
                    placeholder="70"
                    placeholderTextColor={Colors.mutedForeground}
                  />
                </View>
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.2)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }, !name.trim() && { opacity: 0.5 }]}
                  onPress={handleAdd}
                  disabled={!name.trim()}
                >
                  <Text style={[styles.saveBtnText, { color: theme.primary }]}>Adicionar Membro</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {panel === 'ai' && (
            <>
              <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={styles.aiHint}>A IA vai gerar um dirigente com nome, personalidade e descrição únicos para o {careerClubName}.</Text>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>CARGO</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {ROLES.map((r) => (
                        <TouchableOpacity
                          key={r.key}
                          style={[styles.chip, aiRole === r.label && { backgroundColor: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.4)' }]}
                          onPress={() => setAiRole(r.label)}
                        >
                          <Text style={[styles.chipText, aiRole === r.label && { color: '#8B5CF6' }]}>{r.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>PERSONALIDADE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {PERSONALITIES.map((p) => (
                        <TouchableOpacity
                          key={p}
                          style={[styles.chip, aiPersonality === p && { backgroundColor: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.4)' }]}
                          onPress={() => setAiPersonality(p)}
                        >
                          <Text style={[styles.chipText, aiPersonality === p && { color: '#8B5CF6' }]}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: 'rgba(139,92,246,0.2)', borderColor: 'rgba(139,92,246,0.4)' }, aiGenerating && { opacity: 0.7 }]}
                  onPress={handleAIGenerate}
                  disabled={aiGenerating}
                >
                  {aiGenerating ? (
                    <ActivityIndicator size="small" color="#8B5CF6" />
                  ) : (
                    <Text style={[styles.saveBtnText, { color: '#8B5CF6' }]}>✨ Gerar Dirigente</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function DiretoraScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer } = useCareer();
  const theme = useClubTheme();
  const qc = useQueryClient();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const listRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState('');
  const [selectedMember, setSelectedMember] = useState<StoredMemberProfile | null>(null);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [showManage, setShowManage] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['/api/data/career/diretoria', activeCareer?.id],
    queryFn: () => activeCareer ? api.careerData.get(activeCareer.id) : null,
    enabled: !!activeCareer?.id,
    staleTime: 1000 * 60 * 5,
  });

  const rawMembers: StoredMemberProfile[] = (data?.data?.diretoria_members ?? []) as StoredMemberProfile[];
  const rawNotifications: BoardNotification[] = (data?.data?.diretoria_notifications ?? []) as BoardNotification[];

  const notificationMessages: LocalMessage[] = rawNotifications.map((n) => ({
    id: n.id,
    text: n.message,
    fromBoard: true,
    memberName: n.memberName,
    createdAt: n.createdAt,
  }));

  const seenIds = new Set<string>();
  const allMessages: LocalMessage[] = [...notificationMessages, ...localMessages]
    .filter((m) => {
      if (seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const avgSat = rawMembers.length > 0
    ? Math.round(rawMembers.reduce((s, m) => s + (m.satisfaction ?? 70), 0) / rawMembers.length)
    : null;

  const unreadCount = rawNotifications.filter((n) => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: async () => {
      if (!activeCareer) return;
      await api.careerData.set(activeCareer.id, 'diretoria_notifications', rawNotifications.map((n) => ({ ...n, read: true })));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/data/career/diretoria', activeCareer?.id] }),
  });

  const saveMembersMutation = useMutation({
    mutationFn: async (members: StoredMemberProfile[]) => {
      if (!activeCareer) return;
      await api.diretoria.saveMembers(activeCareer.id, members as any);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/data/career/diretoria', activeCareer?.id] }),
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!activeCareer) throw new Error('No active career');
      const speaker = selectedMember ?? rawMembers[0] ?? null;
      if (!speaker) throw new Error('No board member available');

      const coachName = activeCareer.coach?.name ?? 'Técnico';
      const clubContext = {
        clubName: activeCareer.clubName,
        clubLeague: activeCareer.clubLeague ?? '',
        season: activeCareer.season,
        coachName,
        squadSize: 0,
        transfersCount: 0,
        recentMatches: [],
        leaguePosition: null,
        projeto: activeCareer.projeto,
      };

      const allMemberProfiles = rawMembers.map((m) => ({
        id: m.id, name: m.name,
        roleLabel: m.roleLabel ?? m.role ?? 'Membro',
        description: m.description ?? '',
        mood: m.mood ?? 'neutro',
        patience: m.patience ?? 50,
      }));

      const speakerProfile = {
        id: speaker.id, name: speaker.name,
        roleLabel: speaker.roleLabel ?? speaker.role ?? 'Membro',
        description: speaker.description ?? '',
        mood: speaker.mood ?? 'neutro',
        patience: speaker.patience ?? 50,
      };

      const chatHistory = localMessages.map((m) => ({
        role: m.fromBoard ? 'character' : 'user',
        content: m.text,
        memberName: m.fromBoard ? m.memberName : undefined,
      }));

      const result = await api.diretoria.sendTurn({
        speaker: speakerProfile,
        allMembers: allMemberProfiles,
        history: chatHistory,
        context: clubContext,
        triggerMessage: text,
      });

      const boardReplyId = `reply_${Date.now()}`;
      const boardMsg: LocalMessage = {
        id: boardReplyId,
        text: result.reply,
        fromBoard: true,
        memberName: speaker.name,
        createdAt: Date.now(),
      };

      const savedNotification = {
        id: boardReplyId, message: result.reply,
        read: true, createdAt: Date.now(), memberName: speaker.name,
      };
      await api.careerData.set(activeCareer.id, 'diretoria_notifications', [...rawNotifications, savedNotification]);
      return boardMsg;
    },
    onMutate: (text: string) => {
      const userMsg: LocalMessage = {
        id: `user_${Date.now()}`, text, fromBoard: false, createdAt: Date.now(),
      };
      setLocalMessages((prev) => [...prev, userMsg]);
      setInputText('');
    },
    onSuccess: (boardMsg) => {
      if (boardMsg) {
        setLocalMessages((prev) => [...prev, boardMsg]);
        qc.invalidateQueries({ queryKey: ['/api/data/career/diretoria', activeCareer?.id] });
      }
    },
    onError: () => {},
  });

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || sendMutation.isPending) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMutation.mutate(trimmed);
  }, [inputText, sendMutation]);

  const canSend = rawMembers.length > 0;

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
            <Text style={[styles.satSub, { color: satisfactionColor(avgSat) }]}>Satisfação: {avgSat}%</Text>
          )}
        </View>
        <View style={styles.topBarRight}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.unreadBtn}
              onPress={() => markReadMutation.mutate()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.unreadBadge}>{unreadCount}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => setShowManage(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="people-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {rawMembers.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.memberStrip}
        >
          {rawMembers.map((m) => {
            const satColor = satisfactionColor(m.satisfaction ?? 70);
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
                  <Text style={[styles.memberChipSat, { color: satColor }]}>{m.satisfaction ?? 70}%</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : allMessages.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🏢</Text>
          <Text style={styles.emptyTitle}>
            {rawMembers.length === 0 ? 'Diretoria vazia' : 'Sem mensagens'}
          </Text>
          <Text style={styles.emptyText}>
            {rawMembers.length === 0
              ? 'Toque em 👥 para adicionar membros da diretoria.'
              : 'Inicie uma conversa enviando uma mensagem.'}
          </Text>
          {rawMembers.length === 0 && (
            <TouchableOpacity
              style={[styles.openManageBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.3)` }]}
              onPress={() => setShowManage(true)}
            >
              <Ionicons name="people-outline" size={18} color={theme.primary} />
              <Text style={[styles.openManageBtnText, { color: theme.primary }]}>Gerenciar Diretoria</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={allMessages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={[styles.chatList, { paddingTop: 12 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => <ChatBubble msg={item} members={rawMembers} />}
        />
      )}

      {sendMutation.isPending && (
        <View style={styles.typingBar}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.typingText}>
            {(selectedMember ?? rawMembers[0])?.name?.split(' ')[0] ?? 'Diretoria'} está respondendo…
          </Text>
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          placeholder={
            !canSend
              ? 'Adicione membros da diretoria'
              : selectedMember
                ? `Mensagem para ${selectedMember.name.split(' ')[0]}…`
                : 'Escreva uma pauta ou pergunta…'
          }
          placeholderTextColor={Colors.mutedForeground}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={canSend && !sendMutation.isPending}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: inputText.trim() && canSend ? theme.primary : Colors.card }]}
          onPress={handleSend}
          disabled={!inputText.trim() || sendMutation.isPending || !canSend}
          activeOpacity={0.75}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color={inputText.trim() && canSend ? '#fff' : Colors.mutedForeground} />
          )}
        </TouchableOpacity>
      </View>

      <MemberManagementModal
        visible={showManage}
        members={rawMembers}
        careerClubName={activeCareer?.clubName ?? ''}
        careerClubLeague={activeCareer?.clubLeague}
        onClose={() => setShowManage(false)}
        onSave={(members) => {
          saveMembersMutation.mutate(members);
          setShowManage(false);
        }}
      />
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
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 70, justifyContent: 'flex-end' },
  unreadBtn: {
    backgroundColor: Colors.destructive,
    borderRadius: 99, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  unreadBadge: { fontSize: 11, fontWeight: '700' as const, color: '#fff', fontFamily: 'Inter_700Bold' },
  manageBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
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
  memberAvatarSmall: { backgroundColor: 'rgba(139,92,246,0.2)', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontWeight: '700' as const, color: '#8B5CF6', fontFamily: 'Inter_700Bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 22 },
  openManageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: Colors.radius, borderWidth: 1,
  },
  openManageBtnText: { fontSize: 14, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  chatList: { padding: 16 },
  bubbleRowLeft: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  bubbleRowRight: { flexDirection: 'row', justifyContent: 'flex-end' },
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
  typingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 6 },
  typingText: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
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
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet: {
    backgroundColor: Colors.backgroundLighter,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  memberList: { padding: 16, gap: 12, flexGrow: 1 },
  emptyMembers: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyMembersText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  memberListRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberListName: { fontSize: 15, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  memberListRole: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  memberListMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberSat: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  memberListFooter: {
    gap: 10, paddingHorizontal: 16, paddingBottom: 20, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 13, borderRadius: Colors.radius, borderWidth: 1 },
  addMemberBtnText: { fontSize: 14, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  modalBody: { padding: 20, gap: 20 },
  modalFooter: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  field: { gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '600' as const, color: Colors.mutedForeground, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  chipText: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  textInput: {
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15,
  },
  aiHint: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 20 },
  saveBtn: { borderRadius: Colors.radius, paddingVertical: 14, borderWidth: 1, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
});
