// Durable rate limiting for the public Free tier.
//
// Uses Upstash Redis (REST API, no SDK) when configured — this is the real
// guardrail, because it's shared across all serverless instances. Falls back to
// an in-memory counter when Upstash env vars are absent, so local dev still
// works (in-memory is per-process and resets on cold start — fine for dev,
// useless for production abuse protection, which is exactly why prod needs
// Upstash).
//
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable durable mode.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export interface RateResult {
  ok: boolean;
  remaining: number;
  durable: boolean;
}

// ── in-memory fallback (dev only) ────────────────────────────────────────────
const HITS = new Map<string, number[]>();

function memLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (HITS.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    HITS.set(key, hits);
    return { ok: false, remaining: 0, durable: false };
  }
  hits.push(now);
  HITS.set(key, hits);
  return { ok: true, remaining: limit - hits.length, durable: false };
}

// ── Upstash REST helpers ─────────────────────────────────────────────────────
async function upstash(path: string): Promise<any> {
  const res = await fetch(`${UPSTASH_URL}/${path}`, {
    headers: { authorization: `Bearer ${UPSTASH_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
  return res.json();
}

// Fixed-window counter: one Redis key per (client, window). INCR is atomic, so
// concurrent requests can't race past the limit; EXPIRE is set on first hit.
async function redisLimit(key: string, limit: number, windowMs: number): Promise<RateResult> {
  const windowSec = Math.ceil(windowMs / 1000);
  const bucket = Math.floor(Date.now() / windowMs);
  const k = `rl:${key}:${bucket}`;

  const { result: count } = await upstash(`incr/${encodeURIComponent(k)}`);
  if (count === 1) {
    // first request in this window — set the TTL so the key self-cleans
    await upstash(`expire/${encodeURIComponent(k)}/${windowSec}`);
  }
  return { ok: count <= limit, remaining: Math.max(0, limit - count), durable: true };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      return await redisLimit(key, limit, windowMs);
    } catch {
      // If Redis is unreachable, fail closed-ish by falling back to in-memory
      // rather than letting unlimited requests through.
      return memLimit(key, limit, windowMs);
    }
  }
  return memLimit(key, limit, windowMs);
}

export function clientKey(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "anon"
  );
}
