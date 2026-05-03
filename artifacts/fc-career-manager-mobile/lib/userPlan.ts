export type Plan = 'free' | 'pro' | 'ultra';

export interface FrontendPlanLimits {
  maxCareers: number;
  aiGenerationsPerDay: number;
  maxDiretoriaMembers: number;
  maxCustomPortals: number;
  autoNewsEnabled: boolean;
  rumorsEnabled: boolean;
  diretoriaEnabled: boolean;
  maxVideoMomentos: number;
  maxVideoMomentoSizeMb: number;
  videoNewsEnabled: boolean;
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
    maxVideoMomentos: 0,
    maxVideoMomentoSizeMb: 0,
    videoNewsEnabled: false,
  },
  pro: {
    maxCareers: 5,
    aiGenerationsPerDay: 20,
    maxDiretoriaMembers: 2,
    maxCustomPortals: 0,
    autoNewsEnabled: false,
    rumorsEnabled: false,
    diretoriaEnabled: true,
    maxVideoMomentos: 25,
    maxVideoMomentoSizeMb: 200,
    videoNewsEnabled: false,
  },
  ultra: {
    maxCareers: Infinity,
    aiGenerationsPerDay: Infinity,
    maxDiretoriaMembers: Infinity,
    maxCustomPortals: 3,
    autoNewsEnabled: true,
    rumorsEnabled: true,
    diretoriaEnabled: true,
    maxVideoMomentos: 60,
    maxVideoMomentoSizeMb: 500,
    videoNewsEnabled: true,
  },
};

let _currentPlan: Plan = 'free';

/** Set by AuthContext when the user is loaded / refreshed. */
export function setCurrentPlan(plan: Plan): void {
  _currentPlan = plan;
}

export function getUserPlan(): Plan {
  return _currentPlan;
}

export function getPlanLimits(plan: Plan): FrontendPlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function getPlanLabel(plan: Plan): string {
  if (plan === 'pro') return 'Pro';
  if (plan === 'ultra') return 'Ultra';
  return 'Free';
}

export function getPlanColor(plan: Plan): string {
  if (plan === 'ultra') return '#f59e0b';
  if (plan === 'pro') return '#7c5cfc';
  return 'rgba(255,255,255,0.4)';
}
