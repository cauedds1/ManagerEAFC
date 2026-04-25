const DEMO_AI_LIMIT_PER_HOUR = 3;

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Check and increment the demo AI rate limit.
 * Returns true if the request should be blocked (limit reached).
 * Use key format "demo-ai:<userId>" to enforce a shared cap across all demo AI routes.
 */
export function checkDemoRateLimit(key: string): boolean {
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 3_600_000 };
  }
  if (entry.count >= DEMO_AI_LIMIT_PER_HOUR) {
    return true;
  }
  entry.count += 1;
  buckets.set(key, entry);
  return false;
}
