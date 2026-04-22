import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  issueAgentCredentialForUserMock,
  listRecentAgentAuditEventsForUserMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  issueAgentCredentialForUserMock: vi.fn(),
  listRecentAgentAuditEventsForUserMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@/lib/agents", () => ({
  issueAgentCredentialForUser: issueAgentCredentialForUserMock,
  issueAgentCredentialSchema: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
  listRecentAgentAuditEventsForUser: listRecentAgentAuditEventsForUserMock,
}));

vi.mock("@/lib/agents/errors", () => ({
  AgentInputError: class AgentInputError extends Error {
    status = 400;
  },
  getErrorStatus: (error: { status?: number }) => error.status ?? 500,
  getPublicErrorMessage: (error: Error) => error.message,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

import { POST } from "@/app/api/agent-clients/[agentClientId]/credentials/route";

describe("POST /api/agent-clients/[agentClientId]/credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    issueAgentCredentialForUserMock.mockResolvedValue({
      client: { id: "client-1", name: "Donna", kind: "MCP_CLIENT", status: "ACTIVE", createdAt: "2026-04-22T10:00:00.000Z", updatedAt: "2026-04-22T10:00:00.000Z", lastUsedAt: null, credentials: [], recentEvents: [] },
      plainToken: "rla_rotated_token",
    });
    listRecentAgentAuditEventsForUserMock.mockResolvedValue([{ id: "event-2", action: "credential.issued", outcome: "SUCCESS", resourceType: null, resourceId: null, idempotencyKey: null, createdAt: "2026-04-22T10:05:00.000Z" }]);
  });

  it("returns the rotated token and refreshed recent events", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/agent-clients/client-1/credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scopes: ["library:read"] }),
      }),
      { params: Promise.resolve({ agentClientId: "client-1" }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      client: expect.objectContaining({ id: "client-1" }),
      plainToken: "rla_rotated_token",
      recentEvents: expect.any(Array),
    });
  });
});
