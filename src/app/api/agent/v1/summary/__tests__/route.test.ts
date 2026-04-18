import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  handleAgentRouteMock,
  getAgentSummaryMock,
} = vi.hoisted(() => ({
  handleAgentRouteMock: vi.fn(),
  getAgentSummaryMock: vi.fn(),
}));

vi.mock("@/lib/agents", () => ({
  handleAgentRoute: handleAgentRouteMock,
  getAgentSummary: getAgentSummaryMock,
}));

import { GET } from "@/app/api/agent/v1/summary/route";

describe("GET /api/agent/v1/summary", () => {
  it("delegates to the shared agent route handler with the expected scope and action", async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
    handleAgentRouteMock.mockImplementation(async (_request, config, handler) => {
      const body = await handler({
        userId: "user-1",
        owner: {
          userId: "user-1",
          email: "carlo@example.com",
          name: "Carlo",
        },
        agentClientId: "agent-1",
        credentialId: "credential-1",
        agentName: "Donna",
        agentKind: "PRIVATE_COMPANION",
        scopes: ["summary:read"],
        tokenPrefix: "rla_test",
      }, { idempotencyKey: null });

      expect(config).toEqual({
        action: "summary.read",
        scope: "summary:read",
        resourceType: "summary",
      });
      expect(body).toEqual({
        body: {
          summary: true,
        },
      });

      return response;
    });
    getAgentSummaryMock.mockResolvedValue({ summary: true });

    const result = await GET(new NextRequest("http://localhost/api/agent/v1/summary"));

    expect(result).toBe(response);
    expect(getAgentSummaryMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
    }));
  });
});
