import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import jwt from "jsonwebtoken";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./lib/webhookHandlers";
import { handleStripeEvent } from "./lib/stripeWebhook";
import { handleLemonEvent, verifyLemonWebhookSignature } from "./lib/lemonWebhook";
import type Stripe from "stripe";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET ?? "fc-career-dev-secret-change-in-production";
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function blockImpersonatedWrites(req: Request, res: Response, next: NextFunction): void {
  if (!WRITE_METHODS.has(req.method)) { next(); return; }
  if (req.path.startsWith("/admin-panel/")) { next(); return; }
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) { next(); return; }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { impersonated?: boolean; demo?: boolean };
    if (payload.impersonated) {
      res.status(403).json({ error: "Operações de escrita não são permitidas em modo de visualização" });
      return;
    }
  } catch {
  }
  next();
}

const app: Express = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Secret"],
  }),
);

app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res) => {
      if (res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "silent";
    },
  }),
);

function fingerprintSecret(s: string | null | undefined): string {
  if (!s) return "<none>";
  if (s.length < 12) return `${s.slice(0, 3)}…(${s.length})`;
  return `${s.slice(0, 8)}…${s.slice(-4)}(${s.length})`;
}

app.post(
  "/api/lemon/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig = req.headers["x-signature"] as string | undefined;
    if (!sig) {
      res.status(400).json({ error: "Missing Lemon Squeezy signature" });
      return;
    }

    if (!verifyLemonWebhookSignature(req.body as Buffer, sig)) {
      logger.error("Lemon Squeezy webhook signature verification failed");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    res.json({ received: true });

    try {
      const payload = JSON.parse((req.body as Buffer).toString("utf-8"));
      await handleLemonEvent(payload);
    } catch (err) {
      logger.error({ err }, "Lemon Squeezy webhook processing error");
    }
  }
);

app.get("/api/stripe/webhook", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    message: "Stripe webhook endpoint is reachable. POST signed events here.",
  });
});

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).json({ error: "Missing Stripe signature" });
      return;
    }

    let event: Stripe.Event;
    try {
      const { getStripeSync } = await import("./lib/stripeClient");
      const stripeSync = await getStripeSync();
      if (!stripeSync) {
        logger.error("Stripe webhook called but getStripeSync() returned null");
        res.status(503).json({ error: "Stripe not initialized" });
        return;
      }

      const envSecret = process.env.STRIPE_WEBHOOK_SECRET ?? null;
      let dbSecret: string | null = null;
      try {
        const accountId = await stripeSync.getAccountId();
        const { db: pgDb } = await import("@workspace/db");
        const { sql: pgSql } = await import("drizzle-orm");
        const result = await pgDb.execute(
          pgSql`SELECT secret FROM stripe._managed_webhooks WHERE account_id = ${accountId} LIMIT 1`
        );
        const rows = (result as unknown as { rows: Record<string, unknown>[] }).rows;
        dbSecret = (rows?.[0]?.secret as string) ?? null;
      } catch (dbErr) {
        logger.warn({ err: dbErr }, "Could not fetch webhook secret from DB");
      }

      const candidates: Array<{ source: string; secret: string }> = [];
      if (dbSecret) candidates.push({ source: "managed_webhooks_db", secret: dbSecret });
      if (envSecret && envSecret !== dbSecret) {
        candidates.push({ source: "STRIPE_WEBHOOK_SECRET_env", secret: envSecret });
      }

      if (candidates.length === 0) {
        logger.error(
          "No webhook secret available — set STRIPE_WEBHOOK_SECRET or run findOrCreateManagedWebhook first",
        );
        res.status(503).json({ error: "Webhook secret not configured" });
        return;
      }

      let parsed: Stripe.Event | null = null;
      let lastErr: unknown = null;
      let usedSource = "";
      for (const c of candidates) {
        try {
          parsed = stripeSync.stripe.webhooks.constructEvent(
            req.body as Buffer,
            sig as string,
            c.secret,
          );
          usedSource = c.source;
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!parsed) {
        const msg = lastErr instanceof Error ? lastErr.message : "signature verification failed";
        logger.error(
          {
            err: lastErr,
            tried: candidates.map((c) => ({ source: c.source, fp: fingerprintSecret(c.secret) })),
          },
          `Webhook signature verification failed against all candidate secrets: ${msg}`,
        );
        res.status(400).json({ error: `Webhook Error: ${msg}` });
        return;
      }

      event = parsed;
      if (usedSource !== "managed_webhooks_db") {
        logger.warn(
          { usedSource, eventType: event.type },
          "Webhook verified via fallback secret source — env STRIPE_WEBHOOK_SECRET likely out of sync with managed webhook in DB",
        );
      }

      res.json({ received: true });

      try {
        await stripeSync.processEvent(event);
      } catch (syncErr) {
        logger.warn({ err: syncErr, eventType: event.type }, "Stripe sync error (non-fatal)");
      }

      try {
        await handleStripeEvent(event);
      } catch (bizErr) {
        logger.error({ err: bizErr, eventType: event.type }, "Stripe business logic error");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.error({ err }, `Webhook processing failed: ${msg}`);
      if (!res.headersSent) {
        res.status(400).json({ error: `Webhook Error: ${msg}` });
      }
    }
  },
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const trophiesDir = path.resolve(__dirname, "../public/trophies");
if (existsSync(trophiesDir)) {
  app.use("/trophies", express.static(trophiesDir, { maxAge: "30d" }));
}

app.use("/api", blockImpersonatedWrites, router);

const adminDist =
  process.env.ADMIN_DIST ??
  path.resolve(__dirname, "admin-panel");

if (existsSync(adminDist)) {
  app.use("/admin", express.static(adminDist));
  app.get(["/admin", "/admin/{*path}"], (_req, res) => {
    res.sendFile(path.join(adminDist, "index.html"));
  });
}

const frontendDist =
  process.env.FRONTEND_DIST ??
  path.resolve(__dirname, "../public");

if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
