import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  validateInternalApiKeyMock,
  getDonnaRecommendationsMock,
  rateLimitCheckMock,
  rateLimitResponseMock,
} = vi.hoisted(() => {
  const rateLimitCheckMock = vi.fn().mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
  return {
    validateInternalApiKeyMock: vi.fn(),
    getDonnaRecommendationsMock: vi.fn(),
    rateLimitCheckMock,
    rateLimitResponseMock: vi.fn().mockImplementation((result: { resetAt: number; remaining: number }) =>
      new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": String(result.remaining),
        },
      }),
    ),
  };
});

vi.mock("@/lib/internal-api", () => ({
  validateInternalApiKey: validateInternalApiKeyMock,
}));

vi.mock("@/lib/donna", () => ({
  getDonnaRecommendations: getDonnaRecommendationsMock,
}));

vi.mock("@/lib/donna/user", () => ({
  DonnaUserNotConfiguredError: class DonnaUserNotConfiguredError extends Error {},
  DonnaUserNotFoundError: class DonnaUserNotFoundError extends Error {},
}));

// Rate limiter — expose check mock so individual tests can configure it
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: rateLimitCheckMock }),
  rateLimitResponse: rateLimitResponseMock,
}));

import { GET } from "@/app/api/internal/donna/context/recommendations/route";

function makeRequest(): Request {
  return new Request("http://localhost/api/internal/donna/context/recommendations", {
    headers: { "x-api-key": "secret" },
  });
}

describe("GET /api/internal/donna/context/recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateInternalApiKeyMock.mockReturnValue(true);
    rateLimitCheckMock.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
    rateLimitResponseMock.mockImplementation((result: { resetAt: number; remaining: number }) =>
      new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": String(result.remaining),
        },
      }),
    );
  });

  it("returns 200 with recommendations payload when authorised", async () => {
    const recommendations = {
      recommendations: [],
      generatedAt: "2026-04-07T00:00:00.000Z",
    };
    getDonnaRecommendationsMock.mockResolvedValueOnce(recommendations);

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(recommendations);
  });

  it("returns 401 when the API key is invalid", async () => {
    validateInternalApiKeyMock.mockReturnValue(false);

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(401);
  });

  it("returns 503 when DonnaUserNotConfiguredError is thrown", async () => {
    const { DonnaUserNotConfiguredError } = await import("@/lib/donna/user");
    getDonnaRecommendationsMock.mockRejectedValueOnce(new DonnaUserNotConfiguredError("not configured"));

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(503);
  });

  it("returns 503 when DonnaUserNotFoundError is thrown", async () => {
    const { DonnaUserNotFoundError } = await import("@/lib/donna/user");
    getDonnaRecommendationsMock.mockRejectedValueOnce(new DonnaUserNotFoundError("not found"));

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(503);
  });

  it("returns 500 on unexpected errors", async () => {
    getDonnaRecommendationsMock.mockRejectedValueOnce(new Error("model timeout"));

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(500);
  });

  it("returns 429 with Retry-After header and error body when rate limit is exceeded", async () => {
    const resetAt = Date.now() + 60_000;
    rateLimitCheckMock.mockReturnValue({ allowed: false, remaining: 0, resetAt });

    const response = await GET(makeRequest() as never);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    const body = await response.json();
    expect(body).toEqual({ error: "Too many requests" });
  });
});
