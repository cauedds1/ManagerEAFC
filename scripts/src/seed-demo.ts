/**
 * seed-demo.ts — Set up the demo account for FC Career Manager.
 *
 * Usage options:
 *
 *   1. Import from exported JSON file (recommended):
 *      DATABASE_URL=postgresql://... pnpm seed:demo --file ./watford-career-export.json
 *
 *   2. Clone from founder's career in DB (requires founder career to exist):
 *      DATABASE_URL=postgresql://... OPENAI_API_KEY=sk-... pnpm seed:demo
 *
 * Required env:
 *   DATABASE_URL   — PostgreSQL connection string
 *   OPENAI_API_KEY — (only needed for mode 2) OpenAI key for PT→EN translation
 *
 * Run idempotently — re-running is safe.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { db, usersTable, careersTable, seasonsTable, careerDataTable, seasonDataTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

function fakePasswordHash(): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(`demo-${Date.now()}-${salt}`).digest("hex");
  return `sha256:${salt}:${hash}`;
}

const DEMO_EMAIL = "demo@fc-career-manager.app";
const DEMO_NAME = "Demo Coach";

const FOUNDER_CAREER_ID = "mnvq8wxifkh6c";
const FOUNDER_SEASON_ID = "mnvq8wxifkh6c";
const CARL_MONSOON_ID = "member-mnvr58hs-udxh";

function nanoid(size = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < size; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

async function aiTranslate(text: string): Promise<string> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set.\n" +
      "Export it before running:\n" +
      "  OPENAI_API_KEY=sk-... DATABASE_URL=postgresql://... pnpm seed:demo"
    );
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 16384,
      messages: [{
        role: "system",
        content: "You are a professional sports journalist translator. Translate Brazilian Portuguese football content to English, preserving all formatting, emojis, structure, and tone. Do NOT alter names, club names, or data. Return ONLY the translated JSON (no markdown, no explanation).",
      }, {
        role: "user",
        content: text,
      }],
    }),
  });

  if (!resp.ok) throw new Error(`OpenAI API error: ${resp.status} ${await resp.text()}`);
  const result = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = result.choices?.[0]?.message?.content ?? "";
  return raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}

async function translateNewsArray(posts: unknown[]): Promise<unknown[]> {
  if (!posts || posts.length === 0) return [];
  const BATCH = 4;
  console.log(`  Translating ${posts.length} news posts (batch=${BATCH})…`);
  const results: unknown[] = [];
  for (let start = 0; start < posts.length; start += BATCH) {
    const batch = posts.slice(start, start + BATCH);
    const batchResults = await Promise.all(batch.map(async (post, j) => {
      const i = start + j;
      try {
        const ptJson = JSON.stringify(post, null, 2);
        const enJson = await aiTranslate(ptJson);
        const parsed = JSON.parse(enJson) as unknown;
        console.log(`    [${i + 1}/${posts.length}] ✓`);
        return parsed;
      } catch (err) {
        console.warn(`    [${i + 1}/${posts.length}] ✗ Translation failed, using original:`, (err as Error).message);
        return post;
      }
    }));
    results.push(...batchResults);
  }
  return results;
}

async function translateConversation(messages: unknown[]): Promise<unknown[]> {
  if (!messages || messages.length === 0) return [];
  console.log(`  Translating ${messages.length} conversation messages…`);
  const ptJson = JSON.stringify(messages, null, 2);
  try {
    const enJson = await aiTranslate(ptJson);
    const parsed = JSON.parse(enJson) as unknown[];
    console.log(`  ✓ Conversation translated (${parsed.length} messages)`);
    return parsed;
  } catch (err) {
    console.warn("  ✗ Conversation translation failed, using original:", (err as Error).message);
    return messages;
  }
}

interface ExportedCareer {
  exportVersion: number;
  exportedAt: number;
  career: {
    id: string;
    coachJson: string;
    clubId: number;
    clubName: string;
    clubLogo: string;
    clubLeague: string;
    clubCountry: string | null;
    clubStadium: string | null;
    clubFounded: number | null;
    clubPrimary: string | null;
    clubSecondary: string | null;
    clubDescription: string | null;
    clubTitlesJson: string | null;
    season: string;
    projeto: string | null;
    competitionsJson: string | null;
    currentSeasonId: string | null;
    createdAt: number;
    updatedAt: number;
  };
  seasons: Array<{
    id: string;
    careerId: string;
    label: string;
    competitionsJson: string | null;
    isActive: boolean;
    finalized: boolean | null;
    createdAt: number;
  }>;
  seasonData: Record<string, Array<{ key: string; valueJson: string }>>;
  careerData: Array<{ key: string; valueJson: string }>;
}

async function seedFromFile(filePath: string, demoUserId: number): Promise<{ demoCareerId: string; demoSeasonId: string }> {
  const absPath = resolve(filePath);
  console.log(`   Reading export file: ${absPath}`);
  const raw = readFileSync(absPath, "utf-8");
  const data = JSON.parse(raw) as ExportedCareer;

  if (!data.exportVersion || !data.career || !data.seasons) {
    throw new Error("Invalid export file format — missing required fields");
  }

  console.log(`   Imported career: ${data.career.clubName} / ${data.career.clubLeague}`);
  console.log(`   Seasons: ${data.seasons.length}, CareerData keys: ${data.careerData.length}`);

  const demoCareerId = nanoid(13);
  const seasonIdMap: Record<string, string> = {};

  for (const s of data.seasons) {
    seasonIdMap[s.id] = nanoid(13);
  }

  const activeSourceSeason = data.seasons.find((s) => s.isActive) ?? data.seasons[0];
  const demoSeasonId = activeSourceSeason ? seasonIdMap[activeSourceSeason.id] : nanoid(13);

  const mappedCurrentSeasonId = data.career.currentSeasonId
    ? (seasonIdMap[data.career.currentSeasonId] ?? demoSeasonId)
    : demoSeasonId;

  await db.insert(careersTable).values({
    id: demoCareerId,
    coachJson: data.career.coachJson,
    clubId: data.career.clubId,
    clubName: data.career.clubName,
    clubLogo: data.career.clubLogo,
    clubLeague: data.career.clubLeague,
    clubCountry: data.career.clubCountry ?? null,
    clubStadium: data.career.clubStadium ?? null,
    clubFounded: data.career.clubFounded ?? null,
    clubPrimary: data.career.clubPrimary ?? null,
    clubSecondary: data.career.clubSecondary ?? null,
    clubDescription: data.career.clubDescription ?? null,
    clubTitlesJson: data.career.clubTitlesJson ?? null,
    season: data.career.season,
    projeto: data.career.projeto ?? null,
    competitionsJson: data.career.competitionsJson ?? null,
    currentSeasonId: mappedCurrentSeasonId,
    userId: demoUserId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  for (const s of data.seasons) {
    const newSeasonId = seasonIdMap[s.id];
    await db.insert(seasonsTable).values({
      id: newSeasonId,
      careerId: demoCareerId,
      label: s.label,
      competitionsJson: s.competitionsJson ?? null,
      isActive: s.isActive,
      finalized: s.finalized ?? false,
      createdAt: s.createdAt ?? Date.now(),
    });

    const rows = data.seasonData[s.id] ?? [];
    for (const row of rows) {
      let valueJson = row.valueJson;
      if (row.key === "news") {
        try {
          const posts = JSON.parse(row.valueJson) as Array<{ createdAt?: number }>;
          const sorted = [...posts].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
          const limited = sorted.slice(0, 8);
          valueJson = JSON.stringify(limited);
          if (posts.length > 8) {
            console.log(`   → Limiting news: ${posts.length} → ${limited.length} posts (newest 8)`);
          }
        } catch {}
      }
      await db.insert(seasonDataTable).values({
        seasonId: newSeasonId,
        key: row.key,
        valueJson,
        updatedAt: Date.now(),
      }).onConflictDoNothing();
    }
  }

  for (const row of data.careerData) {
    await db.insert(careerDataTable).values({
      careerId: demoCareerId,
      key: row.key,
      valueJson: row.valueJson,
      updatedAt: Date.now(),
    }).onConflictDoNothing();
  }

  console.log(`   ✓ Imported career from file (id=${demoCareerId}, activeSeasonId=${demoSeasonId})`);
  return { demoCareerId, demoSeasonId };
}

async function seedFromFounder(demoUserId: number): Promise<{ demoCareerId: string; demoSeasonId: string }> {
  console.log(`   Cloning from founder's career (${FOUNDER_CAREER_ID})…`);

  const [founderCareer] = await db.select().from(careersTable).where(eq(careersTable.id, FOUNDER_CAREER_ID)).limit(1);
  if (!founderCareer) {
    throw new Error(
      `Founder career not found: ${FOUNDER_CAREER_ID}\n` +
      "Tip: use --file <path> to import from an exported JSON instead:\n" +
      "  pnpm seed:demo --file ./watford-career-export.json"
    );
  }

  const founderSeasons = await db.select().from(seasonsTable).where(eq(seasonsTable.careerId, FOUNDER_CAREER_ID));
  const activeFounderSeason = founderSeasons.find(s => s.isActive) ?? founderSeasons[0];
  if (!activeFounderSeason) {
    throw new Error("No seasons found for founder career");
  }

  const demoCareerId = nanoid(13);
  const demoSeasonId = nanoid(13);

  await db.insert(careersTable).values({
    id: demoCareerId,
    coachJson: founderCareer.coachJson,
    clubId: founderCareer.clubId,
    clubName: founderCareer.clubName,
    clubLogo: founderCareer.clubLogo,
    clubLeague: founderCareer.clubLeague,
    clubCountry: founderCareer.clubCountry,
    clubStadium: founderCareer.clubStadium,
    clubFounded: founderCareer.clubFounded,
    clubPrimary: founderCareer.clubPrimary,
    clubSecondary: founderCareer.clubSecondary,
    clubDescription: founderCareer.clubDescription,
    clubTitlesJson: founderCareer.clubTitlesJson,
    season: founderCareer.season,
    projeto: founderCareer.projeto,
    competitionsJson: founderCareer.competitionsJson,
    currentSeasonId: demoSeasonId,
    userId: demoUserId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  await db.insert(seasonsTable).values({
    id: demoSeasonId,
    careerId: demoCareerId,
    label: activeFounderSeason.label,
    competitionsJson: activeFounderSeason.competitionsJson,
    isActive: true,
    finalized: activeFounderSeason.finalized,
    createdAt: Date.now(),
  });

  const founderSeasonData = await db.select().from(seasonDataTable).where(eq(seasonDataTable.seasonId, FOUNDER_SEASON_ID));
  console.log(`   Cloning ${founderSeasonData.length} season_data rows…`);
  for (const row of founderSeasonData) {
    let valueJson = row.valueJson;
    if (row.key === "news") {
      try {
        const posts = JSON.parse(row.valueJson) as Array<{ createdAt?: number }>;
        const sorted = [...posts].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        const limited = sorted.slice(0, 8);
        valueJson = JSON.stringify(limited);
        console.log(`   → Limiting news: ${posts.length} → ${limited.length} posts (newest 8)`);
      } catch {}
    }
    await db.insert(seasonDataTable).values({
      seasonId: demoSeasonId,
      key: row.key,
      valueJson,
      updatedAt: Date.now(),
    }).onConflictDoNothing();
  }

  const founderCareerData = await db.select().from(careerDataTable).where(eq(careerDataTable.careerId, FOUNDER_CAREER_ID));
  console.log(`   Cloning career_data rows (filtering)…`);
  let cloned = 0;
  let skipped = 0;
  for (const row of founderCareerData) {
    if (row.key.startsWith("conv_member-") && !row.key.startsWith(`conv_${CARL_MONSOON_ID}`)) {
      skipped++;
      continue;
    }
    let valueJson = row.valueJson;
    if (row.key === "diretoria_members") {
      try {
        const members = JSON.parse(row.valueJson) as Array<{ id: string }>;
        const carlOnly = members.filter(m => m.id === CARL_MONSOON_ID);
        valueJson = JSON.stringify(carlOnly);
        console.log(`   → diretoria_members: ${members.length} → ${carlOnly.length} members`);
      } catch {}
    }
    await db.insert(careerDataTable).values({
      careerId: demoCareerId,
      key: row.key,
      valueJson,
      updatedAt: Date.now(),
    }).onConflictDoNothing();
    cloned++;
  }
  console.log(`   ✓ Cloned ${cloned} career_data rows, skipped ${skipped}`);
  console.log(`   ✓ Cloned career (id=${demoCareerId}, seasonId=${demoSeasonId})`);
  return { demoCareerId, demoSeasonId };
}

async function main() {
  const args = process.argv.slice(2);
  const fileArgIdx = args.indexOf("--file");
  const filePath = fileArgIdx !== -1 ? args[fileArgIdx + 1] : null;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  FC Career Manager — Demo Seed Script");
  if (filePath) {
    console.log(`  Mode: import from file (${filePath})`);
  } else {
    console.log("  Mode: clone from founder's career in DB");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── 1. Find or create demo user ──────────────────────────────────────
  console.log("1. Finding or creating demo user…");
  let [demoUser] = await db.select().from(usersTable).where(eq(usersTable.email, DEMO_EMAIL)).limit(1);
  if (!demoUser) {
    const passwordHash = fakePasswordHash();
    const [inserted] = await db.insert(usersTable).values({
      email: DEMO_EMAIL,
      passwordHash,
      name: DEMO_NAME,
      plan: "pro",
      createdAt: Date.now(),
    }).returning();
    demoUser = inserted;
    console.log(`   ✓ Created demo user (id=${demoUser.id})`);
  } else {
    if (demoUser.plan !== "pro") {
      await db.update(usersTable).set({ plan: "pro" }).where(eq(usersTable.id, demoUser.id));
    }
    console.log(`   ✓ Found demo user (id=${demoUser.id})`);
  }

  // ── 2. Find or create demo career ────────────────────────────────────
  console.log("\n2. Finding or creating demo career…");
  const existingDemoCareers = await db.select().from(careersTable).where(eq(careersTable.userId, demoUser.id)).limit(1);
  let demoCareerId: string;
  let demoSeasonId: string;

  if (existingDemoCareers.length > 0) {
    demoCareerId = existingDemoCareers[0].id;
    const seasons = await db.select().from(seasonsTable).where(eq(seasonsTable.careerId, demoCareerId)).limit(1);
    demoSeasonId = seasons[0]?.id ?? demoCareerId;
    console.log(`   ✓ Found existing demo career (id=${demoCareerId}, seasonId=${demoSeasonId})`);
  } else {
    if (filePath) {
      const result = await seedFromFile(filePath, demoUser.id);
      demoCareerId = result.demoCareerId;
      demoSeasonId = result.demoSeasonId;
    } else {
      const result = await seedFromFounder(demoUser.id);
      demoCareerId = result.demoCareerId;
      demoSeasonId = result.demoSeasonId;
    }
  }

  // ── 3. Translate news → news_en ──────────────────────────────────────
  {
    console.log("\n3. Translating news to English…");
    const [newsRow] = await db.select().from(seasonDataTable)
      .where(and(eq(seasonDataTable.seasonId, demoSeasonId), eq(seasonDataTable.key, "news")))
      .limit(1);

    const [newsEnRow] = await db.select().from(seasonDataTable)
      .where(and(eq(seasonDataTable.seasonId, demoSeasonId), eq(seasonDataTable.key, "news_en")))
      .limit(1);

    if (!newsRow) {
      console.log("   ⚠  No news data found — skipping");
    } else if (newsEnRow) {
      console.log("   ✓ news_en already exists — skipping");
    } else {
      const posts = JSON.parse(newsRow.valueJson) as unknown[];
      const enPosts = await translateNewsArray(posts);
      await db.insert(seasonDataTable).values({
        seasonId: demoSeasonId,
        key: "news_en",
        valueJson: JSON.stringify(enPosts),
        updatedAt: Date.now(),
      }).onConflictDoUpdate({ target: [seasonDataTable.seasonId, seasonDataTable.key], set: { valueJson: JSON.stringify(enPosts), updatedAt: Date.now() } });
      console.log(`   ✓ Stored news_en (${enPosts.length} posts)`);
    }

    // ── 4. Translate Carl Monsoon conversation → EN ───────────────────
    const convKey = `conv_${CARL_MONSOON_ID}`;
    const convEnKey = `conv_${CARL_MONSOON_ID}_en`;
    console.log(`\n4. Translating Carl Monsoon conversation (${convKey})…`);

    const [convRow] = await db.select().from(careerDataTable)
      .where(and(eq(careerDataTable.careerId, demoCareerId), eq(careerDataTable.key, convKey)))
      .limit(1);

    const [convEnRow] = await db.select().from(careerDataTable)
      .where(and(eq(careerDataTable.careerId, demoCareerId), eq(careerDataTable.key, convEnKey)))
      .limit(1);

    if (!convRow) {
      console.log("   ⚠  No conversation data found — skipping");
    } else if (convEnRow) {
      console.log("   ✓ conv_en already exists — skipping");
    } else {
      const messages = JSON.parse(convRow.valueJson) as unknown[];
      const enMessages = await translateConversation(messages);
      await db.insert(careerDataTable).values({
        careerId: demoCareerId,
        key: convEnKey,
        valueJson: JSON.stringify(enMessages),
        updatedAt: Date.now(),
      }).onConflictDoUpdate({ target: [careerDataTable.careerId, careerDataTable.key], set: { valueJson: JSON.stringify(enMessages), updatedAt: Date.now() } });
      console.log(`   ✓ Stored conv_en (${enMessages.length} messages)`);
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Demo setup complete!`);
  console.log(`  User: ${DEMO_EMAIL} (id=${demoUser.id})`);
  console.log(`  Career ID: ${demoCareerId}`);
  console.log(`  Season ID: ${demoSeasonId}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err);
  process.exit(1);
});
