import "server-only";

import type { AgentAuditOutcome, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditMetadata = Record<string, unknown> | null | undefined;

function toJsonMetadata(metadata: AuditMetadata): Prisma.InputJsonValue | undefined {
  if (!metadata) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
}

export function getAuditOutcomeFromStatus(status: number): AgentAuditOutcome {
  if (status >= 500) {
    return "FAILURE";
  }

  if (status >= 400) {
    return "REJECTED";
  }

  return "SUCCESS";
}

export async function recordAgentAuditEvent(input: {
  userId: string;
  agentClientId: string;
  credentialId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  outcome: AgentAuditOutcome;
  idempotencyKey?: string | null;
  metadata?: AuditMetadata;
}): Promise<void> {
  await prisma.agentAuditEvent.create({
    data: {
      userId: input.userId,
      agentClientId: input.agentClientId,
      credentialId: input.credentialId ?? null,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      outcome: input.outcome,
      idempotencyKey: input.idempotencyKey ?? null,
      metadata: toJsonMetadata(input.metadata),
    },
  });
}

export async function findSuccessfulIdempotentAuditEvent(input: {
  agentClientId: string;
  action: string;
  idempotencyKey: string;
}): Promise<{ status: number; body: unknown } | null> {
  const event = await prisma.agentAuditEvent.findFirst({
    where: {
      agentClientId: input.agentClientId,
      action: input.action,
      idempotencyKey: input.idempotencyKey,
      outcome: "SUCCESS",
    },
    select: { metadata: true },
  });

  if (!event?.metadata || typeof event.metadata !== "object" || Array.isArray(event.metadata)) {
    return null;
  }

  const responseStatus = "responseStatus" in event.metadata ? event.metadata.responseStatus : undefined;
  const responseBody = "responseBody" in event.metadata ? event.metadata.responseBody : undefined;

  if (typeof responseStatus !== "number") {
    return null;
  }

  return {
    status: responseStatus,
    body: responseBody ?? null,
  };
}
