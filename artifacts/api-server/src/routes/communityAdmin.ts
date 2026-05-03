import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { db, contentReportsTable, publicPostsTable, postCommentsTable, publicProfilesTable, usersTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";

const router = Router();

const ADMIN_JWT_SECRET = () => {
  const s = process.env.ADMIN_SECRET;
  if (!s) throw new Error("ADMIN_SECRET not set");
  return `admin-${s}`;
};

function requireAdmin(req: Request, res: Response): boolean {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) { res.status(401).json({ error: "Admin token required" }); return false; }
  try {
    const p = jwt.verify(h.slice(7), ADMIN_JWT_SECRET()) as { role?: string };
    if (p.role !== "admin") throw new Error("not admin");
    return true;
  } catch {
    res.status(401).json({ error: "Invalid admin token" }); return false;
  }
}

router.get("/admin-panel/community/reports", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const status = String(req.query.status ?? "pending");
  const rows = await db.select({
    id: contentReportsTable.id,
    targetType: contentReportsTable.targetType,
    targetId: contentReportsTable.targetId,
    reporterId: contentReportsTable.reporterId,
    reason: contentReportsTable.reason,
    notes: contentReportsTable.notes,
    status: contentReportsTable.status,
    createdAt: contentReportsTable.createdAt,
    reporterUsername: usersTable.username,
    reporterEmail: usersTable.email,
  }).from(contentReportsTable)
    .leftJoin(usersTable, eq(usersTable.id, contentReportsTable.reporterId))
    .where(eq(contentReportsTable.status, status))
    .orderBy(desc(contentReportsTable.createdAt))
    .limit(200);

  // Hydrate target preview
  const out = await Promise.all(rows.map(async (r) => {
    let preview: Record<string, unknown> | null = null;
    if (r.targetType === "post") {
      const [p] = await db.select({ id: publicPostsTable.id, contentJson: publicPostsTable.contentJson, isHidden: publicPostsTable.isHidden, careerId: publicPostsTable.careerId, userId: publicPostsTable.userId }).from(publicPostsTable).where(eq(publicPostsTable.id, r.targetId)).limit(1);
      if (p) { let content: unknown = {}; try { content = JSON.parse(p.contentJson); } catch {} preview = { type: "post", id: p.id, isHidden: p.isHidden, careerId: p.careerId, userId: p.userId, content }; }
    } else if (r.targetType === "comment") {
      const [c] = await db.select().from(postCommentsTable).where(eq(postCommentsTable.id, Number(r.targetId))).limit(1);
      if (c) preview = { type: "comment", id: c.id, content: c.content, isHidden: c.isHidden, postId: c.postId, userId: c.userId };
    } else if (r.targetType === "profile") {
      const [pr] = await db.select().from(publicProfilesTable).where(eq(publicProfilesTable.careerId, r.targetId)).limit(1);
      if (pr) preview = { type: "profile", careerId: pr.careerId, userId: pr.userId, isPublic: pr.isPublic, bio: pr.bio };
    }
    return {
      id: r.id, targetType: r.targetType, targetId: r.targetId,
      reporterId: r.reporterId, reporterUsername: r.reporterUsername, reporterEmail: r.reporterEmail,
      reason: r.reason, notes: r.notes, status: r.status, createdAt: Number(r.createdAt),
      preview,
    };
  }));
  res.json(out);
});

router.post("/admin-panel/community/reports/:id/action", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.params.id);
  const { action } = req.body as { action?: "approve" | "reject" };
  const [r] = await db.select().from(contentReportsTable).where(eq(contentReportsTable.id, id)).limit(1);
  if (!r) return res.status(404).json({ error: "Not found" });

  if (action === "approve") {
    if (r.targetType === "post") {
      await db.update(publicPostsTable).set({ isHidden: true, hiddenReason: "moderation" }).where(eq(publicPostsTable.id, r.targetId));
    } else if (r.targetType === "comment") {
      await db.update(postCommentsTable).set({ isHidden: true }).where(eq(postCommentsTable.id, Number(r.targetId)));
    } else if (r.targetType === "profile") {
      await db.update(publicProfilesTable).set({ isPublic: false }).where(eq(publicProfilesTable.careerId, r.targetId));
    }
    await db.update(contentReportsTable).set({ status: "approved", reviewedAt: Date.now() }).where(eq(contentReportsTable.id, id));
  } else {
    // reject — only clear auto-moderation hides; never override owner-unpublish
    // or admin "moderation" hide states.
    if (r.targetType === "post") {
      await db.update(publicPostsTable)
        .set({ isHidden: false, hiddenReason: null, reportsCount: 0 })
        .where(and(eq(publicPostsTable.id, r.targetId), eq(publicPostsTable.hiddenReason, "auto")));
      // Always reset reports counter even when not unhiding
      await db.update(publicPostsTable)
        .set({ reportsCount: 0 })
        .where(eq(publicPostsTable.id, r.targetId));
    } else if (r.targetType === "comment") {
      // Comments don't currently track a hiddenReason; conservatively keep
      // any existing hidden state and only reset the counter.
      await db.update(postCommentsTable)
        .set({ reportsCount: 0 })
        .where(eq(postCommentsTable.id, Number(r.targetId)));
    }
    await db.update(contentReportsTable).set({ status: "rejected", reviewedAt: Date.now() }).where(eq(contentReportsTable.id, id));
  }
  res.json({ ok: true });
});

router.get("/admin-panel/community/stats", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const [posts] = await db.select({ c: sql<number>`count(*)::int` }).from(publicPostsTable);
  const [hidden] = await db.select({ c: sql<number>`count(*)::int` }).from(publicPostsTable).where(eq(publicPostsTable.isHidden, true));
  const [profiles] = await db.select({ c: sql<number>`count(*)::int` }).from(publicProfilesTable).where(eq(publicProfilesTable.isPublic, true));
  const [pending] = await db.select({ c: sql<number>`count(*)::int` }).from(contentReportsTable).where(eq(contentReportsTable.status, "pending"));
  res.json({
    publicPosts: Number(posts?.c ?? 0),
    hiddenPosts: Number(hidden?.c ?? 0),
    publicProfiles: Number(profiles?.c ?? 0),
    pendingReports: Number(pending?.c ?? 0),
  });
});

export default router;
