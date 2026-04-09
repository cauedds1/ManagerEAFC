import { Router, type Request, type Response } from "express";

const router = Router();

router.get("/proxy/image", async (req: Request, res: Response) => {
  const url = req.query.url as string | undefined;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing url query parameter" });
    return;
  }

  try {
    const parsed = new URL(url);
    const allowed = ["media.api-sports.io", "v3.football.api-sports.io", "cdn.sofifa.net", "ratings-images-prod.pulse.ea.com"];
    if (!allowed.some((h) => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
      res.status(403).json({ error: "Domain not allowed" });
      return;
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "FCCareerManager/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "Upstream error" });
      return;
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.set("Access-Control-Allow-Origin", "*");
    res.send(buffer);
  } catch {
    res.status(502).json({ error: "Failed to fetch image" });
  }
});

export default router;
