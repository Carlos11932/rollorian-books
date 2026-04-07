import type { NextRequest } from "next/server";
import { createAgentClientSchema, createAgentClientForUser, listAgentClientsForUser, listRecentAgentAuditEventsForUser } from "@/lib/agents";
import { AgentInputError, getErrorStatus, getPublicErrorMessage } from "@/lib/agents/errors";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";

export async function GET(): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const [clients, recentEvents] = await Promise.all([
      listAgentClientsForUser(userId),
      listRecentAgentAuditEventsForUser(userId),
    ]);

    return Response.json({ clients, recentEvents });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Request failed", error, { endpoint: "GET /api/agent-clients" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const body = await request.json().catch(() => null);
    const parsed = createAgentClientSchema.safeParse(body);

    if (!parsed.success) {
      throw new AgentInputError(parsed.error.issues.map((issue) => issue.message).join(", "));
    }

    const result = await createAgentClientForUser(userId, parsed.data);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = getErrorStatus(error);

    if (status >= 500) {
      logger.error("Request failed", error, { endpoint: "POST /api/agent-clients" });
    }

    return Response.json({ error: getPublicErrorMessage(error) }, { status });
  }
}

