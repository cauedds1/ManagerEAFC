import type { NewsPost } from "@/types/noticias";
import type { Career } from "@/types/career";

function postsKey(careerId: string): string {
  return `fc-career-noticias-${careerId}`;
}

export function getPosts(careerId: string): NewsPost[] {
  try {
    const raw = localStorage.getItem(postsKey(careerId));
    if (!raw) return [];
    return JSON.parse(raw) as NewsPost[];
  } catch {
    return [];
  }
}

export function savePosts(careerId: string, posts: NewsPost[]): void {
  try {
    localStorage.setItem(postsKey(careerId), JSON.stringify(posts));
  } catch {}
}

export function addPost(careerId: string, post: NewsPost): void {
  const posts = getPosts(careerId);
  posts.unshift(post);
  savePosts(careerId, posts);
}

export function generatePostId(): string {
  return `post-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateCommentId(): string {
  return `cmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function clearPosts(careerId: string): void {
  try {
    localStorage.removeItem(postsKey(careerId));
  } catch {}
}

export function generateNoticia(_career: Career, _trigger: string): null {
  return null;
}
