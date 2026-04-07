import "server-only";

import {
  isMissingSocialSchemaError,
  isMissingUserBookSchemaError,
} from "@/lib/prisma-schema-compat";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { getRecommendations } from "@/lib/recommendations/get-recommendations";
import { logger } from "@/lib/logger";

export async function GET(): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const recommendations = await getRecommendations(userId);
    return Response.json({ recommendations });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isMissingUserBookSchemaError(error)) {
      return Response.json({ recommendations: [] });
    }
    if (isMissingSocialSchemaError(error)) {
      return Response.json({ recommendations: [] });
    }
    logger.error("Request failed", error, { endpoint: "GET /api/recommendations" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
