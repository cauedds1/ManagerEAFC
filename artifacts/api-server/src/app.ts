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
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { impersonated?: boolean };
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

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret || !sig) {
      res.status(400).json({ error: "Missing webhook secret or signature" });
      return;
    }

    let event: Stripe.Event;
    try {
      const { getStripeSync } = await import("./lib/stripeClient");
      const stripeSync = await getStripeSync();
      if (!stripeSync) {
        res.status(503).json({ error: "Stripe not initialized" });
        return;
      }
      event = stripeSync.stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        webhookSecret,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.error({ err }, `Webhook signature verification failed: ${msg}`);
      res.status(400).json({ error: `Webhook Error: ${msg}` });
      return;
    }

    try {
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch (err) {
      logger.error({ err }, "Stripe webhook handler error");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
