import { Club, Player } from "@/types/club";
import { getClubInfo } from "./clubColors";

const BASE_URL = "https://api.msmc.cc/api/eafc";

export async function fetchClubs(): Promise<Club[]> {
  const res = await fetch(`${BASE_URL}/clubs?gender=m&game=fc26`);
  if (!res.ok) throw new Error("Erro ao carregar os dados");
  const data = await res.json();

  const names: string[] = Array.isArray(data) ? data : data.data || [];

  return names
    .filter((name) => typeof name === "string" && name.trim().length > 0)
    .map((name) => {
      const info = getClubInfo(name);
      return {
        name,
        league: info?.league ?? "Outras ligas",
        sofifaId: info?.sofifaId,
      };
    });
}

export async function fetchLeagues(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/leagues?gender=m&game=fc26`);
  if (!res.ok) return [];
  const data = await res.json();
  const leagues: string[] = Array.isArray(data) ? data : data.data || [];
  return leagues.filter((l) => typeof l === "string" && l.trim().length > 0).sort();
}

export async function fetchPlayersByClub(teamName: string): Promise<Player[]> {
  const res = await fetch(
    `${BASE_URL}/players?game=fc26&team=${encodeURIComponent(teamName)}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.data || [];
}

export function getClubCrestUrl(sofifaId: string): string {
  return `https://cdn.sofifa.net/teams/${sofifaId}/light_60.png`;
}

export function getPlayerFaceUrl(playerId: string): string {
  return `https://cdn.sofifa.net/players/${playerId}/26_60.png`;
}

export function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}/${String(endYear).slice(2)}`;
}
