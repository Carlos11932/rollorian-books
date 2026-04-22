import { describe, expect, it } from "vitest";
import { buildAgentOnboardingSnippets } from "@/lib/agents/onboarding";

describe("buildAgentOnboardingSnippets", () => {
  it("builds provider-specific snippets with a live token", () => {
    const snippets = buildAgentOnboardingSnippets({
      baseUrl: "https://rollorian-books.vercel.app",
      token: "rla_secret_token",
      repoRootPlaceholder: "/absolute/path/to/rollorian-books",
      serverName: "rollorian-books",
    });

    expect(snippets).toHaveLength(4);
    expect(snippets[0]?.primarySnippet).toContain("codex mcp add rollorian-books");
    expect(snippets[0]?.primarySnippet).toContain("ROLLORIAN_AGENT_TOKEN=rla_secret_token");
    expect(snippets[1]?.primarySnippet).toContain("claude mcp add --transport stdio");
    expect(snippets[2]?.primarySnippet).toContain('"type": "stdio"');
    expect(snippets[2]?.primarySnippet).toContain('"ROLLORIAN_BASE_URL": "https://rollorian-books.vercel.app"');
    expect(snippets[3]?.secondarySnippet).toContain("curl -H \"Authorization: Bearer rla_secret_token\"");
  });

  it("falls back to the token placeholder when no live token exists", () => {
    const snippets = buildAgentOnboardingSnippets({
      baseUrl: "https://rollorian-books.vercel.app",
      token: null,
      repoRootPlaceholder: "/absolute/path/to/rollorian-books",
      serverName: "rollorian-books",
    });

    for (const snippet of snippets) {
      expect(snippet.primarySnippet).toContain("<TOKEN>");
    }
  });
});
