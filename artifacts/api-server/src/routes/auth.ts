import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, careersTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { requireAuth, signToken, type AuthRequest } from "../middleware/auth";
import { getUncachableStripeClient } from "../lib/stripeClient";
import type Stripe from "stripe";

const router = Router();

router.post("/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body as { email?: string; password?: string; name?: string };

    if (!email?.trim() || !password || !name?.trim()) {
      return res.status(400).json({ error: "Email, senha e nome são obrigatórios" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Este e-mail já está em uso" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name.trim(),
      createdAt: Date.now(),
      plan: "free",
      aiUsageCount: 0,
      aiUsageResetDate: "",
    }).returning();

    await db.update(careersTable)
      .set({ userId: user.id })
      .where(isNull(careersTable.userId));

    const token = signToken({ id: user.id, email: user.email, name: user.name, plan: user.plan });
    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
    });
  } catch (err) {
    console.error("POST /auth/register error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (!user) {
      return res.status(401).json({ error: "E-mail ou senha incorretos" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "E-mail ou senha incorretos" });
    }

    db.update(usersTable).set({ lastLoginAt: Date.now() }).where(eq(usersTable.id, user.id)).catch(() => {});

    const token = signToken({ id: user.id, email: user.email, name: user.name, plan: user.plan });
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
    });
  } catch (err) {
    console.error("POST /auth/login error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [freshUser] = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, plan: usersTable.plan })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id))
      .limit(1);

    if (!freshUser) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    return res.json({ user: freshUser });
  } catch (err) {
    console.error("GET /auth/me error:", err);
    return res.json({ user: req.user });
  }
});

router.post("/auth/from-checkout", async (req, res) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "sessionId obrigatório" });
    }

    const stripe = await getUncachableStripeClient();

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch {
      return res.status(400).json({ error: "Sessão de pagamento não encontrada" });
    }

    if (session.payment_status !== "paid" || session.status !== "complete") {
      return res.status(402).json({ error: "Pagamento ainda não confirmado. Aguarde alguns instantes." });
    }

    const { userName, userEmail, userPasswordHash, planTier } = session.metadata ?? {};
    if (!userEmail || !userPasswordHash || !userName) {
      return res.status(400).json({ error: "Dados de registro não encontrados na sessão" });
    }

    const validPlan: "pro" | "ultra" = planTier === "ultra" ? "ultra" : "pro";
    const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;

    const existingRows = await db.select().from(usersTable).where(eq(usersTable.email, userEmail)).limit(1);

    let user: typeof existingRows[0];

    if (existingRows.length > 0) {
      user = existingRows[0];
      if (user.plan === "free") {
        await db.update(usersTable)
          .set({ plan: validPlan, ...(stripeCustomerId ? { stripeCustomerId } : {}) })
          .where(eq(usersTable.id, user.id));
        user = { ...user, plan: validPlan };
      }
    } else {
      const [newUser] = await db.insert(usersTable).values({
        email: userEmail,
        passwordHash: userPasswordHash,
        name: userName,
        createdAt: Date.now(),
        plan: validPlan,
        aiUsageCount: 0,
        aiUsageResetDate: "",
        ...(stripeCustomerId ? { stripeCustomerId } : {}),
      }).returning();
      user = newUser;
    }

    const token = signToken({ id: user.id, email: user.email, name: user.name, plan: user.plan });
    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
    });
  } catch (err) {
    console.error("POST /auth/from-checkout error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;
