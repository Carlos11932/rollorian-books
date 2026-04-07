import "server-only";

// ---------------------------------------------------------------------------
// In-memory sliding window rate limiter — no external dependencies
// ---------------------------------------------------------------------------
// Serverless-compatible: state is per-instance (resets on cold start).
// This is acceptable for basic abuse protection per Vercel deployment.
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window per key
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp (ms) when the oldest request in window expires
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

// Map<key, timestamps[]> — each entry holds request timestamps within the window
type TimestampStore = Map<string, number[]>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRateLimiter(config: RateLimitConfig): {
  check(key: string): RateLimitResult;
} {
  const store: TimestampStore = new Map();
  let lastCleanup = Date.now();

  function pruneExpired(now: number): void {
    for (const [key, timestamps] of store.entries()) {
      const windowStart = now - config.windowMs;
      const valid = timestamps.filter((t) => t > windowStart);
      if (valid.length === 0) {
        store.delete(key);
      } else {
        store.set(key, valid);
      }
    }
    lastCleanup = now;
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Periodic cleanup: prune expired entries every 60s OR when store grows large
      if (now - lastCleanup > 60_000 || store.size > 10_000) {
        pruneExpired(now);
      }

      const timestamps = store.get(key) ?? [];

      // Keep only timestamps within the current sliding window
      const recent = timestamps.filter((t) => t > windowStart);

      const allowed = recent.length < config.maxRequests;

      if (allowed) {
        recent.push(now);
        store.set(key, recent);
      }

      const remaining = Math.max(0, config.maxRequests - recent.length);

      // resetAt = when the oldest request in window will expire
      const oldest = recent[0] ?? now;
      const resetAt = oldest + config.windowMs;

      return { allowed, remaining, resetAt };
    },
  };
}

// ---------------------------------------------------------------------------
// 429 response helper
// ---------------------------------------------------------------------------

export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
      "X-RateLimit-Remaining": String(result.remaining),
    },
  });
}
