import type { NextRequest } from "next/server";
import { getAgentSummary, handleAgentRoute } from "@/lib/agents";

export async function GET(request: NextRequest): Promise<Response> {
  return handleAgentRoute(
    request,
    {
      action: "summary.read",
      scope: "summary:read",
      resourceType: "summary",
    },
    async (context) => ({
      body: await getAgentSummary(context),
    }),
  );
}

