import { Router } from "express";
import { db, careersTable, seasonsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

router.get("/careers", async (_req, res) => {
  try {
    const rows = await db.select().from(careersTable).orderBy(careersTable.createdAt);
    return res.json(
      rows.map((r) => ({
        id: r.id,
        coach: JSON.parse(r.coachJson),
        clubId: r.clubId,
        clubName: r.clubName,
        clubLogo: r.clubLogo,
        clubLeague: r.clubLeague,
        clubCountry: r.clubCountry ?? undefined,
        clubStadium: r.clubStadium ?? undefined,
        clubFounded: r.clubFounded ?? undefined,
        clubPrimary: r.clubPrimary ?? undefined,
        clubSecondary: r.clubSecondary ?? undefined,
        clubDescription: r.clubDescription ?? undefined,
        clubTitles: r.clubTitlesJson ? JSON.parse(r.clubTitlesJson) : undefined,
        season: r.season,
        projeto: r.projeto ?? undefined,
        competitions: r.competitionsJson ? JSON.parse(r.competitionsJson) : undefined,
        currentSeasonId: r.currentSeasonId ?? undefined,
        createdAt: Number(r.createdAt),
        updatedAt: Number(r.updatedAt),
      })),
    );
  } catch (err) {
    console.error("GET /careers error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/careers", async (req, res) => {
  try {
    const body = req.body as {
      id?: string;
      coach: object;
      clubId: number;
      clubName: string;
      clubLogo?: string;
      clubLeague?: string;
      clubCountry?: string;
      clubStadium?: string;
      clubFounded?: number;
      clubPrimary?: string;
      clubSecondary?: string;
      clubDescription?: string;
      clubTitles?: object[];
      season?: string;
      projeto?: string;
      competitions?: string[];
      currentSeasonId?: string;
      createdAt?: number;
      updatedAt?: number;
    };

    if (!body.coach || !body.clubName) {
      return res.status(400).json({ error: "coach and clubName are required" });
    }

    const id = body.id ?? generateId();
    const now = Date.now();

    await db
      .insert(careersTable)
      .values({
        id,
        coachJson: JSON.stringify(body.coach),
        clubId: body.clubId ?? 0,
        clubName: body.clubName,
        clubLogo: body.clubLogo ?? "",
        clubLeague: body.clubLeague ?? "",
        clubCountry: body.clubCountry ?? null,
        clubStadium: body.clubStadium ?? null,
        clubFounded: body.clubFounded ?? null,
        clubPrimary: body.clubPrimary ?? null,
        clubSecondary: body.clubSecondary ?? null,
        clubDescription: body.clubDescription ?? null,
        clubTitlesJson: body.clubTitles ? JSON.stringify(body.clubTitles) : null,
        season: body.season ?? "",
        projeto: body.projeto ?? null,
        competitionsJson: body.competitions ? JSON.stringify(body.competitions) : null,
        currentSeasonId: body.currentSeasonId ?? null,
        createdAt: body.createdAt ?? now,
        updatedAt: body.updatedAt ?? now,
      })
      .onConflictDoNothing();

    return res.status(201).json({ id });
  } catch (err) {
    console.error("POST /careers error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/careers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body as Partial<{
      coach: object;
      clubId: number;
      clubName: string;
      clubLogo: string;
      clubLeague: string;
      clubCountry: string;
      clubStadium: string;
      clubFounded: number;
      clubPrimary: string;
      clubSecondary: string;
      clubDescription: string;
      clubTitles: object[];
      season: string;
      projeto: string;
      competitions: string[];
      currentSeasonId: string;
    }>;

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (body.coach !== undefined) patch.coachJson = JSON.stringify(body.coach);
    if (body.clubId !== undefined) patch.clubId = body.clubId;
    if (body.clubName !== undefined) patch.clubName = body.clubName;
    if (body.clubLogo !== undefined) patch.clubLogo = body.clubLogo;
    if (body.clubLeague !== undefined) patch.clubLeague = body.clubLeague;
    if (body.clubCountry !== undefined) patch.clubCountry = body.clubCountry;
    if (body.clubStadium !== undefined) patch.clubStadium = body.clubStadium;
    if (body.clubFounded !== undefined) patch.clubFounded = body.clubFounded;
    if (body.clubPrimary !== undefined) patch.clubPrimary = body.clubPrimary;
    if (body.clubSecondary !== undefined) patch.clubSecondary = body.clubSecondary;
    if (body.clubDescription !== undefined) patch.clubDescription = body.clubDescription;
    if (body.clubTitles !== undefined) patch.clubTitlesJson = JSON.stringify(body.clubTitles);
    if (body.season !== undefined) patch.season = body.season;
    if (body.projeto !== undefined) patch.projeto = body.projeto;
    if (body.competitions !== undefined) patch.competitionsJson = JSON.stringify(body.competitions);
    if (body.currentSeasonId !== undefined) patch.currentSeasonId = body.currentSeasonId;

    await db.update(careersTable).set(patch).where(eq(careersTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("PUT /careers/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/careers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(seasonsTable).where(eq(seasonsTable.careerId, id));
    await db.delete(careersTable).where(eq(careersTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /careers/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/careers/:id/seasons", async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await db
      .select()
      .from(seasonsTable)
      .where(eq(seasonsTable.careerId, id))
      .orderBy(seasonsTable.createdAt);
    return res.json(
      rows.map((r) => ({
        id: r.id,
        careerId: r.careerId,
        label: r.label,
        competitions: r.competitionsJson ? JSON.parse(r.competitionsJson) : undefined,
        isActive: r.isActive,
        createdAt: Number(r.createdAt),
      })),
    );
  } catch (err) {
    console.error("GET /careers/:id/seasons error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/careers/:id/seasons", async (req, res) => {
  try {
    const { id: careerId } = req.params;
    const body = req.body as {
      id?: string;
      label: string;
      competitions?: string[];
      isActive?: boolean;
      createdAt?: number;
    };

    if (!body.label) {
      return res.status(400).json({ error: "label is required" });
    }

    const id = body.id ?? generateId();
    const now = Date.now();

    if (body.isActive) {
      await db
        .update(seasonsTable)
        .set({ isActive: false })
        .where(eq(seasonsTable.careerId, careerId));
    }

    await db.insert(seasonsTable).values({
      id,
      careerId,
      label: body.label,
      competitionsJson: body.competitions ? JSON.stringify(body.competitions) : null,
      isActive: body.isActive ?? false,
      createdAt: body.createdAt ?? now,
    }).onConflictDoNothing();

    if (body.isActive) {
      await db
        .update(careersTable)
        .set({ currentSeasonId: id, updatedAt: now })
        .where(eq(careersTable.id, careerId));
    }

    return res.status(201).json({ id });
  } catch (err) {
    console.error("POST /careers/:id/seasons error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/seasons/:id/label", async (req, res) => {
  try {
    const { id: seasonId } = req.params;
    const { label } = req.body as { label?: string };
    if (!label?.trim()) return res.status(400).json({ error: "label is required" });
    const row = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
    if (!row.length) return res.status(404).json({ error: "Season not found" });
    await db.update(seasonsTable).set({ label: label.trim() }).where(eq(seasonsTable.id, seasonId));
    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /seasons/:id/label error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/seasons/:id/activate", async (req, res) => {
  try {
    const { id: seasonId } = req.params;
    const row = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
    if (!row.length) return res.status(404).json({ error: "Season not found" });
    const { careerId } = row[0];

    await db
      .update(seasonsTable)
      .set({ isActive: false })
      .where(eq(seasonsTable.careerId, careerId));

    await db.update(seasonsTable).set({ isActive: true }).where(eq(seasonsTable.id, seasonId));

    await db
      .update(careersTable)
      .set({ currentSeasonId: seasonId, updatedAt: Date.now() })
      .where(eq(careersTable.id, careerId));

    return res.json({ ok: true });
  } catch (err) {
    console.error("PUT /seasons/:id/activate error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
