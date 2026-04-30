import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const TOKEN_KEY = "admin_token";

function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}
function setToken(t: string) {
  sessionStorage.setItem(TOKEN_KEY, t);
}
function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

type Tab = "overview" | "users" | "bug-reports" | "career-recovery" | "notifications" | "referrals";

interface Stats {
  users: { total: number; free: number; pro: number; ultra: number };
  careers: { total: number };
  seasons: { total: number };
  aiUsage: { allTime: number; today: number };
  bugReports: { total: number; open: number };
}

interface Analytics {
  userGrowth: Array<{ date: string; count: number }>;
  topClubs: Array<{ clubName: string; count: number }>;
  planDistribution: { free: number; pro: number; ultra: number };
  totalMatches: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;
}

interface User {
  id: number;
  email: string;
  name: string;
  plan: string;
  aiUsageCount: number;
  lastLoginAt: number | null;
  createdAt: number;
  careerCount: number;
  seasonCount: number;
  matchCount: number;
  clubs: string[];
}

interface UserDetailCareer {
  id: string;
  clubName: string;
  clubId: number;
  season: string;
  createdAt: number;
  seasonCount: number;
  matchCount: number;
  activeSeasonLabel: string | null;
}

interface UserDetailBug {
  id: number;
  description: string;
  page: string;
  status: string;
  createdAt: number;
}

interface UserDetail {
  user: {
    id: number; email: string; name: string; plan: string;
    aiUsageCount: number; lastLoginAt: number | null; createdAt: number;
  };
  careers: UserDetailCareer[];
  bugReports: UserDetailBug[];
}

interface BugReport {
  id: number;
  userId: number | null;
  userEmail: string | null;
  description: string;
  page: string;
  status: string;
  createdAt: number;
}

interface Referral {
  id: number;
  referrerId: number;
  referrerEmail: string | null;
  referrerName: string | null;
  referredId: number | null;
  referredEmail: string | null;
  referredName: string | null;
  referredPlan: string | null;
  status: string;
  notes: string | null;
  createdAt: number;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  const diffM = Math.floor(diffD / 30);
  const diffY = Math.floor(diffD / 365);
  if (diffMin < 2) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffH < 24) return `há ${diffH}h`;
  if (diffD === 1) return "ontem";
  if (diffD < 30) return `há ${diffD} dias`;
  if (diffM === 1) return "há 1 mês";
  if (diffM < 12) return `há ${diffM} meses`;
  if (diffY === 1) return "há 1 ano";
  return `há ${diffY} anos`;
}

type ActivityLevel = "active" | "recent" | "inactive" | "never";

function getActivityLevel(lastLoginAt: number | null): ActivityLevel {
  if (!lastLoginAt) return "never";
  const diffD = Math.floor((Date.now() - lastLoginAt) / 86400000);
  if (diffD <= 7) return "active";
  if (diffD <= 30) return "recent";
  return "inactive";
}

const ACTIVITY_CONFIG: Record<ActivityLevel, { label: string; color: string; bg: string; border: string }> = {
  active:   { label: "Ativo",    color: "#4ade80", bg: "rgba(74,222,128,0.15)",  border: "rgba(74,222,128,0.3)" },
  recent:   { label: "Recente",  color: "#fbbf24", bg: "rgba(251,191,36,0.15)",  border: "rgba(251,191,36,0.3)" },
  inactive: { label: "Inativo",  color: "#94a3b8", bg: "rgba(148,163,184,0.1)",  border: "rgba(148,163,184,0.2)" },
  never:    { label: "Nunca",    color: "#64748b", bg: "rgba(100,116,139,0.1)",   border: "rgba(100,116,139,0.15)" },
};

function ActivityBadge({ lastLoginAt }: { lastLoginAt: number | null }) {
  const level = getActivityLevel(lastLoginAt);
  const cfg = ACTIVITY_CONFIG[level];
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free:  "rgba(148,163,184,0.15)",
    pro:   "rgba(59,130,246,0.2)",
    ultra: "rgba(168,85,247,0.2)",
  };
  const text: Record<string, string> = {
    free:  "#94a3b8",
    pro:   "#60a5fa",
    ultra: "#c084fc",
  };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide"
      style={{ background: colors[plan] ?? colors.free, color: text[plan] ?? text.free }}
    >
      {plan}
    </span>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <span className="text-xs text-white/40 font-medium uppercase tracking-wider">{label}</span>
      <span className="text-3xl font-bold" style={{ color: color ?? "white" }}>{value}</span>
      {sub && <span className="text-xs text-white/35">{sub}</span>}
    </div>
  );
}

function GrowthChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (!data.length) return <div className="text-white/20 text-xs text-center py-6">Sem cadastros nos últimos 30 dias</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-24 w-full">
      {data.map((d) => {
        const h = Math.max(4, Math.round((d.count / max) * 96));
        const label = d.date.slice(5);
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${d.date}: ${d.count}`}>
            <div
              style={{ height: `${h}px`, background: "rgba(74,222,128,0.6)", borderRadius: "3px 3px 0 0" }}
              className="w-full transition-all group-hover:opacity-80"
            />
            {data.length <= 15 && (
              <span className="text-white/20 text-[9px] rotate-45 origin-left">{label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OverviewTab() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => apiFetch<Stats>("/admin-panel/stats"),
  });
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useQuery<Analytics>({
    queryKey: ["analytics"],
    queryFn: () => apiFetch<Analytics>("/admin-panel/analytics"),
  });

  const isLoading = statsLoading || analyticsLoading;
  const error = statsError || analyticsError;

  if (isLoading) return <div className="text-white/40 text-sm py-8 text-center">Carregando...</div>;
  if (error) return <div className="text-red-400 text-sm py-8 text-center">{String((error as Error).message)}</div>;
  if (!stats || !analytics) return null;

  const totalPlans = analytics.planDistribution.free + analytics.planDistribution.pro + analytics.planDistribution.ultra || 1;
  const planPct = {
    free: Math.round((analytics.planDistribution.free / totalPlans) * 100),
    pro: Math.round((analytics.planDistribution.pro / totalPlans) * 100),
    ultra: Math.round((analytics.planDistribution.ultra / totalPlans) * 100),
  };
  const topMax = analytics.topClubs[0]?.count ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-white font-bold text-base mb-1">Visão Geral</h2>
        <p className="text-white/40 text-xs">Dados em tempo real do banco de produção.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total Usuários" value={stats.users.total} color="#4ade80" />
        <StatCard label="Ativos (7d)" value={analytics.activeUsersLast7Days} color="#34d399" sub="último login" />
        <StatCard label="Total Carreiras" value={stats.careers.total} />
        <StatCard label="Total Partidas" value={analytics.totalMatches} color="#60a5fa" />
        <StatCard label="Gerações de IA" value={stats.aiUsage.allTime} color="#fb923c" sub="acumulado" />
        <StatCard label="Bugs em Aberto" value={stats.bugReports.open} color={stats.bugReports.open > 0 ? "#f87171" : "white"} sub={`${stats.bugReports.total} total`} />
      </div>

      <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <h3 className="text-white font-semibold text-sm">Crescimento de Usuários</h3>
          <p className="text-white/30 text-xs">Novos cadastros nos últimos 30 dias</p>
        </div>
        <GrowthChart data={analytics.userGrowth} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <h3 className="text-white font-semibold text-sm">Top Times</h3>
            <p className="text-white/30 text-xs">Times mais selecionados nas carreiras</p>
          </div>
          <div className="flex flex-col gap-2">
            {analytics.topClubs.length === 0 && <div className="text-white/20 text-xs text-center py-4">Sem dados</div>}
            {analytics.topClubs.map((c, i) => (
              <div key={c.clubName} className="flex items-center gap-3">
                <span className="text-white/25 text-xs font-mono w-4 text-right flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-white/80 text-xs truncate">{c.clubName}</span>
                    <span className="text-white/40 text-xs flex-shrink-0 ml-2">{c.count}</span>
                  </div>
                  <div className="w-full rounded-full overflow-hidden" style={{ height: "3px", background: "rgba(255,255,255,0.06)" }}>
                    <div
                      style={{ width: `${Math.round((c.count / topMax) * 100)}%`, height: "100%", background: "rgba(74,222,128,0.5)", borderRadius: "9999px" }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <h3 className="text-white font-semibold text-sm">Distribuição de Planos</h3>
            <p className="text-white/30 text-xs">Percentual por tipo de plano</p>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { key: "free" as const, label: "Free", color: "#94a3b8", pct: planPct.free, val: analytics.planDistribution.free },
              { key: "pro" as const, label: "Pro", color: "#60a5fa", pct: planPct.pro, val: analytics.planDistribution.pro },
              { key: "ultra" as const, label: "Ultra", color: "#c084fc", pct: planPct.ultra, val: analytics.planDistribution.ultra },
            ].map((p) => (
              <div key={p.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-white/70 text-xs font-medium">{p.label}</span>
                  </div>
                  <span className="text-white/40 text-xs">{p.val} usuários · {p.pct}%</span>
                </div>
                <div className="w-full rounded-full overflow-hidden" style={{ height: "6px", background: "rgba(255,255,255,0.06)" }}>
                  <div style={{ width: `${p.pct}%`, height: "100%", background: p.color, borderRadius: "9999px", opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <StatCard label="Gerações Hoje" value={stats.aiUsage.today} color="#fb923c" sub="reset diário" />
          </div>
        </div>
      </div>
    </div>
  );
}

async function impersonateUser(userId: number): Promise<void> {
  const data = await apiFetch<{ token: string; user: { name: string } }>(`/admin-panel/impersonate/${userId}`, { method: "POST" });
  const url = `${window.location.protocol}//${window.location.host}/?impersonation_token=${encodeURIComponent(data.token)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function ImpersonateButton({ userId, userName }: { userId: number; userName: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    setError(null);
    try {
      await impersonateUser(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar visualização");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        title={`Visualizar como ${userName}`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-50"
        style={{ background: "rgba(234,179,8,0.15)", color: "#fbbf24", border: "1px solid rgba(234,179,8,0.3)" }}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        {loading ? "Abrindo..." : "Visualizar como usuário"}
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}

function ChangePlanSection({ userId, currentPlan }: { userId: number; currentPlan: string }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const qc = useQueryClient();

  const changePlan = async (plan: string) => {
    if (plan === currentPlan || loading) return;
    setLoading(plan);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/admin-panel/users/${userId}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ plan }),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["user-detail", userId] }),
        qc.invalidateQueries({ queryKey: ["users"] }),
        qc.invalidateQueries({ queryKey: ["stats"] }),
        qc.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
      setSuccess(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar plano");
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    { key: "free",  label: "Free",  color: "#94a3b8", bg: "rgba(148,163,184,0.15)", border: "rgba(148,163,184,0.35)" },
    { key: "pro",   label: "Pro",   color: "#60a5fa", bg: "rgba(59,130,246,0.15)",  border: "rgba(59,130,246,0.4)" },
    { key: "ultra", label: "Ultra", color: "#c084fc", bg: "rgba(168,85,247,0.15)",  border: "rgba(168,85,247,0.4)" },
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Alterar Plano</span>
      <div className="flex gap-2">
        {plans.map((p) => {
          const isActive = currentPlan === p.key;
          const isLoading = loading === p.key;
          return (
            <button
              key={p.key}
              onClick={() => changePlan(p.key)}
              disabled={!!loading || isActive}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
              style={{
                background: isActive ? p.bg : "rgba(255,255,255,0.04)",
                color: isActive ? p.color : "rgba(255,255,255,0.35)",
                border: `1px solid ${isActive ? p.border : "rgba(255,255,255,0.08)"}`,
                cursor: isActive ? "default" : loading ? "not-allowed" : "pointer",
                transform: isActive ? "scale(1.03)" : "scale(1)",
              }}
            >
              {isLoading ? "..." : p.label}
              {isActive && <span className="ml-1 opacity-60">✓</span>}
            </button>
          );
        })}
      </div>
      {error && <span className="text-red-400 text-xs">{error}</span>}
      {success && <span className="text-xs" style={{ color: "#34d399" }}>Plano alterado para <strong>{success}</strong> com sucesso.</span>}
    </div>
  );
}

function UserDetailModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { data, isLoading, error } = useQuery<UserDetail>({
    queryKey: ["user-detail", userId],
    queryFn: () => apiFetch(`/admin-panel/users/${userId}`),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="h-full w-full max-w-lg overflow-y-auto flex flex-col"
        style={{ background: "hsl(222 22% 10%)", borderLeft: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <h2 className="text-white font-bold text-sm">Detalhe do Usuário</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 p-6 flex flex-col gap-5">
          {isLoading && <div className="text-white/40 text-sm text-center py-8">Carregando...</div>}
          {error && <div className="text-red-400 text-sm text-center py-8">{(error as Error).message}</div>}
          {data && (
            <>
              <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-white font-bold text-base truncate">{data.user.name}</span>
                    <span className="text-white/50 text-xs truncate">{data.user.email}</span>
                  </div>
                  <PlanBadge plan={data.user.plan} />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[
                    { label: "ID", value: `#${data.user.id}` },
                    { label: "Gerações IA", value: String(data.user.aiUsageCount) },
                    { label: "Cadastro", value: formatDate(data.user.createdAt) },
                    { label: "Último Login", value: data.user.lastLoginAt ? formatDate(data.user.lastLoginAt) : "—" },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col gap-0.5">
                      <span className="text-white/30 text-[10px] uppercase tracking-wider">{item.label}</span>
                      <span className="text-white/80 text-xs font-mono">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <ImpersonateButton userId={data.user.id} userName={data.user.name} />

              <ChangePlanSection userId={data.user.id} currentPlan={data.user.plan} />

              <div className="flex flex-col gap-3">
                <h3 className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                  Carreiras ({data.careers.length})
                </h3>
                {data.careers.length === 0 && <div className="text-white/20 text-xs text-center py-4">Sem carreiras</div>}
                {data.careers.map((c) => (
                  <div key={c.id} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/85 text-sm font-semibold truncate">{c.clubName}</span>
                      {c.activeSeasonLabel && (
                        <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>
                          {c.activeSeasonLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4">
                      <span className="text-white/35 text-xs">{c.seasonCount} temp.</span>
                      <span className="text-white/35 text-xs">{c.matchCount} partidas</span>
                      <span className="text-white/25 text-xs">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                ))}
              </div>

              {data.bugReports.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                    Bugs Reportados ({data.bugReports.length})
                  </h3>
                  {data.bugReports.map((b) => (
                    <div key={b.id} className="rounded-xl p-3 flex flex-col gap-1.5" style={{
                      background: b.status === "open" ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${b.status === "open" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white/25 text-xs font-mono">#{b.id}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                          background: b.status === "open" ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.15)",
                          color: b.status === "open" ? "#f87171" : "#34d399",
                        }}>{b.status === "open" ? "Aberto" : "Resolvido"}</span>
                        {b.page && <span className="text-white/30 text-xs truncate">{b.page}</span>}
                      </div>
                      <p className="text-white/65 text-xs leading-relaxed">{b.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type ActivityFilter = "all" | "active" | "recent" | "inactive";

const ACTIVITY_FILTERS: { key: ActivityFilter; label: string; color: string; bg: string; activeBg: string }[] = [
  { key: "all",      label: "Todos",        color: "rgba(255,255,255,0.6)", bg: "rgba(255,255,255,0.04)", activeBg: "rgba(255,255,255,0.12)" },
  { key: "active",   label: "Ativos (7d)",  color: "#4ade80",               bg: "rgba(74,222,128,0.07)",  activeBg: "rgba(74,222,128,0.2)" },
  { key: "recent",   label: "Recentes (30d)",color: "#fbbf24",              bg: "rgba(251,191,36,0.07)",  activeBg: "rgba(251,191,36,0.2)" },
  { key: "inactive", label: "Inativos",     color: "#94a3b8",               bg: "rgba(148,163,184,0.05)", activeBg: "rgba(148,163,184,0.15)" },
];

function UsersTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  type SortCol = "name" | "lastLoginAt" | "createdAt" | "matchCount" | "aiUsageCount" | "seasonCount" | "careerCount" | "plan";
  const [sortCol, setSortCol] = useState<SortCol>("lastLoginAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const limit = 50;
  const { data, isLoading, error } = useQuery<{ users: User[]; total: number; page: number; limit: number }>({
    queryKey: ["users", page],
    queryFn: () => apiFetch(`/admin-panel/users?page=${page}&limit=${limit}`),
  });

  if (isLoading) return <div className="text-white/40 text-sm py-8 text-center">Carregando...</div>;
  if (error) return <div className="text-red-400 text-sm py-8 text-center">{String((error as Error).message)}</div>;
  if (!data) return null;

  const sorted = [...data.users].sort((a, b) => {
    let va: number | string = 0, vb: number | string = 0;
    if (sortCol === "name" || sortCol === "plan") {
      va = (a[sortCol] ?? "").toLowerCase();
      vb = (b[sortCol] ?? "").toLowerCase();
      return sortDir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    }
    if (sortCol === "lastLoginAt") { va = a.lastLoginAt ?? 0; vb = b.lastLoginAt ?? 0; }
    else if (sortCol === "createdAt") { va = a.createdAt; vb = b.createdAt; }
    else if (sortCol === "matchCount") { va = a.matchCount; vb = b.matchCount; }
    else if (sortCol === "aiUsageCount") { va = a.aiUsageCount; vb = b.aiUsageCount; }
    else if (sortCol === "seasonCount") { va = a.seasonCount; vb = b.seasonCount; }
    else if (sortCol === "careerCount") { va = a.careerCount; vb = b.careerCount; }
    return sortDir === "desc" ? (vb as number) - (va as number) : (va as number) - (vb as number);
  });

  const filtered = sorted.filter((u) => {
    const matchesSearch = search.trim()
      ? u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
      : true;
    const level = getActivityLevel(u.lastLoginAt);
    const matchesActivity = activityFilter === "all"
      ? true
      : activityFilter === "inactive"
        ? level === "inactive" || level === "never"
        : level === activityFilter;
    return matchesSearch && matchesActivity;
  });

  const activityCounts: Record<ActivityFilter, number> = {
    all: data.users.length,
    active: data.users.filter((u) => getActivityLevel(u.lastLoginAt) === "active").length,
    recent: data.users.filter((u) => getActivityLevel(u.lastLoginAt) === "recent").length,
    inactive: data.users.filter((u) => getActivityLevel(u.lastLoginAt) === "inactive" || getActivityLevel(u.lastLoginAt) === "never").length,
  };

  const totalPages = Math.ceil(data.total / limit);

  return (
    <>
      {selectedUserId !== null && (
        <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-white font-bold text-base">Usuários</h2>
            <p className="text-white/40 text-xs mt-0.5">{data.total} usuários cadastrados · ordenados por {sortCol === "lastLoginAt" ? "atividade" : sortCol === "createdAt" ? "cadastro" : sortCol === "matchCount" ? "partidas" : sortCol === "aiUsageCount" ? "uso de IA" : sortCol === "seasonCount" ? "temporadas" : sortCol === "careerCount" ? "clubes" : sortCol === "name" ? "nome" : sortCol === "plan" ? "plano" : sortCol} {sortDir === "desc" ? "↓" : "↑"}</p>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="px-3 py-2 rounded-xl text-white text-xs focus:outline-none placeholder:text-white/20 w-60"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {ACTIVITY_FILTERS.map((f) => {
            const isActive = activityFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActivityFilter(f.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: isActive ? f.activeBg : f.bg,
                  color: isActive ? f.color : "rgba(255,255,255,0.4)",
                  border: `1px solid ${isActive ? f.color + "44" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {f.label}
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: isActive ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.06)", color: isActive ? f.color : "rgba(255,255,255,0.3)" }}
                >
                  {activityCounts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {(
                    [
                      { label: "Nome", col: "name" as SortCol, sortable: true },
                      { label: "Atividade", col: null, sortable: false },
                      { label: "Plano", col: "plan" as SortCol, sortable: true },
                      { label: "Clube(s)", col: "careerCount" as SortCol, sortable: true },
                      { label: "Partidas", col: "matchCount" as SortCol, sortable: true },
                      { label: "IA", col: "aiUsageCount" as SortCol, sortable: true },
                      { label: "Temp.", col: "seasonCount" as SortCol, sortable: true },
                      { label: "Último Login", col: "lastLoginAt" as SortCol, sortable: true },
                      { label: "Cadastro", col: "createdAt" as SortCol, sortable: true },
                    ]
                  ).map(({ label, col, sortable }) => {
                    const isActive = sortable && col !== null && sortCol === col;
                    return (
                      <th
                        key={label}
                        onClick={() => sortable && col !== null && handleSort(col)}
                        className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap select-none transition-colors"
                        style={{
                          color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)",
                          cursor: sortable ? "pointer" : "default",
                        }}
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          {sortable && (
                            <span className="text-[10px] opacity-60">
                              {isActive ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
                            </span>
                          )}
                        </span>
                      </th>
                    );
                  })}
                  <th className="text-left px-4 py-3 text-white/40 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-white/25 text-xs">Nenhum usuário encontrado</td>
                  </tr>
                )}
                {filtered.map((u, i) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    style={{
                      background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      cursor: "pointer",
                    }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white font-medium text-xs">{u.name}</span>
                        <span className="text-white/35 text-[10px]">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><ActivityBadge lastLoginAt={u.lastLoginAt} /></td>
                    <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                    <td className="px-4 py-3 text-white/55 text-xs max-w-[120px]">
                      <span className="truncate block">{u.clubs.length > 0 ? u.clubs.slice(0, 2).join(", ") + (u.clubs.length > 2 ? ` +${u.clubs.length - 2}` : "") : "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">{u.matchCount}</td>
                    <td className="px-4 py-3 text-white/60 text-xs">{u.aiUsageCount}</td>
                    <td className="px-4 py-3 text-white/60 text-xs">{u.seasonCount}</td>
                    <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">
                      {u.lastLoginAt
                        ? <span title={formatDate(u.lastLoginAt)}>{formatRelativeTime(u.lastLoginAt)}</span>
                        : <span className="text-white/20">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <ImpersonateButton userId={u.id} userName={u.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: page === 1 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
                color: page === 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: page === 1 ? "not-allowed" : "pointer",
              }}
            >
              ← Anterior
            </button>
            <span className="text-white/40 text-xs">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: page === totalPages ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
                color: page === totalPages ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: page === totalPages ? "not-allowed" : "pointer",
              }}
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function BugReportsTab() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<{ reports: BugReport[]; total: number }>({
    queryKey: ["bug-reports", page],
    queryFn: () => apiFetch(`/admin-panel/bug-reports?page=${page}&limit=${limit}`),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ id: number; status: string }>(`/admin-panel/bug-reports/${id}`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bug-reports"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  if (isLoading) return <div className="text-white/40 text-sm py-8 text-center">Carregando...</div>;
  if (error) return <div className="text-red-400 text-sm py-8 text-center">{String((error as Error).message)}</div>;
  if (!data) return null;

  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-white font-bold text-base">Bug Reports</h2>
        <p className="text-white/40 text-xs mt-0.5">{data.total} reports no total</p>
      </div>
      <div className="flex flex-col gap-3">
        {data.reports.length === 0 && (
          <div className="text-white/30 text-sm py-8 text-center">Nenhum bug report ainda.</div>
        )}
        {data.reports.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{
              background: r.status === "open" ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${r.status === "open" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white/30 text-xs font-mono">#{r.id}</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold uppercase"
                    style={{
                      background: r.status === "open" ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.15)",
                      color: r.status === "open" ? "#f87171" : "#34d399",
                    }}
                  >
                    {r.status === "open" ? "Aberto" : "Resolvido"}
                  </span>
                  {r.userEmail && (
                    <span className="text-white/40 text-xs truncate">{r.userEmail}</span>
                  )}
                </div>
                {r.page && (
                  <span className="text-white/30 text-xs">Página: {r.page}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-white/30 text-xs whitespace-nowrap">{formatDate(r.createdAt)}</span>
                <button
                  onClick={() => toggleMutation.mutate(r.id)}
                  disabled={toggleMutation.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                  style={{
                    background: r.status === "open" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)",
                    color: r.status === "open" ? "#34d399" : "#f87171",
                    border: `1px solid ${r.status === "open" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)"}`,
                  }}
                >
                  {r.status === "open" ? "Resolver" : "Reabrir"}
                </button>
              </div>
            </div>
            <p className="text-white/75 text-sm leading-relaxed">{r.description}</p>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: page === 1 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
              color: page === 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.08)",
              cursor: page === 1 ? "not-allowed" : "pointer",
            }}
          >
            ← Anterior
          </button>
          <span className="text-white/40 text-xs">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: page === totalPages ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
              color: page === totalPages ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.08)",
              cursor: page === totalPages ? "not-allowed" : "pointer",
            }}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}

interface RecoveryResult {
  ok?: boolean;
  career_id?: string;
  career_created?: boolean;
  seasons_recovered?: number;
  active_season_id?: string | null;
  career_data_keys?: string[];
  metadata_inferred_from_career_data?: Record<string, unknown>;
  competitions_inferred?: string[];
  warnings?: string[];
  message?: string;
  error?: string;
}

function CareerRecoveryTab() {
  const [careerId, setCareerId] = useState("");
  const [userId, setUserId] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubLeague, setClubLeague] = useState("");
  const [clubLogo, setClubLogo] = useState("");
  const [clubId, setClubId] = useState("");
  const [coachName, setCoachName] = useState("");
  const [coachNationality, setCoachNationality] = useState("");
  const [coachFlag, setCoachFlag] = useState("");
  const [coachAge, setCoachAge] = useState("");
  const [result, setResult] = useState<{ success: boolean; data: RecoveryResult } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!careerId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = { career_id: careerId.trim() };
      if (userId.trim()) body.user_id = Number(userId.trim());
      if (clubName.trim()) body.club_name = clubName.trim();
      if (clubLeague.trim()) body.club_league = clubLeague.trim();
      if (clubLogo.trim()) body.club_logo = clubLogo.trim();
      if (clubId.trim()) body.club_id = Number(clubId.trim());
      if (coachName.trim() || coachNationality.trim()) {
        body.coach = {
          name: coachName.trim() || "Técnico",
          nationality: coachNationality.trim() || "Brasil",
          nationalityFlag: coachFlag.trim() || "🇧🇷",
          age: coachAge.trim() ? Number(coachAge.trim()) : 40,
        };
      }

      const data = await apiFetch<RecoveryResult>("/admin-panel/recover-career", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult({ success: true, data });
    } catch (err) {
      setResult({ success: false, data: { error: err instanceof Error ? err.message : "Erro de conexão" } });
    } finally {
      setLoading(false);
    }
  }, [careerId, userId, clubName, clubLeague, clubLogo, clubId, coachName, coachNationality, coachFlag, coachAge]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-white font-bold text-base">Recuperação de Carreira</h2>
        <p className="text-white/40 text-xs mt-0.5">
          Recupera uma carreira órfã (sem user_id) associando-a a um usuário existente.
        </p>
      </div>
      <div className="rounded-2xl p-6 flex flex-col gap-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Career ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={careerId}
                onChange={(e) => setCareerId(e.target.value)}
                placeholder="Ex: mnvq8wxifkh6c"
                required
                className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
              <p className="text-white/30 text-xs">ID da carreira no banco de dados.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                User ID <span className="text-white/30 font-normal normal-case">(opcional)</span>
              </label>
              <input
                type="number"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Ex: 1"
                className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
              <p className="text-white/30 text-xs">Dono da carreira a restaurar.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Nome do Clube <span className="text-white/30 font-normal normal-case">(opcional)</span>
              </label>
              <input
                type="text"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Ex: Watford FC"
                className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Liga <span className="text-white/30 font-normal normal-case">(opcional)</span>
              </label>
              <input
                type="text"
                value={clubLeague}
                onChange={(e) => setClubLeague(e.target.value)}
                placeholder="Ex: Championship"
                className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Club ID <span className="text-white/30 font-normal normal-case">(opcional — API Sports)</span>
              </label>
              <input
                type="number"
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                placeholder="Ex: 50 (Watford)"
                className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
              <p className="text-white/30 text-xs">Se informado, a logo é gerada automaticamente.</p>
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                URL da Logo <span className="text-white/30 font-normal normal-case">(opcional — sobrepõe o Club ID)</span>
              </label>
              <input
                type="url"
                value={clubLogo}
                onChange={(e) => setClubLogo(e.target.value)}
                placeholder="https://media.api-sports.io/football/teams/50.png"
                className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
            </div>
          </div>

          <div className="pt-1">
            <p className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-3">Técnico <span className="font-normal normal-case text-white/20">(opcional — preenchido com valores padrão se omitido)</span></p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/40">Nome</label>
                <input
                  type="text"
                  value={coachName}
                  onChange={(e) => setCoachName(e.target.value)}
                  placeholder="Ex: Eusebio Di Francesco"
                  className="w-full px-3 py-2.5 rounded-xl text-white text-xs focus:outline-none placeholder:text-white/15"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/40">Nacionalidade</label>
                <input
                  type="text"
                  value={coachNationality}
                  onChange={(e) => setCoachNationality(e.target.value)}
                  placeholder="Ex: Itália"
                  className="w-full px-3 py-2.5 rounded-xl text-white text-xs focus:outline-none placeholder:text-white/15"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/40">Bandeira (emoji)</label>
                <input
                  type="text"
                  value={coachFlag}
                  onChange={(e) => setCoachFlag(e.target.value)}
                  placeholder="🇮🇹"
                  className="w-full px-3 py-2.5 rounded-xl text-white text-xs focus:outline-none placeholder:text-white/15"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/40">Idade</label>
                <input
                  type="number"
                  value={coachAge}
                  onChange={(e) => setCoachAge(e.target.value)}
                  placeholder="55"
                  className="w-full px-3 py-2.5 rounded-xl text-white text-xs focus:outline-none placeholder:text-white/15"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !careerId.trim()}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{
              background: loading || !careerId.trim() ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #22c55e, #16a34a)",
              color: loading || !careerId.trim() ? "rgba(255,255,255,0.2)" : "white",
              cursor: loading || !careerId.trim() ? "not-allowed" : "pointer",
              boxShadow: loading || !careerId.trim() ? "none" : "0 4px 16px rgba(34,197,94,0.3)",
            }}
          >
            {loading ? "Recuperando..." : "Recuperar Carreira"}
          </button>
        </form>

        {result && (
          <div className="flex flex-col gap-3">
            <div
              className="rounded-xl px-4 py-3 text-sm font-semibold"
              style={{
                background: result.success ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${result.success ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                color: result.success ? "#34d399" : "#f87171",
              }}
            >
              {result.data.message ?? result.data.error}
            </div>

            {result.success && result.data.warnings && result.data.warnings.length > 0 && (
              <div className="rounded-xl px-4 py-3 flex flex-col gap-2" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                <span className="text-amber-400 text-xs font-bold uppercase tracking-wide">Avisos</span>
                {result.data.warnings.map((w, i) => (
                  <p key={i} className="text-amber-200/70 text-xs leading-relaxed">{w}</p>
                ))}
              </div>
            )}

            {result.success && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="px-4 py-2 text-white/40 text-xs font-semibold uppercase tracking-wide" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  Resultado detalhado
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-px" style={{ background: "rgba(255,255,255,0.06)" }}>
                  {[
                    { label: "Career criada", value: result.data.career_created ? "Sim" : "Não (já existia)" },
                    { label: "Temporadas recuperadas", value: String(result.data.seasons_recovered ?? 0) },
                    { label: "Temporada ativa", value: result.data.active_season_id ?? "—" },
                    { label: "Chaves career_data", value: String(result.data.career_data_keys?.length ?? 0) },
                    { label: "Competições inferidas", value: String(result.data.competitions_inferred?.length ?? 0) },
                  ].map((item) => (
                    <div key={item.label} className="px-4 py-3 flex flex-col gap-0.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <span className="text-white/35 text-xs">{item.label}</span>
                      <span className="text-white text-sm font-semibold font-mono">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "rgba(255,159,28,0.06)", border: "1px solid rgba(255,159,28,0.15)" }}>
        <h3 className="text-amber-400 text-sm font-bold">Como usar</h3>
        <ul className="flex flex-col gap-2">
          {[
            "Consulte o banco para encontrar o career_id da carreira órfã (sem user_id).",
            "Informe o career_id e o user_id do usuário que deve ser o dono.",
            "Preencha nome do clube e liga se quiser sobrescrever os valores inferidos.",
            "O sistema verifica os dados, reconstrói a carreira e ativa a temporada mais recente.",
            "A carreira aparecerá automaticamente na tela do usuário após o próximo login.",
          ].map((item, i) => (
            <li key={i} className="flex gap-2 text-amber-200/60 text-xs leading-relaxed">
              <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(255,159,28,0.2)", color: "#fbbf24" }}>{i + 1}</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface AdminNotification {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  requiresResponse: boolean;
  targetAll: boolean;
  createdAt: number;
  readCount: number;
  targetCount: number;
}

interface AdminUserSimple {
  id: number;
  email: string;
  name: string;
}

function NotificationsTab() {
  const qc = useQueryClient();
  const [page] = useState(1);
  const limit = 20;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [requiresResponse, setRequiresResponse] = useState(false);
  const [targetAll, setTargetAll] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: notifData, isLoading } = useQuery<{ notifications: AdminNotification[]; total: number }>({
    queryKey: ["admin-notifications", page],
    queryFn: () => apiFetch(`/admin-panel/notifications?page=${page}&limit=${limit}`),
  });

  const { data: usersData } = useQuery<{ users: AdminUserSimple[] }>({
    queryKey: ["users-simple"],
    queryFn: () => apiFetch(`/admin-panel/users?page=1&limit=200`),
    enabled: !targetAll,
  });

  const filteredUsers = (usersData?.users ?? []).filter(
    (u) =>
      userSearch.trim() === "" ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin-panel/notifications/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!title.trim()) { setFormError("Título obrigatório."); return; }
    if (!body.trim()) { setFormError("Corpo obrigatório."); return; }
    if (!targetAll && selectedUserIds.length === 0) { setFormError("Selecione ao menos um usuário."); return; }
    setSubmitting(true);
    try {
      await apiFetch("/admin-panel/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim() || undefined,
          requiresResponse,
          targetAll,
          targetUserIds: targetAll ? undefined : selectedUserIds,
        }),
      });
      setTitle("");
      setBody("");
      setImageUrl("");
      setRequiresResponse(false);
      setTargetAll(true);
      setSelectedUserIds([]);
      setUserSearch("");
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
    } catch (err) {
      setFormError(String((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleUser(userId: number) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  const cardStyle = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="text-white font-bold text-base">Notificações</h2>
        <p className="text-white/40 text-xs mt-0.5">Envie pop-ups para usuários ao entrarem no app.</p>
      </div>

      {/* Create form */}
      <form onSubmit={handleSubmit} className="rounded-2xl p-5 flex flex-col gap-4" style={cardStyle}>
        <h3 className="text-white/80 font-semibold text-sm">Nova Notificação</h3>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Título *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Nova funcionalidade disponível!"
            className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Corpo *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Descreva o aviso, novidade ou pedido de feedback..."
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl text-white text-sm resize-none focus:outline-none placeholder:text-white/20"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">URL da Imagem (opcional)</label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        </div>

        {/* Toggles */}
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-white/70 text-sm font-medium">Solicitar resposta do usuário</p>
              <p className="text-white/30 text-xs">Exibe uma caixinha de texto no pop-up</p>
            </div>
            <div
              className="w-11 h-6 rounded-full relative transition-colors duration-200 flex-shrink-0"
              style={{ background: requiresResponse ? "#8b5cf6" : "rgba(255,255,255,0.1)" }}
              onClick={() => setRequiresResponse((v) => !v)}
            >
              <div
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                style={{ left: requiresResponse ? "calc(100% - 20px)" : "4px" }}
              />
            </div>
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-white/70 text-sm font-medium">Enviar para todos</p>
              <p className="text-white/30 text-xs">Todos os usuários verão essa notificação</p>
            </div>
            <div
              className="w-11 h-6 rounded-full relative transition-colors duration-200 flex-shrink-0"
              style={{ background: targetAll ? "#4ade80" : "rgba(255,255,255,0.1)" }}
              onClick={() => { setTargetAll((v) => !v); setSelectedUserIds([]); }}
            >
              <div
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                style={{ left: targetAll ? "calc(100% - 20px)" : "4px" }}
              />
            </div>
          </label>
        </div>

        {/* User selector (when targetAll is off) */}
        {!targetAll && (
          <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
              Selecionar usuários ({selectedUserIds.length} selecionados)
            </p>
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar por email ou nome..."
              className="w-full px-3 py-2 rounded-lg text-white text-xs focus:outline-none placeholder:text-white/20"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {filteredUsers.length === 0 && (
                <p className="text-white/30 text-xs text-center py-2">Nenhum usuário encontrado.</p>
              )}
              {filteredUsers.map((u) => {
                const checked = selectedUserIds.includes(u.id);
                return (
                  <label key={u.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUser(u.id)}
                      className="accent-purple-500"
                    />
                    <div className="min-w-0">
                      <p className="text-white/70 text-xs font-medium truncate">{u.name}</p>
                      <p className="text-white/30 text-xs truncate">{u.email}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {formError && (
          <div className="text-red-400 text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background: submitting ? "rgba(139,92,246,0.2)" : "linear-gradient(135deg, #8b5cf6, #6d28d9)",
            color: submitting ? "rgba(255,255,255,0.3)" : "white",
            cursor: submitting ? "not-allowed" : "pointer",
            boxShadow: submitting ? "none" : "0 4px 16px rgba(139,92,246,0.3)",
          }}
        >
          {submitting ? "Enviando..." : "Enviar Notificação"}
        </button>
      </form>

      {/* Notifications list */}
      <div className="flex flex-col gap-3">
        <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Enviadas</h3>
        {isLoading && <div className="text-white/30 text-sm text-center py-4">Carregando...</div>}
        {!isLoading && notifData?.notifications.length === 0 && (
          <div className="text-white/30 text-sm text-center py-6">Nenhuma notificação enviada ainda.</div>
        )}
        {(notifData?.notifications ?? []).map((n) => (
          <div key={n.id} className="rounded-2xl p-4 flex flex-col gap-2" style={cardStyle}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{n.title}</p>
                <p className="text-white/50 text-xs line-clamp-2">{n.body}</p>
              </div>
              <button
                onClick={() => { if (confirm("Excluir esta notificação?")) deleteMutation.mutate(n.id); }}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-500/15 transition-colors"
                style={{ color: "rgba(248,113,113,0.6)" }}
                title="Excluir"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-white/30 text-xs">
                {new Date(n.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={n.targetAll
                  ? { background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }
                  : { background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}
              >
                {n.targetAll ? "Todos" : `${n.targetCount} usuários`}
              </span>
              {n.requiresResponse && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
                  Pede resposta
                </span>
              )}
              <span className="text-white/30 text-xs ml-auto">
                {n.readCount}/{n.targetAll ? "todos" : n.targetCount} leram
              </span>
            </div>

            {n.imageUrl && (
              <p className="text-white/30 text-xs truncate">🖼 {n.imageUrl}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReferralsTab() {
  const qc = useQueryClient();
  const [page] = useState(1);
  const limit = 30;

  const { data, isLoading } = useQuery<{ referrals: Referral[]; total: number }>({
    queryKey: ["admin-referrals", page],
    queryFn: () => apiFetch(`/admin-panel/referrals?page=${page}&limit=${limit}`),
  });

  const rewardMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      apiFetch(`/admin-panel/referrals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rewarded", notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-referrals"] }),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");

  const statusBadge = (status: string) => {
    if (status === "rewarded") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
          Recompensado
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
        Pendente
      </span>
    );
  };

  const referrals = data?.referrals ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Convites (Referrals)</h2>
        <p className="text-white/40 text-sm mt-0.5">
          Convites registrados — marque como recompensado após aplicar o benefício manualmente.
        </p>
      </div>

      {isLoading ? (
        <div className="text-white/40 text-sm">Carregando...</div>
      ) : referrals.length === 0 ? (
        <div className="rounded-xl px-6 py-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-white/30 text-sm">Nenhum convite registrado ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {referrals.map((r) => (
            <div
              key={r.id}
              className="rounded-xl px-5 py-4 flex flex-col gap-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <p className="text-white text-sm font-semibold">
                    <span className="text-white/40 font-normal">De: </span>
                    {r.referrerEmail ?? `ID ${r.referrerId}`}
                    {r.referrerName ? <span className="text-white/50 font-normal ml-1">({r.referrerName})</span> : null}
                  </p>
                  <p className="text-white/60 text-xs">
                    <span className="text-white/30">Para: </span>
                    {r.referredEmail ?? (r.referredId ? `ID ${r.referredId}` : "—")}
                    {r.referredName ? <span className="text-white/35 ml-1">({r.referredName})</span> : null}
                    {r.referredPlan ? <span className="ml-2 font-semibold text-white/50">[{r.referredPlan.toUpperCase()}]</span> : null}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(r.status)}
                  <span className="text-white/25 text-xs">{formatDate(r.createdAt)}</span>
                </div>
              </div>

              {r.notes && (
                <p className="text-white/40 text-xs italic">Nota: {r.notes}</p>
              )}

              {r.status === "pending" && (
                editingId === r.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Nota (ex: 20 dias Ultra adicionados)"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-white text-xs focus:outline-none placeholder:text-white/20"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          rewardMutation.mutate({ id: r.id, notes: editNotes.trim() });
                          setEditingId(null);
                          setEditNotes("");
                        }}
                        disabled={rewardMutation.isPending}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                        style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}
                      >
                        {rewardMutation.isPending ? "Salvando..." : "Confirmar recompensa"}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditNotes(""); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingId(r.id); setEditNotes(r.notes ?? ""); }}
                    className="self-start px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                    style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}
                  >
                    Marcar como recompensado
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Visão Geral",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "users",
    label: "Usuários",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: "bug-reports",
    label: "Bug Reports",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    id: "career-recovery",
    label: "Recuperar Carreira",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    id: "notifications",
    label: "Notificações",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    id: "referrals",
    label: "Convites",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin-panel/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const body = await res.json() as { token?: string; error?: string };
      if (!res.ok || !body.token) {
        setError(body.error ?? "Senha incorreta.");
        return;
      }
      setToken(body.token);
      onLogin();
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "hsl(222 20% 8%)" }}>
      <div
        className="w-full max-w-sm rounded-3xl p-8 flex flex-col gap-6"
        style={{ background: "hsl(222 20% 12%)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex flex-col gap-1">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-2" style={{ background: "rgba(74,222,128,0.15)" }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-white font-bold text-xl">Admin Panel</h1>
          <p className="text-white/40 text-sm">FC Career Manager — acesso restrito.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Senha de Admin</label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="••••••••"
              autoFocus
              required
              className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none placeholder:text-white/20"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
          </div>
          {error && (
            <div className="text-red-400 text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !secret}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              background: loading || !secret ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #22c55e, #16a34a)",
              color: loading || !secret ? "rgba(255,255,255,0.2)" : "white",
              cursor: loading || !secret ? "not-allowed" : "pointer",
              boxShadow: loading || !secret ? "none" : "0 4px 16px rgba(34,197,94,0.3)",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminApp() {
  const [authed, setAuthed] = useState(() => !!getToken());
  const [tab, setTab] = useState<Tab>("overview");

  const handleLogout = () => {
    clearToken();
    setAuthed(false);
    queryClient.clear();
  };

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(222 20% 8%)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ background: "hsl(222 22% 10%)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(74,222,128,0.15)" }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <span className="text-white font-bold text-sm">Admin Panel</span>
            <span className="text-white/30 text-xs ml-2">FC Career Manager</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          Sair
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className="w-56 flex-shrink-0 flex flex-col gap-1 p-3 hidden md:flex"
          style={{ background: "hsl(222 22% 9%)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150"
                style={{
                  background: active ? "rgba(74,222,128,0.12)" : "transparent",
                  color: active ? "#4ade80" : "rgba(255,255,255,0.45)",
                  border: active ? "1px solid rgba(74,222,128,0.2)" : "1px solid transparent",
                }}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </aside>

        {/* Mobile tab bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex" style={{ background: "hsl(222 22% 10%)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors"
                style={{ color: active ? "#4ade80" : "rgba(255,255,255,0.35)" }}
              >
                {t.icon}
                <span className="text-[10px] leading-none">{t.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6">
          {tab === "overview" && <OverviewTab />}
          {tab === "users" && <UsersTab />}
          {tab === "bug-reports" && <BugReportsTab />}
          {tab === "career-recovery" && <CareerRecoveryTab />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "referrals" && <ReferralsTab />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminApp />
    </QueryClientProvider>
  );
}
