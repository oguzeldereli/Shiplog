// Minimal in-memory sliding-window limiter. Per-isolate only (resets on cold
// start, not shared across edge regions) — a soft guardrail for the free tier,
// not a security boundary. Swap for Upstash/KV if abuse becomes real.
const HITS = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (HITS.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    HITS.set(key, hits);
    return false;
  }
  hits.push(now);
  HITS.set(key, hits);
  return true;
}

export function clientKey(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "anon"
  );
}
