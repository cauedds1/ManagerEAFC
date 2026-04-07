import { Router } from "express";
import { db, clubsTable } from "@workspace/db";

const router = Router();

const CLUBS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

router.get("/clubs", async (_req, res) => {
  try {
    const clubs = await db.select().from(clubsTable);
    if (clubs.length === 0) return res.status(204).end();

    const cachedAt = Number(clubs[0].cachedAt);
    if (Date.now() - cachedAt > CLUBS_TTL_MS) return res.status(204).end();

    return res.json({
      clubs: clubs.map((c) => ({
        id: c.id,
        name: c.name,
        logo: c.logoUrl,
        league: c.league,
        leagueId: c.leagueId,
        country: c.country ?? undefined,
      })),
      cachedAt,
    });
  } catch (err) {
    console.error("GET /clubs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/clubs", async (req, res) => {
  try {
    const body = req.body as {
      clubs?: Array<{
        id: number;
        name: string;
        logo: string;
        league: string;
        leagueId: number;
        country?: string;
      }>;
      cachedAt?: number;
    };

    const { clubs, cachedAt } = body;
    if (!Array.isArray(clubs) || clubs.length === 0 || typeof cachedAt !== "number") {
      return res.status(400).json({ error: "clubs array and cachedAt required" });
    }

    const values = clubs.map((c) => ({
      id: c.id,
      name: c.name,
      logoUrl: c.logo ?? "",
      league: c.league,
      leagueId: c.leagueId,
      country: c.country ?? null,
      cachedAt,
    }));

    await db.transaction(async (tx) => {
      await tx.delete(clubsTable);
      const CHUNK = 200;
      for (let i = 0; i < values.length; i += CHUNK) {
        await tx.insert(clubsTable).values(values.slice(i, i + CHUNK));
      }
    });

    return res.json({ ok: true, count: clubs.length });
  } catch (err) {
    console.error("PUT /clubs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/clubs", async (_req, res) => {
  try {
    await db.delete(clubsTable);
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /clubs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
