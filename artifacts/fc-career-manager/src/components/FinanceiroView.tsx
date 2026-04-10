import { useState, useMemo } from "react";
import type { TransferRecord } from "@/types/transfer";
import {
  getFinanceiroSettings,
  saveFinanceiroSettings,
  computeFinancialSnapshot,
  type FinanceiroSettings,
} from "@/lib/financeiroStorage";

function parseBudgetInput(raw: string): number {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return 0;
  const mMatch = trimmed.match(/^([\d.,]+)\s*[Mm]$/);
  if (mMatch) {
    const base = parseFloat(mMatch[1].replace(/\./g, "").replace(",", "."));
    return isNaN(base) ? 0 : Math.round(base * 1_000_000);
  }
  const cleaned = trimmed.replace(/[^\d]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatMoney(n: number, unit: "k" | "M" | "auto" = "auto"): string {
  if (unit === "auto") {
    if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
    if (Math.abs(n) >= 1_000) return `€${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
    return `€${n.toLocaleString("pt-BR")}`;
  }
  if (unit === "M") return `€${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  return `€${n.toLocaleString("pt-BR")}k`;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const danger = pct >= 90;
  const warn = pct >= 70;
  const barColor = danger ? "#f87171" : warn ? "#fbbf24" : color;
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: barColor }}
      />
    </div>
  );
}

interface BudgetEditorProps {
  label: string;
  value: number;
  onSave: (v: number) => void;
}

function BudgetEditor({ label, value, onSave }: BudgetEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(value > 0 ? String(value) : "");
    setEditing(true);
  };

  const commit = () => {
    const parsed = parseBudgetInput(draft);
    onSave(isNaN(parsed) ? 0 : parsed);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-white/35 text-xs flex-1">{label}</span>
      {editing ? (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-32 px-2 py-1 rounded-lg text-white text-sm text-right glass focus:outline-none"
          style={{ border: "1px solid rgba(var(--club-primary-rgb),0.4)" }}
          placeholder="Ex: 50000000"
        />
      ) : (
        <button
          onClick={startEdit}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold text-white hover:bg-white/10 transition-colors group"
        >
          <span className="tabular-nums">{value > 0 ? formatMoney(value) : "—"}</span>
          <svg className="w-3 h-3 text-white/30 group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface FinanceiroViewProps {
  careerId: string;
  transfers: TransferRecord[];
  season: string;
}

export function FinanceiroView({ careerId, transfers, season }: FinanceiroViewProps) {
  const [settings, setSettings] = useState<FinanceiroSettings>(() => getFinanceiroSettings(careerId));

  const snapshot = useMemo(
    () => computeFinancialSnapshot(settings, transfers),
    [settings, transfers],
  );

  const updateSettings = (partial: Partial<FinanceiroSettings>) => {
    const next = { ...settings, ...partial, updatedAt: Date.now() };
    setSettings(next);
    saveFinanceiroSettings(careerId, next);
  };

  const seasonTransfers = transfers.filter((t) => t.season === season);
  const compras = transfers.filter((t) => !t.type || t.type === "compra");
  const vendas = transfers.filter((t) => t.type === "venda");

  const topEarners = [...compras]
    .filter((t) => t.salary > 0)
    .sort((a, b) => b.salary - a.salary)
    .slice(0, 5);

  const topFees = [...transfers]
    .filter((t) => t.fee > 0)
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 5);

  const budgetUsedPct = snapshot.transferBudget > 0
    ? Math.min(100, Math.max(0, (snapshot.netSpend / snapshot.transferBudget) * 100))
    : 0;

  const wagePct = snapshot.salaryBudget > 0
    ? Math.min(100, Math.max(0, (snapshot.currentWageBill / snapshot.salaryBudget) * 100))
    : 0;

  const hasBudget = settings.transferBudget > 0 || settings.salaryBudget > 0;

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white/35 text-xs font-bold tracking-widest uppercase">Financeiro</h2>
        <span className="text-white/25 text-xs">{seasonTransfers.length} mov. esta temporada</span>
      </div>

      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Orçamentos</p>
        <BudgetEditor
          label="Orçamento de transferências"
          value={settings.transferBudget}
          onSave={(v) => updateSettings({ transferBudget: v })}
        />
        <BudgetEditor
          label="Folha salarial máxima (€k/sem)"
          value={settings.salaryBudget}
          onSave={(v) => updateSettings({ salaryBudget: v })}
        />
        {!hasBudget && (
          <p className="text-white/20 text-xs mt-1">
            Clique nos valores acima para definir os orçamentos do clube.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Gasto em contratações",
            value: formatMoney(snapshot.totalSpent),
            sub: `${snapshot.signingsCount} contratação${snapshot.signingsCount !== 1 ? "ões" : ""}`,
            color: "#f87171",
            icon: "📥",
          },
          {
            label: "Arrecadado em vendas",
            value: formatMoney(snapshot.totalEarned),
            sub: `${snapshot.salesCount} venda${snapshot.salesCount !== 1 ? "s" : ""}`,
            color: "#34d399",
            icon: "📤",
          },
          {
            label: "Saldo líquido",
            value: formatMoney(Math.abs(snapshot.netSpend)),
            sub: snapshot.netSpend > 0 ? "gasto líquido" : snapshot.netSpend < 0 ? "superávit" : "equilíbrio",
            color: snapshot.netSpend > 0 ? "#fbbf24" : "#34d399",
            icon: snapshot.netSpend > 0 ? "📊" : "💰",
          },
          {
            label: "Folha semanal ativa",
            value: snapshot.currentWageBill > 0 ? `€${snapshot.currentWageBill.toLocaleString("pt-BR")}k` : "—",
            sub: snapshot.salaryBudget > 0
              ? `${snapshot.wageRoom >= 0 ? `€${snapshot.wageRoom.toLocaleString("pt-BR")}k livre` : "limite excedido"}`
              : "orçamento não definido",
            color: "#60a5fa",
            icon: "💼",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl p-4 flex flex-col gap-1"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-lg mb-1">{card.icon}</span>
            <p className="text-white font-black text-base tabular-nums" style={{ color: card.color }}>
              {card.value}
            </p>
            <p className="text-white/35 text-[11px] leading-tight">{card.label}</p>
            <p className="text-white/20 text-[10px]">{card.sub}</p>
          </div>
        ))}
      </div>

      {hasBudget && (
        <div
          className="rounded-2xl p-5 space-y-5"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Uso do Orçamento</p>

          {settings.transferBudget > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Transferências</span>
                <span className="text-white/50 tabular-nums">
                  {formatMoney(snapshot.netSpend)} / {formatMoney(snapshot.transferBudget)}
                </span>
              </div>
              <ProgressBar value={snapshot.netSpend} max={snapshot.transferBudget} color="var(--club-primary)" />
              <div className="flex justify-between text-[10px] text-white/25">
                <span>{budgetUsedPct.toFixed(0)}% utilizado</span>
                <span className={snapshot.remainingTransferBudget < 0 ? "text-red-400/60" : ""}>
                  {snapshot.remainingTransferBudget >= 0
                    ? `${formatMoney(snapshot.remainingTransferBudget)} restante`
                    : `${formatMoney(Math.abs(snapshot.remainingTransferBudget))} acima do limite`}
                </span>
              </div>
            </div>
          )}

          {settings.salaryBudget > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Folha Salarial</span>
                <span className="text-white/50 tabular-nums">
                  €{snapshot.currentWageBill.toLocaleString("pt-BR")}k / €{snapshot.salaryBudget.toLocaleString("pt-BR")}k
                </span>
              </div>
              <ProgressBar value={snapshot.currentWageBill} max={snapshot.salaryBudget} color="#60a5fa" />
              <div className="flex justify-between text-[10px] text-white/25">
                <span>{wagePct.toFixed(0)}% da folha utilizada</span>
                <span className={snapshot.wageRoom < 0 ? "text-red-400/60" : ""}>
                  {snapshot.wageRoom >= 0
                    ? `€${snapshot.wageRoom.toLocaleString("pt-BR")}k/sem disponível`
                    : `€${Math.abs(snapshot.wageRoom).toLocaleString("pt-BR")}k acima da folha`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {topEarners.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-lg">💼</span>
            <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">Maiores Salários</span>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {topEarners.map((t, i) => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                <span className="text-white/20 text-xs font-bold w-4 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{t.playerName}</p>
                  <p className="text-white/30 text-xs">{t.playerPositionPtBr} · {t.season}</p>
                </div>
                <p className="text-white font-bold text-sm tabular-nums">€{t.salary.toLocaleString("pt-BR")}k<span className="text-white/25 font-normal text-xs">/sem</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {topFees.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-lg">🏆</span>
            <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">Maiores Negócios</span>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {topFees.map((t, i) => {
              const isVenda = t.type === "venda";
              return (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-white/20 text-xs font-bold w-4 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{t.playerName}</p>
                    <p className="text-white/30 text-xs">{t.playerPositionPtBr} · {t.season}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isVenda && (
                      <span
                        className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
                        style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
                      >
                        V
                      </span>
                    )}
                    <p
                      className="font-bold text-sm tabular-nums"
                      style={{ color: isVenda ? "#34d399" : "rgba(255,255,255,0.9)" }}
                    >
                      {formatMoney(t.fee)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {transfers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl glass text-center gap-3">
          <span className="text-4xl">💰</span>
          <p className="text-white/50 font-semibold">Nenhuma movimentação registrada</p>
          <p className="text-white/25 text-sm max-w-xs">Registre contratações e vendas na aba Transferências para visualizar aqui o panorama financeiro.</p>
        </div>
      )}
    </div>
  );
}
