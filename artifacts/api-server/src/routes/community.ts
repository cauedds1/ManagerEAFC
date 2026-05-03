import { Router } from "express";
import {
  db,
  usersTable,
  careersTable,
  publicProfilesTable,
  publicPostsTable,
  postReactionsTable,
  postCommentsTable,
  commentReactionsTable,
  postRepostsTable,
  userBlocksTable,
  contentReportsTable,
  userDailyQuotaTable,
  communityLastSeenTable,
} from "@workspace/db";
import { and, desc, eq, gt, gte, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

const COMMUNITY_QUOTA: Record<string, number> = {
  free: 0,
  pro: 8,
  ultra: 30,
};

const MAX_BIO = 160;
const MAX_COMMENT = 280;
const USERNAME_RX = /^[a-z0-9_]{3,20}$/;
const VALID_REACTIONS = new Set(["like", "laugh", "shock", "fire", "love"]);
const REPORT_AUTOHIDE_THRESHOLD = 5;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function genId(): string {
  return `pp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getUsername(userId: number): Promise<string | null> {
  const [u] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return u?.username ?? null;
}

async function ownsCareer(userId: number, careerId: string): Promise<boolean> {
  const [c] = await db.select({ userId: careersTable.userId }).from(careersTable).where(eq(careersTable.id, careerId)).limit(1);
  return !!c && c.userId === userId;
}

// Returns post if visible (not hidden AND owning profile is public). Null otherwise.
async function getVisiblePost(postId: string): Promise<{ id: string; userId: number; careerId: string } | null> {
  const [row] = await db.select({
    id: publicPostsTable.id,
    userId: publicPostsTable.userId,
    careerId: publicPostsTable.careerId,
    isHidden: publicPostsTable.isHidden,
    isPublic: publicProfilesTable.isPublic,
  })
    .from(publicPostsTable)
    .innerJoin(publicProfilesTable, eq(publicProfilesTable.careerId, publicPostsTable.careerId))
    .where(eq(publicPostsTable.id, postId))
    .limit(1);
  if (!row || row.isHidden || !row.isPublic) return null;
  return { id: row.id, userId: row.userId, careerId: row.careerId };
}

async function isBlockedBetween(a: number, b: number): Promise<boolean> {
  if (a === b) return false;
  const [r] = await db.select({ id: userBlocksTable.blockerId })
    .from(userBlocksTable)
    .where(or(
      and(eq(userBlocksTable.blockerId, a), eq(userBlocksTable.blockedId, b)),
      and(eq(userBlocksTable.blockerId, b), eq(userBlocksTable.blockedId, a)),
    ))
    .limit(1);
  return !!r;
}

async function getBlockedUserIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ blockedId: userBlocksTable.blockedId, blockerId: userBlocksTable.blockerId })
    .from(userBlocksTable)
    .where(or(eq(userBlocksTable.blockerId, userId), eq(userBlocksTable.blockedId, userId)));
  const ids = new Set<number>();
  for (const r of rows) {
    if (r.blockerId === userId) ids.add(r.blockedId);
    else ids.add(r.blockerId);
  }
  return [...ids];
}

// ─── Username ──────────────────────────────────────────────────────────────
router.get("/community/username", requireAuth, async (req: AuthRequest, res) => {
  const username = await getUsername(req.user!.id);
  res.json({ username });
});

router.put("/community/username", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const raw = (req.body as { username?: string })?.username;
  if (typeof raw !== "string") return res.status(400).json({ error: "username required" });
  const u = raw.trim().toLowerCase();
  if (!USERNAME_RX.test(u)) return res.status(400).json({ error: "Username deve ter 3-20 caracteres (a-z, 0-9, _)" });
  try {
    const [exists] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, u)).limit(1);
    if (exists && exists.id !== userId) return res.status(409).json({ error: "Esse @ já está em uso" });
    await db.update(usersTable).set({ username: u }).where(eq(usersTable.id, userId));
    res.json({ username: u });
  } catch (err) {
    console.error("PUT /community/username", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/community/username/check", requireAuth, async (req: AuthRequest, res) => {
  const u = String(req.query.u ?? "").trim().toLowerCase();
  if (!USERNAME_RX.test(u)) return res.json({ available: false, reason: "invalid" });
  const [exists] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, u)).limit(1);
  res.json({ available: !exists || exists.id === req.user!.id });
});

// ─── Profile (per-career public toggle) ────────────────────────────────────
router.get("/community/profile/:careerId", requireAuth, async (req: AuthRequest, res) => {
  const { careerId } = req.params;
  if (!(await ownsCareer(req.user!.id, careerId))) return res.status(403).json({ error: "Forbidden" });
  const [p] = await db.select().from(publicProfilesTable).where(eq(publicProfilesTable.careerId, careerId)).limit(1);
  if (!p) return res.json({ careerId, isPublic: false, bio: null, favoriteClubId: null, autoPublish: false });
  res.json({
    careerId: p.careerId,
    isPublic: p.isPublic,
    bio: p.bio,
    favoriteClubId: p.favoriteClubId,
    autoPublish: p.autoPublish,
    publishedAt: p.publishedAt ? Number(p.publishedAt) : null,
  });
});

router.put("/community/profile/:careerId", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { careerId } = req.params;
  if (!(await ownsCareer(userId, careerId))) return res.status(403).json({ error: "Forbidden" });

  const [u] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const plan = u?.plan ?? "free";

  const body = req.body as { isPublic?: boolean; bio?: string | null; favoriteClubId?: number | null; autoPublish?: boolean };

  if (body.isPublic && plan === "free") {
    return res.status(403).json({ error: "Plano Free não pode publicar. Faça upgrade para Pro ou Ultra.", code: "PLAN_LIMIT" });
  }

  const bio = typeof body.bio === "string" ? body.bio.slice(0, MAX_BIO) : body.bio === null ? null : undefined;
  const now = Date.now();

  const [existing] = await db.select().from(publicProfilesTable).where(eq(publicProfilesTable.careerId, careerId)).limit(1);
  if (!existing) {
    await db.insert(publicProfilesTable).values({
      careerId,
      userId,
      isPublic: body.isPublic ?? false,
      bio: bio ?? null,
      favoriteClubId: body.favoriteClubId ?? null,
      autoPublish: body.autoPublish ?? false,
      publishedAt: body.isPublic ? now : null,
      lastActivityAt: now,
    });
  } else {
    const patch: Record<string, unknown> = { lastActivityAt: now };
    if (body.isPublic !== undefined) {
      patch.isPublic = body.isPublic;
      if (body.isPublic && !existing.publishedAt) patch.publishedAt = now;
    }
    if (bio !== undefined) patch.bio = bio;
    if (body.favoriteClubId !== undefined) patch.favoriteClubId = body.favoriteClubId;
    if (body.autoPublish !== undefined) patch.autoPublish = body.autoPublish;
    await db.update(publicProfilesTable).set(patch).where(eq(publicProfilesTable.careerId, careerId));
  }
  res.json({ ok: true });
});

// ─── Quota ─────────────────────────────────────────────────────────────────
router.get("/community/quota", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const [u] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const plan = u?.plan ?? "free";
  const limit = COMMUNITY_QUOTA[plan] ?? 0;
  const date = todayUtc();
  const [q] = await db.select().from(userDailyQuotaTable).where(and(eq(userDailyQuotaTable.userId, userId), eq(userDailyQuotaTable.dateUtc, date))).limit(1);
  const used = q?.postsPublished ?? 0;
  res.json({ plan, limit, used, remaining: Math.max(0, limit - used), dateUtc: date });
});

// ─── Publish / unpublish post ──────────────────────────────────────────────
interface PublishBody {
  careerId: string;
  originalNewsPostId: string;
  content: Record<string, unknown>;
  lang?: "pt" | "en";
  isSpecial?: string;
}

router.post("/community/posts", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const body = req.body as PublishBody;
  if (!body?.careerId || !body?.originalNewsPostId || !body?.content) {
    return res.status(400).json({ error: "careerId, originalNewsPostId, content required" });
  }
  if (!(await ownsCareer(userId, body.careerId))) return res.status(403).json({ error: "Forbidden" });

  const username = await getUsername(userId);
  if (!username) return res.status(400).json({ error: "Defina seu @username antes de publicar", code: "NO_USERNAME" });

  const [u] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const plan = u?.plan ?? "free";
  const limit = COMMUNITY_QUOTA[plan] ?? 0;
  if (limit <= 0) return res.status(403).json({ error: "Plano Free não publica", code: "PLAN_LIMIT" });

  const [profile] = await db.select().from(publicProfilesTable).where(eq(publicProfilesTable.careerId, body.careerId)).limit(1);
  if (!profile?.isPublic) return res.status(403).json({ error: "Carreira não é pública", code: "NOT_PUBLIC" });

  const date = todayUtc();
  const id = genId();
  const now = Date.now();

  // Atomic publish: transaction with conditional quota increment to prevent race
  try {
    const result = await db.transaction(async (tx) => {
      // Dedupe inside tx
      const [dupe] = await tx.select({ id: publicPostsTable.id, isHidden: publicPostsTable.isHidden, hiddenReason: publicPostsTable.hiddenReason })
        .from(publicPostsTable)
        .where(and(eq(publicPostsTable.careerId, body.careerId), eq(publicPostsTable.originalNewsPostId, body.originalNewsPostId))).limit(1);
      if (dupe) {
        if (!dupe.isHidden) return { id: dupe.id, alreadyPublished: true as const };
        // If user previously unpublished, allow republish (consume quota again).
        if (dupe.hiddenReason !== "unpublished") {
          // Hidden by moderation/auto — do not let user re-expose it.
          return { blocked: true as const };
        }
        // Republish flow handled below after quota check
      }

      // Atomic quota increment: only if used < limit. Returns the row if increment applied.
      const incremented = await tx.execute(sql`
        INSERT INTO user_daily_quota (user_id, date_utc, posts_published)
        VALUES (${userId}, ${date}, 1)
        ON CONFLICT (user_id, date_utc) DO UPDATE
          SET posts_published = user_daily_quota.posts_published + 1
          WHERE user_daily_quota.posts_published < ${limit}
        RETURNING posts_published
      `);
      const rows = (incremented as unknown as { rows?: Array<{ posts_published: number }> }).rows
        ?? (incremented as unknown as Array<{ posts_published: number }>);
      const usedAfter = Array.isArray(rows) && rows[0]?.posts_published;
      if (!usedAfter) {
        // No row returned → quota was already at limit
        return { quotaExceeded: true as const };
      }

      if (dupe) {
        // Republish: restore visibility, refresh content + timestamp
        await tx.update(publicPostsTable).set({
          isHidden: false,
          hiddenReason: null,
          contentJson: JSON.stringify(body.content),
          lang: body.lang === "en" ? "en" : "pt",
          publishedAt: now,
          isSpecial: body.isSpecial ?? null,
        }).where(eq(publicPostsTable.id, dupe.id));
        await tx.update(publicProfilesTable).set({ lastActivityAt: now }).where(eq(publicProfilesTable.careerId, body.careerId));
        return { id: dupe.id, publishedAt: now, used: usedAfter };
      }

      await tx.insert(publicPostsTable).values({
        id, careerId: body.careerId, userId,
        originalNewsPostId: body.originalNewsPostId,
        contentJson: JSON.stringify(body.content),
        lang: body.lang === "en" ? "en" : "pt",
        publishedAt: now,
        isSpecial: body.isSpecial ?? null,
      });
      await tx.update(publicProfilesTable).set({ lastActivityAt: now }).where(eq(publicProfilesTable.careerId, body.careerId));
      return { id, publishedAt: now, used: usedAfter };
    });

    if ("blocked" in result) {
      return res.status(403).json({ error: "Esta notícia foi removida pela moderação", code: "MODERATION" });
    }
    if ("quotaExceeded" in result) {
      return res.status(429).json({ error: `Cota diária atingida (${limit}/${limit})`, code: "QUOTA", limit, used: limit });
    }
    if ("alreadyPublished" in result) return res.json(result);
    res.status(201).json({ id: result.id, publishedAt: result.publishedAt });
  } catch (err) {
    console.error("POST /community/posts", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/community/posts/:id", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const [post] = await db.select().from(publicPostsTable).where(eq(publicPostsTable.id, id)).limit(1);
  if (!post) return res.status(404).json({ error: "Not found" });
  if (post.userId !== userId) return res.status(403).json({ error: "Forbidden" });
  // Soft-delete: hide post but preserve engagement (comments/reactions/reposts)
  await db.update(publicPostsTable).set({ isHidden: true, hiddenReason: "unpublished" }).where(eq(publicPostsTable.id, id));
  res.json({ ok: true });
});

// Lookup whether a news post is already published in the community
router.get("/community/posts/lookup", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const careerId = String(req.query.careerId ?? "");
  const originalNewsPostId = String(req.query.originalNewsPostId ?? "");
  if (!careerId || !originalNewsPostId) return res.status(400).json({ error: "careerId, originalNewsPostId required" });
  if (!(await ownsCareer(userId, careerId))) return res.status(403).json({ error: "Forbidden" });
  const [row] = await db.select({ id: publicPostsTable.id, isHidden: publicPostsTable.isHidden, hiddenReason: publicPostsTable.hiddenReason })
    .from(publicPostsTable)
    .where(and(eq(publicPostsTable.careerId, careerId), eq(publicPostsTable.originalNewsPostId, originalNewsPostId)))
    .limit(1);
  if (!row || row.isHidden) return res.json({ id: null });
  res.json({ id: row.id });
});

// ─── Feed ──────────────────────────────────────────────────────────────────
async function enrichPosts(rows: Array<{ id: string; careerId: string; userId: number; contentJson: string; lang: string; publishedAt: number | bigint; isSpecial: string | null; isHidden: boolean }>, viewerId: number | null) {
  if (rows.length === 0) return [];
  const careerIds = [...new Set(rows.map((r) => r.careerId))];
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const postIds = rows.map((r) => r.id);

  const [careers, users, reactions, comments, reposts, viewerReactions, viewerReposts] = await Promise.all([
    db.select({
      id: careersTable.id, clubName: careersTable.clubName, clubLogo: careersTable.clubLogo,
      coachJson: careersTable.coachJson, clubId: careersTable.clubId, clubLeague: careersTable.clubLeague,
      clubPrimary: careersTable.clubPrimary, clubSecondary: careersTable.clubSecondary,
    }).from(careersTable).where(inArray(careersTable.id, careerIds)),
    db.select({ id: usersTable.id, username: usersTable.username, plan: usersTable.plan }).from(usersTable).where(inArray(usersTable.id, userIds)),
    db.select({ postId: postReactionsTable.postId, reactionType: postReactionsTable.reactionType, c: sql<number>`count(*)::int` })
      .from(postReactionsTable).where(inArray(postReactionsTable.postId, postIds)).groupBy(postReactionsTable.postId, postReactionsTable.reactionType),
    db.select({ postId: postCommentsTable.postId, c: sql<number>`count(*)::int` })
      .from(postCommentsTable).where(and(inArray(postCommentsTable.postId, postIds), eq(postCommentsTable.isHidden, false), sql`${postCommentsTable.deletedAt} IS NULL`))
      .groupBy(postCommentsTable.postId),
    db.select({ postId: postRepostsTable.postId, c: sql<number>`count(*)::int` })
      .from(postRepostsTable).where(inArray(postRepostsTable.postId, postIds)).groupBy(postRepostsTable.postId),
    viewerId ? db.select({ postId: postReactionsTable.postId, reactionType: postReactionsTable.reactionType })
      .from(postReactionsTable).where(and(inArray(postReactionsTable.postId, postIds), eq(postReactionsTable.userId, viewerId))) : Promise.resolve([]),
    viewerId ? db.select({ postId: postRepostsTable.postId })
      .from(postRepostsTable).where(and(inArray(postRepostsTable.postId, postIds), eq(postRepostsTable.userId, viewerId))) : Promise.resolve([]),
  ]);

  const careerMap = new Map(careers.map((c) => [c.id, c]));
  const userMap = new Map(users.map((u) => [u.id, u]));
  const reactionMap = new Map<string, Record<string, number>>();
  for (const r of reactions) {
    const m = reactionMap.get(r.postId) ?? {};
    m[r.reactionType] = Number(r.c);
    reactionMap.set(r.postId, m);
  }
  const commentCountMap = new Map(comments.map((c) => [c.postId, Number(c.c)]));
  const repostCountMap = new Map(reposts.map((r) => [r.postId, Number(r.c)]));
  const viewerReactionMap = new Map<string, string[]>();
  for (const r of viewerReactions as Array<{ postId: string; reactionType: string }>) {
    const arr = viewerReactionMap.get(r.postId) ?? [];
    arr.push(r.reactionType);
    viewerReactionMap.set(r.postId, arr);
  }
  const viewerRepostSet = new Set((viewerReposts as Array<{ postId: string }>).map((r) => r.postId));

  return rows.map((r) => {
    const career = careerMap.get(r.careerId);
    const user = userMap.get(r.userId);
    const coach = career?.coachJson ? (JSON.parse(career.coachJson) as { name?: string }) : null;
    let content: unknown = {};
    try { content = JSON.parse(r.contentJson); } catch {}
    return {
      id: r.id,
      careerId: r.careerId,
      userId: r.userId,
      username: user?.username ?? null,
      plan: user?.plan ?? "free",
      coachName: coach?.name ?? "",
      clubName: career?.clubName ?? "",
      clubLogo: career?.clubLogo ?? "",
      clubId: career?.clubId ?? 0,
      clubLeague: career?.clubLeague ?? "",
      clubPrimary: career?.clubPrimary ?? null,
      clubSecondary: career?.clubSecondary ?? null,
      content,
      lang: r.lang,
      isSpecial: r.isSpecial,
      publishedAt: Number(r.publishedAt),
      reactions: reactionMap.get(r.id) ?? {},
      commentsCount: commentCountMap.get(r.id) ?? 0,
      repostsCount: repostCountMap.get(r.id) ?? 0,
      viewerReactions: viewerReactionMap.get(r.id) ?? [],
      viewerReposted: viewerRepostSet.has(r.id),
    };
  });
}

router.get("/community/feed", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
    const before = req.query.before ? Number(req.query.before) : null;
    const lang = req.query.lang === "pt" || req.query.lang === "en" ? String(req.query.lang) : null;
    const myClub = req.query.myClub === "1";
    const myLeague = req.query.myLeague === "1";

    const blocked = await getBlockedUserIds(userId);

    let myClubId: number | null = null;
    let myLeagueName: string | null = null;
    if (myClub || myLeague) {
      const [c] = await db.select({ clubId: careersTable.clubId, clubLeague: careersTable.clubLeague })
        .from(careersTable).where(eq(careersTable.userId, userId)).orderBy(desc(careersTable.updatedAt)).limit(1);
      myClubId = c?.clubId ?? null;
      myLeagueName = c?.clubLeague ?? null;
    }

    const conditions = [eq(publicPostsTable.isHidden, false), eq(publicProfilesTable.isPublic, true)];
    if (before) conditions.push(sql`${publicPostsTable.publishedAt} < ${before}`);
    if (lang) conditions.push(eq(publicPostsTable.lang, lang));
    if (blocked.length > 0) conditions.push(notInArray(publicPostsTable.userId, blocked));
    if (myClub && myClubId) conditions.push(eq(careersTable.clubId, myClubId));
    else if (myLeague && myLeagueName) conditions.push(eq(careersTable.clubLeague, myLeagueName));

    const query = db.select({
      id: publicPostsTable.id, careerId: publicPostsTable.careerId, userId: publicPostsTable.userId,
      contentJson: publicPostsTable.contentJson, lang: publicPostsTable.lang,
      publishedAt: publicPostsTable.publishedAt, isSpecial: publicPostsTable.isSpecial, isHidden: publicPostsTable.isHidden,
    }).from(publicPostsTable)
      .innerJoin(careersTable, eq(careersTable.id, publicPostsTable.careerId))
      .innerJoin(publicProfilesTable, eq(publicProfilesTable.careerId, publicPostsTable.careerId))
      .where(and(...conditions));

    const rows = await query.orderBy(desc(publicPostsTable.publishedAt)).limit(limit);
    const enriched = await enrichPosts(rows.map((r) => ({ ...r, publishedAt: Number(r.publishedAt) })), userId);
    res.json({ posts: enriched, nextCursor: rows.length === limit ? Number(rows[rows.length - 1].publishedAt) : null });
  } catch (err) {
    console.error("GET /community/feed", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── Discover ──────────────────────────────────────────────────────────────
router.get("/community/discover", requireAuth, async (req: AuthRequest, res) => {
  try {
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const myClub = req.query.myClub === "1";
    const myLeague = req.query.myLeague === "1";
    const userId = req.user!.id;

    const conditions = [eq(publicProfilesTable.isPublic, true)];

    if (myClub || myLeague) {
      const [c] = await db.select({ clubId: careersTable.clubId, clubLeague: careersTable.clubLeague })
        .from(careersTable).where(eq(careersTable.userId, userId)).orderBy(desc(careersTable.updatedAt)).limit(1);
      if (myClub && c?.clubId) conditions.push(eq(careersTable.clubId, c.clubId));
      if (myLeague && c?.clubLeague) conditions.push(eq(careersTable.clubLeague, c.clubLeague));
    }
    if (q) {
      conditions.push(or(
        sql`LOWER(${usersTable.username}) LIKE ${`%${q}%`}`,
        sql`LOWER(${careersTable.clubName}) LIKE ${`%${q}%`}`,
        sql`LOWER(${careersTable.clubLeague}) LIKE ${`%${q}%`}`,
        sql`LOWER(${careersTable.coachJson}) LIKE ${`%${q}%`}`,
      )!);
    }

    const rows = await db.select({
      careerId: publicProfilesTable.careerId,
      userId: publicProfilesTable.userId,
      username: usersTable.username,
      plan: usersTable.plan,
      bio: publicProfilesTable.bio,
      lastActivityAt: publicProfilesTable.lastActivityAt,
      clubName: careersTable.clubName,
      clubLogo: careersTable.clubLogo,
      clubLeague: careersTable.clubLeague,
      coachJson: careersTable.coachJson,
    })
      .from(publicProfilesTable)
      .innerJoin(careersTable, eq(careersTable.id, publicProfilesTable.careerId))
      .innerJoin(usersTable, eq(usersTable.id, publicProfilesTable.userId))
      .where(and(...conditions))
      .orderBy(desc(publicProfilesTable.lastActivityAt))
      .limit(60);

    res.json(rows.map((r) => ({
      careerId: r.careerId, userId: r.userId, username: r.username,
      plan: r.plan, bio: r.bio, clubName: r.clubName, clubLogo: r.clubLogo, clubLeague: r.clubLeague,
      coachName: r.coachJson ? (JSON.parse(r.coachJson) as { name?: string }).name ?? "" : "",
      lastActivityAt: r.lastActivityAt ? Number(r.lastActivityAt) : null,
    })));
  } catch (err) {
    console.error("GET /community/discover", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── Public profile (read-only) ────────────────────────────────────────────
router.get("/community/profiles/:username/:careerId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { username, careerId } = req.params;
    const u = username.replace(/^@/, "").toLowerCase();
    const [profile] = await db.select({
      careerId: publicProfilesTable.careerId,
      userId: publicProfilesTable.userId,
      isPublic: publicProfilesTable.isPublic,
      bio: publicProfilesTable.bio,
      favoriteClubId: publicProfilesTable.favoriteClubId,
      lastActivityAt: publicProfilesTable.lastActivityAt,
      publishedAt: publicProfilesTable.publishedAt,
      username: usersTable.username,
      plan: usersTable.plan,
      clubName: careersTable.clubName,
      clubLogo: careersTable.clubLogo,
      clubLeague: careersTable.clubLeague,
      clubId: careersTable.clubId,
      clubPrimary: careersTable.clubPrimary,
      clubSecondary: careersTable.clubSecondary,
      coachJson: careersTable.coachJson,
    })
      .from(publicProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, publicProfilesTable.userId))
      .innerJoin(careersTable, eq(careersTable.id, publicProfilesTable.careerId))
      .where(and(eq(publicProfilesTable.careerId, careerId), eq(usersTable.username, u)))
      .limit(1);

    if (!profile || !profile.isPublic) return res.status(404).json({ error: "Perfil não encontrado" });

    const blocked = await getBlockedUserIds(req.user!.id);
    if (blocked.includes(profile.userId)) return res.status(403).json({ error: "Bloqueado" });

    const postsRows = await db.select({
      id: publicPostsTable.id, careerId: publicPostsTable.careerId, userId: publicPostsTable.userId,
      contentJson: publicPostsTable.contentJson, lang: publicPostsTable.lang,
      publishedAt: publicPostsTable.publishedAt, isSpecial: publicPostsTable.isSpecial, isHidden: publicPostsTable.isHidden,
    }).from(publicPostsTable)
      .where(and(eq(publicPostsTable.careerId, careerId), eq(publicPostsTable.isHidden, false)))
      .orderBy(desc(publicPostsTable.publishedAt))
      .limit(50);

    const posts = await enrichPosts(postsRows.map((r) => ({ ...r, publishedAt: Number(r.publishedAt) })), req.user!.id);

    const [stats] = await db.select({
      totalPosts: sql<number>`count(*)::int`,
      totalLikes: sql<number>`coalesce((select count(*)::int from post_reactions pr inner join public_posts p on p.id = pr.post_id where p.career_id = ${careerId}), 0)`,
    }).from(publicPostsTable).where(eq(publicPostsTable.careerId, careerId));

    // sharedHistory: did viewer ever manage this club?
    let sharedHistory: { clubName: string; season: string } | null = null;
    if (profile.clubId) {
      const [shared] = await db.select({ clubName: careersTable.clubName, season: careersTable.season })
        .from(careersTable)
        .where(and(eq(careersTable.userId, req.user!.id), eq(careersTable.clubId, profile.clubId), ne(careersTable.id, careerId)))
        .limit(1);
      if (shared) sharedHistory = { clubName: shared.clubName, season: shared.season };
    }

    const coach = profile.coachJson ? (JSON.parse(profile.coachJson) as { name?: string }) : null;
    const isLive = profile.lastActivityAt ? Date.now() - Number(profile.lastActivityAt) < 24 * 3600 * 1000 : false;

    res.json({
      careerId: profile.careerId,
      userId: profile.userId,
      username: profile.username,
      plan: profile.plan,
      verified: profile.plan === "pro" || profile.plan === "ultra",
      bio: profile.bio,
      favoriteClubId: profile.favoriteClubId,
      coachName: coach?.name ?? "",
      clubName: profile.clubName, clubLogo: profile.clubLogo,
      clubLeague: profile.clubLeague, clubId: profile.clubId,
      clubPrimary: profile.clubPrimary, clubSecondary: profile.clubSecondary,
      isLive,
      stats: { totalPosts: Number(stats?.totalPosts ?? 0), totalLikes: Number(stats?.totalLikes ?? 0) },
      sharedHistory,
      posts,
      publishedAt: profile.publishedAt ? Number(profile.publishedAt) : null,
    });
  } catch (err) {
    console.error("GET /community/profiles", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── Top week ──────────────────────────────────────────────────────────────
router.get("/community/top-week", requireAuth, async (req: AuthRequest, res) => {
  try {
    const since = Date.now() - 7 * 24 * 3600 * 1000;
    const blocked = await getBlockedUserIds(req.user!.id);
    const conds = [eq(publicPostsTable.isHidden, false), eq(publicProfilesTable.isPublic, true), gte(publicPostsTable.publishedAt, since)];
    if (blocked.length > 0) conds.push(notInArray(publicPostsTable.userId, blocked));

    const rows = await db.select({
      id: publicPostsTable.id, careerId: publicPostsTable.careerId, userId: publicPostsTable.userId,
      contentJson: publicPostsTable.contentJson, lang: publicPostsTable.lang,
      publishedAt: publicPostsTable.publishedAt, isSpecial: publicPostsTable.isSpecial, isHidden: publicPostsTable.isHidden,
      reactionCount: sql<number>`(select count(*)::int from post_reactions pr where pr.post_id = ${publicPostsTable.id})`,
    }).from(publicPostsTable)
      .innerJoin(publicProfilesTable, eq(publicProfilesTable.careerId, publicPostsTable.careerId))
      .where(and(...conds))
      .orderBy(desc(sql`(select count(*) from post_reactions pr where pr.post_id = ${publicPostsTable.id})`))
      .limit(5);

    const enriched = await enrichPosts(rows.map((r) => ({ ...r, publishedAt: Number(r.publishedAt) })), req.user!.id);
    res.json(enriched);
  } catch (err) {
    console.error("GET /community/top-week", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── Reactions ─────────────────────────────────────────────────────────────
router.post("/community/posts/:id/reactions", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const t = String((req.body as { type?: string })?.type ?? "like");
  if (!VALID_REACTIONS.has(t)) return res.status(400).json({ error: "Reação inválida" });
  const post = await getVisiblePost(id);
  if (!post) return res.status(404).json({ error: "Not found" });
  if (await isBlockedBetween(userId, post.userId)) return res.status(403).json({ error: "Blocked", code: "BLOCKED" });
  await db.insert(postReactionsTable).values({ postId: id, userId, reactionType: t, createdAt: Date.now() }).onConflictDoNothing();
  await db.update(publicProfilesTable).set({ lastActivityAt: Date.now() }).where(eq(publicProfilesTable.careerId, post.careerId));
  res.json({ ok: true });
});

router.delete("/community/posts/:id/reactions", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const t = String((req.query.type ?? "like"));
  await db.delete(postReactionsTable).where(and(eq(postReactionsTable.postId, id), eq(postReactionsTable.userId, userId), eq(postReactionsTable.reactionType, t)));
  res.json({ ok: true });
});

// ─── Comments ──────────────────────────────────────────────────────────────
router.get("/community/posts/:id/comments", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const visible = await getVisiblePost(id);
  if (!visible) return res.status(404).json({ error: "Not found" });
  const blocked = await getBlockedUserIds(userId);
  const conds = [eq(postCommentsTable.postId, id), eq(postCommentsTable.isHidden, false), sql`${postCommentsTable.deletedAt} IS NULL`];
  if (blocked.length > 0) conds.push(notInArray(postCommentsTable.userId, blocked));

  const rows = await db.select({
    id: postCommentsTable.id, postId: postCommentsTable.postId, userId: postCommentsTable.userId,
    parentCommentId: postCommentsTable.parentCommentId, content: postCommentsTable.content,
    isPinned: postCommentsTable.isPinned, createdAt: postCommentsTable.createdAt,
    username: usersTable.username, plan: usersTable.plan,
  }).from(postCommentsTable)
    .innerJoin(usersTable, eq(usersTable.id, postCommentsTable.userId))
    .where(and(...conds))
    .orderBy(desc(postCommentsTable.isPinned), postCommentsTable.createdAt);

  // Get user's careers for clubName/coachName per comment
  const uids = [...new Set(rows.map((r) => r.userId))];
  const careersByUser = uids.length === 0 ? [] : await db.select({
    userId: careersTable.userId, clubName: careersTable.clubName, clubLogo: careersTable.clubLogo, coachJson: careersTable.coachJson, updatedAt: careersTable.updatedAt,
  }).from(careersTable).where(inArray(careersTable.userId, uids as number[])).orderBy(desc(careersTable.updatedAt));
  const carMap = new Map<number, typeof careersByUser[number]>();
  for (const c of careersByUser) if (c.userId !== null && !carMap.has(c.userId)) carMap.set(c.userId, c);

  res.json(rows.map((r) => {
    const car = carMap.get(r.userId);
    const coach = car?.coachJson ? (JSON.parse(car.coachJson) as { name?: string }) : null;
    return {
      id: r.id, postId: r.postId, userId: r.userId, parentCommentId: r.parentCommentId,
      content: r.content, isPinned: r.isPinned, createdAt: Number(r.createdAt),
      username: r.username, plan: r.plan,
      clubName: car?.clubName ?? "", clubLogo: car?.clubLogo ?? "",
      coachName: coach?.name ?? "",
    };
  }));
});

router.post("/community/posts/:id/comments", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const body = req.body as { content?: string; parentCommentId?: number };
  const content = (body?.content ?? "").trim().slice(0, MAX_COMMENT);
  if (!content) return res.status(400).json({ error: "content required" });

  const username = await getUsername(userId);
  if (!username) return res.status(400).json({ error: "Defina seu @username", code: "NO_USERNAME" });

  const post = await getVisiblePost(id);
  if (!post) return res.status(404).json({ error: "Not found" });
  if (await isBlockedBetween(userId, post.userId)) return res.status(403).json({ error: "Blocked", code: "BLOCKED" });

  let parent: number | null = null;
  if (body.parentCommentId) {
    const [p] = await db.select({ id: postCommentsTable.id, parentCommentId: postCommentsTable.parentCommentId }).from(postCommentsTable).where(eq(postCommentsTable.id, body.parentCommentId)).limit(1);
    if (p && p.parentCommentId === null) parent = p.id;
  }

  const now = Date.now();
  const [inserted] = await db.insert(postCommentsTable).values({
    postId: id, userId, parentCommentId: parent, content, createdAt: now,
  }).returning({ id: postCommentsTable.id });
  await db.update(publicProfilesTable).set({ lastActivityAt: now }).where(eq(publicProfilesTable.careerId, post.careerId));
  res.status(201).json({ id: inserted.id, createdAt: now });
});

router.put("/community/comments/:id", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const cid = Number(req.params.id);
  const body = req.body as { isPinned?: boolean; isHidden?: boolean };
  const [c] = await db.select({ id: postCommentsTable.id, postId: postCommentsTable.postId, userId: postCommentsTable.userId }).from(postCommentsTable).where(eq(postCommentsTable.id, cid)).limit(1);
  if (!c) return res.status(404).json({ error: "Not found" });
  const [post] = await db.select({ careerId: publicPostsTable.careerId, userId: publicPostsTable.userId }).from(publicPostsTable).where(eq(publicPostsTable.id, c.postId)).limit(1);
  if (!post) return res.status(404).json({ error: "Not found" });

  const isOwner = post.userId === userId;
  if (!isOwner) return res.status(403).json({ error: "Apenas o dono do post pode fixar/ocultar comentários" });

  const patch: Record<string, unknown> = {};
  if (body.isPinned !== undefined) {
    if (body.isPinned) {
      await db.update(postCommentsTable).set({ isPinned: false }).where(eq(postCommentsTable.postId, c.postId));
    }
    patch.isPinned = body.isPinned;
  }
  if (body.isHidden !== undefined) patch.isHidden = body.isHidden;
  if (Object.keys(patch).length > 0) await db.update(postCommentsTable).set(patch).where(eq(postCommentsTable.id, cid));
  res.json({ ok: true });
});

router.delete("/community/comments/:id", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const cid = Number(req.params.id);
  const [c] = await db.select({ id: postCommentsTable.id, userId: postCommentsTable.userId, postId: postCommentsTable.postId }).from(postCommentsTable).where(eq(postCommentsTable.id, cid)).limit(1);
  if (!c) return res.status(404).json({ error: "Not found" });
  if (c.userId !== userId) {
    const [post] = await db.select({ userId: publicPostsTable.userId }).from(publicPostsTable).where(eq(publicPostsTable.id, c.postId)).limit(1);
    if (post?.userId !== userId) return res.status(403).json({ error: "Forbidden" });
  }
  await db.update(postCommentsTable).set({ deletedAt: Date.now() }).where(eq(postCommentsTable.id, cid));
  res.json({ ok: true });
});

// ─── Reposts ───────────────────────────────────────────────────────────────
router.post("/community/posts/:id/repost", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const post = await getVisiblePost(id);
  if (!post) return res.status(404).json({ error: "Not found" });
  if (await isBlockedBetween(userId, post.userId)) return res.status(403).json({ error: "Blocked", code: "BLOCKED" });
  await db.insert(postRepostsTable).values({ postId: id, userId, createdAt: Date.now() }).onConflictDoNothing();
  await db.update(publicProfilesTable).set({ lastActivityAt: Date.now() }).where(eq(publicProfilesTable.careerId, post.careerId));
  res.status(201).json({ ok: true });
});

router.delete("/community/posts/:id/repost", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  await db.delete(postRepostsTable).where(and(eq(postRepostsTable.postId, id), eq(postRepostsTable.userId, userId)));
  res.json({ ok: true });
});

// ─── Blocks ────────────────────────────────────────────────────────────────
router.post("/community/blocks", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const target = Number((req.body as { userId?: number })?.userId);
  if (!target || target === userId) return res.status(400).json({ error: "Invalid" });
  await db.insert(userBlocksTable).values({ blockerId: userId, blockedId: target, createdAt: Date.now() }).onConflictDoNothing();
  res.json({ ok: true });
});

router.delete("/community/blocks/:userId", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const target = Number(req.params.userId);
  await db.delete(userBlocksTable).where(and(eq(userBlocksTable.blockerId, userId), eq(userBlocksTable.blockedId, target)));
  res.json({ ok: true });
});

router.get("/community/blocks", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const rows = await db.select({
    blockedId: userBlocksTable.blockedId, createdAt: userBlocksTable.createdAt,
    username: usersTable.username, name: usersTable.name,
  }).from(userBlocksTable).innerJoin(usersTable, eq(usersTable.id, userBlocksTable.blockedId))
    .where(eq(userBlocksTable.blockerId, userId));
  res.json(rows.map((r) => ({ userId: r.blockedId, username: r.username, name: r.name, createdAt: Number(r.createdAt) })));
});

// ─── Reports ───────────────────────────────────────────────────────────────
router.post("/community/reports", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const body = req.body as { targetType?: string; targetId?: string; reason?: string; notes?: string };
  if (!body?.targetType || !body?.targetId || !body?.reason) return res.status(400).json({ error: "targetType, targetId, reason required" });
  if (!["post", "comment", "profile"].includes(body.targetType)) return res.status(400).json({ error: "Invalid target type" });

  // Verify target is publicly visible — cannot report private/hidden content
  if (body.targetType === "post") {
    if (!(await getVisiblePost(body.targetId))) return res.status(404).json({ error: "Not found" });
  } else if (body.targetType === "comment") {
    const cid = Number(body.targetId);
    const [c] = await db.select({ postId: postCommentsTable.postId, isHidden: postCommentsTable.isHidden, deletedAt: postCommentsTable.deletedAt })
      .from(postCommentsTable).where(eq(postCommentsTable.id, cid)).limit(1);
    if (!c || c.isHidden || c.deletedAt) return res.status(404).json({ error: "Not found" });
    if (!(await getVisiblePost(c.postId))) return res.status(404).json({ error: "Not found" });
  } else {
    const [p] = await db.select({ isPublic: publicProfilesTable.isPublic }).from(publicProfilesTable).where(eq(publicProfilesTable.careerId, body.targetId)).limit(1);
    if (!p?.isPublic) return res.status(404).json({ error: "Not found" });
  }

  // Dedupe: one report per (reporter, target) pair — counts only first
  const [existing] = await db.select({ id: contentReportsTable.id }).from(contentReportsTable)
    .where(and(
      eq(contentReportsTable.reporterId, userId),
      eq(contentReportsTable.targetType, body.targetType),
      eq(contentReportsTable.targetId, body.targetId),
    )).limit(1);
  if (existing) return res.status(200).json({ ok: true, alreadyReported: true });

  await db.insert(contentReportsTable).values({
    targetType: body.targetType, targetId: body.targetId, reporterId: userId,
    reason: body.reason, notes: body.notes ?? null, createdAt: Date.now(),
  });

  // Auto-hide threshold
  if (body.targetType === "post") {
    await db.update(publicPostsTable)
      .set({ reportsCount: sql`${publicPostsTable.reportsCount} + 1` })
      .where(eq(publicPostsTable.id, body.targetId));
    const [p] = await db.select({ reportsCount: publicPostsTable.reportsCount }).from(publicPostsTable).where(eq(publicPostsTable.id, body.targetId)).limit(1);
    if (p && p.reportsCount >= REPORT_AUTOHIDE_THRESHOLD) {
      await db.update(publicPostsTable).set({ isHidden: true, hiddenReason: "auto" }).where(eq(publicPostsTable.id, body.targetId));
    }
  } else if (body.targetType === "comment") {
    await db.update(postCommentsTable)
      .set({ reportsCount: sql`${postCommentsTable.reportsCount} + 1` })
      .where(eq(postCommentsTable.id, Number(body.targetId)));
    const [c] = await db.select({ reportsCount: postCommentsTable.reportsCount }).from(postCommentsTable).where(eq(postCommentsTable.id, Number(body.targetId))).limit(1);
    if (c && c.reportsCount >= REPORT_AUTOHIDE_THRESHOLD) {
      await db.update(postCommentsTable).set({ isHidden: true }).where(eq(postCommentsTable.id, Number(body.targetId)));
    }
  }

  res.status(201).json({ ok: true });
});

// ─── Activity / Notifications ──────────────────────────────────────────────
router.get("/community/activity", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const since = Date.now() - 14 * 24 * 3600 * 1000;
  // posts owned by user
  const myPosts = await db.select({ id: publicPostsTable.id }).from(publicPostsTable).where(eq(publicPostsTable.userId, userId));
  const postIds = myPosts.map((p) => p.id);
  if (postIds.length === 0) return res.json([]);

  const [reactions, comments, reposts] = await Promise.all([
    db.select({
      type: sql<string>`'reaction'`, postId: postReactionsTable.postId, userId: postReactionsTable.userId,
      reactionType: postReactionsTable.reactionType, createdAt: postReactionsTable.createdAt,
      username: usersTable.username,
    }).from(postReactionsTable).innerJoin(usersTable, eq(usersTable.id, postReactionsTable.userId))
      .where(and(inArray(postReactionsTable.postId, postIds), gte(postReactionsTable.createdAt, since), ne(postReactionsTable.userId, userId)))
      .orderBy(desc(postReactionsTable.createdAt)).limit(40),
    db.select({
      type: sql<string>`'comment'`, postId: postCommentsTable.postId, userId: postCommentsTable.userId,
      content: postCommentsTable.content, createdAt: postCommentsTable.createdAt, commentId: postCommentsTable.id,
      username: usersTable.username,
    }).from(postCommentsTable).innerJoin(usersTable, eq(usersTable.id, postCommentsTable.userId))
      .where(and(inArray(postCommentsTable.postId, postIds), gte(postCommentsTable.createdAt, since), ne(postCommentsTable.userId, userId), sql`${postCommentsTable.deletedAt} IS NULL`))
      .orderBy(desc(postCommentsTable.createdAt)).limit(40),
    db.select({
      type: sql<string>`'repost'`, postId: postRepostsTable.postId, userId: postRepostsTable.userId,
      createdAt: postRepostsTable.createdAt, username: usersTable.username,
    }).from(postRepostsTable).innerJoin(usersTable, eq(usersTable.id, postRepostsTable.userId))
      .where(and(inArray(postRepostsTable.postId, postIds), gte(postRepostsTable.createdAt, since), ne(postRepostsTable.userId, userId)))
      .orderBy(desc(postRepostsTable.createdAt)).limit(40),
  ]);

  type Item = { type: string; postId: string; userId: number; username: string | null; createdAt: number; reactionType?: string; content?: string; commentId?: number };
  const items: Item[] = [
    ...reactions.map((r) => ({ type: "reaction", postId: r.postId, userId: r.userId, username: r.username, reactionType: r.reactionType, createdAt: Number(r.createdAt) })),
    ...comments.map((c) => ({ type: "comment", postId: c.postId, userId: c.userId, username: c.username, content: c.content, commentId: c.commentId, createdAt: Number(c.createdAt) })),
    ...reposts.map((r) => ({ type: "repost", postId: r.postId, userId: r.userId, username: r.username, createdAt: Number(r.createdAt) })),
  ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 60);

  res.json(items);
});

router.get("/community/notifications/summary", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const [seen] = await db.select().from(communityLastSeenTable).where(eq(communityLastSeenTable.userId, userId)).limit(1);
  const lastSeenAt = seen ? Number(seen.lastSeenAt) : 0;

  const myPosts = await db.select({ id: publicPostsTable.id }).from(publicPostsTable).where(eq(publicPostsTable.userId, userId));
  const postIds = myPosts.map((p) => p.id);
  if (postIds.length === 0) return res.json({ count: 0, lastSeenAt });

  const [reactionsCount] = await db.select({ c: sql<number>`count(*)::int` }).from(postReactionsTable)
    .where(and(inArray(postReactionsTable.postId, postIds), gt(postReactionsTable.createdAt, lastSeenAt), ne(postReactionsTable.userId, userId)));
  const [commentsCount] = await db.select({ c: sql<number>`count(*)::int` }).from(postCommentsTable)
    .where(and(inArray(postCommentsTable.postId, postIds), gt(postCommentsTable.createdAt, lastSeenAt), ne(postCommentsTable.userId, userId)));
  const [repostsCount] = await db.select({ c: sql<number>`count(*)::int` }).from(postRepostsTable)
    .where(and(inArray(postRepostsTable.postId, postIds), gt(postRepostsTable.createdAt, lastSeenAt), ne(postRepostsTable.userId, userId)));

  const total = Number(reactionsCount?.c ?? 0) + Number(commentsCount?.c ?? 0) + Number(repostsCount?.c ?? 0);
  res.json({ count: total, lastSeenAt });
});

router.post("/community/notifications/seen", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const now = Date.now();
  await db.insert(communityLastSeenTable).values({ userId, lastSeenAt: now })
    .onConflictDoUpdate({ target: communityLastSeenTable.userId, set: { lastSeenAt: now } });
  res.json({ ok: true });
});

// ─── Home preview (also accessible to demo) ────────────────────────────────
router.get("/community/preview", async (_req, res) => {
  try {
    const rows = await db.select({
      id: publicPostsTable.id, careerId: publicPostsTable.careerId, userId: publicPostsTable.userId,
      contentJson: publicPostsTable.contentJson, lang: publicPostsTable.lang,
      publishedAt: publicPostsTable.publishedAt, isSpecial: publicPostsTable.isSpecial, isHidden: publicPostsTable.isHidden,
    }).from(publicPostsTable)
      .innerJoin(publicProfilesTable, eq(publicProfilesTable.careerId, publicPostsTable.careerId))
      .where(and(eq(publicPostsTable.isHidden, false), eq(publicProfilesTable.isPublic, true)))
      .orderBy(desc(publicPostsTable.publishedAt)).limit(10);
    const enriched = await enrichPosts(rows.map((r) => ({ ...r, publishedAt: Number(r.publishedAt) })), null);
    res.json(enriched);
  } catch (err) {
    console.error("GET /community/preview", err);
    res.json([]);
  }
});

export default router;
