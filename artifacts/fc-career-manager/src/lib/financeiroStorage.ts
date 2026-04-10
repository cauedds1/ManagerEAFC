import type { TransferRecord } from "@/types/transfer";

export interface FinanceiroSettings {
  transferBudget: number;
  salaryBudget: number;
  updatedAt: number;
}

const key = (careerId: string) => `fc-financeiro-settings-${careerId}`;

const DEFAULT_SETTINGS: Omit<FinanceiroSettings, "updatedAt"> = {
  transferBudget: 0,
  salaryBudget: 0,
};

export function getFinanceiroSettings(careerId: string): FinanceiroSettings {
  try {
    const raw = localStorage.getItem(key(careerId));
    if (!raw) return { ...DEFAULT_SETTINGS, updatedAt: 0 };
    return JSON.parse(raw) as FinanceiroSettings;
  } catch {
    return { ...DEFAULT_SETTINGS, updatedAt: 0 };
  }
}

export function saveFinanceiroSettings(careerId: string, settings: FinanceiroSettings): void {
  try {
    localStorage.setItem(key(careerId), JSON.stringify({ ...settings, updatedAt: Date.now() }));
  } catch {}
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
  const activeCompras = compras.filter((c) => !soldPlayerIds.has(c.playerId));
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
