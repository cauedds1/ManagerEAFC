import { Router } from "express";
import { db, seasonDataTable, careerDataTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/data/season/:seasonId", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(seasonDataTable)
      .where(eq(seasonDataTable.seasonId, req.params.seasonId));
    const data: Record<string, unknown> = {};
    for (const row of rows) {
      try { data[row.key] = JSON.parse(row.valueJson); } catch { data[row.key] = row.valueJson; }
    }
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar dados da temporada", details: String(err) });
  }
});

router.put("/data/season/:seasonId/:key", async (req, res) => {
  const { seasonId, key } = req.params;
  const { value } = req.body as { value: unknown };
  if (value === undefined) { res.status(400).json({ error: "value é obrigatório" }); return; }
  try {
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

router.delete("/data/season/:seasonId", async (req, res) => {
  try {
    await db.delete(seasonDataTable).where(eq(seasonDataTable.seasonId, req.params.seasonId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar dados da temporada", details: String(err) });
  }
});

router.get("/data/career/:careerId", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(careerDataTable)
      .where(eq(careerDataTable.careerId, req.params.careerId));
    const data: Record<string, unknown> = {};
    for (const row of rows) {
      try { data[row.key] = JSON.parse(row.valueJson); } catch { data[row.key] = row.valueJson; }
    }
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar dados da carreira", details: String(err) });
  }
});

router.put("/data/career/:careerId/:key", async (req, res) => {
  const { careerId, key } = req.params;
  const { value } = req.body as { value: unknown };
  if (value === undefined) { res.status(400).json({ error: "value é obrigatório" }); return; }
  try {
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

router.delete("/data/career/:careerId", async (req, res) => {
  try {
    await db.delete(careerDataTable).where(eq(careerDataTable.careerId, req.params.careerId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar dados da carreira", details: String(err) });
  }
});

export default router;
