import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { getUncachableStripeClient } from "../lib/stripeClient";
import type Stripe from "stripe";
import bcrypt from "bcryptjs";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? (
  process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "http://localhost:3000"
);

const ALLOWED_PLAN_TIERS = new Set(["pro", "ultra"]);

const _parsedTTL = parseInt(process.env.STRIPE_PLANS_CACHE_TTL_MINUTES ?? "5", 10);
const PLANS_CACHE_TTL_MS = (Number.isFinite(_parsedTTL) && _parsedTTL > 0 ? _parsedTTL : 5) * 60 * 1000;

type PlanEntry = { planTier: string; priceId: string; unitAmount: number; currency: string };
let plansCache: { data: PlanEntry[]; expiresAt: number } | null = null;

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
      success_url: `${FRONTEND_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
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

router.post("/stripe/checkout-register", async (req, res) => {
  try {
    const { name, email, password, priceId } = req.body as {
      name?: string; email?: string; password?: string; priceId?: string;
    };

    if (!name?.trim() || !email?.trim() || !password || !priceId) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
    }
    if (!priceId.startsWith("price_")) {
      return res.status(400).json({ error: "priceId inválido" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Este e-mail já está em uso" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const stripe = await getUncachableStripeClient();

    let price: Stripe.Price;
    try {
      price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    } catch {
      return res.status(400).json({ error: "Preço não encontrado no Stripe" });
    }

    if (!price.active || price.type !== "recurring") {
      return res.status(400).json({ error: "Preço inválido para assinatura" });
    }

    const product = price.product as Stripe.Product;
    const metaTier = (product.metadata?.planTier ?? "").toLowerCase();
    let planTier: string | null = ALLOWED_PLAN_TIERS.has(metaTier) ? metaTier : null;
    if (!planTier) {
      const pName = product.name.toLowerCase();
      if (pName.includes("ultra")) planTier = "ultra";
      else if (pName.includes("pro")) planTier = "pro";
    }
    if (!planTier) {
      return res.status(400).json({ error: "Este preço não corresponde a um plano válido" });
    }

    const existingCustomers = await stripe.customers.search({
      query: `email:'${normalizedEmail}'`,
      limit: 1,
    });
    let customerId: string;
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      const customer = await stripe.customers.create({ email: normalizedEmail, name: name.trim() });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${FRONTEND_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/?checkout=cancel`,
      metadata: {
        newUser: "true",
        userName: name.trim(),
        userEmail: normalizedEmail,
        userPasswordHash: passwordHash,
        planTier,
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("POST /stripe/checkout-register error:", err);
    return res.status(500).json({ error: "Erro ao criar sessão de pagamento" });
  }
});

router.get("/stripe/products-with-plan", async (_req, res) => {
  try {
    const now = Date.now();

    if (plansCache && now < plansCache.expiresAt) {
      console.log("GET /stripe/products-with-plan — retornando do cache");
      return res.json(plansCache.data);
    }

    const stripe = await getUncachableStripeClient();

    const [productsResp, pricesResp] = await Promise.all([
      stripe.products.list({ active: true, limit: 100 }),
      stripe.prices.list({ active: true, limit: 100, type: "recurring" }),
    ]);

    const productMap = new Map(productsResp.data.map((p) => [p.id, p]));

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
      if (price.unit_amount == null) continue;

      plans.push({
        planTier,
        priceId: price.id,
        unitAmount: price.unit_amount,
        currency: price.currency,
      });
    }

    plans.sort((a, b) => a.unitAmount - b.unitAmount);
    plansCache = { data: plans, expiresAt: now + PLANS_CACHE_TTL_MS };
    console.log("GET /stripe/products-with-plan — planos encontrados:", plans.length, plans.map(p => ({ tier: p.planTier, priceId: p.priceId, amount: p.unitAmount })));
    return res.json(plans);
  } catch (err) {
    console.error("GET /stripe/products-with-plan error:", err);
    return res.status(500).json({ error: "Falha ao buscar planos" });
  }
});

export default router;
