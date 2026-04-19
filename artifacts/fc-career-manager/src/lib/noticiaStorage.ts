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
