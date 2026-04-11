import { Router } from "express";
import { db, customPortalsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function generateId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

router.get("/careers/:careerId/portals", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(customPortalsTable)
      .where(eq(customPortalsTable.careerId, req.params.careerId))
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

router.post("/careers/:careerId/portals", async (req, res) => {
  try {
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
      .where(eq(customPortalsTable.careerId, req.params.careerId));
    if (existing.length >= 3) {
      res.status(400).json({ error: "Máximo de 3 portais por carreira" });
      return;
    }
    const id = generateId();
    const now = Date.now();
    await db.insert(customPortalsTable).values({
      id,
      careerId: req.params.careerId,
      name,
      description,
      tone,
      photoUrl: photo ?? null,
      createdAt: now,
    });
    res.status(201).json({ id, careerId: req.params.careerId, name, description, tone, photo, createdAt: now });
  } catch (err) {
    req.log.error({ err }, "POST /careers/:careerId/portals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/careers/:careerId/portals/:portalId", async (req, res) => {
  try {
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
        eq(customPortalsTable.id, req.params.portalId),
        eq(customPortalsTable.careerId, req.params.careerId),
      ));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PUT /careers/:careerId/portals/:portalId error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/careers/:careerId/portals/:portalId", async (req, res) => {
  try {
    await db
      .delete(customPortalsTable)
      .where(and(
        eq(customPortalsTable.id, req.params.portalId),
        eq(customPortalsTable.careerId, req.params.careerId),
      ));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /careers/:careerId/portals/:portalId error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
