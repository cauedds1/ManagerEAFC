import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

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
    aiModel: "gpt-4.1",
  },
};

export function getPlanLimits(plan: string): PlanLimits {
  if (plan === "pro" || plan === "ultra") return PLAN_LIMITS[plan];
  return PLAN_LIMITS.free;
}

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export const MOMENTOS_MAX_SIZE_BYTES: Record<Plan, number> = {
  free: 0,
  pro: 200 * 1024 * 1024,
  ultra: 500 * 1024 * 1024,
};

export async function getUserPlanFromDb(userId: number): Promise<Plan> {
  const [user] = await db
    .select({ plan: usersTable.plan })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) return "free";
  const plan = user.plan ?? "free";
  if (plan === "pro" || plan === "ultra") return plan;
  return "free";
}
