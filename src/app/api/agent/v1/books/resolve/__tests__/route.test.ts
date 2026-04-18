import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  handleAgentRouteMock,
  resolveAgentBookMock,
  safeParseMock,
} = vi.hoisted(() => ({
  handleAgentRouteMock: vi.fn(),
  resolveAgentBookMock: vi.fn(),
  safeParseMock: vi.fn(),
}));

vi.mock("@/lib/agents", () => ({
  AgentInputError: class AgentInputError extends Error {
    status = 400;
  },
  handleAgentRoute: handleAgentRouteMock,
  resolveAgentBook: resolveAgentBookMock,
  resolveBookRequestSchema: {
    safeParse: safeParseMock,
  },
}));

import { POST } from "@/app/api/agent/v1/books/resolve/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/agent/v1/books/resolve", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agent/v1/books/resolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    safeParseMock.mockImplementation((value: unknown) => ({
      success: true,
      data: value,
    }));
  });

  it("maps a strong match to a 200 response through the shared agent route handler", async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
    resolveAgentBookMock.mockResolvedValue({
      matchStatus: "strong",
      matchedBook: {
        book: {
          id: "book-1",
        },
      },
    });
    handleAgentRouteMock.mockImplementation(async (_request, config, handler) => {
      const result = await handler({
        userId: "user-1",
        owner: {
          userId: "user-1",
          email: "carlo@example.com",
          name: "Carlo",
        },
        agentClientId: "agent-1",
        credentialId: "credential-1",
        agentName: "Donna",
        agentKind: "PRIVATE_COMPANION",
        scopes: ["books:resolve"],
        tokenPrefix: "rla_test",
      }, { idempotencyKey: null });

      expect(config).toEqual({
        action: "books.resolve",
        scope: "books:resolve",
        resourceType: "book",
      });
      expect(result).toEqual({
        body: {
          matchStatus: "strong",
          matchedBook: {
            book: {
              id: "book-1",
            },
          },
        },
        status: 200,
        resourceId: "book-1",
      });

      return response;
    });

    const result = await POST(makeRequest({
      bookRef: {
        title: "Dune",
      },
    }));

    expect(result).toBe(response);
    expect(resolveAgentBookMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
    }), {
      title: "Dune",
    });
  });

  it("maps an ambiguous match to a 409 response", async () => {
    resolveAgentBookMock.mockResolvedValue({
      matchStatus: "ambiguous",
      matchedBook: null,
    });
    handleAgentRouteMock.mockImplementation(async (_request, _config, handler) => {
      const result = await handler({
        userId: "user-1",
        owner: {
          userId: "user-1",
          email: "carlo@example.com",
          name: "Carlo",
        },
        agentClientId: "agent-1",
        credentialId: "credential-1",
        agentName: "Donna",
        agentKind: "PRIVATE_COMPANION",
        scopes: ["books:resolve"],
        tokenPrefix: "rla_test",
      }, { idempotencyKey: null });

      expect(result.status).toBe(409);
      return new Response(JSON.stringify(result.body), { status: result.status });
    });

    const result = await POST(makeRequest({
      bookRef: {
        title: "Dune",
      },
    }));

    expect(result.status).toBe(409);
  });
});
