import type { MatchRecord } from "@/types/match";
import type { NewsPost } from "@/types/noticias";
import type { SquadPlayer } from "@/lib/squadCache";
import type { LeaguePosition } from "@/lib/leagueStorage";
import { detectMatchEvents } from "@/lib/autoNewsEngine";
import { wasEventHandled, markEventHandled } from "@/lib/autoNewsStorage";
import { getAllPlayerStats } from "@/lib/playerStatsStorage";
import { getPosts, addPost, generatePostId } from "@/lib/noticiaStorage";
import { buildPlayerPerformanceContext, buildPlayerContextString } from "@/lib/playerContext";
import { getOpenAIKey } from "@/lib/openaiKeyStorage";

interface AiResult {
  source: string;
  sourceHandle: string;
  sourceName: string;
  category: string;
  title?: string;
  content: string;
  likes: number;
  commentsCount: number;
  sharesCount: number;
  comments: Array<{
    username: string;
    displayName: string;
    content: string;
    likes: number;
    personality?: string;
    replies?: unknown[];
  }>;
}

export interface AutoNewsContext {
  careerId: string;
  seasonId: string;
  season: string;
  clubName: string;
  allMatches: MatchRecord[];
  allPlayers: SquadPlayer[];
  leaguePosition: LeaguePosition | null;
}

const MAX_POSTS_PER_MATCH = 3;

export async function runAutoNews(
  newMatch: MatchRecord,
  ctx: AutoNewsContext,
): Promise<void> {
  try {
    const { careerId, seasonId, season, clubName, allMatches, allPlayers, leaguePosition } = ctx;

    const seasonPlayerStats = getAllPlayerStats(seasonId);

    const allEvents = detectMatchEvents({
      newMatch,
      allMatches,
      seasonPlayerStats,
      allPlayers,
      leaguePosition,
      clubName,
      season,
    });

    const unhandled = allEvents.filter((e) => !wasEventHandled(seasonId, e.key));

    if (unhandled.length === 0) return;

    const top = unhandled.slice(0, MAX_POSTS_PER_MATCH);

    const playerContextStr = buildPlayerContextString(
      buildPlayerPerformanceContext(seasonId, allPlayers),
    );

    const recentPosts = getPosts(seasonId).slice(0, 6).map((p) => ({
      title: p.title,
      category: p.category,
      headline: p.content.split("\n").find((l) => l.trim().length > 10)?.trim().slice(0, 120) ?? p.content.slice(0, 120),
    }));

    const openaiKey = getOpenAIKey();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (openaiKey) headers["x-openai-key"] = openaiKey;

    for (const event of top) {
      try {
        const body: Record<string, unknown> = {
          description: event.aiDescription,
          clubName,
          source: event.source !== "custom" ? event.source : undefined,
          category: event.category,
          playersContext: playerContextStr || undefined,
          recentPostsContext: recentPosts.length > 0 ? recentPosts : undefined,
        };

        const res = await fetch("/api/noticias/generate", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          markEventHandled(seasonId, event.key);
          continue;
        }

        const data = (await res.json()) as AiResult;

        const post: NewsPost = {
          id: generatePostId(),
          careerId,
          source: (data.source as NewsPost["source"]) ?? event.source,
          sourceHandle: data.sourceHandle,
          sourceName: data.sourceName,
          title: event.title,
          content: data.content,
          likes: data.likes ?? 0,
          commentsCount: data.commentsCount ?? 0,
          sharesCount: data.sharesCount ?? 0,
          comments: (data.comments ?? []).map((c) => ({
            id: `cmt-auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
            username: c.username,
            displayName: c.displayName,
            content: c.content,
            likes: c.likes ?? 0,
            personality: c.personality as NewsPost["comments"][number]["personality"],
            replies: [],
            createdAt: Date.now(),
          })),
          matchId: newMatch.id,
          category: (data.category as NewsPost["category"]) ?? event.category,
          createdAt: Date.now(),
        };

        addPost(seasonId, post);
        markEventHandled(seasonId, event.key);

        await new Promise((r) => setTimeout(r, 400));
      } catch {
        markEventHandled(seasonId, event.key);
      }
    }
  } catch {
  }
}
