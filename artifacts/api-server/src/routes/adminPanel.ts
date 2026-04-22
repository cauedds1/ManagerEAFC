import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable, careersTable, seasonsTable, bugReportsTable } from "@workspace/db";
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

// GET /api/admin-panel/users?page=1&limit=20
router.get("/admin-panel/users", async (req: Request, res: Response) => {
  if (!validateAdminToken(req, res)) return;
  try {
    const page = Math.max(1, Number(req.query["page"] ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query["limit"] ?? 20)));
    const offset = (page - 1) * limit;

    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        plan: usersTable.plan,
        aiUsageCount: usersTable.aiUsageCount,
        createdAt: usersTable.createdAt,
        careerCount: sql<number>`(select count(*) from careers where user_id = ${usersTable.id})`,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db.select({ total: count(usersTable.id) }).from(usersTable);

    return res.json({ users, total: Number(total), page, limit });
  } catch (err) {
    console.error("GET /admin-panel/users error:", err);
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
