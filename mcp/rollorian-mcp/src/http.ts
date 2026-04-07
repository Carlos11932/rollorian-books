import cors from "cors";
import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildRollorianMcpServer } from "./server.js";

function jsonRpcError(res: Response, message: string) {
  res.status(500).json({
    jsonrpc: "2.0",
    error: {
      code: -32603,
      message,
    },
    id: null,
  });
}

export async function startHttpServer(): Promise<void> {
  const host = process.env.ROLLORIAN_MCP_HTTP_HOST ?? "127.0.0.1";
  const port = Number(process.env.ROLLORIAN_MCP_HTTP_PORT ?? "8787");
  const app = express();

  app.use(express.json());
  app.use(cors({
    origin: "*",
    exposedHeaders: ["Mcp-Session-Id"],
  }));

  app.post("/mcp", async (req: Request, res: Response) => {
    const server = buildRollorianMcpServer();

    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      res.on("close", () => {
        transport.close();
        server.close();
      });
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        jsonRpcError(res, "Internal server error");
      }
    }
  });

  app.get("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    });
  });

  app.delete("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    });
  });

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(port, host, (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      console.log(`Rollorian MCP listening on http://${host}:${port}/mcp`);
      resolve();
    });

    server.on("error", reject);
  });
}

