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
import { api, type DiretoraaMember, type DiretoraaMeeting, type MatchRecord, getMatchResult } from '@/lib/api';
import { Colors } from '@/constants/colors';

const MEETING_TOPICS = [
  'Avaliação do desempenho na temporada',
  'Situação no mercado de transferências',
  'Gestão financeira e orçamento',
  'Objetivos e metas da temporada',
  'Pressão por resultados recentes',
  'Renovações de contrato',
  'Planejamento tático',
  'Outro assunto',
];

interface MeetingModalProps {
  visible: boolean;
  members: DiretoraaMember[];
  onClose: () => void;
  onMeetingDone: (meeting: DiretoraaMeeting) => void;
  clubName: string;
  clubLeague?: string;
  coachName: string;
  seasonLabel: string;
  projeto?: string;
  recentMatches: MatchRecord[];
}

function MeetingModal({
  visible, members, onClose, onMeetingDone,
  clubName, clubLeague, coachName, seasonLabel, projeto, recentMatches,
}: MeetingModalProps) {
  const theme = useClubTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'select_member' | 'select_topic' | 'result'>('select_member');
  const [selectedMember, setSelectedMember] = useState<DiretoraaMember | null>(null);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ reply: string; newMood: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setStep('select_member');
    setSelectedMember(null);
    setSelectedTopic('');
    setCustomTopic('');
    setResult(null);
    setError(null);
    onClose();
  };

  const handleSelectMember = (m: DiretoraaMember) => {
    setSelectedMember(m);
    setStep('select_topic');
  };

  const handleStartMeeting = async () => {
    if (!selectedMember) return;
    const topic = selectedTopic === 'Outro assunto' ? customTopic.trim() : selectedTopic;
    if (!topic.trim()) return;

    setError(null);
    setLoading(true);
    try {
      const allMemberProfiles = members.map((m) => ({
        id: m.id,
        name: m.name,
        roleLabel: m.roleLabel ?? m.role ?? 'Membro',
        description: m.description ?? '',
        mood: m.mood ?? 'neutro',
        patience: m.patience ?? 50,
      }));
      const speakerProfile = {
        id: selectedMember.id,
        name: selectedMember.name,
        roleLabel: selectedMember.roleLabel ?? selectedMember.role ?? 'Membro',
        description: selectedMember.description ?? '',
        mood: selectedMember.mood ?? 'neutro',
        patience: selectedMember.patience ?? 50,
      };

      const matchCtxList = recentMatches.slice(0, 6).map((m) => {
        const r = getMatchResult(m.myScore, m.opponentScore);
        return {
          opponent: m.opponent,
          myScore: m.myScore,
          opponentScore: m.opponentScore,
          result: r,
          tournament: m.tournament,
          date: m.date,
          createdAt: m.createdAt,
        };
      });

      const res = await api.diretoria.meeting({
        speaker: speakerProfile,
        allMembers: allMemberProfiles,
        history: [],
        context: {
          clubName,
          clubLeague: clubLeague ?? '',
          season: seasonLabel,
          coachName,
          squadSize: 0,
          transfersCount: 0,
          recentMatches: matchCtxList,
          leaguePosition: null,
          projeto,
        },
        triggerMessage: topic,
        lang: 'pt',
      });

      setResult({ reply: res.reply, newMood: res.newMood });

      const newMeeting: DiretoraaMeeting = {
        id: `mtg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
        memberId: selectedMember.id,
        date: new Date().toLocaleDateString('pt-BR'),
        topic,
        outcome: res.reply,
        createdAt: Date.now(),
      };
      onMeetingDone(newMeeting);
      setStep('result');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('plano Free') || msg.includes('PLAN')) {
        setError('Reuniões formais requerem o plano Pro ou Ultra.');
      } else {
        setError('Não foi possível realizar a reunião. Tente novamente.');
      }
    }
    setLoading(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={step === 'select_member' ? handleClose : () => {
                if (step === 'result') { handleClose(); }
                else setStep('select_member');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={step === 'result' ? 'checkmark-circle-outline' : (step === 'select_member' ? 'close' : 'chevron-back')} size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {step === 'select_member' ? 'Convocar Reunião' : step === 'select_topic' ? 'Escolher Pauta' : 'Ata da Reunião'}
            </Text>
            <View style={{ width: 22 }} />
          </View>

          {step === 'select_member' && (
            <ScrollView contentContainerStyle={styles.meetingBody}>
              <Text style={styles.meetingHint}>Selecione o membro da diretoria para a reunião:</Text>
              {members.length === 0 ? (
                <View style={styles.meetingEmpty}>
                  <Text style={{ fontSize: 32 }}>🏢</Text>
                  <Text style={styles.meetingEmptyText}>Adicione membros à diretoria primeiro.</Text>
                </View>
              ) : (
                members.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.memberSelectRow}
                    onPress={() => handleSelectMember(m)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.memberAvatarSmall}>
                      <Text style={[styles.memberAvatarText, { fontSize: 14 }]}>
                        {m.name.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberListName}>{m.name}</Text>
                      <Text style={styles.memberListRole}>{m.roleLabel ?? m.role ?? 'Membro'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.mutedForeground} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}

          {step === 'select_topic' && (
            <>
              <ScrollView contentContainerStyle={styles.meetingBody} keyboardShouldPersistTaps="handled">
                <Text style={styles.meetingHint}>Pauta da reunião com {selectedMember?.name?.split(' ')[0]}:</Text>
                {MEETING_TOPICS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.topicRow,
                      selectedTopic === t && { backgroundColor: `rgba(${theme.primaryRgb},0.12)`, borderColor: `rgba(${theme.primaryRgb},0.35)` },
                    ]}
                    onPress={() => setSelectedTopic(t)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.topicText, selectedTopic === t && { color: theme.primary }]}>{t}</Text>
                    {selectedTopic === t && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                  </TouchableOpacity>
                ))}
                {selectedTopic === 'Outro assunto' && (
                  <TextInput
                    style={styles.topicInput}
                    value={customTopic}
                    onChangeText={setCustomTopic}
                    placeholder="Descreva a pauta…"
                    placeholderTextColor={Colors.mutedForeground}
                    multiline
                    maxLength={300}
                    autoFocus
                  />
                )}
                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning-outline" size={16} color={Colors.destructive} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
              </ScrollView>
              <View style={styles.meetingFooter}>
                <TouchableOpacity
                  style={[
                    styles.meetingBtn,
                    { backgroundColor: `rgba(${theme.primaryRgb},0.18)`, borderColor: `rgba(${theme.primaryRgb},0.4)` },
                    (!selectedTopic || loading) && { opacity: 0.5 },
                  ]}
                  onPress={handleStartMeeting}
                  disabled={!selectedTopic || loading}
                >
                  {loading
                    ? <ActivityIndicator size="small" color={theme.primary} />
                    : <>
                        <Ionicons name="people-outline" size={18} color={theme.primary} />
                        <Text style={[styles.meetingBtnText, { color: theme.primary }]}>Realizar Reunião</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 'result' && result && (
            <>
              <ScrollView contentContainerStyle={styles.meetingBody}>
                <View style={styles.ataCard}>
                  <View style={styles.ataHeader}>
                    <Text style={styles.ataTitle}>📋 Ata da Reunião</Text>
                    <Text style={styles.ataDate}>{new Date().toLocaleDateString('pt-BR')}</Text>
                  </View>
                  <View style={styles.ataMeta}>
                    <Text style={styles.ataMetaText}>Membro: {selectedMember?.name}</Text>
                    <Text style={styles.ataMetaText}>
                      Cargo: {selectedMember?.roleLabel ?? selectedMember?.role ?? 'Membro'}
                    </Text>
                    <Text style={styles.ataMetaText}>
                      Pauta: {selectedTopic === 'Outro assunto' ? customTopic : selectedTopic}
                    </Text>
                    <Text style={styles.ataMetaText}>
                      Estado: {result.newMood.charAt(0).toUpperCase() + result.newMood.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.ataDivider} />
                  <Text style={styles.ataBody}>{result.reply}</Text>
                </View>
              </ScrollView>
              <View style={styles.meetingFooter}>
                <TouchableOpacity
                  style={[styles.meetingBtn, { backgroundColor: `${Colors.success}18`, borderColor: `${Colors.success}35` }]}
                  onPress={handleClose}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={Colors.success} />
                  <Text style={[styles.meetingBtnText, { color: Colors.success }]}>Concluir</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
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

function MemberAvatar({ member, size = 36 }: { member?: DiretoraaMember; size?: number }) {
  const initials = member
    ? member.name.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '🏢';
  return (
    <View style={[styles.memberAvatarSmall, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.memberAvatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

function ChatBubble({ msg, members }: { msg: LocalMessage; members: DiretoraaMember[] }) {
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

type ManagePanel = 'list' | 'add' | 'edit' | 'ai' | 'meetings';

interface MemberFormState {
  name: string;
  roleLabel: string;
  personality: string;
  patience: string;
  description: string;
}

function defaultForm(m?: DiretoraaMember): MemberFormState {
  return {
    name: m?.name ?? '',
    roleLabel: m?.roleLabel ?? m?.role ?? 'Presidente',
    personality: m?.personality ?? 'equilibrado',
    patience: String(m?.patience ?? 70),
    description: m?.description ?? '',
  };
}

interface MemberManagementModalProps {
  visible: boolean;
  members: DiretoraaMember[];
  meetings: DiretoraaMeeting[];
  careerClubName: string;
  careerClubLeague?: string;
  onClose: () => void;
  onSaveMembers: (members: DiretoraaMember[]) => void;
}

function MemberManagementModal({
  visible, members, meetings, careerClubName, careerClubLeague, onClose, onSaveMembers,
}: MemberManagementModalProps) {
  const theme = useClubTheme();
  const [panel, setPanel] = useState<ManagePanel>('list');
  const [editingMember, setEditingMember] = useState<DiretoraaMember | null>(null);
  const [form, setForm] = useState<MemberFormState>(defaultForm());
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiRole, setAiRole] = useState('Presidente');
  const [aiPersonality, setAiPersonality] = useState('exigente');

  const setField = (key: keyof MemberFormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const openAdd = () => { setEditingMember(null); setForm(defaultForm()); setPanel('add'); };
  const openEdit = (m: DiretoraaMember) => { setEditingMember(m); setForm(defaultForm(m)); setPanel('edit'); };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const patience = Math.min(100, Math.max(0, parseInt(form.patience, 10) || 70));
    if (editingMember) {
      onSaveMembers(members.map((m) =>
        m.id === editingMember.id
          ? { ...m, name: form.name.trim(), roleLabel: form.roleLabel, patience, description: form.description.trim(), personality: form.personality }
          : m
      ));
    } else {
      const newMember: DiretoraaMember = {
        id: genId(),
        name: form.name.trim(),
        roleLabel: form.roleLabel,
        description: form.description.trim(),
        mood: 'neutro',
        patience,
        satisfaction: 70,
        personality: form.personality,
      };
      onSaveMembers([...members, newMember]);
    }
    setPanel('list');
  };

  const handleDelete = (id: string) => {
    Alert.alert('Remover membro', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: () => onSaveMembers(members.filter((m) => m.id !== id)),
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
      const newMember: DiretoraaMember = {
        id: genId(),
        name: result.name,
        roleLabel: aiRole,
        description: result.description,
        mood: 'neutro',
        patience: result.patience ?? 60,
        satisfaction: 70,
      };
      onSaveMembers([...members, newMember]);
      setPanel('list');
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o membro. Tente novamente.');
    }
    setAiGenerating(false);
  };

  const handleClose = () => { setPanel('list'); onClose(); };

  const goBack = () => setPanel('list');

  const panelTitle: Record<ManagePanel, string> = {
    list: 'Gerenciar Diretoria',
    add: 'Novo Membro',
    edit: 'Editar Membro',
    ai: 'Gerar com IA',
    meetings: 'Reuniões',
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={panel !== 'list' ? goBack : handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={panel !== 'list' ? 'chevron-back' : 'close'}
                size={22}
                color={Colors.mutedForeground}
              />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{panelTitle[panel]}</Text>
            <View style={{ width: 22 }} />
          </View>

          {panel === 'list' && (
            <>
              <ScrollView contentContainerStyle={styles.memberList} keyboardShouldPersistTaps="handled">
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
                      {m.description ? <Text style={styles.memberListDesc} numberOfLines={1}>{m.description}</Text> : null}
                    </View>
                    <View style={styles.memberListMeta}>
                      <Text style={[styles.memberSat, { color: satisfactionColor(m.satisfaction ?? 70) }]}>
                        {m.satisfaction ?? 70}%
                      </Text>
                      <TouchableOpacity onPress={() => openEdit(m)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="pencil-outline" size={16} color={Colors.mutedForeground} />
                      </TouchableOpacity>
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
                  onPress={openAdd}
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
                {meetings.length > 0 && (
                  <TouchableOpacity
                    style={[styles.addMemberBtn, { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' }]}
                    onPress={() => setPanel('meetings')}
                  >
                    <Ionicons name="calendar-outline" size={18} color={Colors.info} />
                    <Text style={[styles.addMemberBtnText, { color: Colors.info }]}>Ver reuniões ({meetings.length})</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {(panel === 'add' || panel === 'edit') && (
            <>
              <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>NOME</Text>
                  <TextInput
                    style={styles.textInput}
                    value={form.name}
                    onChangeText={(v) => setField('name', v)}
                    placeholder="Nome do dirigente"
                    placeholderTextColor={Colors.mutedForeground}
                    autoFocus={panel === 'add'}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>CARGO</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {ROLES.map((r) => (
                        <TouchableOpacity
                          key={r.key}
                          style={[styles.chip, form.roleLabel === r.label && { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }]}
                          onPress={() => setField('roleLabel', r.label)}
                        >
                          <Text style={[styles.chipText, form.roleLabel === r.label && { color: theme.primary }]}>{r.label}</Text>
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
                          style={[styles.chip, form.personality === p && { backgroundColor: `rgba(${theme.primaryRgb},0.15)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }]}
                          onPress={() => setField('personality', p)}
                        >
                          <Text style={[styles.chipText, form.personality === p && { color: theme.primary }]}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>PACIÊNCIA (0–100)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={form.patience}
                    onChangeText={(v) => setField('patience', v)}
                    keyboardType="number-pad"
                    placeholder="70"
                    placeholderTextColor={Colors.mutedForeground}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>DESCRIÇÃO (opcional)</Text>
                  <TextInput
                    style={[styles.textInput, { minHeight: 60 }]}
                    value={form.description}
                    onChangeText={(v) => setField('description', v)}
                    placeholder="Personalidade, histórico…"
                    placeholderTextColor={Colors.mutedForeground}
                    multiline
                  />
                </View>
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: `rgba(${theme.primaryRgb},0.2)`, borderColor: `rgba(${theme.primaryRgb},0.4)` }, !form.name.trim() && { opacity: 0.5 }]}
                  onPress={handleSave}
                  disabled={!form.name.trim()}
                >
                  <Text style={[styles.saveBtnText, { color: theme.primary }]}>
                    {panel === 'edit' ? 'Salvar Alterações' : 'Adicionar Membro'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {panel === 'ai' && (
            <>
              <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={styles.aiHint}>
                  A IA vai gerar um dirigente com nome, personalidade e descrição únicos para o {careerClubName}.
                </Text>
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
                  {aiGenerating
                    ? <ActivityIndicator size="small" color="#8B5CF6" />
                    : <Text style={[styles.saveBtnText, { color: '#8B5CF6' }]}>✨ Gerar Dirigente</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          )}

          {panel === 'meetings' && (
            <ScrollView contentContainerStyle={styles.meetingsList}>
              {meetings.length === 0 ? (
                <View style={styles.emptyMembers}>
                  <Text style={{ fontSize: 36 }}>📅</Text>
                  <Text style={styles.emptyMembersText}>Sem reuniões registradas</Text>
                </View>
              ) : (
                [...meetings].sort((a, b) => b.createdAt - a.createdAt).map((meeting) => (
                  <View key={meeting.id} style={styles.meetingCard}>
                    <View style={styles.meetingCardTop}>
                      <Text style={styles.meetingTopic}>{meeting.topic}</Text>
                      <Text style={styles.meetingDate}>{meeting.date}</Text>
                    </View>
                    {meeting.outcome ? (
                      <Text style={styles.meetingOutcome}>{meeting.outcome}</Text>
                    ) : null}
                    {meeting.memberId && (
                      <Text style={styles.meetingMember}>
                        {members.find((m) => m.id === meeting.memberId)?.name ?? meeting.memberId}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function DiretoraScreen() {
  const insets = useSafeAreaInsets();
  const { activeCareer, activeSeason } = useCareer();
  const theme = useClubTheme();
  const qc = useQueryClient();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const listRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState('');
  const [selectedMember, setSelectedMember] = useState<DiretoraaMember | null>(null);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'reunioes'>('chat');

  const { data, isLoading } = useQuery({
    queryKey: ['/api/data/career/diretoria', activeCareer?.id],
    queryFn: () => activeCareer ? api.careerData.get(activeCareer.id) : null,
    enabled: !!activeCareer?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: seasonData } = useQuery({
    queryKey: ['/api/data/season', activeSeason?.id],
    queryFn: () => activeSeason ? api.seasonData.get(activeSeason.id) : null,
    enabled: !!activeSeason?.id,
    staleTime: 1000 * 60 * 5,
  });

  const recentMatches: MatchRecord[] = [...(seasonData?.data?.matches ?? [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

  const rawMembers: DiretoraaMember[] = (data?.data?.diretoria_members ?? []) as DiretoraaMember[];
  const rawMeetings: DiretoraaMeeting[] = (data?.data?.diretoria_meetings ?? []) as DiretoraaMeeting[];
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
    mutationFn: async (members: DiretoraaMember[]) => {
      if (!activeCareer) return;
      await api.diretoria.saveMembers(activeCareer.id, members);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/data/career/diretoria', activeCareer?.id] }),
  });

  const saveMeetingsMutation = useMutation({
    mutationFn: async (meetings: DiretoraaMeeting[]) => {
      if (!activeCareer) return;
      await api.diretoria.saveMeetings(activeCareer.id, meetings);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/data/career/diretoria', activeCareer?.id] }),
  });

  const handleMeetingDone = useCallback((meeting: DiretoraaMeeting) => {
    const updated = [meeting, ...rawMeetings];
    saveMeetingsMutation.mutate(updated);
  }, [rawMeetings, saveMeetingsMutation]);

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
        id: m.id,
        name: m.name,
        roleLabel: m.roleLabel ?? m.role ?? 'Membro',
        description: m.description ?? '',
        mood: m.mood ?? 'neutro',
        patience: m.patience ?? 50,
      }));

      const speakerProfile = {
        id: speaker.id,
        name: speaker.name,
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
        id: boardReplyId,
        message: result.reply,
        read: true,
        createdAt: Date.now(),
        memberName: speaker.name,
      };
      await api.careerData.set(activeCareer.id, 'diretoria_notifications', [...rawNotifications, savedNotification]);
      return boardMsg;
    },
    onMutate: (text: string) => {
      const userMsg: LocalMessage = {
        id: `user_${Date.now()}`,
        text,
        fromBoard: false,
        createdAt: Date.now(),
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
          {rawMembers.length > 0 && (
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => setShowMeeting(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.info} />
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

      {rawMembers.length > 0 && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'chat' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('chat')}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === 'chat' ? theme.primary : Colors.mutedForeground }]}>
              Chat
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'reunioes' && { borderBottomColor: Colors.info, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('reunioes')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.tabBtnText, { color: activeTab === 'reunioes' ? Colors.info : Colors.mutedForeground }]}>
                Reuniões
              </Text>
              {rawMeetings.length > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: `${Colors.info}22` }]}>
                  <Text style={[styles.tabBadgeText, { color: Colors.info }]}>{rawMeetings.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'reunioes' ? (
        rawMeetings.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 40 }}>📋</Text>
            <Text style={styles.emptyTitle}>Nenhuma reunião</Text>
            <Text style={styles.emptyText}>Toque em 📅 para convocar uma reunião com a diretoria.</Text>
            <TouchableOpacity
              style={[styles.openManageBtn, { backgroundColor: `${Colors.info}15`, borderColor: `${Colors.info}30` }]}
              onPress={() => setShowMeeting(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={Colors.info} />
              <Text style={[styles.openManageBtnText, { color: Colors.info }]}>Convocar Reunião</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.meetingsList, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {[...rawMeetings].sort((a, b) => b.createdAt - a.createdAt).map((meeting) => {
              const member = rawMembers.find((m) => m.id === meeting.memberId);
              return (
                <View key={meeting.id} style={styles.meetingCard}>
                  <View style={styles.meetingCardTop}>
                    <Text style={styles.meetingTopic} numberOfLines={1}>{meeting.topic}</Text>
                    <Text style={styles.meetingDate}>{meeting.date}</Text>
                  </View>
                  {member && (
                    <Text style={styles.meetingMember}>👤 {member.name} — {member.role}</Text>
                  )}
                  {meeting.outcome && (
                    <Text style={styles.meetingOutcome} numberOfLines={4}>{meeting.outcome}</Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )
      ) : isLoading ? (
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

      {activeTab === 'chat' && sendMutation.isPending && (
        <View style={styles.typingBar}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.typingText}>
            {(selectedMember ?? rawMembers[0])?.name?.split(' ')[0] ?? 'Diretoria'} está respondendo…
          </Text>
        </View>
      )}

      {activeTab === 'chat' && (
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
            {sendMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color={inputText.trim() && canSend ? '#fff' : Colors.mutedForeground} />
            }
          </TouchableOpacity>
        </View>
      )}

      <MemberManagementModal
        visible={showManage}
        members={rawMembers}
        meetings={rawMeetings}
        careerClubName={activeCareer?.clubName ?? ''}
        careerClubLeague={activeCareer?.clubLeague}
        onClose={() => setShowManage(false)}
        onSaveMembers={(members) => {
          saveMembersMutation.mutate(members);
          setShowManage(false);
        }}
      />

      <MeetingModal
        visible={showMeeting}
        members={rawMembers}
        onClose={() => setShowMeeting(false)}
        onMeetingDone={handleMeetingDone}
        clubName={activeCareer?.clubName ?? ''}
        clubLeague={activeCareer?.clubLeague}
        coachName={activeCareer?.coach?.name ?? 'Técnico'}
        seasonLabel={activeSeason?.label ?? activeCareer?.season ?? ''}
        projeto={activeCareer?.projeto}
        recentMatches={recentMatches}
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
  memberList: { padding: 16, gap: 14, flexGrow: 1 },
  emptyMembers: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyMembersText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  memberListRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberListName: { fontSize: 15, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold' },
  memberListRole: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  memberListDesc: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', marginTop: 1 },
  memberListMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberSat: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  memberListFooter: {
    gap: 10, paddingHorizontal: 16, paddingBottom: 20, paddingTop: 10,
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  tabBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnText: { fontSize: 14, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99 },
  tabBadgeText: { fontSize: 11, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  meetingsList: { padding: 16, gap: 12 },
  meetingCard: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 6,
  },
  meetingCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meetingTopic: { fontSize: 14, fontWeight: '600' as const, color: Colors.foreground, fontFamily: 'Inter_600SemiBold', flex: 1 },
  meetingDate: { fontSize: 11, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  meetingOutcome: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  meetingMember: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  meetingBody: { padding: 16, gap: 10 },
  meetingHint: { fontSize: 13, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', fontStyle: 'italic', marginBottom: 4 },
  meetingEmpty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  meetingEmptyText: { fontSize: 14, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  memberSelectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  topicRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  topicText: { fontSize: 14, color: Colors.foreground, fontFamily: 'Inter_400Regular', flex: 1 },
  topicInput: {
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
    color: Colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14,
    minHeight: 60, textAlignVertical: 'top',
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${Colors.destructive}15`, borderRadius: Colors.radius,
    padding: 10, borderWidth: 1, borderColor: `${Colors.destructive}30`,
  },
  errorText: { fontSize: 13, color: Colors.destructive, fontFamily: 'Inter_400Regular', flex: 1 },
  meetingFooter: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  meetingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: Colors.radius, paddingVertical: 14, borderWidth: 1,
  },
  meetingBtnText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  ataCard: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusLg,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 10,
  },
  ataHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ataTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.foreground, fontFamily: 'Inter_700Bold' },
  ataDate: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  ataMeta: { gap: 3 },
  ataMetaText: { fontSize: 12, color: Colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  ataDivider: { height: 1, backgroundColor: Colors.border },
  ataBody: { fontSize: 14, color: Colors.foreground, fontFamily: 'Inter_400Regular', lineHeight: 22 },
});
