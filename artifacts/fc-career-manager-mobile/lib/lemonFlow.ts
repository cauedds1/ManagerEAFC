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

function getReturnUrl(path: 'success' | 'cancel' | 'billing'): string {
  return Linking.createURL(`/checkout/${path}`);
}

export async function startLemonCheckout(plan: RequiredPlan, lang: 'pt' | 'en' = 'pt'): Promise<void> {
  const headers = await authHeader();
  const res = await fetch(`${getApiUrl()}/api/lemon/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      planTier: plan,
      successUrl: getReturnUrl('success'),
      cancelUrl: getReturnUrl('cancel'),
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? (lang === 'en' ? 'Could not create PayPal checkout.' : 'Não foi possível criar o checkout PayPal.'));
  }

  const { url } = await res.json() as { url?: string };
  if (!url) throw new Error(lang === 'en' ? 'Invalid checkout URL.' : 'URL de pagamento inválida.');

  await WebBrowser.openAuthSessionAsync(url, getReturnUrl('success'));
  for (const fn of _returnListeners) { try { fn(); } catch {} }
}

const _returnListeners = new Set<() => void>();
export function onLemonCheckoutReturn(fn: () => void): () => void {
  _returnListeners.add(fn);
  return () => _returnListeners.delete(fn);
}

export async function openLemonPortal(lang: 'pt' | 'en' = 'pt'): Promise<void> {
  const headers = await authHeader();
  const res = await fetch(`${getApiUrl()}/api/lemon/portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? (lang === 'en' ? 'Could not open billing portal.' : 'Não foi possível abrir o portal de cobrança.'));
  }

  const { url } = await res.json() as { url?: string };
  if (!url) throw new Error(lang === 'en' ? 'Invalid portal URL.' : 'URL do portal inválida.');
  await WebBrowser.openAuthSessionAsync(url, getReturnUrl('billing'));
  for (const fn of _returnListeners) { try { fn(); } catch {} }
}
