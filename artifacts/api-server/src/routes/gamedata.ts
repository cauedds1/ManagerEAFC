import { Router } from "express";
import { db, seasonDataTable, careerDataTable, careersTable, seasonsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

async function ownsCareer(careerId: string, userId: number): Promise<boolean> {
  const rows = await db
    .select({ userId: careersTable.userId })
    .from(careersTable)
    .where(eq(careersTable.id, careerId));
  if (rows.length === 0) return false;
  const careerUserId = rows[0].userId;
  return careerUserId === null || careerUserId === userId;
}

async function ownsSeason(seasonId: string, userId: number): Promise<boolean> {
  const seasons = await db
    .select({ careerId: seasonsTable.careerId })
    .from(seasonsTable)
    .where(eq(seasonsTable.id, seasonId));
  if (seasons.length === 0) return false;
  return ownsCareer(seasons[0].careerId, userId);
}

router.get("/data/season/:seasonId", requireAuth, async (req: AuthRequest, res) => {
  const seasonId = String(req.params.seasonId);
  try {
    if (!await ownsSeason(seasonId, req.user!.id)) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const rows = await db
      .select()
      .from(seasonDataTable)
      .where(eq(seasonDataTable.seasonId, seasonId));
    const data: Record<string, unknown> = {};
    for (const row of rows) {
      try { data[row.key] = JSON.parse(row.valueJson); } catch { data[row.key] = row.valueJson; }
    }
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar dados da temporada", details: String(err) });
  }
});

router.put("/data/season/:seasonId/:key", requireAuth, async (req: AuthRequest, res) => {
  const seasonId = String(req.params.seasonId);
  const key = String(req.params.key);
  const { value } = req.body as { value: unknown };
  if (value === undefined) { res.status(400).json({ error: "value é obrigatório" }); return; }
  try {
    if (!await ownsSeason(seasonId, req.user!.id)) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    await db
      .insert(seasonDataTable)
      .values({ seasonId, key, valueJson: JSON.stringify(value), updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: [seasonDataTable.seasonId, seasonDataTable.key],
        set: { valueJson: JSON.stringify(value), updatedAt: Date.now() },
      });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar dados da temporada", details: String(err) });
  }
});

router.delete("/data/season/:seasonId", requireAuth, async (req: AuthRequest, res) => {
  const seasonId = String(req.params.seasonId);
  try {
    if (!await ownsSeason(seasonId, req.user!.id)) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    await db.delete(seasonDataTable).where(eq(seasonDataTable.seasonId, seasonId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar dados da temporada", details: String(err) });
  }
});

router.get("/data/career/:careerId", requireAuth, async (req: AuthRequest, res) => {
  const careerId = String(req.params.careerId);
  try {
    if (!await ownsCareer(careerId, req.user!.id)) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const rows = await db
      .select()
      .from(careerDataTable)
      .where(eq(careerDataTable.careerId, careerId));
    const data: Record<string, unknown> = {};
    for (const row of rows) {
      try { data[row.key] = JSON.parse(row.valueJson); } catch { data[row.key] = row.valueJson; }
    }
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar dados da carreira", details: String(err) });
  }
});

router.put("/data/career/:careerId/:key", requireAuth, async (req: AuthRequest, res) => {
  const careerId = String(req.params.careerId);
  const key = String(req.params.key);
  const { value } = req.body as { value: unknown };
  if (value === undefined) { res.status(400).json({ error: "value é obrigatório" }); return; }
  try {
    if (!await ownsCareer(careerId, req.user!.id)) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    await db
      .insert(careerDataTable)
      .values({ careerId, key, valueJson: JSON.stringify(value), updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: [careerDataTable.careerId, careerDataTable.key],
        set: { valueJson: JSON.stringify(value), updatedAt: Date.now() },
      });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar dados da carreira", details: String(err) });
  }
});

router.delete("/data/career/:careerId", requireAuth, async (req: AuthRequest, res) => {
  const careerId = String(req.params.careerId);
  try {
    if (!await ownsCareer(careerId, req.user!.id)) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    await db.delete(careerDataTable).where(eq(careerDataTable.careerId, careerId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar dados da carreira", details: String(err) });
  }
});

export default router;
