import { Router } from "express";
import { isR2Configured } from "../lib/r2Storage";

const router = Router();

const ALL_LEAGUE_IDS = [
  39, 40, 41, 42, 78, 79, 61, 135, 140, 141, 88, 94, 128, 144, 169, 179, 188,
  207, 218, 253, 283, 292, 307, 357, 106, 113, 103, 119,
  2, 3, 848, 13,
];

/**
 * GET /api/league-logos
 * Returns a map of leagueId → logoUrl.
 * When R2 is configured, returns R2 URLs (requires admin to have run cache-league-logos first).
 * Falls back to media.api-sports.io URLs when R2 is not configured.
 * Public endpoint — no auth required.
 */
router.get("/league-logos", (req, res) => {
  const result: Record<number, string> = {};
  const { R2_PUBLIC_URL } = process.env;

  if (isR2Configured() && R2_PUBLIC_URL) {
    const base = R2_PUBLIC_URL.replace(/\/$/, "");
    for (const id of ALL_LEAGUE_IDS) {
      result[id] = `${base}/cached-images/leagues/${id}.png`;
    }
  } else {
    for (const id of ALL_LEAGUE_IDS) {
      result[id] = `https://media.api-sports.io/football/leagues/${id}.png`;
    }
  }

  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.json(result);
});

export default router;
