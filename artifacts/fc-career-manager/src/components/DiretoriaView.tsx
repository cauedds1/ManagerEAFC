import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Career } from "@/types/career";
import type { MatchRecord } from "@/types/match";
import type { TransferRecord } from "@/types/transfer";
import type {
  BoardMember,
  BoardRole,
  DiretoriaMessage,
  MeetingMessage,
  MeetingRecord,
  MeetingTrigger,
  MoodLevel,
  PendingNotification,
  PersonalityStyle,
} from "@/types/diretoria";
import {
  getMembers,
  addMember,
  updateMember,
  removeMember,
  getConversation,
  saveConversation,
  saveMeeting,
  getNotifications,
  addNotification,
  clearNotification,
  generateMemberId,
  generateMeetingId,
  generateMessageId,
} from "@/lib/diretoriaStorage";
import { getLeaguePosition } from "@/lib/leagueStorage";
import { getOpenAIKey } from "@/lib/openaiKeyStorage";
import type { SquadPlayer } from "@/lib/squadCache";
import { buildPlayerPerformanceContext } from "@/lib/playerContext";

interface DiretoriaViewProps {
  career: Career;
  matches: MatchRecord[];
  transfers: TransferRecord[];
  squadSize: number;
  allPlayers?: SquadPlayer[];
}

interface TransferSuggestion {
  name: string;
  position: string;
  age: number;
  currentClub: string;
  nationality: string;
  estimatedFee: string;
  reasoning: string;
}

const MOOD_CONFIG: Record<MoodLevel, { label: string; color: string; bg: string; emoji: string }> = {
  excelente: { label: "Excelente", color: "#34d399", bg: "rgba(52,211,153,0.12)", emoji: "😁" },
  bom:       { label: "Bom",       color: "#60a5fa", bg: "rgba(96,165,250,0.12)", emoji: "😊" },
  neutro:    { label: "Neutro",    color: "#94a3b8", bg: "rgba(148,163,184,0.1)", emoji: "😐" },
  tenso:     { label: "Tenso",     color: "#fbbf24", bg: "rgba(251,191,36,0.12)", emoji: "😰" },
  irritado:  { label: "Irritado",  color: "#fb923c", bg: "rgba(251,146,60,0.12)", emoji: "😠" },
  furioso:   { label: "Furioso",   color: "#f87171", bg: "rgba(248,113,113,0.12)", emoji: "🤬" },
};

const VALID_MOODS: MoodLevel[] = ["excelente", "bom", "neutro", "tenso", "irritado", "furioso"];
function validateMood(m: string): MoodLevel {
  return VALID_MOODS.includes(m as MoodLevel) ? (m as MoodLevel) : "neutro";
}

const AVATAR_PALETTE = [
  "#8B5CF6","#EC4899","#F59E0B","#10B981","#3B82F6",
  "#EF4444","#6366F1","#14B8A6","#F97316","#06B6D4",
];

const ROLE_OPTIONS: { value: BoardRole; label: string }[] = [
  { value: "presidente",       label: "Presidente" },
  { value: "auxiliar_tecnico", label: "Auxiliar Técnico" },
  { value: "gestor_financeiro",label: "Gestor Financeiro" },
  { value: "custom",           label: "Personalizado" },
];

const PERSONALITY_OPTIONS: { value: PersonalityStyle; label: string; desc: string }[] = [
  { value: "conservador", label: "Conservador", desc: "Prudente, avesso a riscos" },
  { value: "agressivo",   label: "Agressivo",   desc: "Impulsivo, exigente imediato" },
  { value: "analitico",   label: "Analítico",   desc: "Baseado em dados e fatos" },
  { value: "emocional",   label: "Emocional",   desc: "Reagente, apaixonado" },
  { value: "diplomatico", label: "Diplomático", desc: "Mediador, busca equilíbrio" },
  { value: "exigente",    label: "Exigente",    desc: "Alta expectativa constante" },
];

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function MoodBadge({ mood, small }: { mood: MoodLevel; small?: boolean }) {
  const cfg = MOOD_CONFIG[mood];
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${small ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"}`}
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}22` }}
    >
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function AvatarCircle({ member, size = 44 }: { member: BoardMember; size?: number }) {
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center font-black rounded-full select-none"
      style={{
        width: size,
        height: size,
        background: `${member.avatarColor}22`,
        border: `2px solid ${member.avatarColor}44`,
        color: member.avatarColor,
        fontSize: size * 0.34,
      }}
    >
      {getInitials(member.name)}
    </div>
  );
}

function TypingDots({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black opacity-60"
        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
      >
        ...
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-white/40 italic">{name} está digitando</span>
        <span className="flex gap-0.5">
          {[0,1,2].map(i => (
            <span
              key={i}
              className="w-1 h-1 rounded-full bg-white/30 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

interface CreateMemberModalProps {
  career: Career;
  membersCount: number;
  onClose: () => void;
  onCreated: (member: BoardMember) => void;
}

function CreateMemberModal({ career, membersCount, onClose, onCreated }: CreateMemberModalProps) {
  const [mode, setMode] = useState<"manual" | "auto">("auto");
  const [role, setRole] = useState<BoardRole>("presidente");
  const [roleLabel, setRoleLabel] = useState("Presidente");
  const [customRoleLabel, setCustomRoleLabel] = useState("");
  const [personalityStyle, setPersonalityStyle] = useState<PersonalityStyle>("conservador");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [patience, setPatience] = useState(60);
  const [extraTraits, setExtraTraits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (role !== "custom") {
      setRoleLabel(ROLE_OPTIONS.find(r => r.value === role)?.label ?? "");
    }
  }, [role]);

  const finalRoleLabel = role === "custom" ? customRoleLabel : roleLabel;

  const handleAutoGenerate = async () => {
    if (!finalRoleLabel.trim()) { setError("Informe o cargo."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/diretoria/generate-member", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-openai-key": getOpenAIKey() },
        body: JSON.stringify({
          roleLabel: finalRoleLabel,
          personalityStyle,
          clubName: career.clubName,
          clubLeague: career.clubLeague,
          extraTraits: extraTraits.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Erro ao gerar");
      const data = await res.json() as { name: string; description: string; patience: number };
      setName(data.name);
      setDescription(data.description);
      setPatience(data.patience);
      setMode("manual");
    } catch {
      setError("Erro ao gerar personagem. Verifique sua chave OpenAI.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!name.trim() || !description.trim() || !finalRoleLabel.trim()) {
      setError("Preencha nome, cargo e descrição.");
      return;
    }
    const member: BoardMember = {
      id: generateMemberId(),
      name: name.trim(),
      role,
      roleLabel: finalRoleLabel.trim(),
      description: description.trim(),
      personalityStyle,
      patience,
      mood: "neutro",
      avatarColor: AVATAR_PALETTE[membersCount % AVATAR_PALETTE.length],
      createdAt: Date.now(),
    };
    onCreated(member);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl glass overflow-hidden"
        style={{ border: "1px solid var(--surface-border)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <h2 className="text-white font-bold text-lg">Adicionar Membro</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div className="flex gap-2">
            {(["auto","manual"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: mode === m ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.05)",
                  color: mode === m ? "var(--club-primary)" : "rgba(255,255,255,0.4)",
                  border: `1px solid ${mode === m ? "rgba(var(--club-primary-rgb),0.4)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {m === "auto" ? "✨ Gerar com IA" : "✏️ Manual"}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-semibold uppercase tracking-wide">Cargo</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as BoardRole)}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white glass"
              style={{ border: "1px solid var(--surface-border)", outline: "none", background: "rgba(255,255,255,0.06)" }}
            >
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {role === "custom" && (
              <input
                value={customRoleLabel}
                onChange={(e) => setCustomRoleLabel(e.target.value)}
                placeholder="Nome do cargo personalizado"
                className="w-full mt-2 px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 glass"
                style={{ border: "1px solid var(--surface-border)", outline: "none", background: "rgba(255,255,255,0.06)" }}
              />
            )}
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-semibold uppercase tracking-wide">Estilo de Personalidade</label>
            <div className="grid grid-cols-3 gap-1.5">
              {PERSONALITY_OPTIONS.map(p => (
                <button key={p.value} onClick={() => setPersonalityStyle(p.value)}
                  className="py-2 px-2 rounded-xl text-xs font-semibold text-center transition-all"
                  style={{
                    background: personalityStyle === p.value ? "rgba(var(--club-primary-rgb),0.2)" : "rgba(255,255,255,0.04)",
                    color: personalityStyle === p.value ? "var(--club-primary)" : "rgba(255,255,255,0.5)",
                    border: `1px solid ${personalityStyle === p.value ? "rgba(var(--club-primary-rgb),0.35)" : "rgba(255,255,255,0.07)"}`,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {mode === "auto" && (
            <>
              <div>
                <label className="block text-xs text-white/50 mb-1.5 font-semibold uppercase tracking-wide">Traços Adicionais (opcional)</label>
                <input
                  value={extraTraits}
                  onChange={(e) => setExtraTraits(e.target.value)}
                  placeholder="Ex: veterano de 60 anos, ex-jogador profissional..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 glass"
                  style={{ border: "1px solid var(--surface-border)", outline: "none", background: "rgba(255,255,255,0.06)" }}
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                onClick={handleAutoGenerate}
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                style={{ background: "rgba(var(--club-primary-rgb),0.2)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.3)" }}
              >
                {loading ? "Gerando personagem..." : "✨ Gerar Personagem"}
              </button>
            </>
          )}

          {mode === "manual" && (
            <>
              <div>
                <label className="block text-xs text-white/50 mb-1.5 font-semibold uppercase tracking-wide">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 glass"
                  style={{ border: "1px solid var(--surface-border)", outline: "none", background: "rgba(255,255,255,0.06)" }}
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5 font-semibold uppercase tracking-wide">Personalidade e Comportamento</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva como este membro age, suas prioridades, nível de paciência..."
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 glass resize-none"
                  style={{ border: "1px solid var(--surface-border)", outline: "none", background: "rgba(255,255,255,0.06)" }}
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-2 font-semibold uppercase tracking-wide">
                  Paciência: {patience}/100
                </label>
                <input
                  type="range" min={0} max={100} value={patience}
                  onChange={(e) => setPatience(Number(e.target.value))}
                  className="w-full accent-[var(--club-primary)]"
                />
                <div className="flex justify-between text-[10px] text-white/30 mt-1">
                  <span>Explosivo</span><span>Paciente</span>
                </div>
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
            </>
          )}
        </div>

        {mode === "manual" && (
          <div className="px-5 py-4" style={{ borderTop: "1px solid var(--surface-border)" }}>
            <button
              onClick={handleSave}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: "rgba(var(--club-primary-rgb),0.2)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.3)" }}
            >
              Adicionar à Diretoria
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DiretoriaView({ career, matches, transfers, squadSize, allPlayers = [] }: DiretoriaViewProps) {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [conversations, setConversations] = useState<Record<string, DiretoriaMessage[]>>({});
  const [notifications, setNotifications] = useState<PendingNotification[]>([]);
  const [meetingTrigger, setMeetingTrigger] = useState<MeetingTrigger | null>(null);
  const [panel, setPanel] = useState<"list" | "chat" | "meeting">("list");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<MeetingRecord | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [meetingInput, setMeetingInput] = useState("");
  const [meetingResponding, setMeetingResponding] = useState(false);
  const [meetingTypingName, setMeetingTypingName] = useState<string | null>(null);
  const [suggestClose, setSuggestClose] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [triggerChecked, setTriggerChecked] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferPosition, setTransferPosition] = useState("");
  const [transferBudget, setTransferBudget] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSuggestions, setTransferSuggestions] = useState<TransferSuggestion[]>([]);
  const [transferError, setTransferError] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const meetingEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const meetingInputRef = useRef<HTMLTextAreaElement>(null);

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null;
  const activeConv = selectedMemberId ? (conversations[selectedMemberId] ?? []) : [];

  const playerPerformance = useMemo(() => {
    if (allPlayers.length === 0) return [];
    return buildPlayerPerformanceContext(career.id, allPlayers);
  }, [career.id, allPlayers]);

  const isGestor = (member: BoardMember) =>
    member.roleLabel.toLowerCase().includes("gestor") ||
    member.roleLabel.toLowerCase().includes("financeiro") ||
    member.roleLabel.toLowerCase().includes("transfer");

  const handleSuggestTransfer = async () => {
    if (!transferPosition.trim()) return;
    setTransferLoading(true);
    setTransferError("");
    setTransferSuggestions([]);
    try {
      const squadForContext = allPlayers.slice(0, 25).map((p) => ({ name: p.name, position: p.positionPtBr ?? p.position }));
      const res = await fetch("/api/diretoria/suggest-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-openai-key": getOpenAIKey() },
        body: JSON.stringify({
          context: buildClubContext(),
          position: transferPosition.trim(),
          currentSquad: squadForContext,
          estimatedBudget: transferBudget.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Erro ao buscar sugestões");
      const data = await res.json() as { suggestions: TransferSuggestion[] };
      setTransferSuggestions(data.suggestions ?? []);
    } catch {
      setTransferError("Erro ao buscar sugestões. Verifique sua chave OpenAI.");
    } finally {
      setTransferLoading(false);
    }
  };

  useEffect(() => {
    const ms = getMembers(career.id);
    setMembers(ms);
    const convs: Record<string, DiretoriaMessage[]> = {};
    for (const m of ms) {
      convs[m.id] = getConversation(career.id, m.id);
    }
    setConversations(convs);
    setNotifications(getNotifications(career.id));
  }, [career.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv, isTyping]);

  useEffect(() => {
    meetingEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMeeting?.messages, meetingTypingName]);

  const buildClubContext = useCallback(() => {
    const leaguePos = getLeaguePosition(career.id);
    const recentMatches = matches.slice(-10).reverse().map((m) => ({
      opponent: m.opponent,
      myScore: m.myScore,
      opponentScore: m.opponentScore,
      result: m.myScore > m.opponentScore ? "vitoria" as const
             : m.myScore < m.opponentScore ? "derrota" as const
             : "empate" as const,
      tournament: m.tournament,
      date: m.date,
    }));
    return {
      clubName: career.clubName,
      clubLeague: career.clubLeague,
      season: career.season,
      coachName: career.coach.name,
      squadSize,
      transfersCount: transfers.length,
      recentMatches,
      leaguePosition: leaguePos,
    };
  }, [career, matches, transfers, squadSize]);

  useEffect(() => {
    if (triggerChecked || members.length === 0 || matches.length === 0) return;
    setTriggerChecked(true);

    const lastChecked = Number(localStorage.getItem(`fc-diretoria-trigger-checked-${career.id}`) ?? "0");
    fetch("/api/diretoria/check-triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-openai-key": getOpenAIKey() },
      body: JSON.stringify({
        context: buildClubContext(),
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          roleLabel: m.roleLabel,
          description: m.description,
          mood: m.mood,
          patience: m.patience,
        })),
        lastCheckedAt: lastChecked,
        playerPerformance: playerPerformance.length > 0 ? playerPerformance : undefined,
      }),
    })
      .then((r) => r.json())
      .then((data: { notifications: { memberId: string; preview: string }[]; meetingTrigger: MeetingTrigger | null }) => {
        localStorage.setItem(`fc-diretoria-trigger-checked-${career.id}`, String(Date.now()));
        if (data.meetingTrigger) setMeetingTrigger(data.meetingTrigger);
        if (data.notifications?.length) {
          const fresh: PendingNotification[] = data.notifications.map((n) => ({
            memberId: n.memberId,
            preview: n.preview,
            triggeredAt: Date.now(),
          }));
          fresh.forEach((n) => addNotification(career.id, n));
          setNotifications(getNotifications(career.id));
        }
      })
      .catch(() => {});
  }, [triggerChecked, members, matches, career.id, buildClubContext]);

  const handleOpenChat = (memberId: string) => {
    setSelectedMemberId(memberId);
    setPanel("chat");
    clearNotification(career.id, memberId);
    setNotifications(getNotifications(career.id));
    setTimeout(() => chatInputRef.current?.focus(), 100);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !selectedMemberId || isTyping) return;
    const member = members.find((m) => m.id === selectedMemberId);
    if (!member) return;

    const userMsg: DiretoriaMessage = {
      id: generateMessageId(),
      role: "user",
      content: chatInput.trim(),
      timestamp: Date.now(),
    };
    const newConv = [...(conversations[selectedMemberId] ?? []), userMsg];
    const updatedConvs = { ...conversations, [selectedMemberId]: newConv };
    setConversations(updatedConvs);
    saveConversation(career.id, selectedMemberId, newConv);
    setChatInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/diretoria/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-openai-key": getOpenAIKey() },
        body: JSON.stringify({
          member: {
            id: member.id,
            name: member.name,
            roleLabel: member.roleLabel,
            description: member.description,
            mood: member.mood,
            patience: member.patience,
          },
          message: userMsg.content,
          history: newConv.slice(-14).map((m) => ({ role: m.role, content: m.content })),
          context: buildClubContext(),
        }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json() as { reply: string; newMood: string };
      const charMsg: DiretoriaMessage = {
        id: generateMessageId(),
        role: "character",
        content: data.reply,
        timestamp: Date.now(),
      };
      const finalConv = [...newConv, charMsg];
      const finalConvs = { ...updatedConvs, [selectedMemberId]: finalConv };
      setConversations(finalConvs);
      saveConversation(career.id, selectedMemberId, finalConv);
      const newMood = validateMood(data.newMood);
      updateMember(career.id, selectedMemberId, { mood: newMood });
      setMembers((prev) => prev.map((m) => m.id === selectedMemberId ? { ...m, mood: newMood } : m));
    } catch {
      const errMsg: DiretoriaMessage = {
        id: generateMessageId(),
        role: "character",
        content: "Desculpe, não consegui responder agora. Tente novamente.",
        timestamp: Date.now(),
      };
      const fallConv = [...newConv, errMsg];
      setConversations({ ...updatedConvs, [selectedMemberId]: fallConv });
      saveConversation(career.id, selectedMemberId, fallConv);
    } finally {
      setIsTyping(false);
    }
  };

  const handleStartMeeting = (reason: string, initiatedBy: "user" | "system" = "user") => {
    const meeting: MeetingRecord = {
      id: generateMeetingId(),
      careerId: career.id,
      reason,
      initiatedBy,
      messages: [],
      memberMoods: Object.fromEntries(members.map((m) => [m.id, m.mood])),
      createdAt: Date.now(),
    };
    setActiveMeeting(meeting);
    setPanel("meeting");
    setMeetingTrigger(null);
    setSuggestClose(false);
    setTimeout(() => meetingInputRef.current?.focus(), 100);
  };

  const handleSendMeetingMessage = async () => {
    if (!meetingInput.trim() || !activeMeeting || meetingResponding) return;

    const userMsg: MeetingMessage = {
      id: generateMessageId(),
      role: "user",
      content: meetingInput.trim(),
      timestamp: Date.now(),
    };
    let currentMeeting: MeetingRecord = {
      ...activeMeeting,
      messages: [...activeMeeting.messages, userMsg],
    };
    setActiveMeeting({ ...currentMeeting });
    setMeetingInput("");
    setMeetingResponding(true);
    setSuggestClose(false);

    let didSuggestClose = false;

    for (const member of members) {
      setMeetingTypingName(member.name);
      await new Promise((r) => setTimeout(r, 400));
      try {
        const res = await fetch("/api/diretoria/meeting", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-openai-key": getOpenAIKey() },
          body: JSON.stringify({
            speaker: {
              id: member.id,
              name: member.name,
              roleLabel: member.roleLabel,
              description: member.description,
              mood: member.mood,
              patience: member.patience,
            },
            allMembers: members.map((m) => ({
              id: m.id,
              name: m.name,
              roleLabel: m.roleLabel,
              description: m.description,
              mood: m.mood,
              patience: m.patience,
            })),
            history: currentMeeting.messages,
            context: buildClubContext(),
            triggerMessage: currentMeeting.reason,
          }),
        });
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const data = await res.json() as { reply: string; newMood: string; suggestClose: boolean; speakerMemberId: string };

        const charMsg: MeetingMessage = {
          id: generateMessageId(),
          role: "character",
          memberId: member.id,
          memberName: member.name,
          memberColor: member.avatarColor,
          content: data.reply,
          timestamp: Date.now(),
        };
        const newMood = validateMood(data.newMood);
        currentMeeting = {
          ...currentMeeting,
          messages: [...currentMeeting.messages, charMsg],
          memberMoods: { ...currentMeeting.memberMoods, [member.id]: newMood },
        };
        setActiveMeeting({ ...currentMeeting });
        updateMember(career.id, member.id, { mood: newMood });
        setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, mood: newMood } : m));
        if (data.suggestClose) didSuggestClose = true;
      } catch {
        // skip this member's turn
      }
    }

    setMeetingTypingName(null);
    setMeetingResponding(false);
    setSuggestClose(didSuggestClose);
    saveMeeting(career.id, currentMeeting);
  };

  const handleCloseMeeting = () => {
    if (!activeMeeting) return;
    const closed = { ...activeMeeting, closedAt: Date.now() };
    saveMeeting(career.id, closed);
    setActiveMeeting(null);
    setPanel("list");
    setSuggestClose(false);
    setMeetingResponding(false);
    setMeetingTypingName(null);
  };

  const handleMemberCreated = (member: BoardMember) => {
    addMember(career.id, member);
    setMembers((prev) => [...prev, member]);
    setConversations((prev) => ({ ...prev, [member.id]: [] }));
    setShowCreateModal(false);
  };

  const handleDeleteMember = (memberId: string) => {
    removeMember(career.id, memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setConversations((prev) => { const c = { ...prev }; delete c[memberId]; return c; });
    clearNotification(career.id, memberId);
    setNotifications(getNotifications(career.id));
    if (selectedMemberId === memberId) {
      setSelectedMemberId(null);
      setPanel("list");
    }
    setShowDeleteConfirm(null);
  };

  const memberNotif = (memberId: string) =>
    notifications.find((n) => n.memberId === memberId) ?? null;

  const totalNotifs = notifications.length;

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: "rgba(var(--club-primary-rgb),0.1)", border: "1px solid rgba(var(--club-primary-rgb),0.15)" }}
        >
          <svg className="w-10 h-10" style={{ color: "var(--club-primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-white font-black text-2xl mb-2">Montar Diretoria</h2>
        <p className="text-white/40 text-sm max-w-sm mb-8 leading-relaxed">
          Crie os membros da sua diretoria. Eles terão personalidade própria, reações emocionais e vão te pressionar ou elogiar conforme os resultados.
        </p>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "rgba(var(--club-primary-rgb),0.2)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.3)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Criar Diretoria
        </button>
        {showCreateModal && (
          <CreateMemberModal
            career={career}
            membersCount={0}
            onClose={() => setShowCreateModal(false)}
            onCreated={handleMemberCreated}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {meetingTrigger && panel !== "meeting" && (
        <div
          className="flex items-start gap-4 px-5 py-4 rounded-2xl"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)" }}
        >
          <span className="text-2xl flex-shrink-0 mt-0.5">🚨</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Reunião urgente solicitada</p>
            <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{meetingTrigger.reason}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setMeetingTrigger(null)}
              className="text-white/30 hover:text-white/60 transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <button
              onClick={() => handleStartMeeting(meetingTrigger.reason, "system")}
              className="px-3 py-1.5 rounded-lg font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "rgba(248,113,113,0.2)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}
            >
              Iniciar Reunião
            </button>
          </div>
        </div>
      )}

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          border: "1px solid var(--surface-border)",
          minHeight: 520,
          display: "grid",
          gridTemplateColumns: panel === "list" ? "1fr" : "clamp(200px,28%,260px) 1fr",
        }}
      >
        <div
          className={`flex flex-col ${panel !== "list" ? "" : ""}`}
          style={{ borderRight: panel !== "list" ? "1px solid var(--surface-border)" : undefined }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--surface-border)", background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">Diretoria</span>
              {totalNotifs > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(248,113,113,0.2)", color: "#f87171" }}
                >
                  {totalNotifs}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {members.length >= 1 && panel === "list" && (
                <button
                  onClick={() => handleStartMeeting("Reunião convocada pelo técnico")}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg font-semibold text-[11px] transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "rgba(var(--club-primary-rgb),0.12)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}
                  title="Convocar reunião"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Convocar Reunião
                </button>
              )}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:scale-[1.05]"
                style={{ background: "rgba(var(--club-primary-rgb),0.12)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}
                title="Adicionar membro"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {panel === "meeting" && (
              <button
                onClick={() => { setPanel("list"); setSelectedMemberId(null); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                style={{ borderBottom: "1px solid var(--surface-border)" }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Voltar
              </button>
            )}
            {members.map((member) => {
              const notif = memberNotif(member.id);
              const isActive = panel === "chat" && selectedMemberId === member.id;
              const mood = MOOD_CONFIG[member.mood];
              return (
                <button
                  key={member.id}
                  onClick={() => handleOpenChat(member.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                  style={{
                    background: isActive ? "rgba(var(--club-primary-rgb),0.1)" : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    borderLeft: isActive ? "2px solid var(--club-primary)" : "2px solid transparent",
                  }}
                >
                  <div className="relative flex-shrink-0">
                    <AvatarCircle member={member} size={38} />
                    {notif && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                        style={{ background: "#f87171", border: "2px solid var(--surface-bg, #0f172a)" }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-white text-xs font-bold truncate">{member.name}</span>
                      <span
                        className="flex-shrink-0 flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${mood.color}18`, color: mood.color, border: `1px solid ${mood.color}22` }}
                      >
                        {mood.emoji} {mood.label}
                      </span>
                    </div>
                    <span className="text-white/35 text-[10px] truncate block">{member.roleLabel}</span>
                    {notif && (
                      <span className="text-white/40 text-[10px] truncate block italic">{notif.preview}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {panel === "chat" && selectedMember && (
          <div className="flex flex-col min-h-0" style={{ height: 520 }}>
            <div
              className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--surface-border)", background: "rgba(255,255,255,0.02)" }}
            >
              <button
                onClick={() => { setPanel("list"); setSelectedMemberId(null); }}
                className="text-white/30 hover:text-white/70 transition-colors mr-1 sm:hidden"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <AvatarCircle member={selectedMember} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-sm">{selectedMember.name}</span>
                  <MoodBadge mood={selectedMember.mood} small />
                </div>
                <span className="text-white/40 text-xs">{selectedMember.roleLabel}</span>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(selectedMember.id)}
                className="text-white/20 hover:text-red-400/70 transition-colors p-1"
                title="Remover membro"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {activeConv.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <AvatarCircle member={selectedMember} size={52} />
                  <p className="text-white/50 text-sm mt-3 font-semibold">{selectedMember.name}</p>
                  <p className="text-white/25 text-xs mt-1 max-w-xs leading-relaxed">{selectedMember.description.slice(0, 120)}...</p>
                  <p className="text-white/20 text-xs mt-4">Comece uma conversa</p>
                </div>
              )}
              {activeConv.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                  {msg.role === "character" && (
                    <AvatarCircle member={selectedMember} size={28} />
                  )}
                  <div
                    className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                    style={msg.role === "user"
                      ? { background: "rgba(var(--club-primary-rgb),0.2)", color: "rgba(255,255,255,0.9)", borderBottomRightRadius: 4 }
                      : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)", borderBottomLeftRadius: 4 }
                    }
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && <TypingDots name={selectedMember.name} />}
              <div ref={chatEndRef} />
            </div>

            {selectedMember && isGestor(selectedMember) && (
              <div className="px-4 pb-2 flex-shrink-0">
                <button
                  onClick={() => { setShowTransferModal(true); setTransferSuggestions([]); setTransferError(""); setTransferPosition(""); setTransferBudget(""); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: "rgba(var(--club-primary-rgb),0.1)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.2)" }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                  Sugerir Reforços com IA
                </button>
              </div>
            )}

            <div
              className="flex items-end gap-2 px-4 py-3 flex-shrink-0"
              style={{ borderTop: "1px solid var(--surface-border)" }}
            >
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); }
                }}
                placeholder={`Fale com ${selectedMember.name}...`}
                rows={1}
                disabled={isTyping}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 resize-none glass disabled:opacity-50"
                style={{ border: "1px solid var(--surface-border)", outline: "none", background: "rgba(255,255,255,0.05)", maxHeight: 100 }}
              />
              <button
                onClick={handleSendChat}
                disabled={isTyping || !chatInput.trim()}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-[1.05] active:scale-[0.95] disabled:opacity-40"
                style={{ background: "rgba(var(--club-primary-rgb),0.2)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.3)" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          </div>
        )}

        {panel === "meeting" && activeMeeting && (
          <div className="flex flex-col min-h-0" style={{ height: 520 }}>
            <div
              className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--surface-border)", background: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏢</span>
                  <span className="text-white font-bold text-sm">Reunião de Diretoria</span>
                </div>
                <p className="text-white/35 text-xs truncate mt-0.5">{activeMeeting.reason}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {suggestClose && (
                  <span className="text-xs text-white/40 italic hidden sm:block">Pauta concluída</span>
                )}
                <button
                  onClick={handleCloseMeeting}
                  className="px-3 py-1.5 rounded-lg font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}
                >
                  Encerrar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {activeMeeting.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="flex -space-x-2 mb-4">
                    {members.slice(0, 3).map((m) => (
                      <AvatarCircle key={m.id} member={m} size={36} />
                    ))}
                  </div>
                  <p className="text-white/40 text-sm">Reunião iniciada</p>
                  <p className="text-white/20 text-xs mt-1 max-w-xs">
                    Abra a discussão — todos os membros da diretoria vão responder.
                  </p>
                </div>
              )}
              {activeMeeting.messages.map((msg) => {
                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div
                        className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                        style={{ background: "rgba(var(--club-primary-rgb),0.2)", color: "rgba(255,255,255,0.9)", borderBottomRightRadius: 4 }}
                      >
                        <span className="block text-[10px] opacity-50 mb-1 font-semibold">Técnico {career.coach.name}</span>
                        {msg.content}
                      </div>
                    </div>
                  );
                }
                const member = members.find((m) => m.id === msg.memberId);
                const color = msg.memberColor ?? "#94a3b8";
                return (
                  <div key={msg.id} className="flex justify-start gap-2">
                    <div
                      className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-black mt-1"
                      style={{ background: `${color}22`, border: `1.5px solid ${color}44`, color }}
                    >
                      {getInitials(msg.memberName ?? "?")}
                    </div>
                    <div
                      className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                      style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)", borderBottomLeftRadius: 4 }}
                    >
                      <span className="block text-[10px] mb-1 font-bold" style={{ color }}>
                        {msg.memberName}
                        {member && <span className="font-normal opacity-50"> · {member.roleLabel}</span>}
                      </span>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {meetingTypingName && <TypingDots name={meetingTypingName} />}
              {suggestClose && !meetingResponding && (
                <div className="flex justify-center">
                  <span
                    className="text-xs px-3 py-1 rounded-full"
                    style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}
                  >
                    Pauta concluída — você pode encerrar a reunião
                  </span>
                </div>
              )}
              <div ref={meetingEndRef} />
            </div>

            <div
              className="flex items-end gap-2 px-4 py-3 flex-shrink-0"
              style={{ borderTop: "1px solid var(--surface-border)" }}
            >
              <textarea
                ref={meetingInputRef}
                value={meetingInput}
                onChange={(e) => setMeetingInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMeetingMessage(); }
                }}
                placeholder="Fale para a reunião..."
                rows={1}
                disabled={meetingResponding}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 resize-none glass disabled:opacity-50"
                style={{ border: "1px solid var(--surface-border)", outline: "none", background: "rgba(255,255,255,0.05)", maxHeight: 100 }}
              />
              <button
                onClick={handleSendMeetingMessage}
                disabled={meetingResponding || !meetingInput.trim()}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-[1.05] active:scale-[0.95] disabled:opacity-40"
                style={{ background: "rgba(var(--club-primary-rgb),0.2)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.3)" }}
              >
                {meetingResponding ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                )}
              </button>
            </div>
          </div>
        )}

        {panel === "list" && (
          <div
            className="hidden sm:flex flex-col items-center justify-center text-center px-8"
            style={{ color: "rgba(255,255,255,0.15)" }}
          >
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-medium">Selecione um membro</p>
            <p className="text-xs mt-1 opacity-70">ou convoque uma reunião</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateMemberModal
          career={career}
          membersCount={members.length}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleMemberCreated}
        />
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
        >
          <div className="glass rounded-2xl p-6 max-w-xs w-full text-center" style={{ border: "1px solid var(--surface-border)" }}>
            <p className="text-white font-bold text-base mb-2">Remover membro?</p>
            <p className="text-white/40 text-sm mb-6">
              Todo o histórico de conversas será apagado. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white/60 hover:text-white/80 transition-colors glass"
                style={{ border: "1px solid var(--surface-border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteMember(showDeleteConfirm)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all"
                style={{ background: "rgba(248,113,113,0.2)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowTransferModal(false); }}
        >
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col glass"
            style={{ border: "1px solid var(--surface-border)", maxHeight: "88dvh" }}
          >
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--surface-border)" }}>
              <div>
                <h3 className="text-white font-bold text-base">Sugerir Reforços</h3>
                <p className="text-white/35 text-xs mt-0.5">IA sugere jogadores reais para {career.clubName}</p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-white/30 hover:text-white/70 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 font-semibold uppercase tracking-wider mb-2">Posição</label>
                  <input
                    value={transferPosition}
                    onChange={(e) => setTransferPosition(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSuggestTransfer(); }}
                    placeholder="Ex: Atacante, Goleiro..."
                    className="w-full px-3 py-3 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none glass"
                    style={{ border: "1px solid var(--surface-border)", background: "rgba(255,255,255,0.05)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 font-semibold uppercase tracking-wider mb-2">Orçamento (opcional)</label>
                  <input
                    value={transferBudget}
                    onChange={(e) => setTransferBudget(e.target.value)}
                    placeholder="Ex: €5M, €20M..."
                    className="w-full px-3 py-3 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none glass"
                    style={{ border: "1px solid var(--surface-border)", background: "rgba(255,255,255,0.05)" }}
                  />
                </div>
              </div>

              {!transferLoading && transferSuggestions.length === 0 && !transferError && (
                <button
                  onClick={handleSuggestTransfer}
                  disabled={!transferPosition.trim()}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: "var(--club-gradient)" }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Gerar Sugestões com IA
                </button>
              )}

              {transferLoading && (
                <div className="flex items-center justify-center gap-3 py-8">
                  <svg className="w-5 h-5 animate-spin text-white/40" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-white/40 text-sm">Pesquisando mercado...</span>
                </div>
              )}

              {transferError && (
                <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "rgba(252,165,165,0.9)" }}>
                  {transferError}
                </div>
              )}

              {transferSuggestions.length > 0 && (
                <div className="space-y-3">
                  {transferSuggestions.map((s, i) => (
                    <div key={i} className="rounded-xl p-4 flex flex-col gap-1.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-white font-bold text-sm">{s.name}</p>
                          <p className="text-white/40 text-xs">{s.nationality} · {s.age} anos · {s.currentClub}</p>
                        </div>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                          style={{ background: "rgba(var(--club-primary-rgb),0.15)", color: "var(--club-primary)", border: "1px solid rgba(var(--club-primary-rgb),0.25)" }}
                        >
                          {s.estimatedFee}
                        </span>
                      </div>
                      <p className="text-white/55 text-xs leading-relaxed">{s.reasoning}</p>
                    </div>
                  ))}
                  <button
                    onClick={handleSuggestTransfer}
                    className="w-full py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80 mt-1"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    Gerar novas sugestões
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiretoriaView;
