import type { NewsPost } from "@/types/noticias";
import type { Career } from "@/types/career";
import { putSeasonData } from "@/lib/apiStorage";
import { sessionGet, sessionSet, sessionDel } from "@/lib/sessionStore";

function postsKey(seasonId: string): string {
  return `fc-career-noticias-${seasonId}`;
}

export function getPosts(seasonId: string): NewsPost[] {
  return sessionGet<NewsPost[]>(postsKey(seasonId)) ?? [];
}

export function savePosts(seasonId: string, posts: NewsPost[]): void {
  sessionSet(postsKey(seasonId), posts);
  void putSeasonData(seasonId, "news", posts);
}

export function addPost(seasonId: string, post: NewsPost): void {
  const posts = getPosts(seasonId);
  posts.unshift(post);
  savePosts(seasonId, posts);
}

export function removePost(seasonId: string, postId: string): void {
  const posts = getPosts(seasonId).filter((p) => p.id !== postId);
  savePosts(seasonId, posts);
}

export function generatePostId(): string {
  return `post-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateCommentId(): string {
  return `cmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function clearPosts(seasonId: string): void {
  sessionDel(postsKey(seasonId));
}

export function updatePost(seasonId: string, postId: string, updates: Partial<NewsPost>): void {
  const posts = getPosts(seasonId);
  const idx = posts.findIndex((p) => p.id === postId);
  if (idx === -1) return;
  posts[idx] = { ...posts[idx], ...updates };
  savePosts(seasonId, posts);
}

export function generateNoticia(_career: Career, _trigger: string): null {
  return null;
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("fc_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function deleteMediaFromR2(imageKey?: string, videoKey?: string): Promise<void> {
  const keys = [imageKey, videoKey].filter((k): k is string => !!k);
  await Promise.allSettled(
    keys.map((key) =>
      fetch(`/api/storage/objects?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      }),
    ),
  );
}
