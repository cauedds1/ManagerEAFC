const AUTH_TOKEN_KEY = "fc_auth_token";

export function getEffectiveToken(): string | null {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY) ?? localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }
}
