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
  type?: "compra" | "venda" | "emprestimo";
  fromClub?: string;
  fromClubLogo?: string;
  toClub?: string;
  toClubLogo?: string;
  loanDuration?: string;
  loanDirection?: "entrada" | "saida";
  loanEnded?: boolean;
  playerOverall?: number;
  transferDate?: string;
  transferredAt: number;
  windowPending?: boolean;
  tradePlayerName?: string;
  tradePlayerPhoto?: string;
  tradePlayerPosition?: string;
}
