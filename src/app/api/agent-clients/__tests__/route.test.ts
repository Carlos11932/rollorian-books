import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/auth/require-auth";

const {
  createAgentClientForUserMock,
  listAgentClientsForUserMock,
  listRecentAgentAuditEventsForUserMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  createAgentClientForUserMock: vi.fn(),
  listAgentClientsForUserMock: vi.fn(),
  listRecentAgentAuditEventsForUserMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@/lib/agents", () => ({
  createAgentClientForUser: createAgentClientForUserMock,
  createAgentClientSchema: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
  listAgentClientsForUser: listAgentClientsForUserMock,
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

import { GET, POST } from "@/app/api/agent-clients/route";

describe("/api/agent-clients route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listRecentAgentAuditEventsForUserMock.mockResolvedValue([{ id: "event-1", action: "agent.created", outcome: "SUCCESS", resourceType: null, resourceId: null, idempotencyKey: null, createdAt: "2026-04-22T10:00:00.000Z" }]);
    listAgentClientsForUserMock.mockResolvedValue([{ id: "client-1", name: "Donna", kind: "MCP_CLIENT", status: "ACTIVE", createdAt: "2026-04-22T10:00:00.000Z", updatedAt: "2026-04-22T10:00:00.000Z", lastUsedAt: null, credentials: [], recentEvents: [] }]);
    createAgentClientForUserMock.mockResolvedValue({
      client: { id: "client-1", name: "Donna", kind: "MCP_CLIENT", status: "ACTIVE", createdAt: "2026-04-22T10:00:00.000Z", updatedAt: "2026-04-22T10:00:00.000Z", lastUsedAt: null, credentials: [], recentEvents: [] },
      plainToken: "rla_live_token",
    });
  });

  it("returns clients and recent events on GET", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      clients: expect.any(Array),
      recentEvents: expect.any(Array),
    });
  });

  it("returns the created client plus refreshed recent events on POST", async () => {
    const response = await POST(new Request("http://localhost/api/agent-clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Donna", kind: "MCP_CLIENT", scopes: ["library:read"] }),
    }) as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      client: expect.objectContaining({ id: "client-1" }),
      plainToken: "rla_live_token",
      recentEvents: expect.any(Array),
    });
    expect(listRecentAgentAuditEventsForUserMock).toHaveBeenCalledWith("test-user-001");
  });

  it("returns 401 when auth fails", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    vi.mocked(requireAuth).mockRejectedValueOnce(new UnauthorizedError());

    const response = await GET();

    expect(response.status).toBe(401);
  });
});
