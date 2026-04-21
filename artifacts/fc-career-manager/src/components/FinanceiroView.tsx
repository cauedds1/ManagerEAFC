import { useState, useMemo } from "react";
import type { TransferRecord } from "@/types/transfer";
import {
  getFinanceiroSettings,
  saveFinanceiroSettings,
  computeFinancialSnapshot,
  getActiveCompras,
  type FinanceiroSettings,
} from "@/lib/financeiroStorage";
import { getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import { useLang } from "@/hooks/useLang";
import { CLUBE } from "@/lib/i18n";

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
  seasonId: string;
  transfers: TransferRecord[];
  season: string;
  isReadOnly?: boolean;
}

export function FinanceiroView({ careerId, seasonId, transfers, season, isReadOnly }: FinanceiroViewProps) {
  const [lang] = useLang();
  const t = CLUBE[lang];

  const [settings, setSettings] = useState<FinanceiroSettings>(() => getFinanceiroSettings(seasonId));
  const overrides = useMemo(() => getAllPlayerOverrides(careerId), [careerId]);

  const snapshot = useMemo(
    () => computeFinancialSnapshot(settings, transfers, overrides),
    [settings, transfers, overrides],
  );

  const updateSettings = (partial: Partial<FinanceiroSettings>) => {
    const next = { ...settings, ...partial, updatedAt: Date.now() };
    setSettings(next);
    saveFinanceiroSettings(seasonId, next);
  };

  const seasonTransfers = transfers.filter((tr) => tr.season === season);
  const compras = transfers.filter((tr) => !tr.type || tr.type === "compra");
  const vendas = transfers.filter((tr) => tr.type === "venda");
  const activeCompras = useMemo(() => getActiveCompras(transfers), [transfers]);

  const topEarners = [...activeCompras]
    .filter((tr) => tr.salary > 0)
    .sort((a, b) => b.salary - a.salary)
    .slice(0, 5);

  const biggestCompra = [...compras].filter((tr) => tr.fee > 0).sort((a, b) => b.fee - a.fee)[0] ?? null;
  const biggestVenda = [...vendas].filter((tr) => tr.fee > 0).sort((a, b) => b.fee - a.fee)[0] ?? null;

  const budgetUsedPct = snapshot.transferBudget > 0
    ? Math.min(100, Math.max(0, (snapshot.netSpend / snapshot.transferBudget) * 100))
    : 0;

  const wagePct = snapshot.salaryBudget > 0
    ? Math.min(100, Math.max(0, (snapshot.currentWageBill / snapshot.salaryBudget) * 100))
    : 0;

  const hasBudget = settings.transferBudget > 0 || settings.salaryBudget > 0;

  const cards = [
    {
      label: t.remainingBudget,
      value: settings.transferBudget > 0 ? formatMoney(snapshot.remainingTransferBudget) : "—",
      sub: settings.transferBudget > 0
        ? t.ofTotal.replace("{n}", formatMoney(snapshot.transferBudget))
        : t.budgetNotSet,
      color: snapshot.remainingTransferBudget < 0 ? "#f87171" : "#34d399",
      icon: "🏦",
    },
    {
      label: t.spentOnSignings,
      value: formatMoney(snapshot.totalSpent),
      sub: `${snapshot.signingsCount} ${snapshot.signingsCount !== 1 ? t.signingsPlural : t.signingsSingular}`,
      color: "#f87171",
      icon: "📥",
    },
    {
      label: t.earnedFromSales,
      value: snapshot.totalEarned > 0 ? formatMoney(snapshot.totalEarned) : "—",
      sub: `${snapshot.salesCount} ${snapshot.salesCount !== 1 ? t.salePlural : t.saleSingular}`,
      color: "#34d399",
      icon: "📤",
    },
    {
      label: t.netBalance,
      value: formatMoney(Math.abs(snapshot.netSpend)),
      sub: snapshot.netSpend > 0 ? t.netSpent : snapshot.netSpend < 0 ? t.surplus : t.balanced,
      color: snapshot.netSpend > 0 ? "#fbbf24" : snapshot.netSpend < 0 ? "#34d399" : "#94a3b8",
      icon: snapshot.netSpend < 0 ? "💰" : "📊",
    },
    {
      label: t.weeklyWages,
      value: snapshot.currentWageBill > 0 ? `€${snapshot.currentWageBill.toLocaleString("pt-BR")}k` : "—",
      sub: settings.salaryBudget > 0
        ? `${t.ofTotal.replace("{n}", `€${settings.salaryBudget.toLocaleString("pt-BR")}k`)} ${lang === "pt" ? "máximo" : "max"}`
        : t.budgetNotSet,
      color: settings.salaryBudget > 0 && snapshot.wageRoom < 0 ? "#f87171" : "#60a5fa",
      icon: "💼",
    },
    {
      label: t.wageRoom,
      value: settings.salaryBudget > 0
        ? `€${Math.abs(snapshot.wageRoom).toLocaleString("pt-BR")}k`
        : "—",
      sub: settings.salaryBudget > 0
        ? snapshot.wageRoom >= 0 ? t.availablePerWeek : t.aboveLimit
        : t.wageNotSet,
      color: settings.salaryBudget > 0 && snapshot.wageRoom < 0 ? "#f87171" : "#a78bfa",
      icon: snapshot.wageRoom < 0 ? "⚠️" : "📋",
    },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white/35 text-xs font-bold tracking-widest uppercase">{t.financeHeading}</h2>
        <span className="text-white/25 text-xs">{seasonTransfers.length} {t.movThisSeason}</span>
      </div>

      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">{t.budgetsSection}</p>
        {isReadOnly ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-white/35 text-xs flex-1">{t.transferBudgetLabel}</span>
              <span className="text-white text-sm font-semibold">
                {settings.transferBudget > 0 ? formatMoney(settings.transferBudget) : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/35 text-xs flex-1">{t.wageSheetLabel}</span>
              <span className="text-white text-sm font-semibold">
                {settings.salaryBudget > 0 ? formatMoney(settings.salaryBudget, "k") : "—"}
              </span>
            </div>
          </>
        ) : (
          <>
            <BudgetEditor
              label={t.transferBudgetLabel}
              value={settings.transferBudget}
              onSave={(v) => updateSettings({ transferBudget: v })}
            />
            <BudgetEditor
              label={t.wageSheetLabel}
              value={settings.salaryBudget}
              onSave={(v) => updateSettings({ salaryBudget: v })}
            />
            {!hasBudget && (
              <p className="text-white/20 text-xs mt-1">{t.setBudgetsHint}</p>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((card) => (
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
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">{t.budgetUsage}</p>

          {settings.transferBudget > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">{t.transfersLabel}</span>
                <span className="text-white/50 tabular-nums">
                  {formatMoney(snapshot.netSpend)} / {formatMoney(snapshot.transferBudget)}
                </span>
              </div>
              <ProgressBar value={snapshot.netSpend} max={snapshot.transferBudget} color="var(--club-primary)" />
              <div className="flex justify-between text-[10px] text-white/25">
                <span>{budgetUsedPct.toFixed(0)}% {t.percentUsed}</span>
                <span className={snapshot.remainingTransferBudget < 0 ? "text-red-400/60" : ""}>
                  {snapshot.remainingTransferBudget >= 0
                    ? `${formatMoney(snapshot.remainingTransferBudget)} ${t.remaining}`
                    : `${formatMoney(Math.abs(snapshot.remainingTransferBudget))} ${t.aboveLimit}`}
                </span>
              </div>
            </div>
          )}

          {settings.salaryBudget > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">{t.wagesBill}</span>
                <span className="text-white/50 tabular-nums">
                  €{snapshot.currentWageBill.toLocaleString("pt-BR")}k / €{snapshot.salaryBudget.toLocaleString("pt-BR")}k
                </span>
              </div>
              <ProgressBar value={snapshot.currentWageBill} max={snapshot.salaryBudget} color="#60a5fa" />
              <div className="flex justify-between text-[10px] text-white/25">
                <span>{wagePct.toFixed(0)}% {t.percentWagesUsed}</span>
                <span className={snapshot.wageRoom < 0 ? "text-red-400/60" : ""}>
                  {snapshot.wageRoom >= 0
                    ? `€${snapshot.wageRoom.toLocaleString("pt-BR")}${t.availablePerWk}`
                    : `€${Math.abs(snapshot.wageRoom).toLocaleString("pt-BR")}${t.aboveWages}`}
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
            <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">{t.topEarners}</span>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {topEarners.map((tr, i) => (
              <div key={tr.id} className="flex items-center gap-4 px-5 py-3">
                <span className="text-white/20 text-xs font-bold w-4 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{tr.playerName}</p>
                  <p className="text-white/30 text-xs">{tr.playerPositionPtBr} · {tr.season}</p>
                </div>
                <p className="text-white font-bold text-sm tabular-nums">
                  €{tr.salary.toLocaleString("pt-BR")}k
                  <span className="text-white/25 font-normal text-xs">{t.perWeek}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(biggestCompra || biggestVenda) && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-lg">🏆</span>
            <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">{t.biggestDeals}</span>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {biggestCompra && (
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="relative flex-shrink-0">
                  {biggestCompra.playerPhoto ? (
                    <img
                      src={biggestCompra.playerPhoto}
                      alt={biggestCompra.playerName}
                      className="w-10 h-10 rounded-xl object-cover"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextSibling as HTMLElement).style.display = "flex"; }}
                    />
                  ) : null}
                  <div
                    className="w-10 h-10 rounded-xl items-center justify-center text-sm font-black flex-shrink-0"
                    style={{
                      display: biggestCompra.playerPhoto ? "none" : "flex",
                      background: "rgba(var(--club-primary-rgb),0.15)",
                      color: "var(--club-primary)",
                    }}
                  >
                    {biggestCompra.playerName.charAt(0)}
                  </div>
                  <span
                    className="absolute -bottom-1 -right-1 text-[9px] font-black px-1 py-0 rounded leading-4"
                    style={{ background: "rgba(var(--club-primary-rgb),0.9)", color: "#fff" }}
                  >
                    C
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{biggestCompra.playerName}</p>
                  <p className="text-white/30 text-xs">{biggestCompra.playerPositionPtBr} · {biggestCompra.season}</p>
                </div>
                <p className="text-white font-bold text-sm tabular-nums">{formatMoney(biggestCompra.fee)}</p>
              </div>
            )}
            {biggestVenda && (
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="relative flex-shrink-0">
                  {biggestVenda.playerPhoto ? (
                    <img
                      src={biggestVenda.playerPhoto}
                      alt={biggestVenda.playerName}
                      className="w-10 h-10 rounded-xl object-cover"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextSibling as HTMLElement).style.display = "flex"; }}
                    />
                  ) : null}
                  <div
                    className="w-10 h-10 rounded-xl items-center justify-center text-sm font-black"
                    style={{
                      display: biggestVenda.playerPhoto ? "none" : "flex",
                      background: "rgba(52,211,153,0.12)",
                      color: "#34d399",
                    }}
                  >
                    {biggestVenda.playerName.charAt(0)}
                  </div>
                  <span
                    className="absolute -bottom-1 -right-1 text-[9px] font-black px-1 py-0 rounded leading-4"
                    style={{ background: "rgba(52,211,153,0.85)", color: "#fff" }}
                  >
                    V
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{biggestVenda.playerName}</p>
                  <p className="text-white/30 text-xs">{biggestVenda.playerPositionPtBr} · {biggestVenda.season}</p>
                </div>
                <p className="font-bold text-sm tabular-nums" style={{ color: "#34d399" }}>{formatMoney(biggestVenda.fee)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {transfers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl glass text-center gap-3">
          <span className="text-4xl">💰</span>
          <p className="text-white/50 font-semibold">{t.noTransactions}</p>
          <p className="text-white/25 text-sm max-w-xs">{t.noTransactionsSub}</p>
        </div>
      )}
    </div>
  );
}
