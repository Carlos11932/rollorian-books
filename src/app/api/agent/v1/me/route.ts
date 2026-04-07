import type { NextRequest } from "next/server";
import { getAgentProfile, handleAgentRoute } from "@/lib/agents";

export async function GET(request: NextRequest): Promise<Response> {
  return handleAgentRoute(
    request,
    {
      action: "profile.read",
      scope: "profile:read",
      resourceType: "profile",
    },
    async (context) => ({
      body: await getAgentProfile(context),
    }),
  );
}

