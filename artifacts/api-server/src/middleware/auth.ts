import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser & { iat?: number; exp?: number };
    req.user = { id: payload.id, email: payload.email, name: payload.name, plan: payload.plan ?? "free" };
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "30d" });
}
