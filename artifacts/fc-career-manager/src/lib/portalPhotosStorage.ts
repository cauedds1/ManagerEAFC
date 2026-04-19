const AUTH_TOKEN_KEY = "fc_auth_token";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type PortalSource = "tnt" | "espn" | "fanpage";

export interface PortalPhotos {
  tnt?: string;
  espn?: string;
  fanpage?: string;
}

export const PORTAL_PHOTOS_EVENT = "fc-portal-photos-updated";

export async function fetchPortalPhotos(careerId: string): Promise<PortalPhotos> {
  try {
    const res = await fetch(`/api/data/career/${encodeURIComponent(careerId)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return {};
    const { data } = (await res.json()) as { data: Record<string, unknown> };
    return {
      tnt:     (data["portal_photo_tnt"]     as string | undefined) || undefined,
      espn:    (data["portal_photo_espn"]    as string | undefined) || undefined,
      fanpage: (data["portal_photo_fanpage"] as string | undefined) || undefined,
    };
  } catch {
    return {};
  }
}

export async function savePortalPhoto(
  careerId: string,
  source: PortalSource,
  url: string,
): Promise<void> {
  try {
    await fetch(`/api/data/career/${encodeURIComponent(careerId)}/portal_photo_${source}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ value: url }),
    });
  } catch {
  }
}

export async function clearPortalPhotoApi(careerId: string, source: PortalSource): Promise<void> {
  try {
    await fetch(`/api/data/career/${encodeURIComponent(careerId)}/portal_photo_${source}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ value: null }),
    });
  } catch {
  }
}
