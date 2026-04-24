import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import jwt from "jsonwebtoken";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./lib/webhookHandlers";
import { handleStripeEvent } from "./lib/stripeWebhook";
import type Stripe from "stripe";

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

const isProd = process.env.NODE_ENV === "production";

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "blob:", "https:"],
      "media-src": ["'self'", "blob:", "https:"],
      "connect-src": ["'self'", "https:", "blob:"],
    },
  },
}));

const allowedOrigins = isProd
  ? [process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(Boolean) as string[]
  : true;

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature" });
    }

    const sig = Array.isArray(signature) ? signature[0] : signature;

    if (!Buffer.isBuffer(req.body)) {
      logger.error("Webhook body is not a Buffer — express.json() ran before webhook route");
      return res.status(500).json({ error: "Webhook processing error" });
    }

    try {
      let event: Stripe.Event;

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (webhookSecret) {
        const { getUncachableStripeClient } = await import("./lib/stripeClient");
        const stripe = await getUncachableStripeClient();
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
      } else {
        await WebhookHandlers.processWebhook(req.body as Buffer, sig);
        event = JSON.parse(req.body.toString()) as Stripe.Event;
      }

      await handleStripeEvent(event);

      return res.status(200).json({ received: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err }, "Stripe webhook error");
      return res.status(400).json({ error: msg });
    }
  }
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
