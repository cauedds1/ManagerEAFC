import { getEffectiveToken } from "./authToken";
import type {
  CommunityPost,
  CommunityComment,
  DiscoverProfile,
  PublicProfileResponse,
  CommunityQuota,
  CommunityProfile,
  ActivityItem,
  ReactionType,
} from "@/types/community";

const API = "/api";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getEffectiveToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    const err = new Error(body.error ?? `HTTP ${res.status}`) as Error & { code?: string; status?: number };
    err.code = body.code;
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

// ─── Username ────
export const getMyUsername = () => req<{ username: string | null }>("/community/username");
export const setMyUsername = (username: string) => req<{ username: string }>("/community/username", { method: "PUT", body: JSON.stringify({ username }) });
export const checkUsername = (u: string) => req<{ available: boolean; reason?: string }>(`/community/username/check?u=${encodeURIComponent(u)}`);

// ─── Profile ────
export const getProfile = (careerId: string) => req<CommunityProfile>(`/community/profile/${encodeURIComponent(careerId)}`);
export const updateProfile = (careerId: string, patch: Partial<Pick<CommunityProfile, "isPublic" | "bio" | "favoriteClubId" | "autoPublish">>) =>
  req<{ ok: true }>(`/community/profile/${encodeURIComponent(careerId)}`, { method: "PUT", body: JSON.stringify(patch) });

// ─── Quota ────
export const getQuota = () => req<CommunityQuota>("/community/quota");

// ─── Posts ────
export interface PublishParams {
  careerId: string;
  originalNewsPostId: string;
  content: Record<string, unknown>;
  lang?: "pt" | "en";
  isSpecial?: string;
}
export const publishPost = (p: PublishParams) => req<{ id: string; publishedAt?: number; alreadyPublished?: boolean }>("/community/posts", { method: "POST", body: JSON.stringify(p) });
export const unpublishPost = (id: string) => req<{ ok: true }>(`/community/posts/${encodeURIComponent(id)}`, { method: "DELETE" });

// ─── Feed ────
export interface FeedParams { lang?: "pt" | "en"; myClub?: boolean; myLeague?: boolean; limit?: number; before?: number }
export const getFeed = (p: FeedParams = {}) => {
  const qs = new URLSearchParams();
  if (p.lang) qs.set("lang", p.lang);
  if (p.myClub) qs.set("myClub", "1");
  if (p.myLeague) qs.set("myLeague", "1");
  if (p.limit) qs.set("limit", String(p.limit));
  if (p.before) qs.set("before", String(p.before));
  return req<{ posts: CommunityPost[]; nextCursor: number | null }>(`/community/feed?${qs.toString()}`);
};

export const getDiscover = (q?: string, opts: { myClub?: boolean; myLeague?: boolean } = {}) => {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (opts.myClub) qs.set("myClub", "1");
  if (opts.myLeague) qs.set("myLeague", "1");
  return req<DiscoverProfile[]>(`/community/discover?${qs.toString()}`);
};

export const getTopWeek = () => req<CommunityPost[]>("/community/top-week");

export const getPublicProfile = (username: string, careerId: string) =>
  req<PublicProfileResponse>(`/community/profiles/${encodeURIComponent(username.replace(/^@/, ""))}/${encodeURIComponent(careerId)}`);

// ─── Reactions ────
export const addReaction = (postId: string, type: ReactionType) =>
  req<{ ok: true }>(`/community/posts/${encodeURIComponent(postId)}/reactions`, { method: "POST", body: JSON.stringify({ type }) });
export const removeReaction = (postId: string, type: ReactionType) =>
  req<{ ok: true }>(`/community/posts/${encodeURIComponent(postId)}/reactions?type=${type}`, { method: "DELETE" });

// ─── Comments ────
export const getComments = (postId: string) => req<CommunityComment[]>(`/community/posts/${encodeURIComponent(postId)}/comments`);
export const addComment = (postId: string, content: string, parentCommentId?: number) =>
  req<{ id: number; createdAt: number }>(`/community/posts/${encodeURIComponent(postId)}/comments`, { method: "POST", body: JSON.stringify({ content, parentCommentId }) });
export const updateComment = (id: number, patch: { isPinned?: boolean; isHidden?: boolean }) =>
  req<{ ok: true }>(`/community/comments/${id}`, { method: "PUT", body: JSON.stringify(patch) });
export const deleteComment = (id: number) => req<{ ok: true }>(`/community/comments/${id}`, { method: "DELETE" });

// ─── Reposts ────
export const repost = (postId: string) => req<{ ok: true }>(`/community/posts/${encodeURIComponent(postId)}/repost`, { method: "POST" });
export const unrepost = (postId: string) => req<{ ok: true }>(`/community/posts/${encodeURIComponent(postId)}/repost`, { method: "DELETE" });

// ─── Blocks/Reports ────
export const blockUser = (userId: number) => req<{ ok: true }>("/community/blocks", { method: "POST", body: JSON.stringify({ userId }) });
export const unblockUser = (userId: number) => req<{ ok: true }>(`/community/blocks/${userId}`, { method: "DELETE" });
export const getBlocks = () => req<Array<{ userId: number; username: string | null; name: string; createdAt: number }>>("/community/blocks");
export const reportContent = (targetType: "post" | "comment" | "profile", targetId: string, reason: string, notes?: string) =>
  req<{ ok: true }>("/community/reports", { method: "POST", body: JSON.stringify({ targetType, targetId, reason, notes }) });

// ─── Activity / Notifications ────
export const getActivity = () => req<ActivityItem[]>("/community/activity");
export const getNotificationSummary = () => req<{ count: number; lastSeenAt: number }>("/community/notifications/summary");
export const markSeen = () => req<{ ok: true }>("/community/notifications/seen", { method: "POST" });

// ─── Public preview (no auth) ────
export const getPreviewPosts = async (): Promise<CommunityPost[]> => {
  const res = await fetch(`${API}/community/preview`);
  if (!res.ok) return [];
  return res.json() as Promise<CommunityPost[]>;
};
