export type Plan = "free" | "pro" | "ultra";

export interface PlanLimits {
  maxCareers: number;
  aiGenerationsPerDay: number;
  maxDiretoriaMembers: number;
  maxCustomPortals: number;
  autoNewsEnabled: boolean;
  rumorsEnabled: boolean;
  diretoriaEnabled: boolean;
  aiModel: string;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxCareers: 1,
    aiGenerationsPerDay: 3,
    maxDiretoriaMembers: 0,
    maxCustomPortals: 0,
    autoNewsEnabled: false,
    rumorsEnabled: false,
    diretoriaEnabled: false,
    aiModel: "gemini-flash",
  },
  pro: {
    maxCareers: 5,
    aiGenerationsPerDay: 20,
    maxDiretoriaMembers: 2,
    maxCustomPortals: 0,
    autoNewsEnabled: false,
    rumorsEnabled: false,
    diretoriaEnabled: true,
    aiModel: "gemini-flash",
  },
  ultra: {
    maxCareers: Infinity,
    aiGenerationsPerDay: Infinity,
    maxDiretoriaMembers: Infinity,
    maxCustomPortals: 3,
    autoNewsEnabled: true,
    rumorsEnabled: true,
    diretoriaEnabled: true,
    aiModel: "gpt-4o",
  },
};

export function getPlanLimits(plan: string): PlanLimits {
  if (plan === "pro" || plan === "ultra") return PLAN_LIMITS[plan];
  return PLAN_LIMITS.free;
}

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
