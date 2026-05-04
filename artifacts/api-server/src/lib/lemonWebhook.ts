import { createHmac, timingSafeEqual } from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const PLAN_TIERS: Record<string, "pro" | "ultra"> = { pro: "pro", ultra: "ultra" };

function variantToPlanTier(variantId: string | number): "pro" | "ultra" | null {
  const id = String(variantId);
  const proId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID;
  const ultraId = process.env.LEMONSQUEEZY_ULTRA_VARIANT_ID;
  if (proId && id === proId) return "pro";
  if (ultraId && id === ultraId) return "ultra";
  return null;
}

export function verifyLemonWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return false;
  const hmac = createHmac("sha256", secret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

interface LemonSubPayload {
  meta: {
    event_name: string;
    custom_data?: { user_id?: string | number; plan_tier?: string };
  };
  data: {
    id: string;
    attributes: {
      customer_id: number;
      variant_id: number;
      status: string;
      urls?: { customer_portal?: string };
    };
  };
}

export async function handleLemonEvent(payload: LemonSubPayload): Promise<void> {
  const { event_name, custom_data } = payload.meta;
  const attrs = payload.data?.attributes;
  if (!attrs) return;

  const { customer_id, variant_id, status } = attrs;
  const userId = custom_data?.user_id ? Number(custom_data.user_id) : null;

  logger.info({ event_name, userId, variant_id, status, customer_id }, "Lemon Squeezy event received");

  switch (event_name) {
    case "subscription_created":
    case "subscription_updated": {
      if (status !== "active" && status !== "on_trial") break;

      const planTier = variantToPlanTier(variant_id) ?? (custom_data?.plan_tier ? PLAN_TIERS[custom_data.plan_tier] : null);
      if (!planTier) {
        logger.warn({ variant_id, custom_data }, "Lemon: could not resolve plan tier");
        break;
      }

      if (userId) {
        await db.update(usersTable)
          .set({ plan: planTier, lemonSqueezyCustomerId: String(customer_id) })
          .where(eq(usersTable.id, userId));
        logger.info({ userId, planTier, customer_id }, "Plan activated via Lemon Squeezy");
      } else {
        await db.update(usersTable)
          .set({ plan: planTier })
          .where(eq(usersTable.lemonSqueezyCustomerId, String(customer_id)));
        logger.info({ customer_id, planTier }, "Plan updated via Lemon Squeezy (by customer_id)");
      }
      break;
    }

    case "subscription_cancelled":
    case "subscription_expired":
    case "subscription_paused": {
      if (userId) {
        await db.update(usersTable)
          .set({ plan: "free" })
          .where(eq(usersTable.id, userId));
        logger.info({ userId }, "Plan downgraded to free via Lemon Squeezy");
      } else {
        await db.update(usersTable)
          .set({ plan: "free" })
          .where(eq(usersTable.lemonSqueezyCustomerId, String(customer_id)));
        logger.info({ customer_id }, "Plan downgraded to free via Lemon Squeezy (by customer_id)");
      }
      break;
    }

    default:
      logger.info({ event_name }, "Lemon Squeezy event ignored");
  }
}
