import type { MatchRecord } from "@/types/match";
import { getMatchResultFull } from "@/types/match";
import type { NewsPost } from "@/types/noticias";
import type { SquadPlayer } from "@/lib/squadCache";
import type { LeaguePosition } from "@/lib/leagueStorage";
import type { CustomPortal } from "@/lib/customPortalStorage";
import { detectMatchEvents } from "@/lib/autoNewsEngine";
import { wasEventHandled, markEventHandled } from "@/lib/autoNewsStorage";
import { getAllPlayerStats, getAllPlayerOverrides } from "@/lib/playerStatsStorage";
import { fetchPortals } from "@/lib/customPortalStorage";
import { getPosts, addPost, generatePostId, generateCommentId } from "@/lib/noticiaStorage";
import { buildPlayerPerformanceContext, buildPlayerContextString, buildSquadOvrContext, buildStartingXIContext } from "@/lib/playerContext";
import { getAiHeaders } from "@/lib/apiStorage";

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
  currentCompetitions?: string[];
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
  currentCompetitions?: string[];
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
    const { careerId, seasonId, season, clubName, clubLeague, currentCompetitions, clubTitles, clubDescription, projeto, allMatches, allPlayers, leaguePosition, rivals, fanMoodScore, fanMoodLabel, onNewPost } = ctx;

    const seasonPlayerStats = getAllPlayerStats(seasonId);
    const customPortals = await fetchPortals(careerId);
    const allOverrides = getAllPlayerOverrides(careerId);

    const allEvents = detectMatchEvents({
      newMatch,
      allMatches,
      seasonPlayerStats,
      allPlayers,
      allOverrides,
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
    const startingXIContext = buildStartingXIContext(allMatches, newMatch, allPlayers, seasonPlayerStats, allOverrides);

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

    const headers = getAiHeaders();

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
          currentCompetitions: currentCompetitions?.length ? currentCompetitions : undefined,
          clubTitles: clubTitles?.length ? clubTitles : undefined,
          clubDescription: clubDescription || undefined,
          projeto: projeto || undefined,
          playersContext: playerContextStr || undefined,
          squadOvrContext: squadOvrContext || undefined,
          teamFormContext: teamFormContext || undefined,
          startingXIContext: startingXIContext || undefined,
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

        await new Promise((r) => setTimeout(r, 500));
      } catch {
      }
    }
  } catch {
  }
}

export function leagueTierLevel(league: string): number {
  const l = league.toLowerCase();
  if (
    l.includes("série d") || l.includes("serie d") ||
    l.includes("quarta") ||
    l.includes("league two") || l.includes("league 2") ||
    l.includes("4. liga") || l.includes("cuarta")
  ) return 4;
  if (
    l.includes("série c") || l.includes("serie c") ||
    l.includes("terceira") ||
    l.includes("league one") || l.includes("league 1") ||
    l.includes("3. liga") || l.includes("tercera")
  ) return 3;
  if (
    l.includes("série b") || l.includes("serie b") ||
    l.includes("segunda") || l.includes("2ª divisão") || l.includes("2a divisao") ||
    l.includes("championship") ||
    l.includes("2. bundesliga") || l.includes("2.bundesliga") ||
    l.includes("ligue 2") ||
    l.includes("serie b") ||
    l.includes("segunda división") || l.includes("segunda division") || l.includes("laliga 2") || l.includes("la liga 2") ||
    l.includes("eredivisie") === false && l.includes("eerste divisie") ||
    l.includes("segunda liga") ||
    l.includes("promotion league") ||
    l.includes("super lig b") ||
    l.includes("tff 1")
  ) return 2;
  return 1;
}

export interface PromotionRelegationContext {
  careerId: string;
  newSeasonId: string;
  newSeasonLabel: string;
  clubName: string;
  clubDescription?: string;
  projeto?: string;
  oldLeague: string;
  newLeague: string;
  onNewPost?: (post: NewsPost) => void;
}

export async function runPromotionRelegationNews(ctx: PromotionRelegationContext): Promise<void> {
  const { careerId, newSeasonId, newSeasonLabel, clubName, clubDescription, projeto, oldLeague, newLeague, onNewPost } = ctx;

  const oldTier = leagueTierLevel(oldLeague);
  const newTier = leagueTierLevel(newLeague);

  if (oldTier === newTier) return;

  const isPromotion = newTier < oldTier;

  const description = isPromotion
    ? `O clube ${clubName} foi PROMOVIDO de "${oldLeague}" para "${newLeague}"! Uma conquista histórica que leva o clube a uma divisão superior na temporada ${newSeasonLabel}. Gere uma notícia especial de destaque celebrando essa promoção de divisão com muito entusiasmo.`
    : `O clube ${clubName} foi REBAIXADO de "${oldLeague}" para "${newLeague}". Uma temporada decepcionante que resultou na queda de divisão; o clube disputará "${newLeague}" na temporada ${newSeasonLabel}. Gere uma notícia especial anunciando esse rebaixamento com tom dramático e análise das consequências.`;

  try {
    const headers = getAiHeaders();

    const body: Record<string, unknown> = {
      description,
      clubName,
      season: newSeasonLabel,
      category: "conquista",
      clubLeague: newLeague,
      clubDescription: clubDescription || undefined,
      projeto: projeto || undefined,
    };

    const res = await fetch("/api/noticias/generate", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) return;

    const data = (await res.json()) as AiResult;

    const post: NewsPost = {
      id: generatePostId(),
      careerId,
      source: (data.source as NewsPost["source"]) ?? "espn",
      sourceHandle: data.sourceHandle,
      sourceName: data.sourceName,
      title: isPromotion
        ? `PROMOÇÃO: ${clubName} sobe para ${newLeague}!`
        : `REBAIXAMENTO: ${clubName} cai para ${newLeague}`,
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
      category: (data.category as NewsPost["category"]) ?? "conquista",
      createdAt: Date.now(),
    };

    addPost(newSeasonId, post);
    if (onNewPost) onNewPost(post);
  } catch {
  }
}

export async function runRumorNews(ctx: RumorContext): Promise<void> {
  const { careerId, seasonId, season, clubName, clubLeague, currentCompetitions, clubDescription, projeto, allMatches, allPlayers, customPortals, fanMoodScore, fanMoodLabel, onNewPost } = ctx;

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

    const headers = getAiHeaders();

    const body: Record<string, unknown> = {
      clubName,
      season,
      clubLeague: clubLeague || undefined,
      currentCompetitions: currentCompetitions?.length ? currentCompetitions : undefined,
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
