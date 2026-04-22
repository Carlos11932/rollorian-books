import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  revokeAgentClientForUserMock,
  listRecentAgentAuditEventsForUserMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  revokeAgentClientForUserMock: vi.fn(),
  listRecentAgentAuditEventsForUserMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@/lib/agents", () => ({
  revokeAgentClientForUser: revokeAgentClientForUserMock,
  listRecentAgentAuditEventsForUser: listRecentAgentAuditEventsForUserMock,
}));

vi.mock("@/lib/agents/errors", () => ({
  getErrorStatus: (error: { status?: number }) => error.status ?? 500,
  getPublicErrorMessage: (error: Error) => error.message,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

import { POST } from "@/app/api/agent-clients/[agentClientId]/revoke/route";

describe("POST /api/agent-clients/[agentClientId]/revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revokeAgentClientForUserMock.mockResolvedValue({ id: "client-1", name: "Donna", kind: "MCP_CLIENT", status: "REVOKED", createdAt: "2026-04-22T10:00:00.000Z", updatedAt: "2026-04-22T10:10:00.000Z", lastUsedAt: null, credentials: [], recentEvents: [] });
    listRecentAgentAuditEventsForUserMock.mockResolvedValue([{ id: "event-3", action: "client.revoked", outcome: "SUCCESS", resourceType: null, resourceId: null, idempotencyKey: null, createdAt: "2026-04-22T10:10:00.000Z" }]);
  });

  it("returns the revoked client plus refreshed recent events", async () => {
    const response = await POST(new Request("http://localhost/api/agent-clients/client-1/revoke", { method: "POST" }), {
      params: Promise.resolve({ agentClientId: "client-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      client: expect.objectContaining({ status: "REVOKED" }),
      recentEvents: expect.any(Array),
    });
  });
});
