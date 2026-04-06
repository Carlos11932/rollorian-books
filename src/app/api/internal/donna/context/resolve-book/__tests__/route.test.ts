import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  validateInternalApiKeyMock,
  resolveDonnaBookMock,
} = vi.hoisted(() => ({
  validateInternalApiKeyMock: vi.fn(),
  resolveDonnaBookMock: vi.fn(),
}));

vi.mock("@/lib/internal-api", () => ({
  validateInternalApiKey: validateInternalApiKeyMock,
}));

vi.mock("@/lib/donna/books", () => ({
  resolveDonnaBook: resolveDonnaBookMock,
}));

vi.mock("@/lib/donna/user", () => ({
  DonnaUserNotConfiguredError: class DonnaUserNotConfiguredError extends Error {},
  DonnaUserNotFoundError: class DonnaUserNotFoundError extends Error {},
}));

import { POST } from "@/app/api/internal/donna/context/resolve-book/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/internal/donna/context/resolve-book", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": "secret",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/internal/donna/context/resolve-book", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateInternalApiKeyMock.mockReturnValue(true);
  });

  it("returns the resolved book payload", async () => {
    resolveDonnaBookMock.mockResolvedValueOnce({
      matchStatus: "exact",
      matchedBook: { book: { id: "book-1", title: "Dune" } },
      suggestions: [],
    });

    const response = await POST(makeRequest({ bookRef: { isbn13: "9780441172719" } }) as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(resolveDonnaBookMock).toHaveBeenCalledWith({ isbn13: "9780441172719" });
    expect(json.matchStatus).toBe("exact");
  });

  it("returns 401 when x-api-key is invalid", async () => {
    validateInternalApiKeyMock.mockReturnValueOnce(false);

    const response = await POST(makeRequest({ bookRef: { title: "Dune" } }) as never);

    expect(response.status).toBe(401);
  });
});
