/**
 * Einfaches In-Memory Rate-Limit pro API-Key (pro Server-Instanz).
 * Für Vercel/Serverless: bei Bedarf Upstash Redis o. ä. nachrüsten.
 */

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
/** Pro Minute pro Key (POST/GET zählen gemeinsam). */
const MAX_PER_WINDOW = 60;

const store = new Map<string, Bucket>();

export function consumeApiKeyRate(apiKeyId: string):
  | { ok: true }
  | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  let b = store.get(apiKeyId);
  if (!b || now >= b.resetAt) {
    b = { count: 1, resetAt: now + WINDOW_MS };
    store.set(apiKeyId, b);
    return { ok: true };
  }
  if (b.count >= MAX_PER_WINDOW) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  b.count += 1;
  return { ok: true };
}
