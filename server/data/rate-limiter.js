// rate-limiter.js — Token-bucket rate limiter for external APIs.
// Per-domain buckets with configurable capacity + refill rate.
// Shared across all agents so concurrent connectors stay within limits.

const buckets = new Map(); // domain → { tokens, lastRefill, capacity, refillPerSec }

export function configureRateLimit(domain, { capacity, refillPerSec }) {
  buckets.set(domain, {
    tokens: capacity,
    lastRefill: Date.now(),
    capacity,
    refillPerSec,
  });
}

function refill(bucket) {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillPerSec);
  bucket.lastRefill = now;
}

// Returns true if a token is available (and consumes it), false otherwise.
export function tryConsume(domain, cost = 1) {
  const bucket = buckets.get(domain);
  if (!bucket) return true; // unconfigured = unlimited
  refill(bucket);
  if (bucket.tokens >= cost) {
    bucket.tokens -= cost;
    return true;
  }
  return false;
}

// Wait until a token is available, then consume it.
export async function waitForToken(domain, cost = 1) {
  const bucket = buckets.get(domain);
  if (!bucket) return;
  while (!tryConsume(domain, cost)) {
    const deficit = cost - bucket.tokens;
    const waitMs = Math.ceil((deficit / bucket.refillPerSec) * 1000);
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 5000)));
  }
}

// Parse X-Ratelimit-* headers (Reddit, OpenSky) and adjust the bucket.
export function updateFromHeaders(domain, headers) {
  const bucket = buckets.get(domain);
  if (!bucket) return;
  const remaining = parseFloat(headers['x-ratelimit-remaining']);
  const reset = parseFloat(headers['x-ratelimit-reset']);
  if (!isNaN(remaining)) bucket.tokens = remaining;
  // reset is seconds-until-reset on Reddit; we just let refill handle it
  if (!isNaN(reset) && reset > 0) bucket.lastRefill = Date.now();
}

export default { configureRateLimit, tryConsume, waitForToken, updateFromHeaders };
