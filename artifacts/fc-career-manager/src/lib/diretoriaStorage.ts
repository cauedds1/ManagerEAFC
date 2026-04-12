import type {
  BoardMember,
  DiretoriaMessage,
  MeetingRecord,
  PendingNotification,
} from "@/types/diretoria";
import { putCareerData } from "@/lib/apiStorage";

const membersKey = (careerId: string) => `fc-diretoria-members-${careerId}`;
const convKey = (careerId: string, memberId: string) =>
  `fc-diretoria-conv-${careerId}-${memberId}`;
const meetingsKey = (careerId: string) => `fc-diretoria-meetings-${careerId}`;
const notifKey = (careerId: string) => `fc-diretoria-notifications-${careerId}`;

export function getMembers(careerId: string): BoardMember[] {
  try {
    const raw = localStorage.getItem(membersKey(careerId));
    return raw ? (JSON.parse(raw) as BoardMember[]) : [];
  } catch {
    return [];
  }
}

export function saveMembers(careerId: string, members: BoardMember[]): void {
  try {
    localStorage.setItem(membersKey(careerId), JSON.stringify(members));
  } catch {}
  void putCareerData(careerId, "diretoria_members", members);
}

export function addMember(careerId: string, member: BoardMember): void {
  const members = getMembers(careerId);
  members.push(member);
  saveMembers(careerId, members);
}

export function updateMember(
  careerId: string,
  memberId: string,
  updates: Partial<BoardMember>,
): void {
  const members = getMembers(careerId);
  const idx = members.findIndex((m) => m.id === memberId);
  if (idx >= 0) {
    members[idx] = { ...members[idx], ...updates };
    saveMembers(careerId, members);
  }
}

export function removeMember(careerId: string, memberId: string): void {
  const members = getMembers(careerId).filter((m) => m.id !== memberId);
  saveMembers(careerId, members);
  try {
    localStorage.removeItem(convKey(careerId, memberId));
  } catch {}
  void putCareerData(careerId, `conv_${memberId}`, null);
}

export function getConversation(
  careerId: string,
  memberId: string,
): DiretoriaMessage[] {
  try {
    const raw = localStorage.getItem(convKey(careerId, memberId));
    return raw ? (JSON.parse(raw) as DiretoriaMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveConversation(
  careerId: string,
  memberId: string,
  messages: DiretoriaMessage[],
): void {
  try {
    localStorage.setItem(convKey(careerId, memberId), JSON.stringify(messages));
  } catch {}
  void putCareerData(careerId, `conv_${memberId}`, messages);
}

export function getMeetings(careerId: string): MeetingRecord[] {
  try {
    const raw = localStorage.getItem(meetingsKey(careerId));
    return raw ? (JSON.parse(raw) as MeetingRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveMeeting(careerId: string, meeting: MeetingRecord): void {
  const meetings = getMeetings(careerId);
  const idx = meetings.findIndex((m) => m.id === meeting.id);
  if (idx >= 0) {
    meetings[idx] = meeting;
  } else {
    meetings.unshift(meeting);
  }
  try {
    localStorage.setItem(meetingsKey(careerId), JSON.stringify(meetings));
  } catch {}
  void putCareerData(careerId, "diretoria_meetings", meetings);
}

export function getNotifications(careerId: string): PendingNotification[] {
  try {
    const raw = localStorage.getItem(notifKey(careerId));
    return raw ? (JSON.parse(raw) as PendingNotification[]) : [];
  } catch {
    return [];
  }
}

export function saveNotifications(
  careerId: string,
  notifs: PendingNotification[],
): void {
  try {
    localStorage.setItem(notifKey(careerId), JSON.stringify(notifs));
  } catch {}
  void putCareerData(careerId, "diretoria_notifications", notifs);
}

export function addNotification(
  careerId: string,
  notif: PendingNotification,
): void {
  const notifs = getNotifications(careerId);
  const idx = notifs.findIndex((n) => n.memberId === notif.memberId);
  if (idx >= 0) {
    notifs[idx] = notif;
  } else {
    notifs.push(notif);
  }
  saveNotifications(careerId, notifs);
}

export function clearNotification(careerId: string, memberId: string): void {
  const notifs = getNotifications(careerId).filter(
    (n) => n.memberId !== memberId,
  );
  saveNotifications(careerId, notifs);
}

const cooldownKey = (careerId: string) => `fc-diretoria-cooldown-${careerId}`;
const pendingMeetingKey = (careerId: string) => `fc-diretoria-pending-meeting-${careerId}`;

export function getMemberCooldowns(careerId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(cooldownKey(careerId));
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function setMemberCooldown(careerId: string, memberId: string, matchCount: number): void {
  const cooldowns = getMemberCooldowns(careerId);
  cooldowns[memberId] = matchCount;
  try {
    localStorage.setItem(cooldownKey(careerId), JSON.stringify(cooldowns));
  } catch {}
}

export function getPendingMeetingTrigger(
  careerId: string,
): { reason: string; severity: "low" | "medium" | "high" } | null {
  try {
    const raw = localStorage.getItem(pendingMeetingKey(careerId));
    return raw
      ? (JSON.parse(raw) as { reason: string; severity: "low" | "medium" | "high" })
      : null;
  } catch {
    return null;
  }
}

export function setPendingMeetingTrigger(
  careerId: string,
  trigger: { reason: string; severity: "low" | "medium" | "high" } | null,
): void {
  try {
    if (trigger) {
      localStorage.setItem(pendingMeetingKey(careerId), JSON.stringify(trigger));
    } else {
      localStorage.removeItem(pendingMeetingKey(careerId));
    }
  } catch {}
}

export function generateMemberId(): string {
  return `member-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateMeetingId(): string {
  return `meeting-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateMessageId(): string {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
