/**
 * seed-demo.ts — Set up the demo account for FC Career Manager.
 *
 * Usage (Railway or local, pointing at prod DB):
 *   DATABASE_URL=postgresql://... GEMINI_API_KEY=AIza... pnpm seed:demo
 *
 * Required env:
 *   DATABASE_URL   — PostgreSQL connection string
 *   GEMINI_API_KEY — Google AI Studio key for EN translation
 *
 * What it does:
 *   1. Finds or creates demo@fc-career-manager.app user (plan=pro)
 *   2. Finds or clones the founder's Watford FC / Championship career
 *   3. Translates PT news posts → news_en (stored in season_data)
 *   4. Translates Carl Monsoon PT conversation → EN (stored in career_data)
 *
 * Run idempotently — re-running is safe.
 */

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

async function geminiTranslate(text: string): Promise<string> {
  const apiKey = process.env["GEMINI_API_KEY"] ?? process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Export it before running: GEMINI_API_KEY=AIza... pnpm seed:demo");
  }
  const baseUrl = process.env["GEMINI_BASE_URL"] ?? "https://generativelanguage.googleapis.com";
  const url = `${baseUrl.replace(/\/$/, "")}/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{
      role: "user",
      parts: [{
        text: `You are a professional sports journalist translator. Translate the following Brazilian Portuguese football content to English, preserving all formatting, emojis, structure, and tone. Do NOT alter names, club names, or data. Return ONLY the translated JSON (no markdown, no explanation).\n\n${text}`,
      }],
    }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
  });

  const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!resp.ok) throw new Error(`Gemini API error: ${resp.status} ${await resp.text()}`);
  const result = await resp.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}

async function translateNewsArray(posts: unknown[]): Promise<unknown[]> {
  if (!posts || posts.length === 0) return [];
  console.log(`  Translating ${posts.length} news posts…`);
  const translated: unknown[] = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    try {
      const ptJson = JSON.stringify(post, null, 2);
      const enJson = await geminiTranslate(ptJson);
      const parsed = JSON.parse(enJson) as unknown;
      translated.push(parsed);
      console.log(`    [${i + 1}/${posts.length}] ✓`);
    } catch (err) {
      console.warn(`    [${i + 1}/${posts.length}] ✗ Translation failed, using original:`, (err as Error).message);
      translated.push(post);
    }
  }
  return translated;
}

async function translateConversation(messages: unknown[]): Promise<unknown[]> {
  if (!messages || messages.length === 0) return [];
  console.log(`  Translating ${messages.length} conversation messages…`);
  const ptJson = JSON.stringify(messages, null, 2);
  try {
    const enJson = await geminiTranslate(ptJson);
    const parsed = JSON.parse(enJson) as unknown[];
    console.log(`  ✓ Conversation translated (${parsed.length} messages)`);
    return parsed;
  } catch (err) {
    console.warn("  ✗ Conversation translation failed, using original:", (err as Error).message);
    return messages;
  }
}

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  FC Career Manager — Demo Seed Script");
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

  // ── 2. Find or clone demo career ─────────────────────────────────────
  console.log("\n2. Finding or cloning demo career…");
  const existingDemoCareers = await db.select().from(careersTable).where(eq(careersTable.userId, demoUser.id)).limit(1);
  let demoCareerId: string;
  let demoSeasonId: string;

  if (existingDemoCareers.length > 0) {
    demoCareerId = existingDemoCareers[0].id;
    const seasons = await db.select().from(seasonsTable).where(eq(seasonsTable.careerId, demoCareerId)).limit(1);
    demoSeasonId = seasons[0]?.id ?? demoCareerId;
    console.log(`   ✓ Found existing demo career (id=${demoCareerId}, seasonId=${demoSeasonId})`);
  } else {
    console.log(`   Cloning from founder's career (${FOUNDER_CAREER_ID})…`);

    const [founderCareer] = await db.select().from(careersTable).where(eq(careersTable.id, FOUNDER_CAREER_ID)).limit(1);
    if (!founderCareer) {
      throw new Error(`Founder career not found: ${FOUNDER_CAREER_ID}`);
    }

    const founderSeasons = await db.select().from(seasonsTable).where(eq(seasonsTable.careerId, FOUNDER_CAREER_ID));
    const activeFounderSeason = founderSeasons.find(s => s.isActive) ?? founderSeasons[0];
    if (!activeFounderSeason) {
      throw new Error("No seasons found for founder career");
    }

    demoCareerId = nanoid(13);
    demoSeasonId = nanoid(13);

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
      userId: demoUser.id,
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

    // Clone season_data (news: 8 most recent only)
    const founderSeasonData = await db.select().from(seasonDataTable).where(eq(seasonDataTable.seasonId, FOUNDER_SEASON_ID));
    console.log(`   Cloning ${founderSeasonData.length} season_data rows…`);
    for (const row of founderSeasonData) {
      let valueJson = row.valueJson;
      if (row.key === "news") {
        try {
          const posts = JSON.parse(row.valueJson) as Array<{ createdAt?: number }>;
          // Sort by createdAt descending so the 8 newest are first
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

    // Clone career_data (diretoria_members: Carl only; skip other conv_member-* keys)
    const founderCareerData = await db.select().from(careerDataTable).where(eq(careerDataTable.careerId, FOUNDER_CAREER_ID));
    console.log(`   Cloning career_data rows (filtering)…`);
    let cloned = 0;
    let skipped = 0;
    for (const row of founderCareerData) {
      // Skip conv threads for members other than Carl Monsoon
      if (row.key.startsWith("conv_member-") && !row.key.startsWith(`conv_${CARL_MONSOON_ID}`)) {
        skipped++;
        continue;
      }
      let valueJson = row.valueJson;
      // Filter diretoria_members to Carl Monsoon only
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
  }

  // ── 3. Translate news → news_en ──────────────────────────────────────
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

  // ── 4. Translate Carl Monsoon conversation → EN ──────────────────────
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
