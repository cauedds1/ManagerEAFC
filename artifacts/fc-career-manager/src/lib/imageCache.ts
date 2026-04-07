const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

export async function getClubImage(clubName: string): Promise<string | null> {
  if (cache.has(clubName)) return cache.get(clubName) ?? null;
  if (pending.has(clubName)) return pending.get(clubName)!;

  const p = fetch(
    `https://api.msmc.cc/api/eafc/players?game=fc26&team=${encodeURIComponent(clubName)}`
  )
    .then((res) => (res.ok ? res.json() : []))
    .then((data) => {
      const arr = Array.isArray(data) ? data : data?.data ?? [];
      const player = arr.find((p: { card?: string }) => p.card);
      const url = player?.card ?? null;
      cache.set(clubName, url);
      pending.delete(clubName);
      return url;
    })
    .catch(() => {
      cache.set(clubName, null);
      pending.delete(clubName);
      return null;
    });

  pending.set(clubName, p);
  return p;
}
