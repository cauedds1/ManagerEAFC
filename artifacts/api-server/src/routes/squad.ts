import { Router } from "express";
import { db, squadPlayersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const SQUAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SquadPlayerBody {
  id: number;
  name: string;
  age: number;
  position: string;
  positionPtBr: string;
  photo: string;
  number?: number;
}

router.get("/squad/:teamId", async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId ?? "", 10);
    if (isNaN(teamId) || teamId <= 0) {
      return res.status(400).json({ error: "Invalid teamId" });
    }

    const rows = await db
      .select()
      .from(squadPlayersTable)
      .where(eq(squadPlayersTable.teamId, teamId));

    if (rows.length === 0) return res.status(204).end();

    const cachedAt = Number(rows[0].cachedAt);
    if (Date.now() - cachedAt > SQUAD_TTL_MS) return res.status(204).end();

    // schemaVersion is encoded in source as "api-football@v2" or "fc26@v2"
    const [rawSource, schemaVersion = null] = rows[0].source.split("@");

    return res.json({
      players: rows.map((r) => ({
        id: r.playerId,
        name: r.name,
        age: r.age,
        position: r.position,
        positionPtBr: r.positionPtBr,
        photo: r.photo,
        number: r.playerNumber ?? undefined,
      })),
      source: rawSource,
      cachedAt,
      schemaVersion,
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
      players?: SquadPlayerBody[];
      source?: string;
      cachedAt?: number;
      schemaVersion?: string;
    };

    const { players, source, cachedAt, schemaVersion } = body;
    if (!Array.isArray(players) || typeof source !== "string" || typeof cachedAt !== "number") {
      return res.status(400).json({ error: "players, source, and cachedAt required" });
    }

    if (players.length === 0) {
      return res.status(400).json({ error: "players array must not be empty" });
    }

    // Encode schemaVersion into the source column: "api-football@v2" / "fc26@v2"
    const storedSource = schemaVersion ? `${source}@${schemaVersion}` : source;

    const values = players.map((p) => ({
      teamId,
      playerId: p.id,
      name: p.name,
      age: p.age ?? 0,
      position: p.position,
      positionPtBr: p.positionPtBr,
      photo: p.photo ?? "",
      playerNumber: p.number ?? null,
      source: storedSource,
      cachedAt,
    }));

    await db.transaction(async (tx) => {
      await tx.delete(squadPlayersTable).where(eq(squadPlayersTable.teamId, teamId));
      const CHUNK = 100;
      for (let i = 0; i < values.length; i += CHUNK) {
        await tx.insert(squadPlayersTable).values(values.slice(i, i + CHUNK));
      }
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("PUT /squad/:teamId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
