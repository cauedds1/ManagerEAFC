import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

const LS_API = "https://api.lemonsqueezy.com/v1";

function lsHeaders() {
  return {
    "Authorization": `Bearer ${process.env.LEMONSQUEEZY_API_KEY ?? ""}`,
    "Accept": "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
  };
}

const FRONTEND_URL = (() => {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  return "http://localhost:3000";
})();

const ALLOWED_PLAN_TIERS = new Set(["pro", "ultra"]);

function getVariantId(planTier: string): string | null {
  if (planTier === "pro") return process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? null;
  if (planTier === "ultra") return process.env.LEMONSQUEEZY_ULTRA_VARIANT_ID ?? null;
  return null;
}

router.post("/lemon/checkout", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { planTier, successUrl, cancelUrl } = req.body as {
      planTier?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!planTier || !ALLOWED_PLAN_TIERS.has(planTier)) {
      return res.status(400).json({ error: "planTier inválido" });
    }

    const variantId = getVariantId(planTier);
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;

    if (!variantId || !storeId) {
      return res.status(503).json({ error: "Lemon Squeezy não configurado" });
    }

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "Lemon Squeezy API key não configurada" });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const frontendOrigin = (() => { try { return new URL(FRONTEND_URL).origin; } catch { return ""; } })();
    const isAllowed = (u: unknown): u is string => {
      if (typeof u !== "string") return false;
      if (u.startsWith("fccareer://")) return true;
      try { return new URL(u).origin === frontendOrigin; } catch { return false; }
    };

    const finalSuccess = isAllowed(successUrl) ? successUrl : `${FRONTEND_URL}/?checkout=success`;
    const finalCancel = isAllowed(cancelUrl) ? cancelUrl : `${FRONTEND_URL}/?checkout=cancel`;

    const body = {
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            custom: {
              user_id: String(user.id),
              plan_tier: planTier,
            },
            email: user.email,
            name: user.name,
          },
          product_options: {
            redirect_url: finalSuccess,
          },
          checkout_options: {
            button_color: "#7c5cfc",
          },
          expires_at: null,
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    };

    const lsRes = await fetch(`${LS_API}/checkouts`, {
      method: "POST",
      headers: lsHeaders(),
      body: JSON.stringify(body),
    });

    if (!lsRes.ok) {
      const errText = await lsRes.text();
      console.error("Lemon Squeezy checkout error:", errText);
      return res.status(502).json({ error: "Erro ao criar checkout no Lemon Squeezy" });
    }

    const data = await lsRes.json() as { data: { attributes: { url: string } } };
    return res.json({ url: data.data.attributes.url });
  } catch (err) {
    console.error("POST /lemon/checkout error:", err);
    return res.status(500).json({ error: "Erro ao criar sessão de pagamento" });
  }
});

router.post("/lemon/portal", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);

    if (!user?.lemonSqueezyCustomerId) {
      return res.status(400).json({ error: "Nenhuma assinatura Lemon Squeezy encontrada" });
    }

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "Lemon Squeezy não configurado" });
    }

    const subsRes = await fetch(
      `${LS_API}/subscriptions?filter[customer_id]=${user.lemonSqueezyCustomerId}&filter[status]=active`,
      { headers: lsHeaders() }
    );

    if (!subsRes.ok) {
      return res.status(502).json({ error: "Erro ao buscar assinatura" });
    }

    const subsData = await subsRes.json() as {
      data: Array<{ attributes: { urls: { customer_portal: string } } }>
    };

    const portalUrl = subsData.data?.[0]?.attributes?.urls?.customer_portal;
    if (!portalUrl) {
      return res.status(404).json({ error: "Portal de cliente não encontrado" });
    }

    return res.json({ url: portalUrl });
  } catch (err) {
    console.error("POST /lemon/portal error:", err);
    return res.status(500).json({ error: "Erro ao abrir portal de assinatura" });
  }
});

export default router;
