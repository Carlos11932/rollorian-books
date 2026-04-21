import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  prismaMock,
  hashAgentTokenMock,
} = vi.hoisted(() => ({
  prismaMock: {
    agentCredential: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    agentClient: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  hashAgentTokenMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/agents/tokens", () => ({
  hashAgentToken: hashAgentTokenMock,
}));

import { AgentAuthError, AgentScopeError } from "@/lib/agents/errors";
import { getBearerToken, requireAgentScope, resolveAgentRequestContext } from "@/lib/agents/context";

function makeRequest(headers?: HeadersInit) {
  return new NextRequest("http://localhost/api/agent/v1/summary", {
    headers,
  });
}

function makeCredential(overrides: Record<string, unknown> = {}) {
  return {
    id: "credential-1",
    agentClientId: "agent-1",
    tokenPrefix: "rla_test",
    scopes: ["summary:read", "invalid:scope"],
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    revokedAt: null,
    agentClient: {
      id: "agent-1",
      userId: "user-1",
      name: "Donna",
      kind: "PRIVATE_COMPANION",
      status: "ACTIVE",
      user: {
        id: "user-1",
        email: "carlo@example.com",
        name: "Carlo",
      },
    },
    ...overrides,
  };
}

describe("agent context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hashAgentTokenMock.mockReturnValue("hashed-token");
    prismaMock.agentCredential.findUnique.mockResolvedValue(makeCredential());
    prismaMock.agentCredential.update.mockResolvedValue({});
    prismaMock.agentClient.update.mockResolvedValue({});
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it("reads the bearer token from the authorization header", () => {
    expect(getBearerToken(makeRequest({
      authorization: "Bearer secret-token",
    }))).toBe("secret-token");
  });

  it("rejects requests without a bearer token", () => {
    expect(() => getBearerToken(makeRequest())).toThrowError(new AgentAuthError("Missing Bearer token"));
  });

  it("resolves the authenticated agent context and refreshes last-used timestamps", async () => {
    const context = await resolveAgentRequestContext(makeRequest({
      authorization: "Bearer secret-token",
    }));

    expect(hashAgentTokenMock).toHaveBeenCalledWith("secret-token");
    expect(prismaMock.agentCredential.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: "hashed-token" },
    }));
    expect(context).toEqual({
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
      scopes: ["summary:read"],
      tokenPrefix: "rla_test",
    });
    expect(prismaMock.agentCredential.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "credential-1" },
    }));
    expect(prismaMock.agentClient.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "agent-1" },
    }));
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown tokens", async () => {
    prismaMock.agentCredential.findUnique.mockResolvedValue(null);

    await expect(resolveAgentRequestContext(makeRequest({
      authorization: "Bearer secret-token",
    }))).rejects.toThrowError(new AgentAuthError("Invalid token"));
  });

  it("rejects revoked, expired, or connection-revoked credentials", async () => {
    prismaMock.agentCredential.findUnique.mockResolvedValueOnce(makeCredential({
      revokedAt: new Date("2026-01-01T00:00:00.000Z"),
    }));

    await expect(resolveAgentRequestContext(makeRequest({
      authorization: "Bearer secret-token",
    }))).rejects.toThrowError(new AgentAuthError("Token revoked"));

    prismaMock.agentCredential.findUnique.mockResolvedValueOnce(makeCredential({
      expiresAt: new Date("2000-01-01T00:00:00.000Z"),
    }));

    await expect(resolveAgentRequestContext(makeRequest({
      authorization: "Bearer secret-token",
    }))).rejects.toThrowError(new AgentAuthError("Token expired"));

    prismaMock.agentCredential.findUnique.mockResolvedValueOnce(makeCredential({
      agentClient: {
        id: "agent-1",
        userId: "user-1",
        name: "Donna",
        kind: "PRIVATE_COMPANION",
        status: "REVOKED",
        user: {
          id: "user-1",
          email: "carlo@example.com",
          name: "Carlo",
        },
      },
    }));

    await expect(resolveAgentRequestContext(makeRequest({
      authorization: "Bearer secret-token",
    }))).rejects.toThrowError(new AgentAuthError("Agent connection revoked"));
  });

  it("enforces the required scope", () => {
    expect(() => requireAgentScope({
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
      scopes: ["summary:read"],
      tokenPrefix: "rla_test",
    }, "library:read")).toThrowError(new AgentScopeError("Missing required scope: library:read"));
  });
});
