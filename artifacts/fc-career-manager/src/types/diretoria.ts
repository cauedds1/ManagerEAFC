export type BoardRole = "presidente" | "auxiliar_tecnico" | "gestor_financeiro" | "custom";

export type MoodLevel = "excelente" | "bom" | "neutro" | "tenso" | "irritado" | "furioso";

export type PersonalityStyle =
  | "conservador"
  | "agressivo"
  | "analitico"
  | "emocional"
  | "diplomatico"
  | "exigente";

export interface BoardMember {
  id: string;
  name: string;
  role: BoardRole;
  roleLabel: string;
  description: string;
  personalityStyle?: PersonalityStyle;
  patience: number;
  mood: MoodLevel;
  avatarColor: string;
  createdAt: number;
  messageLimit?: number;
  userMessagesSent?: number;
}

export interface DiretoriaMessage {
  id: string;
  role: "user" | "character";
  content: string;
  timestamp: number;
}

export interface MeetingMessage {
  id: string;
  role: "user" | "character" | "error";
  memberId?: string;
  memberName?: string;
  memberColor?: string;
  content: string;
  timestamp: number;
}

export interface MeetingRecord {
  id: string;
  careerId: string;
  reason: string;
  initiatedBy: "user" | "system";
  messages: MeetingMessage[];
  memberMoods: Record<string, MoodLevel>;
  createdAt: number;
  closedAt?: number;
}

export interface BoardConversation {
  memberId: string;
  messages: DiretoriaMessage[];
  updatedAt: number;
}

export interface PendingNotification {
  memberId: string;
  preview: string;
  triggeredAt: number;
}

export interface MeetingTrigger {
  reason: string;
  severity: "low" | "medium" | "high";
}
