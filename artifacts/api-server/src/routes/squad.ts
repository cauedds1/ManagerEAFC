import { Router } from "express";
import { db, squadsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

const SQUAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

router.get("/squad/:teamId", async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId ?? "", 10);
    if (isNaN(teamId) || teamId <= 0) {
      return res.status(400).json({ error: "Invalid teamId" });
    }

    const rows = await db.select().from(squadsTable).where(eq(squadsTable.teamId, teamId));
    if (rows.length === 0) return res.status(204).end();

    const row = rows[0];
    const cachedAt = Number(row.cachedAt);
    if (Date.now() - cachedAt > SQUAD_TTL_MS) return res.status(204).end();

    return res.json({
      players: row.players,
      source: row.source,
      cachedAt,
    });
  } catch (err) {
    console.error("GET /squad/:teamId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/squad/:teamId", async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId ?? "", 10);
    if (isNaN(teamId) || teamId <= 0) {
      return res.status(400).json({ error: "Invalid teamId" });
    }

    const body = req.body as {
      players?: unknown[];
      source?: string;
      cachedAt?: number;
    };

    const { players, source, cachedAt } = body;
    if (!Array.isArray(players) || typeof source !== "string" || typeof cachedAt !== "number") {
      return res.status(400).json({ error: "players, source, and cachedAt required" });
    }

    await db
      .insert(squadsTable)
      .values({ teamId, players, source, cachedAt })
      .onConflictDoUpdate({
        target: squadsTable.teamId,
        set: {
          players: sql`excluded.players`,
          source: sql`excluded.source`,
          cachedAt: sql`excluded.cached_at`,
        },
      });

    return res.json({ ok: true });
  } catch (err) {
    console.error("PUT /squad/:teamId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
