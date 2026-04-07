import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AgentAuthError, AgentScopeError } from "@/lib/agents/errors";

const {
  resolveAgentRequestContextMock,
  requireAgentScopeMock,
  recordAgentAuditEventMock,
  loggerInfoMock,
  loggerWarnMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  resolveAgentRequestContextMock: vi.fn(),
  requireAgentScopeMock: vi.fn(),
  recordAgentAuditEventMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@/lib/agents/context", () => ({
  resolveAgentRequestContext: resolveAgentRequestContextMock,
  requireAgentScope: requireAgentScopeMock,
}));

vi.mock("@/lib/agents/audit", () => ({
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

import { handleAgentRoute } from "@/lib/agents/http";

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
  scopes: ["summary:read"] as const,
  tokenPrefix: "rla_test",
};

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/agent/v1/summary");
}

describe("handleAgentRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAgentRequestContextMock.mockResolvedValue(context);
    requireAgentScopeMock.mockReturnValue(undefined);
    recordAgentAuditEventMock.mockResolvedValue(undefined);
  });

  it("returns handler JSON and records success audits", async () => {
    const response = await handleAgentRoute(
      makeRequest(),
      { action: "summary.read", scope: "summary:read", resourceType: "summary" },
      async () => ({
        body: { ok: true },
        status: 200,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(recordAgentAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      agentClientId: "agent-1",
      action: "summary.read",
      outcome: "SUCCESS",
    }));
    expect(loggerInfoMock).toHaveBeenCalled();
  });

  it("returns 403 and records a rejected audit when the scope is missing", async () => {
    requireAgentScopeMock.mockImplementation(() => {
      throw new AgentScopeError("Missing required scope: summary:read");
    });

    const response = await handleAgentRoute(
      makeRequest(),
      { action: "summary.read", scope: "summary:read", resourceType: "summary" },
      async () => ({ body: { ok: true } }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Missing required scope: summary:read" });
    expect(recordAgentAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "summary.read",
      outcome: "REJECTED",
    }));
    expect(loggerWarnMock).toHaveBeenCalled();
  });

  it("returns 401 without recording an audit when auth fails before context resolution", async () => {
    resolveAgentRequestContextMock.mockRejectedValue(new AgentAuthError("Invalid token"));

    const response = await handleAgentRoute(
      makeRequest(),
      { action: "summary.read", scope: "summary:read", resourceType: "summary" },
      async () => ({ body: { ok: true } }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid token" });
    expect(recordAgentAuditEventMock).not.toHaveBeenCalled();
  });
});
