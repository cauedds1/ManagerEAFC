const BASE = "/api";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("fc_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getAiHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeader() };
}

export async function putSeasonData(seasonId: string, key: string, value: unknown): Promise<void> {
  try {
    await fetch(`${BASE}/data/season/${encodeURIComponent(seasonId)}/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ value }),
    });
  } catch {
  }
}

export async function putCareerData(careerId: string, key: string, value: unknown): Promise<void> {
  try {
    await fetch(`${BASE}/data/career/${encodeURIComponent(careerId)}/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ value }),
    });
  } catch {
  }
}

export async function loadSeasonData(seasonId: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${BASE}/data/season/${encodeURIComponent(seasonId)}`, {
      headers: authHeader(),
    });
    if (!res.ok) return {};
    const json = await res.json() as { data: Record<string, unknown> };
    return json.data ?? {};
  } catch {
    return {};
  }
}

export async function loadCareerData(careerId: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${BASE}/data/career/${encodeURIComponent(careerId)}`, {
      headers: authHeader(),
    });
    if (!res.ok) return {};
    const json = await res.json() as { data: Record<string, unknown> };
    return json.data ?? {};
  } catch {
    return {};
  }
}
