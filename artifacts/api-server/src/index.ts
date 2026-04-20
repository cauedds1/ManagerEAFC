import app from "./app";
import { logger } from "./lib/logger";
import { db, runMigrations, squadPlayersTable } from "@workspace/db";
import { ne, inArray, sql, like } from "drizzle-orm";
import { getStripeSync } from "./lib/stripeClient";
import { runMigrations as runStripeMigrations } from "stripe-replit-sync";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function applyMigrations() {
  const migrationsPath = process.env["MIGRATIONS_PATH"];
  if (!migrationsPath) {
    return;
  }
  try {
    await runMigrations(migrationsPath);
    logger.info({ migrationsPath }, "Database migrations applied");
  } catch (err) {
    logger.error({ err }, "Database migration failed — aborting startup");
    process.exit(1);
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }

  try {
    logger.info("Initializing Stripe schema...");
    await runStripeMigrations({ databaseUrl, schema: "stripe" });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : null;

    if (webhookBaseUrl) {
      logger.info({ webhookBaseUrl }, "Setting up managed Stripe webhook...");
      await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
      logger.info("Stripe webhook configured");
    }

    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data backfill complete"))
      .catch((err) => logger.warn({ err }, "Stripe backfill error (non-fatal)"));
  } catch (err) {
    logger.warn({ err }, "Stripe initialization failed (non-fatal) — check Stripe integration is connected");
  }
}

async function purgeInvalidSquadRows() {
  try {
    const deleted = await db
      .delete(squadPlayersTable)
      .where(ne(squadPlayersTable.source, "api-football@v2"))
      .returning({ teamId: squadPlayersTable.teamId });
    logger.info({ rows: deleted.length }, "Purged legacy squad rows on startup");
  } catch (err) {
    logger.warn({ err }, "Failed to purge legacy squad rows on startup (non-fatal)");
  }
}

async function migratePositionGroups() {
  try {
    const OLD_DEFENDER = ["CentreBack", "FullBack"];
    const OLD_MIDFIELDER = ["DefensiveMid", "CentralMid", "AttackingMid", "LeftWing", "RightWing", "SecondStriker"];
    const OLD_ATTACKER = ["Striker", "BroadForward"];

    let updated = 0;

    const defRes = await db
      .update(squadPlayersTable)
      .set({ position: "Defender", positionPtBr: "DEF" })
      .where(inArray(squadPlayersTable.position, OLD_DEFENDER))
      .returning({ id: sql<number>`1` });
    updated += defRes.length;

    const midRes = await db
      .update(squadPlayersTable)
      .set({ position: "Midfielder", positionPtBr: "MID" })
      .where(inArray(squadPlayersTable.position, OLD_MIDFIELDER))
      .returning({ id: sql<number>`1` });
    updated += midRes.length;

    const atkRes = await db
      .update(squadPlayersTable)
      .set({ position: "Attacker", positionPtBr: "ATA" })
      .where(inArray(squadPlayersTable.position, OLD_ATTACKER))
      .returning({ id: sql<number>`1` });
    updated += atkRes.length;

    if (updated > 0) {
      logger.info({ rows: updated }, "Migrated squad positions to 4-category system");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to migrate position groups (non-fatal)");
  }
}

async function clearCardPhotos() {
  try {
    const result = await db
      .update(squadPlayersTable)
      .set({ photo: "" })
      .where(like(squadPlayersTable.photo, "%ratings-images-prod.pulse.ea.com%"))
      .returning({ playerId: squadPlayersTable.playerId });
    if (result.length > 0) {
      logger.info({ rows: result.length }, "Cleared UT card photos from squad players");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to clear card photos (non-fatal)");
  }
}

applyMigrations()
  .then(purgeInvalidSquadRows)
  .then(migratePositionGroups)
  .then(clearCardPhotos)
  .then(initStripe)
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  });
