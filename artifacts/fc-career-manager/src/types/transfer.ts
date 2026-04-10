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
  type?: "compra" | "venda";
  fromClub?: string;
  fromClubLogo?: string;
  toClub?: string;
  transferredAt: number;
}
