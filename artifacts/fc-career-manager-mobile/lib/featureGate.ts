import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Plan } from '@/lib/userPlan';
import { getPlanLimits } from '@/lib/userPlan';

export type Feature =
  | 'ai.generation'
  | 'ai.rumors'
  | 'ai.leaks'
  | 'ai.autoNews'
  | 'ai.videoNews'
  | 'diretoria'
  | 'customPortals'
  | 'videoMomentos'
  | 'community.post';

interface GateInfo {
  allowed: boolean;
  requiredPlan: 'pro' | 'ultra' | null;
  reason?: 'plan' | 'quota';
}

function evaluate(feature: Feature, plan: Plan): GateInfo {
  const limits = getPlanLimits(plan);
  switch (feature) {
    case 'ai.generation':
      return { allowed: limits.aiGenerationsPerDay > 0, requiredPlan: limits.aiGenerationsPerDay > 0 ? null : 'pro', reason: limits.aiGenerationsPerDay > 0 ? undefined : 'plan' };
    case 'ai.rumors':
      return { allowed: limits.rumorsEnabled, requiredPlan: limits.rumorsEnabled ? null : 'ultra', reason: limits.rumorsEnabled ? undefined : 'plan' };
    case 'ai.leaks':
      return { allowed: limits.maxCustomPortals > 0, requiredPlan: limits.maxCustomPortals > 0 ? null : 'pro', reason: limits.maxCustomPortals > 0 ? undefined : 'plan' };
    case 'ai.autoNews':
      return { allowed: limits.autoNewsEnabled, requiredPlan: limits.autoNewsEnabled ? null : 'ultra', reason: limits.autoNewsEnabled ? undefined : 'plan' };
    case 'ai.videoNews':
      return { allowed: limits.videoNewsEnabled, requiredPlan: limits.videoNewsEnabled ? null : 'ultra', reason: limits.videoNewsEnabled ? undefined : 'plan' };
    case 'diretoria':
      return { allowed: limits.diretoriaEnabled, requiredPlan: limits.diretoriaEnabled ? null : 'pro', reason: limits.diretoriaEnabled ? undefined : 'plan' };
    case 'customPortals':
      return { allowed: limits.maxCustomPortals > 0, requiredPlan: limits.maxCustomPortals > 0 ? null : 'ultra', reason: limits.maxCustomPortals > 0 ? undefined : 'plan' };
    case 'videoMomentos':
      return { allowed: limits.maxVideoMomentos > 0, requiredPlan: limits.maxVideoMomentos > 0 ? null : 'pro', reason: limits.maxVideoMomentos > 0 ? undefined : 'plan' };
    case 'community.post':
      return { allowed: true, requiredPlan: null };
  }
}

export interface FeatureGate extends GateInfo {
  plan: Plan;
  paywallOpen: boolean;
  openPaywall: () => void;
  closePaywall: () => void;
  /** Returns true if the action may proceed; opens paywall and returns false otherwise. */
  ensure: () => boolean;
}

export function useFeatureGate(feature: Feature): FeatureGate {
  const { user } = useAuth();
  const plan = (user?.plan ?? 'free') as Plan;
  const info = evaluate(feature, plan);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const openPaywall = useCallback(() => setPaywallOpen(true), []);
  const closePaywall = useCallback(() => setPaywallOpen(false), []);
  const ensure = useCallback(() => {
    if (info.allowed) return true;
    setPaywallOpen(true);
    return false;
  }, [info.allowed]);

  return { ...info, plan, paywallOpen, openPaywall, closePaywall, ensure };
}
