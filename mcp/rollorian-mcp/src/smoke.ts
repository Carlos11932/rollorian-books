import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema, ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { buildRollorianMcpServer } from "./server.js";
import type { RollorianAgentClient } from "./client.js";

async function main() {
  const mockClient = {
    getProfile: async () => ({
      id: "user-1",
      name: "Carlo",
    }),
    getSummary: async () => ({
      booksRead: 12,
      currentBook: "Dune",
    }),
    getLibrarySnapshot: async () => ({ items: [] }),
    resolveBook: async () => ({ matchStatus: "strong" }),
    applyReadingEvent: async () => ({ applied: true }),
    getRecommendations: async () => ({ items: [] }),
    listLists: async () => ({ lists: [] }),
  } satisfies Partial<RollorianAgentClient>;

  const server = buildRollorianMcpServer(mockClient as unknown as RollorianAgentClient);
  const client = new Client({
    name: "rollorian-mcp-smoke",
    version: "0.1.0",
  });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  try {
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const tools = await client.request({
      method: "tools/list",
      params: {},
    }, ListToolsResultSchema);

    assert.equal(tools.tools.length, 6);
    assert.ok(tools.tools.some((tool) => tool.name === "get_summary"));

    const result = await client.request({
      method: "tools/call",
      params: {
        name: "get_summary",
        arguments: {},
      },
    }, CallToolResultSchema);

    assert.equal(result.content[0]?.type, "text");
    assert.match(result.content[0]?.type === "text" ? result.content[0].text : "", /booksRead/);
  } finally {
    await server.close();
    await client.close();
  }
}

main().catch((error) => {
  console.error("Rollorian MCP smoke failed:", error);
  process.exit(1);
});
