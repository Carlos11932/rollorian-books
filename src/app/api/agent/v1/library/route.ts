import type { NextRequest } from "next/server";
import { getAgentLibrarySnapshot, handleAgentRoute } from "@/lib/agents";

export async function GET(request: NextRequest): Promise<Response> {
  return handleAgentRoute(
    request,
    {
      action: "library.read",
      scope: "library:read",
      resourceType: "library",
    },
    async (context) => ({
      body: await getAgentLibrarySnapshot(context),
    }),
  );
}

