import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildRollorianMcpServer } from "./server.js";
import { startHttpServer } from "./http.js";

async function main() {
  const mode = process.argv[2] ?? process.env.ROLLORIAN_MCP_MODE ?? "stdio";

  if (mode === "http") {
    await startHttpServer();
    return;
  }

  const server = buildRollorianMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Rollorian MCP failed to start:", error);
  process.exit(1);
});

