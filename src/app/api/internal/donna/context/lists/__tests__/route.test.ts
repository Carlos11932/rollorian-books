import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  validateInternalApiKeyMock,
  getDonnaListsMock,
} = vi.hoisted(() => ({
  validateInternalApiKeyMock: vi.fn(),
  getDonnaListsMock: vi.fn(),
}));

vi.mock("@/lib/internal-api", () => ({
  validateInternalApiKey: validateInternalApiKeyMock,
}));

vi.mock("@/lib/donna", () => ({
  getDonnaLists: getDonnaListsMock,
}));

vi.mock("@/lib/donna/user", () => ({
  DonnaUserNotConfiguredError: class DonnaUserNotConfiguredError extends Error {},
  DonnaUserNotFoundError: class DonnaUserNotFoundError extends Error {},
}));

import { GET } from "@/app/api/internal/donna/context/lists/route";

function makeRequest(): Request {
  return new Request("http://localhost/api/internal/donna/context/lists", {
    headers: { "x-api-key": "secret" },
  });
}

describe("GET /api/internal/donna/context/lists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateInternalApiKeyMock.mockReturnValue(true);
  });

  it("returns 200 with lists payload when authorised", async () => {
    const listsPayload = {
      total: 2,
      lists: [
        { id: "list-1", name: "Favourites", description: null, itemCount: 3, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
    };
    getDonnaListsMock.mockResolvedValueOnce(listsPayload);

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(listsPayload);
  });

  it("returns 401 when the API key is invalid", async () => {
    validateInternalApiKeyMock.mockReturnValue(false);

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(401);
  });

  it("returns 503 when DonnaUserNotConfiguredError is thrown", async () => {
    const { DonnaUserNotConfiguredError } = await import("@/lib/donna/user");
    getDonnaListsMock.mockRejectedValueOnce(new DonnaUserNotConfiguredError("not configured"));

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(503);
  });

  it("returns 503 when DonnaUserNotFoundError is thrown", async () => {
    const { DonnaUserNotFoundError } = await import("@/lib/donna/user");
    getDonnaListsMock.mockRejectedValueOnce(new DonnaUserNotFoundError("not found"));

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(503);
  });

  it("returns 500 on unexpected errors", async () => {
    getDonnaListsMock.mockRejectedValueOnce(new Error("db failure"));

    const response = await GET(makeRequest() as never);
    expect(response.status).toBe(500);
  });
});
