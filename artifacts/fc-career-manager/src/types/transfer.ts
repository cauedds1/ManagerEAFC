import type { PositionPtBr } from "@/lib/squadCache";
import type { TeamRole } from "./playerStats";

export interface TransferRecord {
  id: string;
  careerId: string;
  season: string;
  playerId: number;
  playerName: string;
  playerPhoto: string;
  playerPositionPtBr: PositionPtBr;
  playerAge: number;
  shirtNumber?: number;
  fee: number;
  salary: number;
  contractYears: number;
  role: TeamRole;
  fromClub?: string;
  fromClubLogo?: string;
  transferredAt: number;
}
