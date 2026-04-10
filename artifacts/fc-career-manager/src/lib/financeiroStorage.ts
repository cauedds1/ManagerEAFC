import type { TransferRecord } from "@/types/transfer";
import { putSeasonData } from "@/lib/apiStorage";

export interface FinanceiroSettings {
  transferBudget: number;
  salaryBudget: number;
  updatedAt: number;
}

const key = (seasonId: string) => `fc-financeiro-settings-${seasonId}`;

const DEFAULT_SETTINGS: Omit<FinanceiroSettings, "updatedAt"> = {
  transferBudget: 0,
  salaryBudget: 0,
};

export function getFinanceiroSettings(seasonId: string): FinanceiroSettings {
  try {
    const raw = localStorage.getItem(key(seasonId));
    if (!raw) return { ...DEFAULT_SETTINGS, updatedAt: 0 };
    return JSON.parse(raw) as FinanceiroSettings;
  } catch {
    return { ...DEFAULT_SETTINGS, updatedAt: 0 };
  }
}

export function saveFinanceiroSettings(seasonId: string, settings: FinanceiroSettings): void {
  const withTs = { ...settings, updatedAt: Date.now() };
  try {
    localStorage.setItem(key(seasonId), JSON.stringify(withTs));
  } catch {}
  void putSeasonData(seasonId, "finances", withTs);
}

export interface FinancialSnapshot {
  transferBudget: number;
  salaryBudget: number;
  totalSpent: number;
  totalEarned: number;
  netSpend: number;
  remainingTransferBudget: number;
  currentWageBill: number;
  wageRoom: number;
  signingsCount: number;
  salesCount: number;
}

export function computeFinancialSnapshot(
  settings: FinanceiroSettings,
  transfers: TransferRecord[],
): FinancialSnapshot {
  const compras = transfers.filter((t) => !t.type || t.type === "compra");
  const vendas = transfers.filter((t) => t.type === "venda");

  const totalSpent = compras.reduce((acc, t) => acc + (t.fee ?? 0), 0);
  const totalEarned = vendas.reduce((acc, t) => acc + (t.fee ?? 0), 0);
  const netSpend = totalSpent - totalEarned;
  const remainingTransferBudget = settings.transferBudget - netSpend;

  const soldPlayerIds = new Set(vendas.map((v) => v.playerId));
  const soldPlayerNames = new Set(
    vendas
      .filter((v) => !compras.find((c) => c.playerId === v.playerId))
      .map((v) => v.playerName.toLowerCase().trim()),
  );

  const activeCompras = compras.filter(
    (c) =>
      !soldPlayerIds.has(c.playerId) &&
      !soldPlayerNames.has(c.playerName.toLowerCase().trim()),
  );

  const currentWageBill = activeCompras.reduce((acc, t) => acc + (t.salary ?? 0), 0);
  const wageRoom = settings.salaryBudget - currentWageBill;

  return {
    transferBudget: settings.transferBudget,
    salaryBudget: settings.salaryBudget,
    totalSpent,
    totalEarned,
    netSpend,
    remainingTransferBudget,
    currentWageBill,
    wageRoom,
    signingsCount: compras.length,
    salesCount: vendas.length,
  };
}

export function getActiveCompras(transfers: TransferRecord[]): TransferRecord[] {
  const compras = transfers.filter((t) => !t.type || t.type === "compra");
  const vendas = transfers.filter((t) => t.type === "venda");
  const soldIds = new Set(vendas.map((v) => v.playerId));
  const soldNames = new Set(
    vendas
      .filter((v) => !compras.find((c) => c.playerId === v.playerId))
      .map((v) => v.playerName.toLowerCase().trim()),
  );
  return compras.filter(
    (c) => !soldIds.has(c.playerId) && !soldNames.has(c.playerName.toLowerCase().trim()),
  );
}
