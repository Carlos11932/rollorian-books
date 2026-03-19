import "server-only";

import { prisma } from "@/lib/prisma";

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("[GET /api/health]", error);
    return Response.json(
      { status: "error", message: "Database unreachable" },
      { status: 503 }
    );
  }
}
