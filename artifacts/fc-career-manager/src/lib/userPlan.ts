export type Plan = "free" | "pro" | "ultra";

export interface FrontendPlanLimits {
  maxCareers: number;
  aiGenerationsPerDay: number;
  maxDiretoriaMembers: number;
  maxCustomPortals: number;
  autoNewsEnabled: boolean;
  rumorsEnabled: boolean;
  diretoriaEnabled: boolean;
}

const PLAN_LIMITS: Record<Plan, FrontendPlanLimits> = {
  free: {
    maxCareers: 1,
    aiGenerationsPerDay: 3,
    maxDiretoriaMembers: 0,
    maxCustomPortals: 0,
    autoNewsEnabled: false,
    rumorsEnabled: false,
    diretoriaEnabled: false,
  },
  pro: {
    maxCareers: 5,
    aiGenerationsPerDay: 20,
    maxDiretoriaMembers: 2,
    maxCustomPortals: 0,
    autoNewsEnabled: false,
    rumorsEnabled: false,
    diretoriaEnabled: true,
  },
  ultra: {
    maxCareers: Infinity,
    aiGenerationsPerDay: Infinity,
    maxDiretoriaMembers: Infinity,
    maxCustomPortals: 3,
    autoNewsEnabled: true,
    rumorsEnabled: true,
    diretoriaEnabled: true,
  },
};

export function getUserPlan(): Plan {
  try {
    const raw = localStorage.getItem("fc_auth_user");
    if (!raw) return "free";
    const user = JSON.parse(raw) as { plan?: string };
    if (user.plan === "pro" || user.plan === "ultra") return user.plan;
  } catch {}
  return "free";
}

export function getPlanLimits(plan: Plan): FrontendPlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function getPlanLabel(plan: Plan): string {
  if (plan === "pro") return "Pro";
  if (plan === "ultra") return "Ultra";
  return "Free";
}

export function getPlanColor(plan: Plan): string {
  if (plan === "ultra") return "#f59e0b";
  if (plan === "pro") return "#7c5cfc";
  return "rgba(255,255,255,0.4)";
}
