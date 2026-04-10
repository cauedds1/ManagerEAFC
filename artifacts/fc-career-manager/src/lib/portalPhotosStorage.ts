export type PortalSource = "tnt" | "espn" | "fanpage";

export interface PortalPhotos {
  tnt?: string;
  espn?: string;
  fanpage?: string;
}

const KEY = "fc-portal-photos";

export function getPortalPhotos(): PortalPhotos {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PortalPhotos) : {};
  } catch {
    return {};
  }
}

export function setPortalPhoto(source: PortalSource, dataUrl: string): void {
  const photos = getPortalPhotos();
  photos[source] = dataUrl;
  try { localStorage.setItem(KEY, JSON.stringify(photos)); } catch {}
}

export function clearPortalPhoto(source: PortalSource): void {
  const photos = getPortalPhotos();
  delete photos[source];
  try { localStorage.setItem(KEY, JSON.stringify(photos)); } catch {}
}

export const PORTAL_PHOTOS_EVENT = "fc-portal-photos-updated";
