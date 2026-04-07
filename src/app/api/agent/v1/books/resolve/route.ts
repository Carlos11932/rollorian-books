import type { NextRequest } from "next/server";
import { AgentInputError, handleAgentRoute, resolveAgentBook, resolveBookRequestSchema } from "@/lib/agents";

export async function POST(request: NextRequest): Promise<Response> {
  return handleAgentRoute(
    request,
    {
      action: "books.resolve",
      scope: "books:resolve",
      resourceType: "book",
    },
    async (context) => {
      const body = await request.json().catch(() => null);
      const parsed = resolveBookRequestSchema.safeParse(body);

      if (!parsed.success) {
        throw new AgentInputError(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const result = await resolveAgentBook(context, parsed.data.bookRef);
      const status = result.matchStatus === "none"
        ? 404
        : result.matchStatus === "ambiguous"
          ? 409
          : 200;

      return {
        body: result,
        status,
        resourceId: result.matchedBook?.book.id ?? null,
      };
    },
  );
}
