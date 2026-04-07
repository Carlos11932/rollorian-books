import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { recordAgentAuditEvent, getAuditOutcomeFromStatus } from "./audit";
import {
  requireAgentScope,
  resolveAgentRequestContext,
  type AgentContext,
} from "./context";
import type { AgentScope } from "./constants";
import { AgentInputError, getErrorStatus, getPublicErrorMessage } from "./errors";

type AgentRouteResult = {
  body: unknown;
  status?: number;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function handleAgentRoute(
  request: NextRequest,
  config: {
    action: string;
    scope: AgentScope;
    resourceType?: string;
    requireIdempotencyKey?: boolean;
  },
  handler: (context: AgentContext, options: { idempotencyKey: string | null }) => Promise<AgentRouteResult>,
): Promise<Response> {
  const startedAt = Date.now();
  let context: AgentContext | null = null;
  let idempotencyKey: string | null = null;

  try {
    context = await resolveAgentRequestContext(request);
    requireAgentScope(context, config.scope);
    idempotencyKey = request.headers.get("Idempotency-Key");

    if (config.requireIdempotencyKey && !idempotencyKey) {
      throw new AgentInputError("Missing Idempotency-Key header");
    }

    const result = await handler(context, { idempotencyKey });
    const status = result.status ?? 200;

    await recordAgentAuditEvent({
      userId: context.userId,
      agentClientId: context.agentClientId,
      credentialId: context.credentialId,
      action: config.action,
      resourceType: config.resourceType ?? null,
      resourceId: result.resourceId ?? null,
      outcome: getAuditOutcomeFromStatus(status),
      idempotencyKey,
      metadata: {
        latencyMs: Date.now() - startedAt,
        path: request.nextUrl.pathname,
        status,
        ...result.metadata,
      },
    });

    logger.info("Agent request completed", {
      endpoint: request.nextUrl.pathname,
      userId: context.userId,
      agentClientId: context.agentClientId,
      action: config.action,
      status,
      latencyMs: Date.now() - startedAt,
    });

    return NextResponse.json(result.body, { status });
  } catch (error) {
    const status = getErrorStatus(error);

    if (context) {
      await recordAgentAuditEvent({
        userId: context.userId,
        agentClientId: context.agentClientId,
        credentialId: context.credentialId,
        action: config.action,
        resourceType: config.resourceType ?? null,
        outcome: getAuditOutcomeFromStatus(status),
        idempotencyKey,
        metadata: {
          latencyMs: Date.now() - startedAt,
          path: request.nextUrl.pathname,
          status,
          error: getPublicErrorMessage(error),
        },
      }).catch((auditError) => {
        logger.error("Agent audit failed", auditError, {
          endpoint: request.nextUrl.pathname,
          action: config.action,
        });
      });
    }

    if (status >= 500) {
      logger.error("Agent request failed", error, {
        endpoint: request.nextUrl.pathname,
        action: config.action,
        latencyMs: Date.now() - startedAt,
      });
    } else {
      logger.warn("Agent request rejected", {
        endpoint: request.nextUrl.pathname,
        action: config.action,
        status,
        latencyMs: Date.now() - startedAt,
      });
    }

    return NextResponse.json({ error: getPublicErrorMessage(error) }, { status });
  }
}
