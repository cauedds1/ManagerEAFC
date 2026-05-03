// Mobile Stripe flow — opens Stripe checkout / customer portal in the device
// browser via expo-web-browser.openAuthSessionAsync, so the app reopens via
// the deep-link scheme on success/cancel. Stripe stays web-only (no native
// IAP) — see Master Plan.

import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { getApiUrl } from '@/lib/api';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY } from '@/lib/api';

export type RequiredPlan = 'pro' | 'ultra';

async function authHeader(): Promise<Record<string, string>> {
  const token = Platform.OS === 'web'
    ? localStorage.getItem(TOKEN_KEY)
    : await SecureStore.getItemAsync(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getReturnUrl(path: 'success' | 'cancel'): string {
  return Linking.createURL(`/checkout/${path}`);
}

interface PriceRow { planTier: string; priceId: string; currency: string }

async function pickPriceId(plan: RequiredPlan, lang: 'pt' | 'en'): Promise<string> {
  const headers = await authHeader();
  const res = await fetch(`${getApiUrl()}/api/stripe/products-with-plan`, { headers });
  if (!res.ok) throw new Error(lang === 'en' ? 'Could not load plans.' : 'Não foi possível carregar os planos.');
  const prices = await res.json() as PriceRow[];
  const target = lang === 'en' ? 'usd' : 'brl';
  const exact = prices.find((p) => p.planTier === plan && p.currency === target);
  const match = exact ?? prices.find((p) => p.planTier === plan);
  if (!match?.priceId) throw new Error(lang === 'en' ? 'Plan not found.' : 'Plano não encontrado.');
  return match.priceId;
}

export async function startCheckout(plan: RequiredPlan, lang: 'pt' | 'en' = 'pt'): Promise<void> {
  const headers = await authHeader();
  const priceId = await pickPriceId(plan, lang);
  const res = await fetch(`${getApiUrl()}/api/stripe/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      priceId,
      successUrl: getReturnUrl('success'),
      cancelUrl: getReturnUrl('cancel'),
    }),
  });
  if (!res.ok) throw new Error(lang === 'en' ? 'Could not create checkout session.' : 'Não foi possível criar a sessão de pagamento.');
  const { url } = await res.json() as { url?: string };
  if (!url) throw new Error(lang === 'en' ? 'Invalid checkout URL.' : 'URL de pagamento inválida.');

  await WebBrowser.openAuthSessionAsync(url, getReturnUrl('success'));
}

export async function openCustomerPortal(lang: 'pt' | 'en' = 'pt'): Promise<void> {
  const headers = await authHeader();
  const res = await fetch(`${getApiUrl()}/api/stripe/portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ returnUrl: getReturnUrl('success') }),
  });
  if (!res.ok) throw new Error(lang === 'en' ? 'Could not open billing portal.' : 'Não foi possível abrir o portal de cobrança.');
  const { url } = await res.json() as { url?: string };
  if (!url) throw new Error(lang === 'en' ? 'Invalid portal URL.' : 'URL do portal inválida.');
  await WebBrowser.openAuthSessionAsync(url, getReturnUrl('success'));
}
