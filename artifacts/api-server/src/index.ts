import app from "./app";
import { logger } from "./lib/logger";
import { db, runMigrations, squadPlayersTable } from "@workspace/db";
import { inArray, sql, like } from "drizzle-orm";
import { getStripeSync } from "./lib/stripeClient";

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
    const { runMigrations: runStripeMigrations } = await import("stripe-replit-sync");
    await runStripeMigrations({ databaseUrl });
    logger.info("Stripe schema ready");
  } catch (err) {
    logger.warn({ err }, "Stripe schema migration failed (non-fatal)");
  }

  const isReplit = !!process.env.REPLIT_DOMAINS;

  try {
    const stripeSync = await getStripeSync();

    const webhookBaseUrl = isReplit
      ? `https://${process.env.REPLIT_DOMAINS!.split(",")[0]}`
      : process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : process.env.PUBLIC_DOMAIN
          ? `https://${process.env.PUBLIC_DOMAIN}`
          : null;

    const fp = (s: string | null | undefined): string => {
      if (!s) return "<none>";
      if (s.length < 12) return `${s.slice(0, 3)}…(${s.length})`;
      return `${s.slice(0, 8)}…${s.slice(-4)}(${s.length})`;
    };

    if (webhookBaseUrl) {
      const webhookUrl = `${webhookBaseUrl}/api/stripe/webhook`;
      logger.info({ webhookUrl }, "Setting up managed Stripe webhook...");
      try {
        const wh = await stripeSync.findOrCreateManagedWebhook(webhookUrl);
        logger.info(
          {
            webhookId: wh.id,
            webhookUrl: wh.url,
            status: wh.status,
            envSecretFp: fp(process.env.STRIPE_WEBHOOK_SECRET),
          },
          "Stripe webhook configured (DB-managed secret is the source of truth; env STRIPE_WEBHOOK_SECRET is only a fallback)",
        );
        if (process.env.STRIPE_WEBHOOK_SECRET) {
          logger.warn(
            "STRIPE_WEBHOOK_SECRET is set in env — if it differs from the managed webhook's secret in stripe._managed_webhooks, signature verification will fall back to env. Prefer unsetting it and relying on the managed webhook.",
          );
        }
      } catch (whErr) {
        logger.error({ err: whErr, webhookUrl }, "Failed to configure managed Stripe webhook");
      }
    } else {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.warn(
          "No public domain configured and STRIPE_WEBHOOK_SECRET not set — webhooks will be rejected. " +
          "Set RAILWAY_PUBLIC_DOMAIN or PUBLIC_DOMAIN for automatic webhook setup, or add STRIPE_WEBHOOK_SECRET to your environment."
        );
      } else {
        logger.info({ envSecretFp: fp(webhookSecret) }, "Stripe webhook secret configured (manual mode)");
      }
    }

    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data backfill complete"))
      .catch((err) => logger.warn({ err }, "Stripe backfill error (non-fatal)"));
  } catch (err) {
    logger.warn({ err }, "Stripe initialization failed (non-fatal) — check Stripe credentials are configured");
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

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM — shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("Received SIGINT — shutting down gracefully");
  process.exit(0);
});

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  applyMigrations()
    .then(migratePositionGroups)
    .then(clearCardPhotos)
    .then(initStripe)
    .catch((err) => logger.error({ err }, "Background startup tasks failed"));
});
