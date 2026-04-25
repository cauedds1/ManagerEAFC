import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable, careersTable, seasonsTable, bugReportsTable, notificationsTable, notificationTargetsTable, notificationReadsTable } from "@workspace/db";
import { eq, sql, desc, count, sum } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import type { Request, Response } from "express";

const router = Router();

const ADMIN_SECRET = () => process.env.ADMIN_SECRET ?? "";
const ADMIN_JWT_SECRET = () => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("ADMIN_SECRET environment variable is not set");
  return `admin-${secret}`;
};

function signAdminToken(): string {
  return jwt.sign({ role: "admin" }, ADMIN_JWT_SECRET(), { expiresIn: "12h" });
}

function validateAdminToken(req: Request, res: Response): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de admin necessário" });
    return false;
  }
  try {
    const secret = ADMIN_JWT_SECRET();
    const payload = jwt.verify(header.slice(7), secret) as { role?: string };
    if (payload.role !== "admin") throw new Error("not admin");
    return true;
  } catch {
    res.status(401).json({ error: "Token de admin inválido ou expirado" });
    return false;
  }
}

// POST /api/admin-panel/auth
router.post("/admin-panel/auth", (req: Request, res: Response) => {
  const { secret } = req.body as { secret?: string };
  const adminSecret = ADMIN_SECRET();
  if (!adminSecret || secret !== adminSecret) {
    return res.status(401).json({ error: "Senha incorreta" });
  }
  return res.json({ token: signAdminToken() });
});

// GET /api/admin-panel/stats
router.get("/admin-panel/stats", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  try {
    const [userStats] = await db
      .select({
        total: count(usersTable.id),
        freeCount: sql<number>`count(*) filter (where plan = 'free')`,
        proCount: sql<number>`count(*) filter (where plan = 'pro')`,
        ultraCount: sql<number>`count(*) filter (where plan = 'ultra')`,
        totalAiUsage: sum(usersTable.aiUsageCount),
      })
      .from(usersTable);

    const [careerStats] = await db
      .select({ total: count(careersTable.id) })
      .from(careersTable);

    const [seasonStats] = await db
      .select({ total: count(seasonsTable.id) })
      .from(seasonsTable);

    const [bugStats] = await db
      .select({
        total: count(bugReportsTable.id),
        open: sql<number>`count(*) filter (where status = 'open')`,
      })
      .from(bugReportsTable);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayDateStr = todayStart.toISOString().slice(0, 10);

    const [todayAiStats] = await db
      .select({ todayUsage: sum(usersTable.aiUsageCount) })
      .from(usersTable)
      .where(sql`${usersTable.aiUsageResetDate} = ${todayDateStr}`);

    return res.json({
      users: {
        total: Number(userStats?.total ?? 0),
        free: Number(userStats?.freeCount ?? 0),
        pro: Number(userStats?.proCount ?? 0),
        ultra: Number(userStats?.ultraCount ?? 0),
      },
      careers: { total: Number(careerStats?.total ?? 0) },
      seasons: { total: Number(seasonStats?.total ?? 0) },
      aiUsage: {
        allTime: Number(userStats?.totalAiUsage ?? 0),
        today: Number(todayAiStats?.todayUsage ?? 0),
      },
      bugReports: {
        total: Number(bugStats?.total ?? 0),
        open: Number(bugStats?.open ?? 0),
      },
    });
  } catch (err) {
    console.error("GET /admin-panel/stats error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/admin-panel/analytics
router.get("/admin-panel/analytics", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  try {
    const [growthRows, topClubRows, planRows, matchRow, active7Row, active30Row] = await Promise.all([
      db.execute(sql`
        SELECT DATE(to_timestamp(created_at / 1000.0)) as date, COUNT(*) as count
        FROM users
        WHERE created_at >= (EXTRACT(EPOCH FROM NOW()) - 30*86400) * 1000
        GROUP BY date ORDER BY date
      `),
      db.execute(sql`
        SELECT club_name, COUNT(*) as count
        FROM careers
        GROUP BY club_name
        ORDER BY count DESC
        LIMIT 15
      `),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE plan = 'free') as free,
          COUNT(*) FILTER (WHERE plan = 'pro') as pro,
          COUNT(*) FILTER (WHERE plan = 'ultra') as ultra
        FROM users
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(jsonb_array_length(value_json::jsonb)), 0) as total
        FROM season_data
        WHERE key = 'matches'
      `),
      db.execute(sql`
        SELECT COUNT(*) as count FROM users
        WHERE last_login_at >= (EXTRACT(EPOCH FROM NOW()) - 7*86400) * 1000
      `),
      db.execute(sql`
        SELECT COUNT(*) as count FROM users
        WHERE last_login_at >= (EXTRACT(EPOCH FROM NOW()) - 30*86400) * 1000
      `),
    ]);

    const userGrowth = (growthRows.rows as Array<{ date: string; count: string }>).map((r) => ({
      date: r.date,
      count: Number(r.count),
    }));

    const topClubs = (topClubRows.rows as Array<{ club_name: string; count: string }>).map((r) => ({
      clubName: r.club_name,
      count: Number(r.count),
    }));

    const planRow = planRows.rows[0] as { free: string; pro: string; ultra: string } | undefined;
    const planDistribution = {
      free: Number(planRow?.free ?? 0),
      pro: Number(planRow?.pro ?? 0),
      ultra: Number(planRow?.ultra ?? 0),
    };

    const totalMatches = Number((matchRow.rows[0] as { total: string } | undefined)?.total ?? 0);
    const activeUsersLast7Days = Number((active7Row.rows[0] as { count: string } | undefined)?.count ?? 0);
    const activeUsersLast30Days = Number((active30Row.rows[0] as { count: string } | undefined)?.count ?? 0);

    return res.json({ userGrowth, topClubs, planDistribution, totalMatches, activeUsersLast7Days, activeUsersLast30Days });
  } catch (err) {
    console.error("GET /admin-panel/analytics error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/admin-panel/users?page=1&limit=20
router.get("/admin-panel/users", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  try {
    const page = Math.max(1, Number(req.query["page"] ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query["limit"] ?? 20)));
    const offset = (page - 1) * limit;

    const rows = await db.execute(sql`
      SELECT
        u.id, u.email, u.name, u.plan, u.ai_usage_count as "aiUsageCount",
        u.last_login_at as "lastLoginAt", u.created_at as "createdAt",
        COUNT(DISTINCT c.id) as "careerCount",
        COUNT(DISTINCT s.id) as "seasonCount",
        COALESCE(SUM(jsonb_array_length(sd.value_json::jsonb)), 0) as "matchCount",
        ARRAY_AGG(DISTINCT c.club_name) FILTER (WHERE c.club_name IS NOT NULL) as clubs
      FROM users u
      LEFT JOIN careers c ON c.user_id = u.id
      LEFT JOIN seasons s ON s.career_id = c.id
      LEFT JOIN season_data sd ON sd.season_id = s.id AND sd.key = 'matches'
      GROUP BY u.id, u.email, u.name, u.plan, u.ai_usage_count, u.last_login_at, u.created_at
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const users = rows.rows.map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      email: r.email,
      name: r.name,
      plan: r.plan,
      aiUsageCount: Number(r.aiUsageCount ?? 0),
      lastLoginAt: r.lastLoginAt != null ? Number(r.lastLoginAt) : null,
      createdAt: Number(r.createdAt),
      careerCount: Number(r.careerCount ?? 0),
      seasonCount: Number(r.seasonCount ?? 0),
      matchCount: Number(r.matchCount ?? 0),
      clubs: Array.isArray(r.clubs) ? (r.clubs as string[]).filter(Boolean) : [],
    }));

    const [{ total }] = await db.select({ total: count(usersTable.id) }).from(usersTable);

    return res.json({ users, total: Number(total), page, limit });
  } catch (err) {
    console.error("GET /admin-panel/users error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/admin-panel/users/:id
router.get("/admin-panel/users/:id", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  try {
    const userId = Number(req.params["id"]);
    if (!Number.isFinite(userId)) return res.status(400).json({ error: "ID inválido" });

    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        plan: usersTable.plan,
        aiUsageCount: usersTable.aiUsageCount,
        lastLoginAt: usersTable.lastLoginAt,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const careerRows = await db.execute(sql`
      SELECT
        c.id, c.club_name, c.club_id, c.season, c.created_at,
        COUNT(DISTINCT s.id) as season_count,
        COALESCE(SUM(jsonb_array_length(sd.value_json::jsonb)), 0) as match_count,
        MAX(CASE WHEN s.is_active THEN s.label END) as active_season_label
      FROM careers c
      LEFT JOIN seasons s ON s.career_id = c.id
      LEFT JOIN season_data sd ON sd.season_id = s.id AND sd.key = 'matches'
      WHERE c.user_id = ${userId}
      GROUP BY c.id, c.club_name, c.club_id, c.season, c.created_at
      ORDER BY c.created_at DESC
    `);

    const careers = careerRows.rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      clubName: r.club_name,
      clubId: r.club_id,
      season: r.season,
      createdAt: Number(r.created_at),
      seasonCount: Number(r.season_count ?? 0),
      matchCount: Number(r.match_count ?? 0),
      activeSeasonLabel: r.active_season_label ?? null,
    }));

    const bugReports = await db
      .select({
        id: bugReportsTable.id,
        description: bugReportsTable.description,
        page: bugReportsTable.page,
        status: bugReportsTable.status,
        createdAt: bugReportsTable.createdAt,
      })
      .from(bugReportsTable)
      .where(eq(bugReportsTable.userId, userId))
      .orderBy(desc(bugReportsTable.createdAt))
      .limit(20);

    return res.json({ user, careers, bugReports });
  } catch (err) {
    console.error("GET /admin-panel/users/:id error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/admin-panel/bug-reports?page=1&limit=20
router.get("/admin-panel/bug-reports", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  try {
    const page = Math.max(1, Number(req.query["page"] ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query["limit"] ?? 20)));
    const offset = (page - 1) * limit;

    const reports = await db
      .select()
      .from(bugReportsTable)
      .orderBy(desc(bugReportsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db.select({ total: count(bugReportsTable.id) }).from(bugReportsTable);

    return res.json({ reports, total: Number(total), page, limit });
  } catch (err) {
    console.error("GET /admin-panel/bug-reports error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// PATCH /api/admin-panel/bug-reports/:id
router.patch("/admin-panel/bug-reports/:id", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  try {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });

    const [report] = await db
      .select({ status: bugReportsTable.status })
      .from(bugReportsTable)
      .where(eq(bugReportsTable.id, id))
      .limit(1);

    if (!report) return res.status(404).json({ error: "Report não encontrado" });

    const newStatus = report.status === "open" ? "resolved" : "open";
    await db.update(bugReportsTable).set({ status: newStatus }).where(eq(bugReportsTable.id, id));

    return res.json({ id, status: newStatus });
  } catch (err) {
    console.error("PATCH /admin-panel/bug-reports/:id error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// PATCH /api/admin-panel/users/:id/plan
router.patch("/admin-panel/users/:id/plan", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  try {
    const userId = Number(req.params["id"]);
    if (!Number.isFinite(userId)) return res.status(400).json({ error: "ID inválido" });

    const { plan } = req.body as { plan?: string };
    if (!["free", "pro", "ultra"].includes(plan ?? "")) {
      return res.status(400).json({ error: "Plano inválido. Use: free, pro ou ultra" });
    }

    const [user] = await db
      .update(usersTable)
      .set({ plan: plan! })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, plan: usersTable.plan });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    return res.json({ id: user.id, plan: user.plan });
  } catch (err) {
    console.error("PATCH /admin-panel/users/:id/plan error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/admin-panel/impersonate/:userId
router.post("/admin-panel/impersonate/:userId", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  try {
    const userId = Number(req.params["userId"]);
    if (!Number.isFinite(userId)) return res.status(400).json({ error: "ID inválido" });

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, plan: usersTable.plan })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const JWT_SECRET = process.env.JWT_SECRET ?? "fc-career-dev-secret-change-in-production";
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, plan: user.plan ?? "free", impersonated: true },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  } catch (err) {
    console.error("POST /admin-panel/impersonate/:userId error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/admin-panel/recover-career — admin JWT authenticated proxy to recover-career logic
router.post("/admin-panel/recover-career", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  const adminSecret = ADMIN_SECRET();
  if (!adminSecret) {
    return res.status(503).json({ error: "ADMIN_SECRET não configurado no servidor" });
  }
  try {
    // Forward the request internally to /api/admin/recover-career with x-admin-secret header
    const baseUrl = `http://localhost:${process.env.PORT ?? 8080}`;
    const forwardRes = await fetch(`${baseUrl}/api/admin/recover-career`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify(req.body),
    });
    const body = await forwardRes.json();
    return res.status(forwardRes.status).json(body);
  } catch (err) {
    console.error("POST /admin-panel/recover-career proxy error:", err);
    return res.status(500).json({ error: "Erro interno ao encaminhar pedido de recuperação" });
  }
});

// ─── Admin: Notifications ────────────────────────────────────────────────────

// POST /api/admin-panel/notifications
router.post("/admin-panel/notifications", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  try {
    const { title, body, imageUrl, requiresResponse, targetAll, targetUserIds } = req.body as {
      title?: string;
      body?: string;
      imageUrl?: string;
      requiresResponse?: boolean;
      targetAll?: boolean;
      targetUserIds?: number[];
    };

    if (!title?.trim()) return res.status(400).json({ error: "Título obrigatório" });
    if (!body?.trim()) return res.status(400).json({ error: "Corpo obrigatório" });

    const isTargetAll = targetAll !== false;

    const [notif] = await db.insert(notificationsTable).values({
      title: title.trim().slice(0, 200),
      body: body.trim().slice(0, 2000),
      imageUrl: imageUrl?.trim() || null,
      requiresResponse: !!requiresResponse,
      targetAll: isTargetAll,
      createdAt: Date.now(),
    }).returning();

    if (!isTargetAll && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      const validIds = targetUserIds.filter((id) => Number.isFinite(id));
      if (validIds.length > 0) {
        await db.insert(notificationTargetsTable).values(
          validIds.map((userId) => ({ notificationId: notif.id, userId }))
        );
      }
    }

    return res.json({ ok: true, id: notif.id });
  } catch (err) {
    console.error("POST /admin-panel/notifications error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/admin-panel/notifications?page=1&limit=20
router.get("/admin-panel/notifications", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  try {
    const page = Math.max(1, Number(req.query["page"] ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query["limit"] ?? 20)));
    const offset = (page - 1) * limit;

    const rows = await db.execute(sql`
      SELECT
        n.id, n.title, n.body, n.image_url as "imageUrl",
        n.requires_response as "requiresResponse",
        n.target_all as "targetAll",
        n.created_at as "createdAt",
        COUNT(DISTINCT nr.user_id) as "readCount",
        CASE WHEN n.target_all THEN (SELECT COUNT(*) FROM users) ELSE COUNT(DISTINCT nt.user_id) END as "targetCount"
      FROM notifications n
      LEFT JOIN notification_reads nr ON nr.notification_id = n.id
      LEFT JOIN notification_targets nt ON nt.notification_id = n.id
      GROUP BY n.id
      ORDER BY n.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const notifications = rows.rows.map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      title: r.title,
      body: r.body,
      imageUrl: r.imageUrl ?? null,
      requiresResponse: !!r.requiresResponse,
      targetAll: !!r.targetAll,
      createdAt: Number(r.createdAt),
      readCount: Number(r.readCount ?? 0),
      targetCount: Number(r.targetCount ?? 0),
    }));

    const [{ total }] = await db.select({ total: count(notificationsTable.id) }).from(notificationsTable);

    return res.json({ notifications, total: Number(total), page, limit });
  } catch (err) {
    console.error("GET /admin-panel/notifications error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// DELETE /api/admin-panel/notifications/:id
router.delete("/admin-panel/notifications/:id", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  try {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });
    await db.delete(notificationsTable).where(eq(notificationsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin-panel/notifications/:id error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// ─── User-facing: Notifications ─────────────────────────────────────────────

// GET /api/notifications/pending — returns first unread notification for the logged-in user
router.get("/notifications/pending", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const readRows = await db
      .select({ notificationId: notificationReadsTable.notificationId })
      .from(notificationReadsTable)
      .where(eq(notificationReadsTable.userId, userId));
    const readIds = readRows.map((r) => r.notificationId);

    // Find first unread notification targeting this user (targetAll OR in targets list)
    const rows = await db.execute(sql`
      SELECT n.id, n.title, n.body, n.image_url as "imageUrl", n.requires_response as "requiresResponse"
      FROM notifications n
      WHERE
        (
          n.target_all = true
          OR EXISTS (
            SELECT 1 FROM notification_targets nt
            WHERE nt.notification_id = n.id AND nt.user_id = ${userId}
          )
        )
        ${readIds.length > 0 ? sql`AND n.id NOT IN (${sql.join(readIds.map((id) => sql`${id}`), sql`, `)})` : sql``}
      ORDER BY n.created_at ASC
      LIMIT 1
    `);

    if (rows.rows.length === 0) return res.status(204).send();

    const r = rows.rows[0] as Record<string, unknown>;
    return res.json({
      id: Number(r.id),
      title: r.title,
      body: r.body,
      imageUrl: r.imageUrl ?? null,
      requiresResponse: !!r.requiresResponse,
    });
  } catch (err) {
    console.error("GET /notifications/pending error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/notifications/:id/read — mark notification as read, optionally submit response
router.post("/notifications/:id/read", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const notifId = Number(req.params["id"]);
    if (!Number.isFinite(notifId)) return res.status(400).json({ error: "ID inválido" });

    const userId = req.user!.id;
    const { response } = req.body as { response?: string };

    // Upsert read record
    await db.execute(sql`
      INSERT INTO notification_reads (notification_id, user_id, responded_at)
      VALUES (${notifId}, ${userId}, ${response?.trim() ? Date.now() : null})
      ON CONFLICT (notification_id, user_id) DO NOTHING
    `);

    // If there's a response, save it as a bug report
    if (response?.trim()) {
      const [notif] = await db
        .select({ title: notificationsTable.title })
        .from(notificationsTable)
        .where(eq(notificationsTable.id, notifId))
        .limit(1);

      const pageLabel = notif ? `📣 Notificação: ${notif.title}` : "📣 Notificação";

      await db.insert(bugReportsTable).values({
        userId,
        userEmail: req.user!.email,
        description: response.trim().slice(0, 2000),
        page: pageLabel.slice(0, 500),
        status: "open",
        createdAt: Date.now(),
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /notifications/:id/read error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/bug-reports — user-facing, requires auth
router.post("/bug-reports", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { description, page } = req.body as { description?: string; page?: string };
    if (!description?.trim()) {
      return res.status(400).json({ error: "Descrição obrigatória" });
    }

    await db.insert(bugReportsTable).values({
      userId: req.user?.id ?? null,
      userEmail: req.user?.email ?? null,
      description: description.trim().slice(0, 2000),
      page: (page ?? "").slice(0, 500),
      status: "open",
      createdAt: Date.now(),
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /bug-reports error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
