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

  const metaTier = (product.metadata?.planTier ?? "").toLowerCase();
  if (VALID_PLAN_TIERS[metaTier]) return VALID_PLAN_TIERS[metaTier];

  const name = product.name.toLowerCase();
  if (name.includes("ultra")) return "ultra";
  if (name.includes("pro")) return "pro";

  logger.warn({ priceId, productName: product.name }, "Price has no valid planTier and name doesn't match");
  return null;
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId = session.metadata?.userId;
        const isNewUser = session.metadata?.newUser === "true";
        const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;

        if (!userId && !isNewUser) {
          logger.warn({ sessionId: session.id }, "checkout.session.completed: no userId or newUser metadata");
          break;
        }

        let plan: "pro" | "ultra" | null = null;

        const metaPlanTier = (session.metadata?.planTier ?? "").toLowerCase();
        if (VALID_PLAN_TIERS[metaPlanTier]) {
          plan = VALID_PLAN_TIERS[metaPlanTier];
        } else {
          const stripe = await getUncachableStripeClient();
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
          const priceId = lineItems.data?.[0]?.price?.id ?? null;
          if (priceId) plan = await getPlanTierFromPriceId(priceId);
        }

        if (!plan) {
          logger.warn({ sessionId: session.id }, "checkout.session.completed: could not resolve planTier");
          break;
        }

        if (isNewUser) {
          const { userName, userEmail, userPasswordHash } = session.metadata ?? {};
          if (!userEmail || !userPasswordHash || !userName) {
            logger.warn({ sessionId: session.id }, "checkout.session.completed: newUser missing metadata fields");
            break;
          }

          const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, userEmail)).limit(1);
          if (existing.length === 0) {
            const [newUser] = await db.insert(usersTable).values({
              email: userEmail,
              passwordHash: userPasswordHash,
              name: userName,
              createdAt: Date.now(),
              plan,
              aiUsageCount: 0,
              aiUsageResetDate: "",
              ...(stripeCustomerId ? { stripeCustomerId } : {}),
            }).returning();
            logger.info({ userId: newUser.id, plan, stripeCustomerId }, "New user created via checkout.session.completed");
          } else {
            await db.update(usersTable)
              .set({ plan, ...(stripeCustomerId ? { stripeCustomerId } : {}) })
              .where(eq(usersTable.id, existing[0].id));
            logger.info({ userId: existing[0].id, plan }, "Existing user plan updated via checkout.session.completed");
          }
          break;
        }

        await db
          .update(usersTable)
          .set({ plan, ...(stripeCustomerId ? { stripeCustomerId } : {}) })
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
