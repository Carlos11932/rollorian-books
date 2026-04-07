import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AgentAuthError, AgentScopeError } from "@/lib/agents/errors";

const {
  resolveAgentRequestContextMock,
  requireAgentScopeMock,
  applyAgentReadingEventMock,
  findSuccessfulIdempotentAuditEventMock,
  recordAgentAuditEventMock,
  loggerInfoMock,
  loggerWarnMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  resolveAgentRequestContextMock: vi.fn(),
  requireAgentScopeMock: vi.fn(),
  applyAgentReadingEventMock: vi.fn(),
  findSuccessfulIdempotentAuditEventMock: vi.fn(),
  recordAgentAuditEventMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@/lib/agents", () => ({
  AgentInputError: class AgentInputError extends Error {
    status = 400;
  },
  AgentScopeError,
  agentReadingEventRequestSchema: {
    safeParse: (value: unknown) => ({
      success: true,
      data: value,
    }),
  },
  applyAgentReadingEvent: applyAgentReadingEventMock,
  resolveAgentRequestContext: resolveAgentRequestContextMock,
  requireAgentScope: requireAgentScopeMock,
}));

vi.mock("@/lib/agents/audit", () => ({
  findSuccessfulIdempotentAuditEvent: findSuccessfulIdempotentAuditEventMock,
  recordAgentAuditEvent: recordAgentAuditEventMock,
  getAuditOutcomeFromStatus: (status: number) => status >= 500 ? "FAILURE" : status >= 400 ? "REJECTED" : "SUCCESS",
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
    error: loggerErrorMock,
  },
}));

import { POST } from "@/app/api/agent/v1/reading-events/route";

const context = {
  userId: "user-1",
  owner: {
    userId: "user-1",
    email: "carlo@example.com",
    name: "Carlo",
  },
  agentClientId: "agent-1",
  credentialId: "credential-1",
  agentName: "Donna",
  agentKind: "PRIVATE_COMPANION" as const,
  scopes: ["reading-events:write"] as const,
  tokenPrefix: "rla_test",
};

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/agent/v1/reading-events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer secret",
      ...headers,
    },
    body: JSON.stringify({
      event: "finished",
      bookRef: { title: "Dune" },
      payload: {},
    }),
  });
}

describe("POST /api/agent/v1/reading-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAgentRequestContextMock.mockResolvedValue(context);
    requireAgentScopeMock.mockReturnValue(undefined);
    findSuccessfulIdempotentAuditEventMock.mockResolvedValue(null);
    recordAgentAuditEventMock.mockResolvedValue(undefined);
  });

  it("returns 400 when the idempotency header is missing", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing Idempotency-Key header" });
    expect(applyAgentReadingEventMock).not.toHaveBeenCalled();
  });

  it("returns the cached response for repeated idempotency keys", async () => {
    findSuccessfulIdempotentAuditEventMock.mockResolvedValue({
      status: 200,
      body: { applied: true, cached: true },
    });

    const response = await POST(makeRequest({ "Idempotency-Key": "same-key" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ applied: true, cached: true });
    expect(applyAgentReadingEventMock).not.toHaveBeenCalled();
  });

  it("returns 200 and audits the applied event", async () => {
    applyAgentReadingEventMock.mockResolvedValue({
      applied: true,
      resolvedBook: { id: "book-1", title: "Dune" },
      resultingState: { semanticState: "read" },
      warnings: [],
      matchStatus: "strong",
      suggestions: [],
    });

    const response = await POST(makeRequest({ "Idempotency-Key": "event-1" }));

    expect(response.status).toBe(200);
    expect(recordAgentAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "reading-events.write",
      outcome: "SUCCESS",
      idempotencyKey: "event-1",
    }));
  });

  it("returns 409 when the event cannot be applied", async () => {
    applyAgentReadingEventMock.mockResolvedValue({
      applied: false,
      resolvedBook: null,
      resultingState: null,
      warnings: [],
      matchStatus: "ambiguous",
      suggestions: [{ book: { id: "book-1", title: "Dune" } }],
    });

    const response = await POST(makeRequest({ "Idempotency-Key": "event-2" }));

    expect(response.status).toBe(409);
    expect(recordAgentAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "reading-events.write",
      outcome: "REJECTED",
    }));
  });

  it("returns 401 on invalid tokens", async () => {
    resolveAgentRequestContextMock.mockRejectedValue(new AgentAuthError("Invalid token"));

    const response = await POST(makeRequest({ "Idempotency-Key": "event-3" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid token" });
  });

  it("returns 403 when the agent lacks the required scope", async () => {
    requireAgentScopeMock.mockImplementation(() => {
      throw new AgentScopeError("Missing required scope: reading-events:write");
    });

    const response = await POST(makeRequest({ "Idempotency-Key": "event-4" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Missing required scope: reading-events:write" });
    expect(loggerWarnMock).toHaveBeenCalled();
  });
});
