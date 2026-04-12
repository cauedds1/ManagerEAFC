const SOUND_KEY = "fc-notif-sound-enabled";

export function isSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, String(enabled));
  } catch {}
}

export function playNotificationSound(type: "noticias" | "diretoria" = "noticias"): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new AudioContext();

    const play = (freq: number, startTime: number, duration: number, gain: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;

    if (type === "diretoria") {
      play(880, now, 0.25, 0.18);
      play(1108, now + 0.1, 0.3, 0.14);
      play(1320, now + 0.22, 0.35, 0.10);
    } else {
      play(1046, now, 0.22, 0.15);
      play(1318, now + 0.12, 0.28, 0.11);
    }

    setTimeout(() => ctx.close(), 1000);
  } catch {}
}
