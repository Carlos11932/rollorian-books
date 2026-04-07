import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  validateInternalApiKeyMock,
  getDonnaSummaryMock,
} = vi.hoisted(() => ({
  validateInternalApiKeyMock: vi.fn(),
  getDonnaSummaryMock: vi.fn(),
}));

vi.mock("@/lib/internal-api", () => ({
  validateInternalApiKey: validateInternalApiKeyMock,
}));

vi.mock("@/lib/donna", () => ({
  getDonnaSummary: getDonnaSummaryMock,
}));

vi.mock("@/lib/donna/user", () => ({
  DonnaUserNotConfiguredError: class DonnaUserNotConfiguredError extends Error {},
  DonnaUserNotFoundError: class DonnaUserNotFoundError extends Error {},
}));

import { GET } from "@/app/api/internal/donna/context/summary/route";

describe("GET /api/internal/donna/context/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateInternalApiKeyMock.mockReturnValue(true);
  });

  it("returns the summary payload", async () => {
    getDonnaSummaryMock.mockResolvedValueOnce({
      currentlyReading: [],
      recentlyFinished: [],
      wishlistHighlights: [],
      topGenres: [],
      topAuthors: [],
      readingStreak: { current: 0, unit: "weeks" },
      averageRating: null,
      abandonedCount: 0,
      activeLists: [],
      profileUpdatedAt: "2026-04-06T00:00:00.000Z",
    });

    const response = await GET(new Request("http://localhost/api/internal/donna/context/summary", {
      headers: { "x-api-key": "secret" },
    }) as never);

    expect(response.status).toBe(200);
  });
});
