import type { NextRequest } from "next/server";
import { getAgentLists, handleAgentRoute } from "@/lib/agents";

export async function GET(request: NextRequest): Promise<Response> {
  return handleAgentRoute(
    request,
    {
      action: "lists.read",
      scope: "lists:read",
      resourceType: "list",
    },
    async (context) => ({
      body: await getAgentLists(context),
    }),
  );
}

