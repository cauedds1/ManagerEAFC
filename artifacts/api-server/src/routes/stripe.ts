import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { getUncachableStripeClient } from "../lib/stripeClient";
import type Stripe from "stripe";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? (
  process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "http://localhost:3000"
);

const ALLOWED_PLAN_TIERS = new Set(["pro", "ultra"]);

router.post("/stripe/checkout", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { priceId } = req.body as { priceId?: string };
    if (!priceId || typeof priceId !== "string" || !priceId.startsWith("price_")) {
      return res.status(400).json({ error: "priceId inválido" });
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const stripe = await getUncachableStripeClient();

    let price: Stripe.Price;
    try {
      price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    } catch {
      return res.status(400).json({ error: "Preço não encontrado no Stripe" });
    }

    const product = price.product as Stripe.Product;
    const planTier = product.metadata?.planTier;

    if (!planTier || !ALLOWED_PLAN_TIERS.has(planTier)) {
      return res.status(400).json({ error: "Este preço não corresponde a um plano válido" });
    }

    if (!price.active) {
      return res.status(400).json({ error: "Este preço não está mais disponível" });
    }

    if (price.currency !== "brl" || price.type !== "recurring") {
      return res.status(400).json({ error: "Preço inválido para assinatura BRL" });
    }

    if (price.recurring?.interval !== "month") {
      return res.status(400).json({ error: "Apenas assinaturas mensais são aceitas" });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const existingCustomers = await stripe.customers.search({
        query: `email:'${user.email}'`,
        limit: 1,
      });
      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId: String(user.id) },
        });
        customerId = customer.id;
      }
      await db
        .update(usersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(usersTable.id, user.id));
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${FRONTEND_URL}/?checkout=success`,
      cancel_url: `${FRONTEND_URL}/?checkout=cancel`,
      metadata: {
        userId: String(user.id),
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("POST /stripe/checkout error:", err);
    return res.status(500).json({ error: "Erro ao criar sessão de pagamento" });
  }
});

router.post("/stripe/portal", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id))
      .limit(1);

    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: "Nenhuma assinatura encontrada" });
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: FRONTEND_URL,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("POST /stripe/portal error:", err);
    return res.status(500).json({ error: "Erro ao abrir portal de assinatura" });
  }
});

router.get("/stripe/subscription", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id))
      .limit(1);

    if (!user?.stripeCustomerId) {
      return res.json({ subscription: null });
    }

    const result = await db.execute(
      sql`
        SELECT
          s.id,
          s.status,
          s.current_period_end,
          s.cancel_at_period_end,
          p.metadata as price_metadata,
          pr.metadata as product_metadata,
          pr.name as product_name
        FROM stripe.subscriptions s
        LEFT JOIN stripe.prices p ON p.id = s.items->0->>'price'
        LEFT JOIN stripe.products pr ON pr.id = p.product
        WHERE s.customer = ${user.stripeCustomerId}
          AND s.status = 'active'
        ORDER BY s.created DESC
        LIMIT 1
      `
    );

    const sub = (result as unknown as { rows: Record<string, unknown>[] }).rows?.[0] ?? null;
    return res.json({ subscription: sub });
  } catch (err) {
    console.error("GET /stripe/subscription error:", err);
    return res.json({ subscription: null });
  }
});

router.get("/stripe/products-with-plan", requireAuth, async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();

    const [productsResp, pricesResp] = await Promise.all([
      stripe.products.list({ active: true, limit: 100 }),
      stripe.prices.list({ active: true, limit: 100, type: "recurring" }),
    ]);

    const productMap = new Map(productsResp.data.map((p) => [p.id, p]));

    type PlanEntry = { planTier: string; priceId: string; unitAmount: number; currency: string };
    const plans: PlanEntry[] = [];

    for (const price of pricesResp.data) {
      const productId = typeof price.product === "string" ? price.product : price.product?.id;
      if (!productId) continue;
      const product = productMap.get(productId);
      if (!product) continue;

      const metaTier = (product.metadata?.planTier ?? "").toLowerCase();
      let planTier: string | null = ALLOWED_PLAN_TIERS.has(metaTier) ? metaTier : null;

      if (!planTier) {
        const name = product.name.toLowerCase();
        if (name.includes("ultra")) planTier = "ultra";
        else if (name.includes("pro")) planTier = "pro";
      }

      if (!planTier) continue;

      plans.push({
        planTier,
        priceId: price.id,
        unitAmount: price.unit_amount ?? 0,
        currency: price.currency,
      });
    }

    plans.sort((a, b) => a.unitAmount - b.unitAmount);
    console.log("GET /stripe/products-with-plan — planos encontrados:", plans.length, plans.map(p => ({ tier: p.planTier, priceId: p.priceId, amount: p.unitAmount })));
    return res.json(plans);
  } catch (err) {
    console.error("GET /stripe/products-with-plan error:", err);
    return res.status(500).json({ error: "Falha ao buscar planos" });
  }
});

export default router;
