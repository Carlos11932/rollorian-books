import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RollorianAgentClient } from "./client.js";

function toStructuredContent(output: unknown): Record<string, unknown> {
  if (output && typeof output === "object" && !Array.isArray(output)) {
    return output as Record<string, unknown>;
  }

  return { result: output };
}

function asToolResult(output: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(output, null, 2),
      },
    ],
    structuredContent: toStructuredContent(output),
  };
}

export function buildRollorianMcpServer(client = new RollorianAgentClient()) {
  const server = new McpServer({
    name: "rollorian-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "get_summary",
    {
      title: "Get reading summary",
      description: "Return the compact Rollorian reading summary for the token owner.",
      inputSchema: {},
    },
    async () => asToolResult(await client.getSummary()),
  );

  server.registerTool(
    "get_library_snapshot",
    {
      title: "Get library snapshot",
      description: "Return the complete Rollorian library snapshot for the token owner.",
      inputSchema: {},
    },
    async () => asToolResult(await client.getLibrarySnapshot()),
  );

  server.registerTool(
    "resolve_book",
    {
      title: "Resolve book",
      description: "Resolve a book reference against the token owner's Rollorian library.",
      inputSchema: {
        bookId: z.string().optional(),
        isbn10: z.string().optional(),
        isbn13: z.string().optional(),
        title: z.string().optional(),
        authors: z.array(z.string()).optional(),
      },
    },
    async ({ bookId, isbn10, isbn13, title, authors }) => asToolResult(await client.resolveBook({
      bookId,
      isbn10,
      isbn13,
      title,
      authors,
    })),
  );

  server.registerTool(
    "apply_reading_event",
    {
      title: "Apply reading event",
      description: "Write a Rollorian reading event such as started, finished, rated, or paused.",
      inputSchema: {
        event: z.enum(["wishlisted", "started", "finished", "paused", "abandoned", "rated", "noted", "restarted"]),
        bookRef: z.object({
          bookId: z.string().optional(),
          isbn10: z.string().optional(),
          isbn13: z.string().optional(),
          title: z.string().optional(),
          authors: z.array(z.string()).optional(),
        }),
        payload: z.object({
          title: z.string().optional(),
          subtitle: z.string().optional(),
          authors: z.array(z.string()).optional(),
          description: z.string().optional(),
          coverUrl: z.string().url().optional(),
          publisher: z.string().optional(),
          publishedDate: z.string().optional(),
          pageCount: z.number().int().positive().optional(),
          isbn10: z.string().optional(),
          isbn13: z.string().optional(),
          genres: z.array(z.string()).optional(),
          rating: z.number().int().min(1).max(5).optional(),
          notes: z.string().optional(),
          occurredAt: z.string().datetime().optional(),
        }).optional(),
        channel: z.string().optional(),
        idempotencyKey: z.string().optional(),
      },
    },
    async ({ event, bookRef, payload, channel, idempotencyKey }) => asToolResult(await client.applyReadingEvent({
      event,
      bookRef,
      payload,
      channel,
      idempotencyKey,
    })),
  );

  server.registerTool(
    "get_recommendations",
    {
      title: "Get recommendations",
      description: "Return personalized recommendations for the token owner.",
      inputSchema: {},
    },
    async () => asToolResult(await client.getRecommendations()),
  );

  server.registerTool(
    "list_lists",
    {
      title: "List lists",
      description: "Return the token owner's saved Rollorian lists.",
      inputSchema: {},
    },
    async () => asToolResult(await client.listLists()),
  );

  return server;
}
