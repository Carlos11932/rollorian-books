import "server-only";

import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { getStats } from "@/lib/stats/get-stats";

export async function GET(): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const stats = await getStats(userId);
    return Response.json(stats);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/stats]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
