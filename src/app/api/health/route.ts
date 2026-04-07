import "server-only";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({ status: "ok" });
  } catch (error) {
    logger.error("Request failed", error, { endpoint: "GET /api/health" });
    return Response.json(
      { status: "error", message: "Database unreachable" },
      { status: 503 }
    );
  }
}
