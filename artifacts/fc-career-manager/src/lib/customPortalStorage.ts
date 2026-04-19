export type PortalTone =
  | "humoristico"
  | "serio"
  | "jornalistico"
  | "apaixonado"
  | "critico"
  | "ironico"
  | "agressivo";

export const PORTAL_TONES: { id: PortalTone; emoji: string; label: string; description: string }[] = [
  { id: "humoristico",  emoji: "😂", label: "Humorístico",  description: "Posts engraçados, memes e piadas. Não leva nada a sério." },
  { id: "apaixonado",   emoji: "❤️", label: "Apaixonado",   description: "Torcedor fanático, emocional e incondicional." },
  { id: "critico",      emoji: "🔥", label: "Crítico",       description: "Corneteiro raiz. Questiona tudo, cobra resultado." },
  { id: "ironico",      emoji: "😏", label: "Irônico",       description: "Sarcástico e espirituoso. Tudo com uma dose de ironia." },
  { id: "jornalistico", emoji: "📰", label: "Jornalístico",  description: "Reportagens elaboradas com contexto e profundidade." },
  { id: "serio",        emoji: "🎯", label: "Sério",         description: "Cobertura factual, objetiva e sem exageros." },
  { id: "agressivo",    emoji: "💢", label: "Agressivo",     description: "Sem filtro. Xinga, se exalta, briga — mas também celebra quando merece." },
];

export const PORTAL_TONE_PROMPTS: Record<PortalTone, string> = {
  humoristico:  "Tom HUMORÍSTICO — use humor, memes, piadas, trocadilhos e emojis engraçados. Os comentários devem ser engraçados e bem-humorados, com zoações e memes. Pode xingar jogador com bom humor.",
  apaixonado:   "Tom APAIXONADO — escrita emocional, dramática, cheia de amor pelo clube. Defende os jogadores, mas cobra quando necessário. Comentários com muita paixão e sentimento.",
  critico:      "Tom CRÍTICO/CORNETEIRO — questiona decisões, cobra resultados, aponta falhas. Não poupa ninguém, nem a comissão técnica. Comentários exigentes e impacientes. Pode xingar jogador.",
  ironico:      "Tom IRÔNICO/SARCÁSTICO — usa sarcasmo e ironia na escrita. Faz insinuações inteligentes, sorri debochado de situações. Comentários afiados e espirituosos.",
  jornalistico: "Tom JORNALÍSTICO — reportagem elaborada com contexto histórico, números e análise. Escrita profissional mas acessível. Comentários mais analíticos e debatedores.",
  serio:        "Tom SÉRIO/OBJETIVO — cobertura factual e direta ao ponto. Sem exageros, sem drama. Comentários racionais e equilibrados.",
  agressivo:    "Tom AGRESSIVO/SEM FILTRO — escreve como um torcedor raivoso e sem censura. Quando o time vai mal: xinga jogador, técnico, diretoria sem cerimônia, usa palavrões naturalmente (porra, merda, filho da puta, etc.), grita no texto. Quando vai bem: euforia total, celebração explosiva, xingamento de alegria. O tom varia com a situação do time mas NUNCA é robótico ou polido — é humano, cru e autêntico. Comentários igualmente sem filtro.",
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

const AUTH_TOKEN_KEY = "fc_auth_token";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

export async function fetchPortals(careerId: string): Promise<CustomPortal[]> {
  try {
    const res = await fetch(`/api/careers/${encodeURIComponent(careerId)}/portals`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    return (await res.json()) as CustomPortal[];
  } catch {
    return [];
  }
}

export async function createPortal(
  careerId: string,
  data: { name: string; description: string; tone: PortalTone; photo?: string },
): Promise<CustomPortal | null> {
  try {
    const res = await fetch(`/api/careers/${encodeURIComponent(careerId)}/portals`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    return (await res.json()) as CustomPortal;
  } catch {
    return null;
  }
}

export async function updatePortal(
  careerId: string,
  id: string,
  updates: Partial<{ name: string; description: string; tone: PortalTone; photo: string | null }>,
): Promise<void> {
  try {
    await fetch(`/api/careers/${encodeURIComponent(careerId)}/portals/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
  } catch {
  }
}

export async function deletePortal(careerId: string, id: string): Promise<void> {
  try {
    await fetch(`/api/careers/${encodeURIComponent(careerId)}/portals/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
  } catch {
  }
}

export function getCustomPortal(portals: CustomPortal[], id: string): CustomPortal | undefined {
  return portals.find((p) => p.id === id);
}

export function canAddPortal(portals: CustomPortal[]): boolean {
  return portals.length < MAX_PORTALS;
}
