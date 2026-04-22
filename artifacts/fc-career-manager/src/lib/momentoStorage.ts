import { putSeasonData } from "@/lib/apiStorage";

export interface Momento {
  id: string;
  title: string;
  description: string;
  gameDate: string;
  photoDataUrl: string;
  createdAt: string;
  mediaType?: "image" | "video";
  videoUrl?: string;
  videoKey?: string;
  playerIds?: number[];
}

function momentosKey(seasonId: string): string {
  return `fc-career-manager-momentos-${seasonId}`;
}

export function getMomentos(seasonId: string): Momento[] {
  try {
    const raw = localStorage.getItem(momentosKey(seasonId));
    if (!raw) return [];
    return JSON.parse(raw) as Momento[];
  } catch {
    return [];
  }
}

export function saveMomentos(seasonId: string, list: Momento[]): void {
  try {
    localStorage.setItem(momentosKey(seasonId), JSON.stringify(list));
  } catch {}
  const withoutPhoto = list.map(({ photoDataUrl: _, ...rest }) => rest);
  void putSeasonData(seasonId, "momentos", withoutPhoto);
}

export const FC_MOMENTO_SAVED_EVENT = "fc-momento-saved";

export function addMomento(seasonId: string, momento: Momento): void {
  const list = getMomentos(seasonId);
  list.unshift(momento);
  saveMomentos(seasonId, list);
  window.dispatchEvent(new CustomEvent(FC_MOMENTO_SAVED_EVENT, { detail: { seasonId, momentoId: momento.id } }));
}

export function deleteMomento(seasonId: string, id: string): void {
  const list = getMomentos(seasonId).filter((m) => m.id !== id);
  saveMomentos(seasonId, list);
}

export function generateMomentoId(): string {
  return `mo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function resizeImageToDataUrl(file: File, maxPx = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height * maxPx) / width);
          width = maxPx;
        } else {
          width = Math.round((width * maxPx) / height);
          height = maxPx;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas error"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image load error")); };
    img.src = url;
  });
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("fc_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function deleteVideoFromR2(videoKey: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/storage/objects?key=${encodeURIComponent(videoKey)}`, {
      method: "DELETE",
      headers: { ...getAuthHeader() },
    });
    return res.ok;
  } catch {
    return false;
  }
}
