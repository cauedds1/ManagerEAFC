export const FC_AUTO_NEWS_TOGGLED_EVENT = "fc_auto_news_toggled";

function storageKey(careerId: string): string {
  return `fc_auto_news_enabled_${careerId}`;
}

export function getAutoNewsEnabled(careerId: string): boolean {
  try {
    return localStorage.getItem(storageKey(careerId)) === "1";
  } catch {
    return false;
  }
}

export function setAutoNewsEnabled(careerId: string, enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(storageKey(careerId), "1");
    } else {
      localStorage.removeItem(storageKey(careerId));
    }
    window.dispatchEvent(
      new CustomEvent(FC_AUTO_NEWS_TOGGLED_EVENT, { detail: { careerId, enabled } }),
    );
  } catch {}
}
