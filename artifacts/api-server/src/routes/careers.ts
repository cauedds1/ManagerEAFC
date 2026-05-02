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

    const systemPrompt = `You are an elite football career mode analyst. The user will describe their ongoing career in EA FC (FIFA) in any language, possibly with great detail (club, coach, league position, results, transfers, key players, board pressure, fan mood, finances, narrative arc, rivals). Your job is to extract MAXIMUM structured context so the system can pick up the career mid-stream.

Return ONLY a single valid JSON object — no markdown fences, no commentary. Use the SAME LANGUAGE as the user description for all human-readable strings (projeto, narratives, missions, board letter, predictions, reasons, questions).

Required JSON schema:
{
  "club": { "name": "<canonical club name in English when possible, e.g. 'Tottenham Hotspur'>", "league": "<league name>", "country": "<country>", "confidence": "<low|medium|high>" },
  "coach": { "name": "<coach name if mentioned, else empty>", "nationality": "<country if mentioned>", "style": "<short tactical descriptor, e.g. 'gegenpressing 4-2-3-1'>", "confidence": "<low|medium|high>" },
  "season": { "label": "<e.g. '2025/26'>", "stage": "<pre-season|early|mid|late|playoffs|finished>", "matchday": <integer or null>, "confidence": "<low|medium|high>" },
  "leaguePosition": { "rank": <integer or null>, "points": <integer or null>, "form": "<short, e.g. 'WWDLW'>", "recentForm": ["W","W","D","L","W"], "goalDifference": <integer or null>, "gap": "<short text describing distance to leaders/relegation>", "currentMatchday": <integer or null>, "confidence": "<low|medium|high>" },
  "preferredFormation": "<e.g. '4-3-3' or empty>",
  "injuries": [ { "name": "<player>", "weeks": <integer or null>, "note": "<short>" } ],
  "trophiesWon": [ "<trophy name>" ],
  "ongoingCompetitions": [ { "name": "<comp>", "stage": "<short, e.g. 'Quartas'>", "nextOpponent": "<short>" } ],
  "rivalsContext": [ { "name": "<rival club>", "context": "<1 sentence about the rivalry's current state>" } ],
  "narrativeArcs": [ { "title": "<short arc title>", "description": "<1-2 sentences>", "status": "<rising|peaking|fading>" } ],
  "moods": {
    "board": { "value": <0-100>, "label": "<one-word, e.g. 'satisfeita'>", "reason": "<one short sentence why>" },
    "fans":  { "value": <0-100>, "label": "<one-word>", "reason": "<one short sentence>" },
    "dressingRoom": { "value": <0-100>, "label": "<one-word>", "reason": "<one short sentence>" }
  },
  "finances": { "summary": "<short text or empty>", "budget": "<short text or empty>", "confidence": "<low|medium|high>" },
  "keyPlayers": [ { "name": "<player name>", "role": "<star|captain|young promise|loan|injured>", "note": "<short context>" } ],
  "transfersIn":  [ { "name": "<player>", "from": "<club>", "fee": "<short, optional>", "note": "<short>" } ],
  "transfersOut": [ { "name": "<player>", "to": "<club>", "fee": "<short, optional>", "note": "<short>" } ],
  "rivals": [ "<rival club name>" ],
  "recentMatches": [ { "opponent": "<club>", "competition": "<comp>", "result": "<W|D|L>", "score": "<e.g. '2-1'>", "note": "<short>" } ],
  "storyArc": "<2-4 sentences capturing the narrative so far — origin, struggle, breakthrough, current chapter>",
  "narrativeSummary": "<3 short sentences for AI news-generation background>",
  "projeto": "<the suggested career project (1-2 sentences) given everything inferred>",
  "competitions": [ "<competition names you would expect this season>" ],
  "missions": [ { "title": "<short mission title>", "description": "<1 sentence>", "deadline": "<season|matchday X|short text>" }, ... up to 3 missions ],
  "boardLetter": "<3-5 sentence letter from the board to the coach, in the language used by the user, addressing the moment>",
  "prediction": { "endOfSeason": "<short text predicting where the club ends up>", "boardReaction": "<short text predicting board reaction>", "confidence": "<low|medium|high>" },
  "inconsistencies": [ "<short note about anything contradictory or impossible>" ],
  "deepeningQuestions": [ "<a question the user could answer to enrich the context further>", ... up to 3 ],
  "squadSyncWarning": "<one short paragraph reminding the coach that real EA FC squad may differ from extracted players, and to verify in-game>",
  "overallConfidence": "<low|medium|high>"
}

Rules:
- mood values: 80+ ecstatic/triumphant, 60-79 happy/stable, 40-59 neutral/watching, 20-39 unhappy/concerned, 0-19 crisis/revolt
- If a field is unknown, use empty string / empty array / null and lower confidence accordingly
- Be concise — short strings only. No paragraphs longer than ~280 chars
- Never invent a club name; if unsure, leave club.name empty and mark confidence low
- Always return arrays even if empty
- Output ONLY the JSON object`;

    // Allow very long multi-season histories; cap only at hard model context limits
    const userPrompt = description.trim().slice(0, 60000);

    const [dbUser] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    const plan = dbUser?.plan ?? "free";

    const raw = await callDiretoriaWithPlan(plan, systemPrompt, userPrompt, 4096);

    type ParsedRaw = Record<string, unknown> & {
      club?: Record<string, unknown>;
      coach?: Record<string, unknown>;
      season?: Record<string, unknown>;
      leaguePosition?: Record<string, unknown>;
      moods?: { board?: Record<string, unknown>; fans?: Record<string, unknown>; dressingRoom?: Record<string, unknown> };
      finances?: Record<string, unknown>;
      prediction?: Record<string, unknown>;
    };
    let parsed: ParsedRaw;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]) as ParsedRaw;
    } catch {
      return res.status(500).json({ error: "AI returned invalid JSON" });
    }

    const clamp = (v: unknown, def: number) => {
      const n = Number(v);
      return isNaN(n) ? def : Math.max(0, Math.min(100, Math.round(n)));
    };
    const str = (v: unknown, def = "") => (typeof v === "string" ? v.trim() : def);
    const conf = (v: unknown): "low" | "medium" | "high" =>
      v === "low" || v === "high" ? v : "medium";
    const arr = <T>(v: unknown, mapFn: (x: Record<string, unknown> | string) => T | null): T[] =>
      Array.isArray(v) ? v.map((x) => mapFn(x as Record<string, unknown> | string)).filter((x): x is T => x !== null).slice(0, 16) : [];

    const moodObj = (raw: Record<string, unknown> | undefined, def = 50) => ({
      value: clamp(raw?.value, def),
      label: str(raw?.label),
      reason: str(raw?.reason),
    });
    const numOrNull = (v: unknown) => (typeof v === "number" && !isNaN(v) ? v : null);
    const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? v as Record<string, unknown> : {});

    const result = {
      club: {
        name: str(parsed.club?.name),
        league: str(parsed.club?.league),
        country: str(parsed.club?.country),
        confidence: conf(parsed.club?.confidence),
      },
      coach: {
        name: str(parsed.coach?.name),
        nationality: str(parsed.coach?.nationality),
        style: str(parsed.coach?.style),
        confidence: conf(parsed.coach?.confidence),
      },
      season: {
        label: str(parsed.season?.label),
        stage: str(parsed.season?.stage),
        matchday: typeof parsed.season?.matchday === "number" ? parsed.season.matchday : null,
        confidence: conf(parsed.season?.confidence),
      },
      leaguePosition: {
        rank: numOrNull(parsed.leaguePosition?.rank),
        points: numOrNull(parsed.leaguePosition?.points),
        form: str(parsed.leaguePosition?.form),
        recentForm: arr<string>(parsed.leaguePosition?.recentForm, (s) => {
          const v = typeof s === "string" ? s.trim().toUpperCase() : "";
          return v === "W" || v === "D" || v === "L" ? v : null;
        }),
        goalDifference: numOrNull(parsed.leaguePosition?.goalDifference),
        gap: str(parsed.leaguePosition?.gap),
        currentMatchday: numOrNull(parsed.leaguePosition?.currentMatchday),
        confidence: conf(parsed.leaguePosition?.confidence),
      },
      preferredFormation: str(parsed.preferredFormation),
      injuries: arr(parsed.injuries, (p) => {
        const o = obj(p); return o.name ? { name: str(o.name), weeks: numOrNull(o.weeks), note: str(o.note) } : null;
      }),
      trophiesWon: arr<string>(parsed.trophiesWon, (s) => typeof s === "string" && s.trim() ? s.trim() : null),
      ongoingCompetitions: arr(parsed.ongoingCompetitions, (c) => {
        const o = obj(c); return o.name ? { name: str(o.name), stage: str(o.stage), nextOpponent: str(o.nextOpponent) } : null;
      }),
      rivalsContext: arr(parsed.rivalsContext, (r) => {
        const o = obj(r); return o.name ? { name: str(o.name), context: str(o.context) } : null;
      }),
      narrativeArcs: arr(parsed.narrativeArcs, (n) => {
        const o = obj(n); return o.title ? { title: str(o.title), description: str(o.description), status: str(o.status) } : null;
      }),
      moods: {
        board: moodObj(parsed.moods?.board),
        fans: moodObj(parsed.moods?.fans),
        dressingRoom: moodObj(parsed.moods?.dressingRoom),
      },
      finances: {
        summary: str(parsed.finances?.summary),
        budget: str(parsed.finances?.budget),
        confidence: conf(parsed.finances?.confidence),
      },
      keyPlayers: arr(parsed.keyPlayers, (p) => { const o = obj(p); return o.name ? { name: str(o.name), role: str(o.role), note: str(o.note) } : null; }),
      transfersIn: arr(parsed.transfersIn, (p) => { const o = obj(p); return o.name ? { name: str(o.name), from: str(o.from), fee: str(o.fee), note: str(o.note) } : null; }),
      transfersOut: arr(parsed.transfersOut, (p) => { const o = obj(p); return o.name ? { name: str(o.name), to: str(o.to), fee: str(o.fee), note: str(o.note) } : null; }),
      rivals: arr<string>(parsed.rivals, (r) => typeof r === "string" && r.trim() ? r.trim() : null),
      recentMatches: arr(parsed.recentMatches, (m) => { const o = obj(m); return o.opponent ? { opponent: str(o.opponent), competition: str(o.competition), result: str(o.result), score: str(o.score), note: str(o.note) } : null; }),
      storyArc: str(parsed.storyArc),
      narrativeSummary: str(parsed.narrativeSummary),
      projeto: str(parsed.projeto),
      competitions: arr<string>(parsed.competitions, (c) => typeof c === "string" && c.trim() ? c.trim() : null),
      missions: arr(parsed.missions, (m) => { const o = obj(m); return o.title ? { title: str(o.title), description: str(o.description), deadline: str(o.deadline) } : null; }).slice(0, 5),
      boardLetter: str(parsed.boardLetter),
      prediction: {
        endOfSeason: str(parsed.prediction?.endOfSeason),
        boardReaction: str(parsed.prediction?.boardReaction),
        confidence: conf(parsed.prediction?.confidence),
      },
      inconsistencies: arr<string>(parsed.inconsistencies, (s) => typeof s === "string" && s.trim() ? s.trim() : null),
      deepeningQuestions: arr<string>(parsed.deepeningQuestions, (s) => typeof s === "string" && s.trim() ? s.trim() : null).slice(0, 5),
      squadSyncWarning: str(parsed.squadSyncWarning),
      overallConfidence: conf(parsed.overallConfidence),
      // legacy flat fields kept for backward compat
      boardMood: clamp(parsed.moods?.board?.value, 50),
      fanMood: clamp(parsed.moods?.fans?.value, 50),
      currentSeason: str(parsed.season?.label),
      confidence: conf(parsed.overallConfidence),
    };

    return res.json(result);
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
        initialContext: r.initialContextJson ? JSON.parse(r.initialContextJson) : undefined,
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
      initialContext?: object;
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
        initialContextJson: body.initialContext ? JSON.stringify(body.initialContext) : null,
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
      initialContext: object;
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
    if (body.initialContext !== undefined) patch.initialContextJson = JSON.stringify(body.initialContext);

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
