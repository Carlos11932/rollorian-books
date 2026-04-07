import type { NextRequest } from "next/server";
import { getAgentRecommendations, handleAgentRoute } from "@/lib/agents";

export async function GET(request: NextRequest): Promise<Response> {
  return handleAgentRoute(
    request,
    {
      action: "recommendations.read",
      scope: "recommendations:read",
      resourceType: "recommendation",
    },
    async (context) => ({
      body: await getAgentRecommendations(context),
    }),
  );
}

