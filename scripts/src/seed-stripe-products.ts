import { getUncachableStripeClient } from "./stripeClient.js";

async function ensureUsdPrice(stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>, productId: string, unitAmount: number, label: string) {
  const prices = await stripe.prices.list({ product: productId, active: true, currency: "usd", type: "recurring" });
  const existing = prices.data.find(p => p.recurring?.interval === "month");
  if (existing) {
    console.log(`  · Preço USD já existe: ${existing.id}`);
    return existing;
  }
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency: "usd",
    recurring: { interval: "month" },
  });
  console.log(`  ✓ Preço ${label} criado: ${price.id}`);
  return price;
}

async function createProducts() {
  const stripe = await getUncachableStripeClient();
  console.log("Configurando produtos no Stripe (BRL + USD)...\n");

  const existingPro = await stripe.products.search({ query: "name:'FC Career Pro' AND active:'true'" });
  const existingUltra = await stripe.products.search({ query: "name:'FC Career Ultra' AND active:'true'" });

  // ── Pro ──────────────────────────────────────────────────────────────
  let proProductId: string;
  if (existingPro.data.length === 0) {
    const proProduct = await stripe.products.create({
      name: "FC Career Pro",
      description: "Plano Pro — até 5 carreiras, 20 gerações de IA/dia, recursos de diretoria",
      metadata: { planTier: "pro" },
    });
    proProductId = proProduct.id;

    const proPrice = await stripe.prices.create({
      product: proProductId,
      unit_amount: 1490,
      currency: "brl",
      recurring: { interval: "month" },
    });

    console.log(`✓ Produto Pro criado: ${proProductId}`);
    console.log(`  Preço R$14,90/mês (BRL): ${proPrice.id}`);
  } else {
    proProductId = existingPro.data[0].id;
    console.log(`· Pro já existe: ${proProductId}`);
    const brlPrices = await stripe.prices.list({ product: proProductId, active: true, currency: "brl" });
    if (brlPrices.data.length > 0) {
      console.log(`  BRL: ${brlPrices.data[0].id}`);
    }
  }

  console.log("  Verificando preço USD para Pro...");
  await ensureUsdPrice(stripe, proProductId, 499, "$4.99/mês (USD) Pro");

  // ── Ultra ─────────────────────────────────────────────────────────────
  let ultraProductId: string;
  if (existingUltra.data.length === 0) {
    const ultraProduct = await stripe.products.create({
      name: "FC Career Ultra",
      description: "Plano Ultra — carreiras ilimitadas, IA ilimitada, notícias automáticas, portais personalizados",
      metadata: { planTier: "ultra" },
    });
    ultraProductId = ultraProduct.id;

    const ultraPrice = await stripe.prices.create({
      product: ultraProductId,
      unit_amount: 3990,
      currency: "brl",
      recurring: { interval: "month" },
    });

    console.log(`\n✓ Produto Ultra criado: ${ultraProductId}`);
    console.log(`  Preço R$39,90/mês (BRL): ${ultraPrice.id}`);
  } else {
    ultraProductId = existingUltra.data[0].id;
    console.log(`\n· Ultra já existe: ${ultraProductId}`);
    const brlPrices = await stripe.prices.list({ product: ultraProductId, active: true, currency: "brl" });
    if (brlPrices.data.length > 0) {
      console.log(`  BRL: ${brlPrices.data[0].id}`);
    }
  }

  console.log("  Verificando preço USD para Ultra...");
  await ensureUsdPrice(stripe, ultraProductId, 999, "$9.99/mês (USD) Ultra");

  console.log("\n✓ Produtos configurados no Stripe (BRL + USD).");
  console.log("Os webhooks sincronizarão os dados automaticamente ao iniciar o servidor.");
}

createProducts().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
