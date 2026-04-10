export type PortalTone =
  | "humoristico"
  | "serio"
  | "jornalistico"
  | "apaixonado"
  | "critico"
  | "ironico";

export const PORTAL_TONES: { id: PortalTone; emoji: string; label: string; description: string }[] = [
  { id: "humoristico",  emoji: "😂", label: "Humorístico",  description: "Posts engraçados, memes e piadas. Não leva nada a sério." },
  { id: "apaixonado",   emoji: "❤️", label: "Apaixonado",   description: "Torcedor fanático, emocional e incondicional." },
  { id: "critico",      emoji: "🔥", label: "Crítico",       description: "Corneteiro raiz. Questiona tudo, cobra resultado." },
  { id: "ironico",      emoji: "😏", label: "Irônico",       description: "Sarcástico e espirituoso. Tudo com uma dose de ironia." },
  { id: "jornalistico", emoji: "📰", label: "Jornalístico",  description: "Reportagens elaboradas com contexto e profundidade." },
  { id: "serio",        emoji: "🎯", label: "Sério",         description: "Cobertura factual, objetiva e sem exageros." },
];

export const PORTAL_TONE_PROMPTS: Record<PortalTone, string> = {
  humoristico:  "Tom HUMORÍSTICO — use humor, memes, piadas, trocadilhos e emojis engraçados. Os comentários devem ser engraçados e bem-humorados, com zoações e memes. Pode xingar jogador com bom humor.",
  apaixonado:   "Tom APAIXONADO — escrita emocional, dramática, cheia de amor pelo clube. Defende os jogadores, mas cobra quando necessário. Comentários com muita paixão e sentimento.",
  critico:      "Tom CRÍTICO/CORNETEIRO — questiona decisões, cobra resultados, aponta falhas. Não poupa ninguém, nem a comissão técnica. Comentários exigentes e impacientes. Pode xingar jogador.",
  ironico:      "Tom IRÔNICO/SARCÁSTICO — usa sarcasmo e ironia na escrita. Faz insinuações inteligentes, sorri debochado de situações. Comentários afiados e espirituosos.",
  jornalistico: "Tom JORNALÍSTICO — reportagem elaborada com contexto histórico, números e análise. Escrita profissional mas acessível. Comentários mais analíticos e debatedores.",
  serio:        "Tom SÉRIO/OBJETIVO — cobertura factual e direta ao ponto. Sem exageros, sem drama. Comentários racionais e equilibrados.",
};

export interface CustomPortal {
  id: string;
  careerId: string;
  name: string;
  description: string;
  tone: PortalTone;
  photo?: string;
  createdAt: number;
}

export const CUSTOM_PORTALS_EVENT = "fc-custom-portals-changed";
const MAX_PORTALS = 3;

function storageKey(careerId: string): string {
  return `fc-career-custom-portals-${careerId}`;
}

export function getCustomPortals(careerId: string): CustomPortal[] {
  try {
    const raw = localStorage.getItem(storageKey(careerId));
    if (!raw) return [];
    return JSON.parse(raw) as CustomPortal[];
  } catch {
    return [];
  }
}

export function saveCustomPortals(careerId: string, portals: CustomPortal[]): void {
  try {
    localStorage.setItem(storageKey(careerId), JSON.stringify(portals));
  } catch {}
}

export function addCustomPortal(careerId: string, portal: Omit<CustomPortal, "id" | "careerId" | "createdAt">): CustomPortal | null {
  const portals = getCustomPortals(careerId);
  if (portals.length >= MAX_PORTALS) return null;
  const newPortal: CustomPortal = {
    ...portal,
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    careerId,
    createdAt: Date.now(),
  };
  saveCustomPortals(careerId, [...portals, newPortal]);
  return newPortal;
}

export function updateCustomPortal(careerId: string, id: string, updates: Partial<Omit<CustomPortal, "id" | "careerId" | "createdAt">>): void {
  const portals = getCustomPortals(careerId);
  const idx = portals.findIndex((p) => p.id === id);
  if (idx === -1) return;
  portals[idx] = { ...portals[idx], ...updates };
  saveCustomPortals(careerId, portals);
}

export function deleteCustomPortal(careerId: string, id: string): void {
  const portals = getCustomPortals(careerId).filter((p) => p.id !== id);
  saveCustomPortals(careerId, portals);
}

export function getCustomPortal(careerId: string, id: string): CustomPortal | undefined {
  return getCustomPortals(careerId).find((p) => p.id === id);
}
