import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  validateInternalApiKeyMock,
  applyDonnaReadingEventMock,
} = vi.hoisted(() => ({
  validateInternalApiKeyMock: vi.fn(),
  applyDonnaReadingEventMock: vi.fn(),
}));

vi.mock("@/lib/internal-api", () => ({
  validateInternalApiKey: validateInternalApiKeyMock,
}));

vi.mock("@/lib/donna/books", () => ({
  applyDonnaReadingEvent: applyDonnaReadingEventMock,
}));

vi.mock("@/lib/donna/user", () => ({
  DonnaUserNotConfiguredError: class DonnaUserNotConfiguredError extends Error {},
  DonnaUserNotFoundError: class DonnaUserNotFoundError extends Error {},
}));

import { POST } from "@/app/api/internal/donna/actions/reading-event/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/internal/donna/actions/reading-event", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": "secret",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/internal/donna/actions/reading-event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateInternalApiKeyMock.mockReturnValue(true);
  });

  it("returns 200 for an applied event", async () => {
    applyDonnaReadingEventMock.mockResolvedValueOnce({
      applied: true,
      resolvedBook: { id: "book-1", title: "Dune" },
      resultingState: { semanticState: "read" },
      warnings: [],
      matchStatus: "strong",
      suggestions: [],
    });

    const response = await POST(makeRequest({
      event: "finished",
      bookRef: { title: "Dune", authors: ["Frank Herbert"] },
      payload: {},
      source: { channel: "telegram", actor: "Donna" },
    }) as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.applied).toBe(true);
  });

  it("returns 409 when the event cannot be applied", async () => {
    applyDonnaReadingEventMock.mockResolvedValueOnce({
      applied: false,
      resolvedBook: null,
      resultingState: null,
      warnings: [],
      matchStatus: "ambiguous",
      suggestions: [{ book: { id: "book-1", title: "Dune" } }],
    });

    const response = await POST(makeRequest({
      event: "finished",
      bookRef: { title: "Dune" },
      payload: {},
      source: { channel: "telegram", actor: "Donna" },
    }) as never);

    expect(response.status).toBe(409);
  });
});
