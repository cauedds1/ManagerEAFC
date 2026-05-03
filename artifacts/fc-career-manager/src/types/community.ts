export interface CommunityPost {
  id: string;
  careerId: string;
  userId: number;
  username: string | null;
  plan: string;
  coachName: string;
  coachPhoto?: string;
  clubName: string;
  clubLogo: string;
  clubId: number;
  clubLeague: string;
  clubPrimary: string | null;
  clubSecondary: string | null;
  content: {
    title?: string;
    content?: string;
    imageUrl?: string;
    sourceName?: string;
    sourceHandle?: string;
    sourcePhotoUrl?: string;
    category?: string;
    [k: string]: unknown;
  };
  lang: string;
  isSpecial: string | null;
  publishedAt: number;
  reactions: Record<string, number>;
  commentsCount: number;
  repostsCount: number;
  viewerReactions: string[];
  viewerReposted: boolean;
}

export interface CommunityComment {
  id: number;
  postId: string;
  userId: number;
  parentCommentId: number | null;
  content: string;
  isPinned: boolean;
  createdAt: number;
  username: string | null;
  plan: string;
  clubName: string;
  clubLogo: string;
  coachName: string;
  coachPhoto?: string;
}

export interface DiscoverProfile {
  careerId: string;
  userId: number;
  username: string | null;
  plan: string;
  bio: string | null;
  clubName: string;
  clubLogo: string;
  clubLeague: string;
  coachName: string;
  coachPhoto?: string;
  lastActivityAt: number | null;
}

export interface PublicProfileResponse {
  careerId: string;
  userId: number;
  username: string;
  plan: string;
  verified: boolean;
  bio: string | null;
  favoriteClubId: number | null;
  coachName: string;
  coachPhoto?: string;
  clubName: string;
  clubLogo: string;
  clubLeague: string;
  clubId: number;
  clubPrimary: string | null;
  clubSecondary: string | null;
  isLive: boolean;
  stats: { totalPosts: number; totalLikes: number };
  sharedHistory: { clubName: string; season: string } | null;
  posts: CommunityPost[];
  publishedAt: number | null;
}

export interface CommunityQuota {
  plan: string;
  limit: number;
  used: number;
  remaining: number;
  dateUtc: string;
}

export interface CommunityProfile {
  careerId: string;
  isPublic: boolean;
  bio: string | null;
  favoriteClubId: number | null;
  autoPublish: boolean;
  publishedAt?: number | null;
}

export interface ActivityItem {
  type: "reaction" | "comment" | "repost";
  postId: string;
  userId: number;
  username: string | null;
  createdAt: number;
  reactionType?: string;
  content?: string;
  commentId?: number;
}

export type ReactionType = "like" | "laugh" | "shock" | "fire" | "love";
export const REACTION_EMOJI: Record<ReactionType, string> = {
  like: "👍",
  laugh: "😂",
  shock: "😮",
  fire: "🔥",
  love: "❤️",
};
