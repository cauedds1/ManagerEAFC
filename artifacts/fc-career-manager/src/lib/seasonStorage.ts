import type { Season } from "@/types/career";

const AUTH_TOKEN_KEY = "fc_auth_token";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

export async function getSeasons(careerId: string): Promise<Season[]> {
  try {
    const res = await fetch(`/api/careers/${careerId}/seasons`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    return (await res.json()) as Season[];
  } catch {
    return [];
  }
}

export async function createSeason(
  careerId: string,
  label: string,
  competitions?: string[],
  isActive?: boolean,
  id?: string,
): Promise<Season | null> {
  try {
    const res = await fetch(`/api/careers/${careerId}/seasons`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ label, competitions, isActive, id }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id: string };
    return {
      id: data.id,
      careerId,
      label,
      competitions,
      isActive: isActive ?? false,
      createdAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export async function activateSeason(seasonId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/seasons/${seasonId}/activate`, {
      method: "PUT",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function suggestNextSeasonLabel(existingLabels: string[]): string {
  if (!existingLabels.length) {
    const year = new Date().getFullYear();
    return `${year}/${String(year + 1).slice(2)}`;
  }
  const last = existingLabels[existingLabels.length - 1];
  const match = last.match(/^(\d{4})\/(\d{2})$/);
  if (match) {
    const startYear = parseInt(match[1], 10) + 1;
    const endYearShort = String(startYear + 1).slice(2);
    return `${startYear}/${endYearShort}`;
  }
  const year = new Date().getFullYear();
  return `${year}/${String(year + 1).slice(2)}`;
}

export async function updateSeasonLabel(seasonId: string, label: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/seasons/${seasonId}/label`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ label }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function generateSeasonId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
