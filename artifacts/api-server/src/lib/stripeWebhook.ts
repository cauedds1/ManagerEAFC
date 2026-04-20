import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { getUncachableStripeClient } from "./stripeClient";
import type Stripe from "stripe";

const VALID_PLAN_TIERS: Record<string, "pro" | "ultra"> = {
  pro: "pro",
  ultra: "ultra",
};

async function getPlanTierFromPriceId(priceId: string): Promise<"pro" | "ultra" | null> {
  const stripe = await getUncachableStripeClient();
  const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  const product = price.product as Stripe.Product;
  const planTier = product.metadata?.planTier;
  if (!planTier || !VALID_PLAN_TIERS[planTier]) {
    logger.warn({ priceId, planTier }, "Price has no valid planTier metadata");
    return null;
  }
  return VALID_PLAN_TIERS[planTier];
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId = session.metadata?.userId;
        const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;

        if (!userId) {
          logger.warn({ sessionId: session.id }, "checkout.session.completed missing userId metadata");
          break;
        }

        const stripe = await getUncachableStripeClient();
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        const priceId = lineItems.data?.[0]?.price?.id ?? null;

        let plan: "pro" | "ultra" | null = null;

        if (priceId) {
          plan = await getPlanTierFromPriceId(priceId);
        }

        if (!plan) {
          logger.warn({ sessionId: session.id, priceId }, "checkout.session.completed: could not resolve planTier from price_id");
          break;
        }

        await db
          .update(usersTable)
          .set({
            plan,
            ...(stripeCustomerId ? { stripeCustomerId } : {}),
          })
          .where(eq(usersTable.id, Number(userId)));

        logger.info({ userId, plan, stripeCustomerId }, "Plan activated via checkout.session.completed");
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        if (!customerId) break;

        if (subscription.status !== "active") break;

        const priceId = subscription.items?.data?.[0]?.price?.id;
        if (!priceId) break;

        const plan = await getPlanTierFromPriceId(priceId);
        if (!plan) break;

        await db
          .update(usersTable)
          .set({ plan, stripeCustomerId: customerId })
          .where(eq(usersTable.stripeCustomerId, customerId));

        logger.info({ customerId, plan }, "Plan updated via customer.subscription.updated");
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        if (!customerId) break;

        await db
          .update(usersTable)
          .set({ plan: "free" })
          .where(eq(usersTable.stripeCustomerId, customerId));

        logger.info({ customerId }, "Plan downgraded to free via subscription.deleted");
        break;
      }

      default:
        break;
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Error handling Stripe event");
    throw err;
  }
}
