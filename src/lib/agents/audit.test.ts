import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    agentAuditEvent: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  findSuccessfulIdempotentAuditEvent,
  getAuditOutcomeFromStatus,
  recordAgentAuditEvent,
} from "@/lib/agents/audit";

describe("agent audit helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.agentAuditEvent.create.mockResolvedValue({});
  });

  it("maps response statuses to audit outcomes", () => {
    expect(getAuditOutcomeFromStatus(200)).toBe("SUCCESS");
    expect(getAuditOutcomeFromStatus(409)).toBe("REJECTED");
    expect(getAuditOutcomeFromStatus(500)).toBe("FAILURE");
  });

  it("records agent audit events with JSON-safe metadata", async () => {
    await recordAgentAuditEvent({
      userId: "user-1",
      agentClientId: "agent-1",
      credentialId: "credential-1",
      action: "summary.read",
      resourceType: "summary",
      resourceId: "summary-1",
      outcome: "SUCCESS",
      idempotencyKey: "idem-1",
      metadata: {
        responseStatus: 200,
        responseBody: {
          ok: true,
        },
      },
    });

    expect(prismaMock.agentAuditEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        agentClientId: "agent-1",
        credentialId: "credential-1",
        action: "summary.read",
        resourceType: "summary",
        resourceId: "summary-1",
        outcome: "SUCCESS",
        idempotencyKey: "idem-1",
        metadata: {
          responseStatus: 200,
          responseBody: {
            ok: true,
          },
        },
      },
    });
  });

  it("rehydrates successful idempotent responses when the audit metadata includes the cached payload", async () => {
    prismaMock.agentAuditEvent.findFirst.mockResolvedValue({
      metadata: {
        responseStatus: 200,
        responseBody: {
          applied: true,
        },
      },
    });

    await expect(findSuccessfulIdempotentAuditEvent({
      agentClientId: "agent-1",
      action: "reading-events.write",
      idempotencyKey: "idem-1",
    })).resolves.toEqual({
      status: 200,
      body: {
        applied: true,
      },
    });
  });

  it("returns null when the stored audit metadata cannot be used as a cached response", async () => {
    prismaMock.agentAuditEvent.findFirst.mockResolvedValue({
      metadata: {
        status: 200,
      },
    });

    await expect(findSuccessfulIdempotentAuditEvent({
      agentClientId: "agent-1",
      action: "reading-events.write",
      idempotencyKey: "idem-1",
    })).resolves.toBeNull();
  });
});
