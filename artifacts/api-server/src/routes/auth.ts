import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, careersTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { requireAuth, signToken, type AuthRequest } from "../middleware/auth";

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

router.get("/auth/me", requireAuth, (req: AuthRequest, res) => {
  return res.json({ user: req.user });
});

export default router;
