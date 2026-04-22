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

type Tab = "overview" | "users" | "bug-reports" | "career-recovery";

interface Stats {
  users: { total: number; free: number; pro: number; ultra: number };
  careers: { total: number };
  seasons: { total: number };
  aiUsage: { allTime: number };
  bugReports: { total: number; open: number };
}

interface User {
  id: number;
  email: string;
  name: string;
  plan: string;
  aiUsageCount: number;
  createdAt: number;
  careerCount: number;
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

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
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

function OverviewTab() {
  const { data, isLoading, error } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => apiFetch<Stats>("/admin-panel/stats"),
  });

  if (isLoading) return <div className="text-white/40 text-sm py-8 text-center">Carregando...</div>;
  if (error) return <div className="text-red-400 text-sm py-8 text-center">{String((error as Error).message)}</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-white font-bold text-base mb-1">Visão Geral</h2>
        <p className="text-white/40 text-xs">Dados em tempo real do banco de produção.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Usuários" value={data.users.total} color="#4ade80" />
        <StatCard label="Carreiras" value={data.careers.total} />
        <StatCard label="Temporadas" value={data.seasons.total} />
        <StatCard label="Bug Reports" value={data.bugReports.total} sub={`${data.bugReports.open} abertos`} color={data.bugReports.open > 0 ? "#f87171" : "white"} />
      </div>
      <div>
        <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Planos</h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Free" value={data.users.free} color="#94a3b8" />
          <StatCard label="Pro" value={data.users.pro} color="#60a5fa" />
          <StatCard label="Ultra" value={data.users.ultra} color="#c084fc" />
        </div>
      </div>
      <div>
        <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">IA</h3>
        <div className="grid grid-cols-1 gap-3">
          <StatCard label="Gerações de IA (total acumulado)" value={data.aiUsage.allTime} color="#fb923c" />
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const { data, isLoading, error } = useQuery<{ users: User[]; total: number; page: number; limit: number }>({
    queryKey: ["users", page],
    queryFn: () => apiFetch(`/admin-panel/users?page=${page}&limit=${limit}`),
  });

  if (isLoading) return <div className="text-white/40 text-sm py-8 text-center">Carregando...</div>;
  if (error) return <div className="text-red-400 text-sm py-8 text-center">{String((error as Error).message)}</div>;
  if (!data) return null;

  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-base">Usuários</h2>
          <p className="text-white/40 text-xs mt-0.5">{data.total} usuários cadastrados</p>
        </div>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold uppercase tracking-wide">ID</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold uppercase tracking-wide">Plano</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold uppercase tracking-wide">Carreiras</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold uppercase tracking-wide">IA</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold uppercase tracking-wide">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u, i) => (
                <tr
                  key={u.id}
                  style={{
                    background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <td className="px-4 py-3 text-white/30 font-mono text-xs">{u.id}</td>
                  <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">{u.email}</td>
                  <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                  <td className="px-4 py-3 text-white/60">{u.careerCount}</td>
                  <td className="px-4 py-3 text-white/60">{u.aiUsageCount}</td>
                  <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">{formatDate(u.createdAt)}</td>
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

function CareerRecoveryTab() {
  const [careerId, setCareerId] = useState("");
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!careerId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const token = getToken();
      const res = await fetch("/api/admin/recover-career", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": token ?? "",
        },
        body: JSON.stringify({
          careerId: careerId.trim(),
          userId: userId.trim() ? Number(userId.trim()) : undefined,
        }),
      });
      const body = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        setResult({ success: true, message: body.message ?? "Carreira recuperada com sucesso!" });
        setCareerId("");
        setUserId("");
      } else {
        setResult({ success: false, message: body.error ?? `Erro HTTP ${res.status}` });
      }
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Erro de conexão" });
    } finally {
      setLoading(false);
    }
  }, [careerId, userId]);

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
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
            <p className="text-white/30 text-xs">O ID da carreira no banco de dados.</p>
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
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
            <p className="text-white/30 text-xs">Se omitido, usa o menor user_id disponível no banco.</p>
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
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: result.success ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
              border: `1px solid ${result.success ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
              color: result.success ? "#34d399" : "#f87171",
            }}
          >
            {result.message}
          </div>
        )}
      </div>
      <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "rgba(255,159,28,0.06)", border: "1px solid rgba(255,159,28,0.15)" }}>
        <h3 className="text-amber-400 text-sm font-bold">Como usar</h3>
        <ul className="flex flex-col gap-2">
          {[
            "Consulte o banco para encontrar o career_id da carreira órfã (sem user_id).",
            "Informe o career_id e o user_id do usuário que deve ser o dono.",
            "O sistema verifica se a carreira existe, se o usuário existe, e faz a associação.",
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
