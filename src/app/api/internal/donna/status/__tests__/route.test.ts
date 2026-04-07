import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  validateInternalApiKeyMock,
  getDonnaStatusMock,
} = vi.hoisted(() => ({
  validateInternalApiKeyMock: vi.fn(),
  getDonnaStatusMock: vi.fn(),
}));

vi.mock("@/lib/internal-api", () => ({
  validateInternalApiKey: validateInternalApiKeyMock,
}));

vi.mock("@/lib/donna", () => ({
  getDonnaStatus: getDonnaStatusMock,
}));

vi.mock("@/lib/donna/user", () => ({
  DonnaUserNotConfiguredError: class DonnaUserNotConfiguredError extends Error {},
  DonnaUserNotFoundError: class DonnaUserNotFoundError extends Error {},
}));

import { GET } from "@/app/api/internal/donna/status/route";

function makeRequest(): Request {
  return new Request("http://localhost/api/internal/donna/status", {
    headers: { "x-api-key": "secret" },
  });
}

describe("GET /api/internal/donna/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateInternalApiKeyMock.mockReturnValue(true);
  });

  it("returns 200 with status payload when authorised", async () => {
    const statusPayload = {
      ok: true,
      owner: { userId: "user-001" },
      contractVersion: "v1",
      libraryCount: 42,
      generatedAt: "2026-04-07T00:00:00.000Z",
    };
    getDonnaStatusMock.mockResolvedValueOnce(statusPayload);

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(statusPayload);
  });

  it("returns 401 when the API key is invalid", async () => {
    validateInternalApiKeyMock.mockReturnValue(false);

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(401);
  });

  it("returns 503 when DonnaUserNotConfiguredError is thrown", async () => {
    const { DonnaUserNotConfiguredError } = await import("@/lib/donna/user");
    getDonnaStatusMock.mockRejectedValueOnce(new DonnaUserNotConfiguredError("not configured"));

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(503);
  });

  it("returns 503 when DonnaUserNotFoundError is thrown", async () => {
    const { DonnaUserNotFoundError } = await import("@/lib/donna/user");
    getDonnaStatusMock.mockRejectedValueOnce(new DonnaUserNotFoundError("not found"));

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(503);
  });

  it("returns 500 on unexpected errors", async () => {
    getDonnaStatusMock.mockRejectedValueOnce(new Error("unexpected"));

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(500);
  });
});
