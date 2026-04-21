# Rollorian MCP

Private MCP server for Rollorian. This package does not access Prisma or the app database directly. It only calls the `Agent API`:

- `GET /api/agent/v1/me`
- `GET /api/agent/v1/summary`
- `GET /api/agent/v1/library`
- `POST /api/agent/v1/books/resolve`
- `POST /api/agent/v1/reading-events`
- `GET /api/agent/v1/recommendations`
- `GET /api/agent/v1/lists`

## Environment

```bash
ROLLORIAN_BASE_URL=https://your-rollorian.vercel.app
ROLLORIAN_AGENT_TOKEN=your-issued-agent-token
ROLLORIAN_MCP_MODE=stdio
ROLLORIAN_MCP_HTTP_HOST=127.0.0.1
ROLLORIAN_MCP_HTTP_PORT=8787
```

## Install

```bash
cd mcp/rollorian-mcp
npm ci
```

## Build and smoke test

```bash
npm run build
npm run smoke
```

## Run over stdio

```bash
npm run dev:stdio
```

Example Claude Desktop style config:

```json
{
  "mcpServers": {
    "rollorian": {
      "command": "node",
      "args": [
        "/absolute/path/to/rollorian-books/mcp/rollorian-mcp/dist/index.js",
        "stdio"
      ],
      "env": {
        "ROLLORIAN_BASE_URL": "https://your-rollorian.vercel.app",
        "ROLLORIAN_AGENT_TOKEN": "your-issued-agent-token"
      }
    }
  }
}
```

## Run over Streamable HTTP

```bash
npm run dev:http
```

Default endpoint:

```txt
http://127.0.0.1:8787/mcp
```

Default binding is loopback only so the private MCP stays local to the Pi unless you explicitly change the host.

## Tools

- `get_summary`
- `get_library_snapshot`
- `resolve_book`
- `apply_reading_event`
- `get_recommendations`
- `list_lists`

## Inspector

Use MCP Inspector against stdio or HTTP after exporting the environment variables above.

## Related docs

- Product-facing overview: `../../docs/agent-platform.md`
- Donna contract examples: `../../contracts/donna/README.md`

## Pi 5 service

See `systemd/rollorian-mcp.service` for a minimal service unit.

