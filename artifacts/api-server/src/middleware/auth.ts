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
  impersonated?: boolean;
  demo?: boolean;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de autenticação necessário" });
    return;
  }

  const token = header.slice(7);

  let payload: AuthUser & { iat?: number; exp?: number; impersonated?: boolean; demo?: boolean };
  try {
    payload = jwt.verify(token, JWT_SECRET) as AuthUser & { iat?: number; exp?: number; impersonated?: boolean; demo?: boolean };
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  if (payload.impersonated) {
    const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
    if (writeMethods.includes(req.method)) {
      res.status(403).json({ error: "Operações de escrita não são permitidas em modo de visualização" });
      return;
    }
    req.user = { id: payload.id, email: payload.email, name: payload.name, plan: payload.plan ?? "free" };
    req.impersonated = true;
    next();
    return;
  }

  if (payload.demo) {
    const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
    if (writeMethods.includes(req.method)) {
      const aiPaths = [
        "/noticias/generate",
        "/noticias/generate-rumor",
        "/noticias/generate-leak",
        "/noticias/generate-welcome",
        "/noticias/generate-image",
        "/diretoria/chat",
        "/diretoria/meeting",
        "/diretoria/check-triggers",
        "/diretoria/suggest-transfer",
        "/generate-projeto",
      ];
      const isAiRoute = aiPaths.some((p) => req.path === p || req.path.startsWith(p + "?"));
      if (!isAiRoute) {
        res.status(403).json({ error: "Operação não permitida em modo demo" });
        return;
      }
    }
    req.user = { id: payload.id, email: payload.email, name: payload.name, plan: payload.plan ?? "pro" };
    req.demo = true;
    next();
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

export function signToken(user: AuthUser, extra?: Record<string, unknown>): string {
  return jwt.sign({ ...user, ...extra }, JWT_SECRET, { expiresIn: "30d" });
}

export function signDemoToken(user: AuthUser): string {
  return jwt.sign({ ...user, demo: true }, JWT_SECRET, { expiresIn: "1h" });
}

export function extractUserIdFromToken(authHeader: string | undefined): number | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id?: number };
    return typeof payload.id === "number" ? payload.id : null;
  } catch {
    return null;
  }
}
