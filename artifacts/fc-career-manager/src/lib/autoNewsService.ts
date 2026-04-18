import type { MatchRecord } from "@/types/match";
import { getMatchResultFull } from "@/types/match";
import type { NewsPost } from "@/types/noticias";
import type { SquadPlayer } from "@/lib/squadCache";
import type { LeaguePosition } from "@/lib/leagueStorage";
import type { CustomPortal } from "@/lib/customPortalStorage";
import { detectMatchEvents } from "@/lib/autoNewsEngine";
import type { ImagePromptContext } from "@/lib/autoNewsEngine";
import { wasEventHandled, markEventHandled } from "@/lib/autoNewsStorage";
import { getAllPlayerStats, getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import { fetchPortals } from "@/lib/customPortalStorage";
import { getPosts, addPost, updatePost, generatePostId, generateCommentId } from "@/lib/noticiaStorage";
import { buildPlayerPerformanceContext, buildPlayerContextString, buildSquadOvrContext } from "@/lib/playerContext";
import { getOpenAIKey } from "@/lib/openaiKeyStorage";

const FC_NEWS_IMAGE_UPDATED_EVENT = "fc-news-image-updated";

async function generateNewsImage(
  postId: string,
  seasonId: string,
  clubName: string,
  clubLeague: string | undefined,
  imagePromptContext: ImagePromptContext,
  isClassico: boolean | undefined,
  rivalName: string | undefined,
  headers: Record<string, string>,
): Promise<void> {
  try {
    const res = await fetch("/api/noticias/generate-image", {
      method: "POST",
      headers,
      body: JSON.stringify({ clubName, clubLeague, imagePromptContext, isClassico, rivalName }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { imageUrl?: string };
    if (!data.imageUrl) return;
    updatePost(seasonId, postId, { imageUrl: data.imageUrl, imageFit: "cover" });
    window.dispatchEvent(new CustomEvent(FC_NEWS_IMAGE_UPDATED_EVENT, { detail: { postId, imageUrl: data.imageUrl } }));
  } catch {
  }
}

function rumorStateKey(seasonId: string): string {
  return `fc-rumor-state-${seasonId}`;
}

function getLastRumorMatchCount(seasonId: string): number {
  try {
    const raw = localStorage.getItem(rumorStateKey(seasonId));
    if (!raw) return -99;
    return (JSON.parse(raw) as { lastRumorAtMatchCount: number }).lastRumorAtMatchCount ?? -99;
  } catch {
    return -99;
  }
}

function setLastRumorMatchCount(seasonId: string, count: number): void {
  try {
    localStorage.setItem(rumorStateKey(seasonId), JSON.stringify({ lastRumorAtMatchCount: count }));
  } catch {}
}

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

export interface RumorContext {
  careerId: string;
  seasonId: string;
  season: string;
  clubName: string;
  clubLeague?: string;
  clubDescription?: string;
  projeto?: string;
  allMatches: MatchRecord[];
  allPlayers: SquadPlayer[];
  customPortals: CustomPortal[];
  fanMoodScore?: number;
  fanMoodLabel?: string;
  onNewPost?: (post: NewsPost) => void;
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
  rivals?: string[];
  fanMoodScore?: number;
  fanMoodLabel?: string;
  onNewPost?: (post: NewsPost) => void;
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

export function buildTeamFormContext(allMatches: MatchRecord[], currentMatch?: MatchRecord): string {
  const others = allMatches
    .filter((m) => !currentMatch || m.id !== currentMatch.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, currentMatch ? 7 : 8);

  const recent = currentMatch ? [currentMatch, ...others] : others;

  if (recent.length === 0) return "";

  const lines = recent.map((m) => {
    const r = getMatchResultFull(m.myScore, m.opponentScore, m.penaltyShootout);
    const base = r === "vitoria" ? "V" : r === "derrota" ? "D" : "E";
    const suffix = m.penaltyShootout ? "(pen.)" : m.hasExtraTime ? "(prorr.)" : "";
    const label = suffix ? `${base}${suffix}` : base;
    return `${label} ${m.opponent} (${m.myScore}-${m.opponentScore}${m.penaltyShootout ? ` | pen. ${m.penaltyShootout.myScore}-${m.penaltyShootout.opponentScore}` : ""})`;
  });

  return `Sequência recente (mais recente primeiro): ${lines.join(" | ")}`;
}

export async function runAutoNews(
  newMatch: MatchRecord,
  ctx: AutoNewsContext,
): Promise<void> {
  try {
    const { careerId, seasonId, season, clubName, clubLeague, clubTitles, clubDescription, projeto, allMatches, allPlayers, leaguePosition, rivals, fanMoodScore, fanMoodLabel, onNewPost } = ctx;

    const seasonPlayerStats = getAllPlayerStats(seasonId);
    const customPortals = await fetchPortals(careerId);
    const allOverrides = getAllPlayerOverrides(careerId);

    const allEvents = detectMatchEvents({
      newMatch,
      allMatches,
      seasonPlayerStats,
      allPlayers,
      leaguePosition,
      clubName,
      season,
      rivals,
    });

    const unhandled = allEvents.filter((e) => !wasEventHandled(seasonId, e.key));

    if (unhandled.length === 0) return;

    const top = unhandled.slice(0, MAX_POSTS_PER_MATCH);

    const playerContextStr = buildPlayerContextString(
      buildPlayerPerformanceContext(seasonId, allPlayers, careerId),
    );

    const squadOvrContext = buildSquadOvrContext(allPlayers, allOverrides);
    const teamFormContext = buildTeamFormContext(allMatches, newMatch);

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
          teamFormContext: teamFormContext || undefined,
          recentPostsContext: recentPosts.length > 0 ? recentPosts : undefined,
          isClassico: event.isClassico || undefined,
          rivalName: event.rivalName || undefined,
          fanMoodScore: fanMoodScore ?? undefined,
          fanMoodLabel: fanMoodLabel ?? undefined,
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
        if (onNewPost) onNewPost(post);

        const shouldGenerateImage = (event.imageWorthy || event.isClassico) && !!openaiKey;
        if (shouldGenerateImage && event.imagePromptContext) {
          const imgCtx = event.isClassico && event.rivalName
            ? { ...event.imagePromptContext, opponent: event.rivalName }
            : event.imagePromptContext;
          void generateNewsImage(post.id, seasonId, clubName, clubLeague, imgCtx, event.isClassico, event.rivalName, headers);
        }

        await new Promise((r) => setTimeout(r, 500));
      } catch {
      }
    }
  } catch {
  }
}

export async function runRumorNews(ctx: RumorContext): Promise<void> {
  const { careerId, seasonId, season, clubName, clubLeague, clubDescription, projeto, allMatches, allPlayers, customPortals, fanMoodScore, fanMoodLabel, onNewPost } = ctx;

  const matchCount = allMatches.length;
  if (matchCount < 2) return;

  const lastRumorAt = getLastRumorMatchCount(seasonId);
  const matchesSinceLast = matchCount - lastRumorAt;
  if (matchesSinceLast < 2) return;

  if (Math.random() >= 0.30) return;

  try {
    const playerContextStr = buildPlayerContextString(
      buildPlayerPerformanceContext(seasonId, allPlayers, careerId),
    );

    const positionCounts: Record<string, number> = {};
    for (const p of allPlayers) {
      const pos = p.position ?? "GK";
      positionCounts[pos] = (positionCounts[pos] ?? 0) + 1;
    }
    const needyPositions = Object.entries(positionCounts)
      .filter(([, cnt]) => cnt <= 1)
      .map(([pos]) => pos);
    const squadPositionNeeds = needyPositions.length > 0
      ? `Posições com apenas 1 jogador (possível necessidade de reforço): ${needyPositions.join(", ")}`
      : "";

    const selectedPortal = customPortals.length > 0 && Math.random() < 0.5
      ? customPortals[Math.floor(Math.random() * customPortals.length)]
      : null;

    const openaiKey = getOpenAIKey();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (openaiKey) headers["x-openai-key"] = openaiKey;

    const body: Record<string, unknown> = {
      clubName,
      season,
      clubLeague: clubLeague || undefined,
      clubDescription: clubDescription || undefined,
      projeto: projeto || undefined,
      playersContext: playerContextStr || undefined,
      squadPositionNeeds: squadPositionNeeds || undefined,
      fanMoodScore: fanMoodScore ?? undefined,
      fanMoodLabel: fanMoodLabel ?? undefined,
      customPortal: selectedPortal
        ? { id: selectedPortal.id, name: selectedPortal.name, description: selectedPortal.description, tone: selectedPortal.tone }
        : undefined,
    };

    const res = await fetch("/api/noticias/generate-rumor", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) return;

    const data = (await res.json()) as AiResult & { customPortalId?: string };

    const post: NewsPost = {
      id: generatePostId(),
      careerId,
      source: (data.source as NewsPost["source"]) ?? (selectedPortal ? "custom" : "espn"),
      sourceHandle: data.sourceHandle,
      sourceName: data.sourceName,
      title: data.title,
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
      category: "transferencia",
      createdAt: Date.now(),
      postTag: "rumor",
      ...(selectedPortal ? { customPortalId: selectedPortal.id } : {}),
    };

    addPost(seasonId, post);
    setLastRumorMatchCount(seasonId, matchCount);
    if (onNewPost) onNewPost(post);
  } catch {
  }
}
