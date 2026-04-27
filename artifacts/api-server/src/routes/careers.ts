import { Router } from "express";
import { db, careersTable, seasonsTable, usersTable, careerDataTable, seasonDataTable, customPortalsTable, clubsTable } from "@workspace/db";
import { eq, isNull, or, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { getPlanLimits } from "../lib/planLimits";
import { isR2Configured, cacheExternalImage } from "../lib/r2Storage";
import { callDiretoriaWithPlan } from "../lib/aiProvider";

const router = Router();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function isApiSportsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "media.api-sports.io";
  } catch {
    return false;
  }
}

async function cacheClubLogoInBackground(careerId: string, clubId: number, hintLogoUrl?: string): Promise<void> {
  if (!isR2Configured() || !clubId) return;
  try {
    // Use DB as source-of-truth for the logo URL (prevents caching incorrect client-provided URLs)
    const [clubRow] = await db
      .select({ logoUrl: clubsTable.logoUrl })
      .from(clubsTable)
      .where(eq(clubsTable.id, clubId))
      .limit(1);

    const dbLogoUrl = clubRow?.logoUrl;

    // If club already has an R2 URL in DB, repair career to point at it (prevents downgrade)
    if (dbLogoUrl && !isApiSportsUrl(dbLogoUrl)) {
      await db.update(careersTable).set({ clubLogo: dbLogoUrl }).where(eq(careersTable.id, careerId));
      return;
    }

    // Resolve source: DB URL takes precedence, then client hint
    const sourceUrl = dbLogoUrl ?? hintLogoUrl;
    if (!sourceUrl || !isApiSportsUrl(sourceUrl)) return;

    const r2Url = await cacheExternalImage(sourceUrl, `cached-images/teams/${clubId}.png`);
    if (r2Url) {
      await db.update(careersTable).set({ clubLogo: r2Url }).where(eq(careersTable.id, careerId));
      await db.update(clubsTable).set({ logoUrl: r2Url }).where(eq(clubsTable.id, clubId));
    }
  } catch {
    // ignore — fallback to original URL already in DB
  }
}

router.post("/careers/parse-ongoing-context", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { description } = req.body as { description?: string };
    if (!description?.trim()) {
      return res.status(400).json({ error: "description is required" });
    }

    const systemPrompt = `You are a football career mode analyst. The user will describe their ongoing career in EA FC (FIFA) in any language. Extract the following information and return ONLY valid JSON — no markdown, no code blocks, just the raw JSON object.

Return this exact JSON structure:
{
  "boardMood": <integer 0-100, board satisfaction level>,
  "fanMood": <integer 0-100, fan satisfaction level>,
  "currentSeason": "<string, e.g. '2024/25' or '2025'>",
  "projeto": "<string, suggested career objective in 1-2 sentences, in the same language as the user's description>",
  "narrativeSummary": "<string, 2-3 sentences summarizing the career context for use as AI news generation background, in the same language as the user's description>",
  "confidence": "<'low'|'medium'|'high'>"
}

Rules:
- boardMood: 80+ if board is happy/satisfied, 60-79 stable, 40-59 watching, 20-39 concerned, 0-19 crisis
- fanMood: 80+ if fans are ecstatic/euphoric, 60-79 excited, 40-59 neutral, 20-39 unhappy, 0-19 revolted
- If the user does not mention mood explicitly, infer from context (win streak = higher, relegation battle = lower)
- If information is missing or unclear, use 50 for mood and mark confidence as 'low'
- narrativeSummary should capture: club, competition context, recent form, key events, and career trajectory
- Return ONLY the JSON object, nothing else`;

    const userPrompt = description.trim().slice(0, 4000);

    const [dbUser] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    const plan = dbUser?.plan ?? "free";

    const raw = await callDiretoriaWithPlan(plan, systemPrompt, userPrompt, 1024);

    let parsed: {
      boardMood: number;
      fanMood: number;
      currentSeason: string;
      projeto: string;
      narrativeSummary: string;
      confidence: string;
    };

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(500).json({ error: "AI returned invalid JSON" });
    }

    const clamp = (v: unknown, def: number) => {
      const n = Number(v);
      return isNaN(n) ? def : Math.max(0, Math.min(100, Math.round(n)));
    };

    return res.json({
      boardMood: clamp(parsed.boardMood, 50),
      fanMood: clamp(parsed.fanMood, 50),
      currentSeason: typeof parsed.currentSeason === "string" ? parsed.currentSeason.trim() : "",
      projeto: typeof parsed.projeto === "string" ? parsed.projeto.trim() : "",
      narrativeSummary: typeof parsed.narrativeSummary === "string" ? parsed.narrativeSummary.trim() : "",
      confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "medium",
    });
  } catch (err) {
    console.error("POST /careers/parse-ongoing-context error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/careers", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const rows = await db
      .select()
      .from(careersTable)
      .where(or(eq(careersTable.userId, userId), isNull(careersTable.userId)))
      .orderBy(careersTable.createdAt);
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
        backstory: r.backstory ?? undefined,
        createdAt: Number(r.createdAt),
        updatedAt: Number(r.updatedAt),
      })),
    );
  } catch (err) {
    console.error("GET /careers error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/careers", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
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
      backstory?: string;
      createdAt?: number;
      updatedAt?: number;
    };

    if (!body.coach || !body.clubName) {
      return res.status(400).json({ error: "coach and clubName are required" });
    }

    const [dbUser] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const plan = dbUser?.plan ?? "free";
    const limits = getPlanLimits(plan);
    if (limits.maxCareers !== Infinity) {
      const existing = await db.select({ id: careersTable.id }).from(careersTable).where(eq(careersTable.userId, userId));
      if (existing.length >= limits.maxCareers) {
        return res.status(403).json({
          error: `Plano ${plan} permite no máximo ${limits.maxCareers} carreira(s)`,
          code: "PLAN_LIMIT_REACHED",
          plan,
          limit: limits.maxCareers,
        });
      }
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
        backstory: body.backstory ?? null,
        userId,
        createdAt: body.createdAt ?? now,
        updatedAt: body.updatedAt ?? now,
      })
      .onConflictDoNothing();

    if (body.clubId) {
      cacheClubLogoInBackground(id, body.clubId, body.clubLogo).catch(() => {});
    }

    return res.status(201).json({ id });
  } catch (err) {
    console.error("POST /careers error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/careers/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const [career] = await db.select({ userId: careersTable.userId }).from(careersTable).where(eq(careersTable.id, id)).limit(1);
    if (!career || career.userId !== userId) {
      return res.status(404).json({ error: "Carreira não encontrada" });
    }

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
      backstory: string;
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
    if (body.backstory !== undefined) patch.backstory = body.backstory;

    await db.update(careersTable).set(patch).where(eq(careersTable.id, id));

    if (body.clubId) {
      cacheClubLogoInBackground(id, body.clubId, body.clubLogo).catch(() => {});
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("PUT /careers/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/careers/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const [career] = await db.select({ userId: careersTable.userId }).from(careersTable).where(eq(careersTable.id, id)).limit(1);
    if (!career || career.userId !== userId) {
      return res.status(404).json({ error: "Carreira não encontrada" });
    }

    await db.transaction(async (tx) => {
      const seasonRows = await tx.select({ id: seasonsTable.id }).from(seasonsTable).where(eq(seasonsTable.careerId, id));
      const seasonIds = seasonRows.map((r) => r.id);

      if (seasonIds.length > 0) {
        await tx.delete(seasonDataTable).where(inArray(seasonDataTable.seasonId, seasonIds));
      }
      await tx.delete(careerDataTable).where(eq(careerDataTable.careerId, id));
      await tx.delete(customPortalsTable).where(eq(customPortalsTable.careerId, id));
      await tx.delete(seasonsTable).where(eq(seasonsTable.careerId, id));
      await tx.delete(careersTable).where(eq(careersTable.id, id));
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /careers/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/careers/:id/seasons", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const [career] = await db.select({ userId: careersTable.userId }).from(careersTable).where(eq(careersTable.id, id)).limit(1);
    if (!career || career.userId !== userId) {
      return res.status(404).json({ error: "Carreira não encontrada" });
    }

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
        finalized: r.finalized ?? false,
        createdAt: Number(r.createdAt),
      })),
    );
  } catch (err) {
    console.error("GET /careers/:id/seasons error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/careers/:id/seasons", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: careerId } = req.params;
    const userId = req.user!.id;

    const [career] = await db.select({ userId: careersTable.userId }).from(careersTable).where(eq(careersTable.id, careerId)).limit(1);
    if (!career || career.userId !== userId) {
      return res.status(404).json({ error: "Carreira não encontrada" });
    }

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

router.patch("/seasons/:id/finalize", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: seasonId } = req.params;
    const userId = req.user!.id;
    const [row] = await db.select({ careerId: seasonsTable.careerId }).from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
    if (!row) return res.status(404).json({ error: "Season not found" });
    const [career] = await db.select({ userId: careersTable.userId }).from(careersTable).where(eq(careersTable.id, row.careerId)).limit(1);
    if (!career || career.userId !== userId) return res.status(404).json({ error: "Season not found" });
    await db.update(seasonsTable).set({ finalized: true }).where(eq(seasonsTable.id, seasonId));
    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /seasons/:id/finalize error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/seasons/:id/label", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: seasonId } = req.params;
    const userId = req.user!.id;
    const { label } = req.body as { label?: string };
    if (!label?.trim()) return res.status(400).json({ error: "label is required" });
    const [row] = await db.select({ careerId: seasonsTable.careerId }).from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
    if (!row) return res.status(404).json({ error: "Season not found" });
    const [career] = await db.select({ userId: careersTable.userId }).from(careersTable).where(eq(careersTable.id, row.careerId)).limit(1);
    if (!career || career.userId !== userId) return res.status(404).json({ error: "Season not found" });
    await db.update(seasonsTable).set({ label: label.trim() }).where(eq(seasonsTable.id, seasonId));
    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /seasons/:id/label error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/seasons/:id/activate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: seasonId } = req.params;
    const userId = req.user!.id;
    const [row] = await db.select({ careerId: seasonsTable.careerId }).from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
    if (!row) return res.status(404).json({ error: "Season not found" });
    const { careerId } = row;
    const [career] = await db.select({ userId: careersTable.userId }).from(careersTable).where(eq(careersTable.id, careerId)).limit(1);
    if (!career || career.userId !== userId) return res.status(404).json({ error: "Season not found" });

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

router.post("/careers/:id/squad", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: careerId } = req.params;
    const userId = req.user!.id;

    const [career] = await db.select({ userId: careersTable.userId }).from(careersTable).where(eq(careersTable.id, careerId)).limit(1);
    if (!career || career.userId !== userId) {
      return res.status(404).json({ error: "Carreira não encontrada" });
    }

    const body = req.body as {
      name?: string;
      age?: number;
      position?: string;
      positionPtBr?: string;
      overallRating?: number;
      number?: number;
      photo?: string;
      source?: string;
    };

    if (!body.name?.trim()) return res.status(400).json({ error: "name is required" });
    if (body.source !== "manual") return res.status(400).json({ error: "source must be 'manual'" });

    const VALID_POSITIONS = ["GOL", "DEF", "MID", "ATA", "Goalkeeper", "Defender", "Midfielder", "Attacker"];
    const clampedOvr = body.overallRating != null
      ? Math.min(99, Math.max(1, Math.floor(body.overallRating)))
      : 70;
    const clampedAge = body.age != null
      ? Math.min(50, Math.max(14, Math.floor(body.age)))
      : 25;
    const safePosition = body.position && VALID_POSITIONS.includes(body.position) ? body.position : "MID";
    const safePtBr = body.positionPtBr && VALID_POSITIONS.includes(body.positionPtBr) ? body.positionPtBr : "MID";

    const allRows = await db
      .select({ key: careerDataTable.key, valueJson: careerDataTable.valueJson })
      .from(careerDataTable)
      .where(eq(careerDataTable.careerId, careerId));

    const customPlayersRow = allRows.find((r) => r.key === "customPlayers");
    const existing: { id?: number }[] = customPlayersRow
      ? (JSON.parse(customPlayersRow.valueJson) as { id?: number }[])
      : [];

    const existingIds = existing.map((p) => p.id ?? 0).filter((id) => id < 0);
    const minId = existingIds.length > 0 ? Math.min(...existingIds) : 0;
    const newId = minId - 1;

    const newPlayer = {
      id: newId,
      name: body.name.trim().slice(0, 100),
      age: clampedAge,
      position: safePosition,
      positionPtBr: safePtBr,
      overallRating: clampedOvr,
      number: body.number != null ? Math.min(99, Math.max(1, Math.floor(body.number))) : undefined,
      photo: body.photo?.trim() ?? "",
    };

    const updated = [...existing, newPlayer];

    await db
      .insert(careerDataTable)
      .values({ careerId, key: "customPlayers", valueJson: JSON.stringify(updated) })
      .onConflictDoUpdate({
        target: [careerDataTable.careerId, careerDataTable.key],
        set: { valueJson: JSON.stringify(updated) },
      });

    return res.status(201).json({ player: newPlayer });
  } catch (err) {
    console.error("POST /careers/:id/squad error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/careers/:id/squad/:playerId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: careerId, playerId: playerIdStr } = req.params;
    const userId = req.user!.id;
    const playerId = Number(playerIdStr);

    if (isNaN(playerId) || playerId >= 0) return res.status(400).json({ error: "Only custom players (negative id) can be removed" });

    const [career] = await db.select({ userId: careersTable.userId }).from(careersTable).where(eq(careersTable.id, careerId)).limit(1);
    if (!career || career.userId !== userId) return res.status(404).json({ error: "Carreira não encontrada" });

    const allRows = await db
      .select({ key: careerDataTable.key, valueJson: careerDataTable.valueJson })
      .from(careerDataTable)
      .where(eq(careerDataTable.careerId, careerId));

    const customPlayersRow = allRows.find((r) => r.key === "customPlayers");
    const existing: unknown[] = customPlayersRow
      ? (JSON.parse(customPlayersRow.valueJson) as unknown[])
      : [];

    const updated = (existing as { id?: number }[]).filter((p) => p.id !== playerId);
    await db
      .insert(careerDataTable)
      .values({ careerId, key: "customPlayers", valueJson: JSON.stringify(updated) })
      .onConflictDoUpdate({
        target: [careerDataTable.careerId, careerDataTable.key],
        set: { valueJson: JSON.stringify(updated) },
      });

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /careers/:id/squad/:playerId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/careers/:id/export", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const [career] = await db.select().from(careersTable).where(eq(careersTable.id, id)).limit(1);
    if (!career || career.userId !== userId) {
      return res.status(404).json({ error: "Carreira não encontrada" });
    }

    const seasons = await db.select().from(seasonsTable).where(eq(seasonsTable.careerId, id)).orderBy(seasonsTable.createdAt);
    const seasonIds = seasons.map((s) => s.id);

    const allSeasonData: Record<string, { key: string; valueJson: string }[]> = {};
    for (const sid of seasonIds) {
      const rows = await db.select({ key: seasonDataTable.key, valueJson: seasonDataTable.valueJson }).from(seasonDataTable).where(eq(seasonDataTable.seasonId, sid));
      allSeasonData[sid] = rows;
    }

    const careerDataRows = await db.select({ key: careerDataTable.key, valueJson: careerDataTable.valueJson }).from(careerDataTable).where(eq(careerDataTable.careerId, id));

    const payload = {
      exportVersion: 1,
      exportedAt: Date.now(),
      career: {
        id: career.id,
        coachJson: career.coachJson,
        clubId: career.clubId,
        clubName: career.clubName,
        clubLogo: career.clubLogo,
        clubLeague: career.clubLeague,
        clubCountry: career.clubCountry,
        clubStadium: career.clubStadium,
        clubFounded: career.clubFounded,
        clubPrimary: career.clubPrimary,
        clubSecondary: career.clubSecondary,
        clubDescription: career.clubDescription,
        clubTitlesJson: career.clubTitlesJson,
        season: career.season,
        projeto: career.projeto,
        competitionsJson: career.competitionsJson,
        currentSeasonId: career.currentSeasonId,
        createdAt: career.createdAt,
        updatedAt: career.updatedAt,
      },
      seasons: seasons.map((s) => ({
        id: s.id,
        careerId: s.careerId,
        label: s.label,
        competitionsJson: s.competitionsJson,
        isActive: s.isActive,
        finalized: s.finalized,
        createdAt: s.createdAt,
      })),
      seasonData: allSeasonData,
      careerData: careerDataRows,
    };

    const clubSlug = career.clubName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${clubSlug}-career-export.json"`);
    return res.json(payload);
  } catch (err) {
    console.error("GET /careers/:id/export error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
