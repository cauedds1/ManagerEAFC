import type { MatchRecord } from "@/types/match";
import type { NewsPost } from "@/types/noticias";
import type { SquadPlayer } from "@/lib/squadCache";
import type { LeaguePosition } from "@/lib/leagueStorage";
import type { CustomPortal } from "@/lib/customPortalStorage";
import { detectMatchEvents } from "@/lib/autoNewsEngine";
import { wasEventHandled, markEventHandled } from "@/lib/autoNewsStorage";
import { getAllPlayerStats, getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import { getCustomPortals } from "@/lib/customPortalStorage";
import { getPosts, addPost, generatePostId, generateCommentId } from "@/lib/noticiaStorage";
import { buildPlayerPerformanceContext, buildPlayerContextString, buildSquadOvrContext } from "@/lib/playerContext";
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
  clubLeague?: string;
  clubTitles?: { name: string; count: number }[];
  clubDescription?: string;
  projeto?: string;
  allMatches: MatchRecord[];
  allPlayers: SquadPlayer[];
  leaguePosition: LeaguePosition | null;
}

const MAX_POSTS_PER_MATCH = 3;

function pickPortalForEvent(
  portals: CustomPortal[],
  eventIndex: number,
  totalEvents: number,
): CustomPortal | null {
  if (portals.length === 0) return null;
  if (totalEvents === 0) return null;
  const useCustom = eventIndex === Math.floor(totalEvents / 2);
  if (!useCustom) return null;
  return portals[Math.floor(Math.random() * portals.length)];
}

export async function runAutoNews(
  newMatch: MatchRecord,
  ctx: AutoNewsContext,
): Promise<void> {
  try {
    const { careerId, seasonId, season, clubName, clubLeague, clubTitles, clubDescription, projeto, allMatches, allPlayers, leaguePosition } = ctx;

    const seasonPlayerStats = getAllPlayerStats(seasonId);
    const customPortals = getCustomPortals(careerId);
    const allOverrides = getAllPlayerOverrides(careerId);

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
      buildPlayerPerformanceContext(seasonId, allPlayers, careerId),
    );

    const squadOvrContext = buildSquadOvrContext(allPlayers, allOverrides);

    const recentPosts = getPosts(seasonId)
      .slice(0, 6)
      .map((p) => ({
        title: p.title,
        category: p.category,
        headline:
          p.content
            .split("\n")
            .find((l) => l.trim().length > 10)
            ?.trim()
            .slice(0, 120) ?? p.content.slice(0, 120),
      }));

    const openaiKey = getOpenAIKey();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (openaiKey) headers["x-openai-key"] = openaiKey;

    for (let i = 0; i < top.length; i++) {
      const event = top[i];
      try {
        const selectedPortal = pickPortalForEvent(customPortals, i, top.length);
        const isCustom = selectedPortal != null;

        const body: Record<string, unknown> = {
          description: event.aiDescription,
          clubName,
          season,
          source: !isCustom ? event.source : undefined,
          category: event.category,
          clubLeague: clubLeague || undefined,
          clubTitles: clubTitles?.length ? clubTitles : undefined,
          clubDescription: clubDescription || undefined,
          projeto: projeto || undefined,
          playersContext: playerContextStr || undefined,
          squadOvrContext: squadOvrContext || undefined,
          recentPostsContext: recentPosts.length > 0 ? recentPosts : undefined,
          customPortal: isCustom
            ? {
                id: selectedPortal.id,
                name: selectedPortal.name,
                description: selectedPortal.description,
                tone: selectedPortal.tone,
              }
            : undefined,
        };

        const res = await fetch("/api/noticias/generate", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
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
            id: generateCommentId(),
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
          ...(isCustom ? { customPortalId: selectedPortal.id } : {}),
        };

        addPost(seasonId, post);
        markEventHandled(seasonId, event.key);

        await new Promise((r) => setTimeout(r, 500));
      } catch {
      }
    }
  } catch {
  }
}
