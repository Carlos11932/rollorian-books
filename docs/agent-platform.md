# Rollorian Agent Platform

This feature turns Rollorian into a product-facing platform for user-owned agents.

## Core pieces

- `Agent API` inside the Next.js app on Vercel.
- `Agent connections` in Settings for normal authenticated users.
- `Donna` kept as a reference client instead of a product feature.
- `Private MCP` package for the Pi 5 that consumes the Agent API.

## Agent API

All agent-facing routes live under `/api/agent/v1` and use:

- `Authorization: Bearer <token>`
- `Idempotency-Key` on `POST /api/agent/v1/reading-events`

Supported scopes:

- `profile:read`
- `summary:read`
- `library:read`
- `lists:read`
- `recommendations:read`
- `books:resolve`
- `reading-events:write`

## Settings flow

Users can now:

- create agent connections
- choose the connection kind
- choose explicit scopes
- generate a token shown once
- revoke tokens
- revoke full connections
- inspect recent agent audit events

## Private MCP flow

The package at `mcp/rollorian-mcp` supports:

- `stdio` for local desktop clients
- `Streamable HTTP` for local always-on use on the Pi 5

It talks only to the Agent API and never to Prisma directly.

## Public MCP next step

The public MCP should live in a separate Vercel project and reuse the same Agent API contract. That rollout is intentionally deferred until auth, scopes, audit, and docs are already stable.
