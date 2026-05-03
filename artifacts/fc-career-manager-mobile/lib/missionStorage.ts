// PORTED FROM artifacts/fc-career-manager/src/lib/missionStorage.ts — adapted for React Native (AsyncStorage-backed localCache, no DOM).
import type { Plan } from '@/lib/userPlan';
import { putCareerData } from '@/lib/apiStorage';
import { localCache } from '@/lib/localCache';

export type MissionId =
  | 'free_log_match'
  | 'free_gen_news'
  | 'free_view_squad'
  | 'free_set_rivals'
  | 'pro_setup_diretoria'
  | 'pro_save_momento'
  | 'pro_gen_3_news'
  | 'ultra_auto_news'
  | 'ultra_rumor'
  | 'ultra_portal';

export type TeaserKey =
  | 'after_match_diretoria'
  | 'after_news_auto'
  | 'after_squad_rumor'
  | 'after_momento_videonews';

export type MissionTrigger =
  | 'match_added' | 'news_generated_auto' | 'news_generated' | 'elenco_tab_viewed'
  | 'board_member_added' | 'momento_saved' | 'news_count_3' | 'rumor_post_generated'
  | 'portal_created' | 'rival_added';

export interface MissionDef {
  id: MissionId;
  plan: Plan;
  titleKey: string;
  descKey: string;
  tab: string;
  rewardKey: string;
  trigger: MissionTrigger;
  teaserKey?: TeaserKey;
}

export const MISSIONS: MissionDef[] = [
  { id: 'free_view_squad',     plan: 'free',  titleKey: 'm_free3_title',  descKey: 'm_free3_desc',  tab: 'clube',         rewardKey: 'm_free3_reward',  trigger: 'elenco_tab_viewed',     teaserKey: 'after_squad_rumor' },
  { id: 'free_log_match',      plan: 'free',  titleKey: 'm_free1_title',  descKey: 'm_free1_desc',  tab: 'partidas',      rewardKey: 'm_free1_reward',  trigger: 'match_added',           teaserKey: 'after_match_diretoria' },
  { id: 'free_gen_news',       plan: 'free',  titleKey: 'm_free2_title',  descKey: 'm_free2_desc',  tab: 'noticias',      rewardKey: 'm_free2_reward',  trigger: 'news_generated',        teaserKey: 'after_news_auto' },
  { id: 'free_set_rivals',     plan: 'free',  titleKey: 'm_free4_title',  descKey: 'm_free4_desc',  tab: 'configuracoes', rewardKey: 'm_free4_reward',  trigger: 'rival_added' },
  { id: 'pro_setup_diretoria', plan: 'pro',   titleKey: 'm_pro1_title',   descKey: 'm_pro1_desc',   tab: 'diretoria',     rewardKey: 'm_pro1_reward',   trigger: 'board_member_added' },
  { id: 'pro_save_momento',    plan: 'pro',   titleKey: 'm_pro2_title',   descKey: 'm_pro2_desc',   tab: 'momentos',      rewardKey: 'm_pro2_reward',   trigger: 'momento_saved',         teaserKey: 'after_momento_videonews' },
  { id: 'pro_gen_3_news',      plan: 'pro',   titleKey: 'm_pro3_title',   descKey: 'm_pro3_desc',   tab: 'noticias',      rewardKey: 'm_pro3_reward',   trigger: 'news_count_3' },
  { id: 'ultra_auto_news',     plan: 'ultra', titleKey: 'm_ultra1_title', descKey: 'm_ultra1_desc', tab: 'noticias',      rewardKey: 'm_ultra1_reward', trigger: 'news_generated_auto' },
  { id: 'ultra_rumor',         plan: 'ultra', titleKey: 'm_ultra2_title', descKey: 'm_ultra2_desc', tab: 'noticias',      rewardKey: 'm_ultra2_reward', trigger: 'rumor_post_generated' },
  { id: 'ultra_portal',        plan: 'ultra', titleKey: 'm_ultra3_title', descKey: 'm_ultra3_desc', tab: 'configuracoes', rewardKey: 'm_ultra3_reward', trigger: 'portal_created' },
];

function missionKey(careerId: string, missionId: MissionId): string { return `fc_mission_${careerId}_${missionId}`; }
function seenPlanKey(careerId: string): string                       { return `fc_seen_plan_${careerId}`; }
function teaserKey(careerId: string, teaser: TeaserKey): string      { return `fc_teaser_${careerId}_${teaser}`; }
function onboardingSeenKey(careerId: string): string                 { return `fc_onboarding_seen_${careerId}`; }

const TEASER_KEYS: TeaserKey[] = [
  'after_match_diretoria',
  'after_news_auto',
  'after_squad_rumor',
  'after_momento_videonews',
];

type Listener = (missionId: MissionId) => void;
const _listeners = new Set<Listener>();

export function onMissionComplete(listener: Listener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

function persistMissionsToDb(careerId: string): void {
  const completed: Record<string, boolean> = {};
  for (const m of MISSIONS) {
    if (localCache.getItem(missionKey(careerId, m.id)) === '1') {
      completed[m.id] = true;
    }
  }
  void putCareerData(careerId, 'missions', completed);
}

function persistTeasersToDb(careerId: string): void {
  const seen: Record<string, boolean> = {};
  for (const t of TEASER_KEYS) {
    if (localCache.getItem(teaserKey(careerId, t)) === '1') {
      seen[t] = true;
    }
  }
  void putCareerData(careerId, 'teasers', seen);
}

export function hydrateMissionsFromDb(
  careerId: string,
  data: { missions?: Record<string, boolean>; teasers?: Record<string, boolean>; onboarding_seen?: boolean; seen_plan?: string },
): void {
  if (data.missions) {
    for (const [id, done] of Object.entries(data.missions)) {
      if (done) localCache.setItem(missionKey(careerId, id as MissionId), '1');
    }
  }
  if (data.teasers) {
    for (const [t, seen] of Object.entries(data.teasers)) {
      if (seen) localCache.setItem(teaserKey(careerId, t as TeaserKey), '1');
    }
  }
  if (data.onboarding_seen) localCache.setItem(onboardingSeenKey(careerId), '1');
  if (data.seen_plan)       localCache.setItem(seenPlanKey(careerId), data.seen_plan);
}

export function getMissionsLocalState(careerId: string): {
  missions: Record<string, boolean>;
  teasers: Record<string, boolean>;
  onboarding_seen: boolean;
  seen_plan: string | null;
} {
  const missions: Record<string, boolean> = {};
  const teasers: Record<string, boolean> = {};
  for (const m of MISSIONS) {
    if (localCache.getItem(missionKey(careerId, m.id)) === '1') missions[m.id] = true;
  }
  for (const t of TEASER_KEYS) {
    if (localCache.getItem(teaserKey(careerId, t)) === '1') teasers[t] = true;
  }
  return {
    missions,
    teasers,
    onboarding_seen: localCache.getItem(onboardingSeenKey(careerId)) === '1',
    seen_plan: localCache.getItem(seenPlanKey(careerId)),
  };
}

export function isMissionComplete(careerId: string, missionId: MissionId): boolean {
  return localCache.getItem(missionKey(careerId, missionId)) === '1';
}

export function canCompleteMission(careerId: string, missionId: MissionId): boolean {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission) return false;
  const planMissions = MISSIONS.filter((m) => m.plan === mission.plan);
  const idx = planMissions.findIndex((m) => m.id === missionId);
  if (idx <= 0) return true;
  return isMissionComplete(careerId, planMissions[idx - 1].id);
}

export function completeMission(careerId: string, missionId: MissionId): void {
  if (!canCompleteMission(careerId, missionId)) return;
  if (localCache.getItem(missionKey(careerId, missionId)) === '1') return;
  localCache.setItem(missionKey(careerId, missionId), '1');
  persistMissionsToDb(careerId);
  for (const l of _listeners) {
    try { l(missionId); } catch {}
  }
}

export function getSeenPlan(careerId: string): Plan | null {
  const v = localCache.getItem(seenPlanKey(careerId));
  if (v === 'free' || v === 'pro' || v === 'ultra') return v;
  return null;
}

export function setSeenPlan(careerId: string, plan: Plan): void {
  localCache.setItem(seenPlanKey(careerId), plan);
  void putCareerData(careerId, 'seen_plan', plan);
}

export function isTeaserSeen(careerId: string, teaser: TeaserKey): boolean {
  return localCache.getItem(teaserKey(careerId, teaser)) === '1';
}

export function markTeaserSeen(careerId: string, teaser: TeaserKey): void {
  localCache.setItem(teaserKey(careerId, teaser), '1');
  persistTeasersToDb(careerId);
}

export function isOnboardingSeen(careerId: string): boolean {
  return localCache.getItem(onboardingSeenKey(careerId)) === '1';
}

export function markOnboardingSeen(careerId: string): void {
  localCache.setItem(onboardingSeenKey(careerId), '1');
  void putCareerData(careerId, 'onboarding_seen', true);
}

export function getMissionsForPlan(plan: Plan): MissionDef[] {
  return MISSIONS.filter((m) => m.plan === plan);
}

export function getPlanDeltaMissions(oldPlan: Plan, newPlan: Plan): MissionDef[] {
  if (newPlan === 'free') return [];
  if (newPlan === 'pro' && oldPlan === 'free') return MISSIONS.filter((m) => m.plan === 'pro');
  if (newPlan === 'ultra' && oldPlan === 'free') return MISSIONS.filter((m) => m.plan === 'pro' || m.plan === 'ultra');
  if (newPlan === 'ultra' && oldPlan === 'pro') return MISSIONS.filter((m) => m.plan === 'ultra');
  return [];
}

export function allMissionsForPlanDone(careerId: string, plan: Plan): boolean {
  return getMissionsForPlan(plan).every((m) => isMissionComplete(careerId, m.id));
}
