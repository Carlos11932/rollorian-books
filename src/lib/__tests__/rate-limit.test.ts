import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function advanceMs(ms: number): void {
  vi.advanceTimersByTime(ms);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("sliding window — counting", () => {
    it("allows the first request", () => {
      const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 5 });
      const result = limiter.check("user-a");
      expect(result.allowed).toBe(true);
    });

    it("counts requests within the window and decrements remaining", () => {
      const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 3 });
      limiter.check("user-a"); // 1st — remaining = 2
      limiter.check("user-a"); // 2nd — remaining = 1
      const result = limiter.check("user-a"); // 3rd — remaining = 0
      expect(result.remaining).toBe(0);
    });

    it("does not count expired timestamps toward the window", () => {
      const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 2 });
      limiter.check("user-a"); // t=0
      limiter.check("user-a"); // t=0  — now at max

      // Advance past the window so both timestamps expire
      advanceMs(1001);

      const result = limiter.check("user-a"); // new window
      expect(result.allowed).toBe(true);
    });
  });

  describe("boundary conditions", () => {
    it("allows request exactly at maxRequests (the N-th request)", () => {
      const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 3 });
      limiter.check("user-b"); // 1st
      limiter.check("user-b"); // 2nd
      const result = limiter.check("user-b"); // exactly the 3rd — should be allowed
      expect(result.allowed).toBe(true);
    });

    it("blocks the (maxRequests + 1)-th request", () => {
      const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 3 });
      limiter.check("user-b"); // 1
      limiter.check("user-b"); // 2
      limiter.check("user-b"); // 3
      const result = limiter.check("user-b"); // 4 — should be blocked
      expect(result.allowed).toBe(false);
    });

    it("blocked request returns 0 remaining", () => {
      const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 1 });
      limiter.check("user-b"); // consume the only slot
      const result = limiter.check("user-b");
      expect(result.remaining).toBe(0);
    });
  });

  describe("window reset", () => {
    it("allows new requests after the full window expires", () => {
      const limiter = createRateLimiter({ windowMs: 2000, maxRequests: 2 });
      limiter.check("user-c"); // 1st
      limiter.check("user-c"); // 2nd — at max
      expect(limiter.check("user-c").allowed).toBe(false); // blocked

      advanceMs(2001); // window fully expired

      expect(limiter.check("user-c").allowed).toBe(true);
    });

    it("remaining resets to (maxRequests - 1) after window expires and one request lands", () => {
      const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 5 });
      for (let i = 0; i < 5; i++) limiter.check("user-c");

      advanceMs(1001);

      const result = limiter.check("user-c");
      expect(result.remaining).toBe(4); // 5 - 1 used
    });
  });

  describe("key isolation", () => {
    it("two different keys are tracked independently", () => {
      const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 1 });
      limiter.check("key-x"); // consume key-x
      const resultY = limiter.check("key-y"); // key-y is independent
      expect(resultY.allowed).toBe(true);
    });

    it("blocking one key does not affect another key", () => {
      const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 2 });
      limiter.check("key-1");
      limiter.check("key-1");
      limiter.check("key-1"); // blocked

      limiter.check("key-2");
      const result = limiter.check("key-2"); // still within limit
      expect(result.allowed).toBe(true);
    });
  });

  describe("resetAt calculation", () => {
    it("resetAt is in the future relative to now", () => {
      const limiter = createRateLimiter({ windowMs: 5000, maxRequests: 10 });
      const now = Date.now();
      const result = limiter.check("user-d");
      expect(result.resetAt).toBeGreaterThan(now);
    });

    it("resetAt is approximately (first-request-time + windowMs)", () => {
      const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 10 });
      const before = Date.now();
      const result = limiter.check("user-d");
      // resetAt should be within [before+window, before+window+1ms tolerance]
      expect(result.resetAt).toBeGreaterThanOrEqual(before + 10_000);
    });
  });

  describe("periodic cleanup", () => {
    it("prunes stale entries when more than 60 s have passed since last cleanup", () => {
      const limiter = createRateLimiter({ windowMs: 100, maxRequests: 5 });
      // Fill in requests for two keys
      limiter.check("stale-1");
      limiter.check("stale-2");

      // Advance well past the window (stale entries) AND past the 60s cleanup interval
      advanceMs(61_000);

      // A fresh check should still work correctly after the pruning pass
      const result = limiter.check("fresh-key");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });
});

describe("rateLimitResponse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns HTTP 429", () => {
    const result = { allowed: false, remaining: 0, resetAt: Date.now() + 3000 };
    const response = rateLimitResponse(result);
    expect(response.status).toBe(429);
  });

  it("includes Content-Type: application/json", () => {
    const result = { allowed: false, remaining: 0, resetAt: Date.now() + 3000 };
    const response = rateLimitResponse(result);
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("includes X-RateLimit-Remaining header", () => {
    const result = { allowed: false, remaining: 0, resetAt: Date.now() + 3000 };
    const response = rateLimitResponse(result);
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("Retry-After is always at least 1", () => {
    // resetAt in the past should still return >= 1
    const result = { allowed: false, remaining: 0, resetAt: Date.now() - 9999 };
    const response = rateLimitResponse(result);
    const retryAfter = Number(response.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("Retry-After reflects the remaining window in seconds", () => {
    const resetAt = Date.now() + 5000;
    const result = { allowed: false, remaining: 0, resetAt };
    const response = rateLimitResponse(result);
    const retryAfter = Number(response.headers.get("Retry-After"));
    // Math.ceil(5000 / 1000) = 5
    expect(retryAfter).toBe(5);
  });

  it("response body contains error message", async () => {
    const result = { allowed: false, remaining: 0, resetAt: Date.now() + 1000 };
    const response = rateLimitResponse(result);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });
});
