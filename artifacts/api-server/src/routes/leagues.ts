import { Router } from "express";
import { db, clubInfoCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isR2Configured } from "../lib/r2Storage";

const router = Router();

const ALL_LEAGUE_IDS = [
  39, 40, 41, 42, 78, 79, 61, 135, 140, 141, 88, 94, 128, 144, 169, 179, 188,
  207, 218, 253, 283, 292, 307, 357, 106, 113, 103, 119,
  2, 3, 848, 13,
];

const R2_LEAGUE_CACHE_KEY = "r2-league-logos";

/**
 * Persists the set of successfully cached league IDs to the DB.
 * Used by the admin cache endpoint to record which leagues have R2 copies.
 */
export async function saveLeagueCacheRecord(cachedIds: number[]): Promise<void> {
  const value = JSON.stringify({ cachedIds, cachedAt: Date.now() });
  await db
    .insert(clubInfoCacheTable)
    .values({
      cacheKey: R2_LEAGUE_CACHE_KEY,
      description: value,
      titlesJson: "[]",
      createdAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: clubInfoCacheTable.cacheKey,
      set: { description: value },
    });
}

/**
 * GET /api/league-logos
 * Returns a map of leagueId → logoUrl.
 * Only returns R2 URLs for leagues that have been successfully cached by the admin
 * (tracked in club_info_cache). Falls back to media.api-sports.io for uncached leagues.
 * Public endpoint — no auth required.
 */
router.get("/league-logos", async (req, res) => {
  const result: Record<number, string> = {};
  const { R2_PUBLIC_URL } = process.env;

  let cachedLeagueIds = new Set<number>();

  if (isR2Configured() && R2_PUBLIC_URL) {
    try {
      const [row] = await db
        .select({ description: clubInfoCacheTable.description })
        .from(clubInfoCacheTable)
        .where(eq(clubInfoCacheTable.cacheKey, R2_LEAGUE_CACHE_KEY))
        .limit(1);

      if (row) {
        const parsed = JSON.parse(row.description) as { cachedIds?: number[] };
        cachedLeagueIds = new Set(parsed.cachedIds ?? []);
      }
    } catch {
      // DB error — fall back to all api-sports.io URLs
    }

    const base = R2_PUBLIC_URL.replace(/\/$/, "");
    for (const id of ALL_LEAGUE_IDS) {
      result[id] = cachedLeagueIds.has(id)
        ? `${base}/cached-images/leagues/${id}.png`
        : `https://media.api-sports.io/football/leagues/${id}.png`;
    }
  } else {
    for (const id of ALL_LEAGUE_IDS) {
      result[id] = `https://media.api-sports.io/football/leagues/${id}.png`;
    }
  }

  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json(result);
});

export default router;
