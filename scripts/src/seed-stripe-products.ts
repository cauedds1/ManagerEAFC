import { getUncachableStripeClient } from "./stripeClient.js";

async function createProducts() {
  const stripe = await getUncachableStripeClient();
  console.log("Criando produtos no Stripe (BRL)...");

  const existingPro = await stripe.products.search({ query: "name:'FC Career Pro' AND active:'true'" });
  const existingUltra = await stripe.products.search({ query: "name:'FC Career Ultra' AND active:'true'" });

  if (existingPro.data.length === 0) {
    const proProduct = await stripe.products.create({
      name: "FC Career Pro",
      description: "Plano Pro — até 5 carreiras, 20 gerações de IA/dia, recursos de diretoria",
      metadata: { planTier: "pro" },
    });

    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 1490,
      currency: "brl",
      recurring: { interval: "month" },
    });

    console.log(`✓ Produto Pro criado: ${proProduct.id}`);
    console.log(`  Preço R$14,90/mês: ${proPrice.id}`);
  } else {
    console.log(`· Pro já existe: ${existingPro.data[0].id}`);
    const prices = await stripe.prices.list({ product: existingPro.data[0].id, active: true });
    if (prices.data.length > 0) {
      console.log(`  Preço: ${prices.data[0].id}`);
    }
  }

  if (existingUltra.data.length === 0) {
    const ultraProduct = await stripe.products.create({
      name: "FC Career Ultra",
      description: "Plano Ultra — carreiras ilimitadas, IA ilimitada, notícias automáticas, portais personalizados",
      metadata: { planTier: "ultra" },
    });

    const ultraPrice = await stripe.prices.create({
      product: ultraProduct.id,
      unit_amount: 3990,
      currency: "brl",
      recurring: { interval: "month" },
    });

    console.log(`✓ Produto Ultra criado: ${ultraProduct.id}`);
    console.log(`  Preço R$39,90/mês: ${ultraPrice.id}`);
  } else {
    console.log(`· Ultra já existe: ${existingUltra.data[0].id}`);
    const prices = await stripe.prices.list({ product: existingUltra.data[0].id, active: true });
    if (prices.data.length > 0) {
      console.log(`  Preço: ${prices.data[0].id}`);
    }
  }

  console.log("\n✓ Produtos configurados no Stripe.");
  console.log("Os webhooks sincronizarão os dados automaticamente ao iniciar o servidor.");
}

createProducts().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
