import { Router } from "express";
import { db, customPortalsTable, careersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { getPlanLimits } from "../lib/planLimits";

const router = Router();

function generateId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

async function assertCareerOwner(careerId: string | string[], userId: number): Promise<boolean> {
  if (Array.isArray(careerId)) return false;
  const [career] = await db.select({ userId: careersTable.userId }).from(careersTable).where(eq(careersTable.id, careerId)).limit(1);
  return !!career && career.userId === userId;
}

router.get("/careers/:careerId/portals", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { careerId } = req.params;

    if (!(await assertCareerOwner(careerId, userId))) {
      res.status(404).json({ error: "Carreira não encontrada" });
      return;
    }

    const rows = await db
      .select()
      .from(customPortalsTable)
      .where(eq(customPortalsTable.careerId, careerId))
      .orderBy(customPortalsTable.createdAt);
    res.json(rows.map((r) => ({
      id: r.id,
      careerId: r.careerId,
      name: r.name,
      description: r.description,
      tone: r.tone,
      photo: r.photoUrl ?? undefined,
      createdAt: Number(r.createdAt),
    })));
  } catch (err) {
    req.log.error({ err }, "GET /careers/:careerId/portals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/careers/:careerId/portals", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { careerId } = req.params;

    if (!(await assertCareerOwner(careerId, userId))) {
      res.status(404).json({ error: "Carreira não encontrada" });
      return;
    }

    const plan = req.user!.plan;
    const limits = getPlanLimits(plan);
    if (limits.maxCustomPortals === 0) {
      res.status(403).json({
        error: "Portais personalizados não estão disponíveis no seu plano",
        code: "PLAN_LIMIT_REACHED",
        plan,
      });
      return;
    }

    const { name, description, tone, photo } = req.body as {
      name: string;
      description: string;
      tone: string;
      photo?: string;
    };
    if (!name || !description || !tone) {
      res.status(400).json({ error: "name, description e tone são obrigatórios" });
      return;
    }

    const existing = await db
      .select({ id: customPortalsTable.id })
      .from(customPortalsTable)
      .where(eq(customPortalsTable.careerId, careerId));
    if (existing.length >= limits.maxCustomPortals) {
      res.status(403).json({
        error: `Máximo de ${limits.maxCustomPortals} portal(is) por carreira no plano ${plan}`,
        code: "PLAN_LIMIT_REACHED",
        plan,
        limit: limits.maxCustomPortals,
      });
      return;
    }

    const id = generateId();
    const now = Date.now();
    await db.insert(customPortalsTable).values({
      id,
      careerId,
      name,
      description,
      tone,
      photoUrl: photo ?? null,
      createdAt: now,
    });
    res.status(201).json({ id, careerId, name, description, tone, photo, createdAt: now });
  } catch (err) {
    req.log.error({ err }, "POST /careers/:careerId/portals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/careers/:careerId/portals/:portalId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { careerId, portalId } = req.params;

    if (!(await assertCareerOwner(careerId, userId))) {
      res.status(404).json({ error: "Carreira não encontrada" });
      return;
    }

    const { name, description, tone, photo } = req.body as {
      name?: string;
      description?: string;
      tone?: string;
      photo?: string | null;
    };
    const updates: Partial<typeof customPortalsTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (tone !== undefined) updates.tone = tone;
    if (photo !== undefined) updates.photoUrl = photo;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nenhum campo para atualizar" });
      return;
    }
    await db
      .update(customPortalsTable)
      .set(updates)
      .where(and(
        eq(customPortalsTable.id, portalId),
        eq(customPortalsTable.careerId, careerId),
      ));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PUT /careers/:careerId/portals/:portalId error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/careers/:careerId/portals/:portalId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { careerId, portalId } = req.params;

    if (!(await assertCareerOwner(careerId, userId))) {
      res.status(404).json({ error: "Carreira não encontrada" });
      return;
    }

    await db
      .delete(customPortalsTable)
      .where(and(
        eq(customPortalsTable.id, portalId),
        eq(customPortalsTable.careerId, careerId),
      ));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /careers/:careerId/portals/:portalId error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
