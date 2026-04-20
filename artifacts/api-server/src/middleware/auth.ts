import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET ?? "fc-career-dev-secret-change-in-production";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  plan: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de autenticação necessário" });
    return;
  }

  const token = header.slice(7);

  let payload: AuthUser & { iat?: number; exp?: number };
  try {
    payload = jwt.verify(token, JWT_SECRET) as AuthUser & { iat?: number; exp?: number };
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, plan: usersTable.plan })
    .from(usersTable)
    .where(eq(usersTable.id, payload.id))
    .limit(1)
    .then(([user]) => {
      if (!user) {
        res.status(401).json({ error: "Usuário não encontrado" });
        return;
      }
      req.user = { id: user.id, email: user.email, name: user.name, plan: user.plan ?? "free" };
      next();
    })
    .catch(() => {
      req.user = { id: payload.id, email: payload.email, name: payload.name, plan: payload.plan ?? "free" };
      next();
    });
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "30d" });
}
