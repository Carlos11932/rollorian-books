import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  validateInternalApiKeyMock,
  getDonnaLibrarySnapshotMock,
  rateLimitCheckMock,
  rateLimitResponseMock,
} = vi.hoisted(() => {
  const rateLimitCheckMock = vi.fn().mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
  return {
    validateInternalApiKeyMock: vi.fn(),
    getDonnaLibrarySnapshotMock: vi.fn(),
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
  getDonnaLibrarySnapshot: getDonnaLibrarySnapshotMock,
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

import { GET } from "@/app/api/internal/donna/context/library-snapshot/route";

function makeRequest(): Request {
  return new Request("http://localhost/api/internal/donna/context/library-snapshot", {
    headers: { "x-api-key": "secret" },
  });
}

describe("GET /api/internal/donna/context/library-snapshot", () => {
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

  it("returns 200 with snapshot payload when authorised", async () => {
    const snapshot = {
      owner: { userId: "user-001" },
      total: 5,
      items: [],
      generatedAt: "2026-04-07T00:00:00.000Z",
    };
    getDonnaLibrarySnapshotMock.mockResolvedValueOnce(snapshot);

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(snapshot);
  });

  it("returns 401 when the API key is invalid", async () => {
    validateInternalApiKeyMock.mockReturnValue(false);

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(401);
  });

  it("returns 503 when DonnaUserNotConfiguredError is thrown", async () => {
    const { DonnaUserNotConfiguredError } = await import("@/lib/donna/user");
    getDonnaLibrarySnapshotMock.mockRejectedValueOnce(new DonnaUserNotConfiguredError("not configured"));

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(503);
  });

  it("returns 503 when DonnaUserNotFoundError is thrown", async () => {
    const { DonnaUserNotFoundError } = await import("@/lib/donna/user");
    getDonnaLibrarySnapshotMock.mockRejectedValueOnce(new DonnaUserNotFoundError("not found"));

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(503);
  });

  it("returns 500 on unexpected errors", async () => {
    getDonnaLibrarySnapshotMock.mockRejectedValueOnce(new Error("db failure"));

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
