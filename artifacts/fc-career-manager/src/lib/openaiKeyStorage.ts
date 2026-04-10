const KEY = "fc-openai-key";

export function getOpenAIKey(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setOpenAIKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY, key.trim());
    else localStorage.removeItem(KEY);
  } catch {}
}

export function clearOpenAIKey(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
