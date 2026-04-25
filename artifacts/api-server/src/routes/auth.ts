import { Router } from "express";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import crypto from "crypto";
import { db, usersTable, careersTable, referralsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { requireAuth, signToken, signDemoToken, type AuthRequest } from "../middleware/auth";
import { getUncachableStripeClient } from "../lib/stripeClient";
import type Stripe from "stripe";

const router = Router();

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString("hex");
}

router.post("/auth/register", authRateLimit, async (req, res) => {
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
    let referralCode = generateReferralCode();
    // Retry once if collision (extremely rare)
    const codeExists = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, referralCode)).limit(1);
    if (codeExists.length > 0) referralCode = generateReferralCode();

    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name.trim(),
      createdAt: Date.now(),
      plan: "free",
      aiUsageCount: 0,
      aiUsageResetDate: "",
      referralCode,
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

router.post("/auth/login", authRateLimit, async (req, res) => {
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

    db.update(usersTable).set({ lastLoginAt: Date.now() }).where(eq(usersTable.id, user.id)).catch((err) => {
      console.error("Failed to update last_login_at:", err);
    });

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

    const { userName, userEmail, userPasswordHash, planTier, referralRef } = session.metadata ?? {};
    if (!userEmail || !userPasswordHash || !userName) {
      return res.status(400).json({ error: "Dados de registro não encontrados na sessão" });
    }

    const validPlan: "pro" | "ultra" = planTier === "ultra" ? "ultra" : "pro";
    const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;

    const existingRows = await db.select().from(usersTable).where(eq(usersTable.email, userEmail)).limit(1);

    let user: typeof existingRows[0];
    let isNewUser = false;

    if (existingRows.length > 0) {
      user = existingRows[0];
      if (user.plan === "free") {
        await db.update(usersTable)
          .set({ plan: validPlan, ...(stripeCustomerId ? { stripeCustomerId } : {}) })
          .where(eq(usersTable.id, user.id));
        user = { ...user, plan: validPlan };
      }
    } else {
      isNewUser = true;
      let referralCode = generateReferralCode();
      const codeExists = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, referralCode)).limit(1);
      if (codeExists.length > 0) referralCode = generateReferralCode();

      const [newUser] = await db.insert(usersTable).values({
        email: userEmail,
        passwordHash: userPasswordHash,
        name: userName,
        createdAt: Date.now(),
        plan: validPlan,
        aiUsageCount: 0,
        aiUsageResetDate: "",
        referralCode,
        ...(stripeCustomerId ? { stripeCustomerId } : {}),
      }).returning();
      user = newUser;
    }

    // Create referral record if referralRef code was provided and this is a paid plan
    if (referralRef && isNewUser) {
      try {
        const [referrer] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.referralCode, referralRef))
          .limit(1);
        if (referrer && referrer.id !== user.id) {
          await db.insert(referralsTable).values({
            referrerId: referrer.id,
            referredId: user.id,
            referredPlan: validPlan,
            status: "pending",
            createdAt: Date.now(),
          });
        }
      } catch (refErr) {
        console.error("Non-fatal: failed to create referral record:", refErr);
      }
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

// GET /api/referrals/my-link — returns authenticated user's referral link
router.get("/referrals/my-link", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    let [user] = await db
      .select({ id: usersTable.id, referralCode: usersTable.referralCode })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    // Lazy-generate referral code if missing (backfill for pre-existing users)
    if (!user.referralCode) {
      let code = generateReferralCode();
      const collision = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, code)).limit(1);
      if (collision.length > 0) code = generateReferralCode();
      await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, userId));
      user = { ...user, referralCode: code };
    }

    const origin = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:5000"}`;
    return res.json({ code: user.referralCode, url: `${origin}/?ref=${user.referralCode}` });
  } catch (err) {
    console.error("GET /referrals/my-link error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

const demoRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Muitas tentativas de demo. Tente novamente mais tarde." },
});

const DEMO_EMAIL = "demo@fc-career-manager.app";
const DEMO_NAME = "Demo Coach";

router.get("/auth/demo", demoRateLimit, async (_req, res) => {
  try {
    let demoUser = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, plan: usersTable.plan })
      .from(usersTable)
      .where(eq(usersTable.email, DEMO_EMAIL))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!demoUser) {
      const passwordHash = await bcrypt.hash(`demo-${Date.now()}`, 12);
      const [inserted] = await db.insert(usersTable).values({
        email: DEMO_EMAIL,
        passwordHash,
        name: DEMO_NAME,
        createdAt: Date.now(),
        plan: "pro",
        aiUsageCount: 0,
        aiUsageResetDate: "",
      }).returning();
      demoUser = inserted;
    }

    const token = signDemoToken({ id: demoUser.id, email: demoUser.email, name: demoUser.name, plan: demoUser.plan ?? "pro" });

    const careers = await db
      .select({ id: careersTable.id })
      .from(careersTable)
      .where(eq(careersTable.userId, demoUser.id))
      .limit(1);

    return res.json({
      token,
      user: { id: demoUser.id, email: demoUser.email, name: demoUser.name, plan: demoUser.plan ?? "pro" },
      careerId: careers[0]?.id ?? null,
    });
  } catch (err) {
    console.error("GET /auth/demo error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;
