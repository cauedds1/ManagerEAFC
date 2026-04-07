import { Club } from "@/types/club";

export async function getClubImage(club: Club): Promise<string | null> {
  if (club.logo) return club.logo;
  if (club.apiFootballId) {
    return `https://media.api-sports.io/football/teams/${club.apiFootballId}.png`;
  }
  return null;
}
