import { NextResponse, type NextRequest } from "next/server";
import {
  AgentInputError,
  AgentScopeError,
  agentReadingEventRequestSchema,
  applyAgentReadingEvent,
  resolveAgentRequestContext,
  requireAgentScope,
} from "@/lib/agents";
import { findSuccessfulIdempotentAuditEvent, getAuditOutcomeFromStatus, recordAgentAuditEvent } from "@/lib/agents/audit";
import { getErrorStatus, getPublicErrorMessage } from "@/lib/agents/errors";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest): Promise<Response> {
  const startedAt = Date.now();
  let context: Awaited<ReturnType<typeof resolveAgentRequestContext>> | null = null;
  let idempotencyKey: string | null = null;

  try {
    context = await resolveAgentRequestContext(request);
    requireAgentScope(context, "reading-events:write");
    idempotencyKey = request.headers.get("Idempotency-Key");

    if (!idempotencyKey) {
      throw new AgentInputError("Missing Idempotency-Key header");
    }

    const cached = await findSuccessfulIdempotentAuditEvent({
      agentClientId: context.agentClientId,
      action: "reading-events.write",
      idempotencyKey,
    });

    if (cached) {
      logger.info("Agent reading event deduplicated", {
        endpoint: request.nextUrl.pathname,
        userId: context.userId,
        agentClientId: context.agentClientId,
        idempotencyKey,
        latencyMs: Date.now() - startedAt,
      });

      return NextResponse.json(cached.body, { status: cached.status });
    }

    const body = await request.json().catch(() => null);
    const parsed = agentReadingEventRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new AgentInputError(parsed.error.issues.map((issue) => issue.message).join(", "));
    }

    const result = await applyAgentReadingEvent(context, parsed.data);
    const status = result.applied ? 200 : 409;

    await recordAgentAuditEvent({
      userId: context.userId,
      agentClientId: context.agentClientId,
      credentialId: context.credentialId,
      action: "reading-events.write",
      resourceType: "reading_event",
      resourceId: result.resolvedBook?.id ?? null,
      outcome: getAuditOutcomeFromStatus(status),
      idempotencyKey,
      metadata: {
        latencyMs: Date.now() - startedAt,
        path: request.nextUrl.pathname,
        status,
        responseStatus: status,
        responseBody: result,
        matchStatus: result.matchStatus,
        applied: result.applied,
      },
    });

    logger.info("Agent request completed", {
      endpoint: request.nextUrl.pathname,
      userId: context.userId,
      agentClientId: context.agentClientId,
      action: "reading-events.write",
      status,
      latencyMs: Date.now() - startedAt,
    });

    return NextResponse.json(result, { status });
  } catch (error) {
    const status = getErrorStatus(error);

    if (context) {
      await recordAgentAuditEvent({
        userId: context.userId,
        agentClientId: context.agentClientId,
        credentialId: context.credentialId,
        action: "reading-events.write",
        resourceType: "reading_event",
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
          action: "reading-events.write",
        });
      });
    }

    if (error instanceof AgentScopeError || error instanceof AgentInputError) {
      logger.warn("Agent request rejected", {
        endpoint: request.nextUrl.pathname,
        action: "reading-events.write",
        status,
        latencyMs: Date.now() - startedAt,
      });
    } else if (status >= 500) {
      logger.error("Agent request failed", error, {
        endpoint: request.nextUrl.pathname,
        action: "reading-events.write",
        latencyMs: Date.now() - startedAt,
      });
    }

    return NextResponse.json({ error: getPublicErrorMessage(error) }, { status });
  }
}
