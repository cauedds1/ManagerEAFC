import { Club } from "@/types/club";
import { getSofifaTeamUrl } from "./clubColors";

export const leagueCache = new Map<string, string>();

const playerImageCache = new Map<string, string | null>();
const pendingFetch = new Map<string, Promise<string | null>>();

async function fetchPlayerImageAndLeague(clubName: string): Promise<string | null> {
  if (playerImageCache.has(clubName)) return playerImageCache.get(clubName) ?? null;
  if (pendingFetch.has(clubName)) return pendingFetch.get(clubName)!;

  const p = fetch(
    `https://api.msmc.cc/api/eafc/players?game=fc26&team=${encodeURIComponent(clubName)}`
  )
    .then((res) => (res.ok ? res.json() : []))
    .then((data: { data?: Array<{ card?: string; league?: string }> } | Array<{ card?: string; league?: string }>) => {
      const arr = Array.isArray(data) ? data : (data?.data ?? []);
      const player = arr.find((p) => p.card);
      const url = player?.card ?? null;

      if (player?.league && player.league.trim()) {
        leagueCache.set(clubName, player.league.trim());
      }

      playerImageCache.set(clubName, url);
      pendingFetch.delete(clubName);
      return url;
    })
    .catch(() => {
      playerImageCache.set(clubName, null);
      pendingFetch.delete(clubName);
      return null;
    });

  pendingFetch.set(clubName, p);
  return p;
}

function testImageUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = "";
      resolve(false);
    }, 4000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}

const resolvedCache = new Map<string, string | null>();
const resolvedPending = new Map<string, Promise<string | null>>();

export async function getClubImage(club: Club): Promise<string | null> {
  const key = club.name;
  if (resolvedCache.has(key)) return resolvedCache.get(key) ?? null;
  if (resolvedPending.has(key)) return resolvedPending.get(key)!;

  const p = (async () => {
    if (club.sofifaId) {
      const sofifaUrl = getSofifaTeamUrl(club.sofifaId);
      const works = await testImageUrl(sofifaUrl);
      if (works) {
        resolvedCache.set(key, sofifaUrl);
        return sofifaUrl;
      }
    }

    const url = await fetchPlayerImageAndLeague(club.name);
    resolvedCache.set(key, url);
    return url;
  })();

  resolvedPending.set(key, p);
  p.finally(() => resolvedPending.delete(key));
  return p;
}
