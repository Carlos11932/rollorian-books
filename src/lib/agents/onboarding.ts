export const AGENT_ONBOARDING_PROVIDERS = [
  "codex",
  "claude",
  "cursor",
  "generic",
] as const;

export type AgentOnboardingProvider = (typeof AGENT_ONBOARDING_PROVIDERS)[number];

export type AgentOnboardingSnippet = {
  provider: AgentOnboardingProvider;
  primaryLabel: "command" | "json";
  primarySnippet: string;
  secondaryLabel?: "json" | "env" | "curl";
  secondarySnippet?: string;
};

export type BuildAgentOnboardingOptions = {
  baseUrl: string;
  token: string | null;
  repoRootPlaceholder: string;
  serverName: string;
};

const TOKEN_PLACEHOLDER = "<TOKEN>";

function createEnvBlock(baseUrl: string, token: string) {
  return [
    `ROLLORIAN_BASE_URL=${baseUrl}`,
    `ROLLORIAN_AGENT_TOKEN=${token}`,
  ].join("\n");
}

function createCursorConfig(pathToMcp: string, baseUrl: string, token: string, serverName: string) {
  return JSON.stringify({
    mcpServers: {
      [serverName]: {
        type: "stdio",
        command: "npm",
        args: ["--prefix", pathToMcp, "run", "dev:stdio"],
        env: {
          ROLLORIAN_BASE_URL: baseUrl,
          ROLLORIAN_AGENT_TOKEN: token,
        },
      },
    },
  }, null, 2);
}

function createGenericConfig(pathToMcp: string, baseUrl: string, token: string) {
  return JSON.stringify({
    command: "npm",
    args: ["--prefix", pathToMcp, "run", "dev:stdio"],
    env: {
      ROLLORIAN_BASE_URL: baseUrl,
      ROLLORIAN_AGENT_TOKEN: token,
    },
  }, null, 2);
}

export function buildAgentOnboardingSnippets({
  baseUrl,
  token,
  repoRootPlaceholder,
  serverName,
}: BuildAgentOnboardingOptions): AgentOnboardingSnippet[] {
  const resolvedToken = token?.trim() || TOKEN_PLACEHOLDER;
  const pathToMcp = `${repoRootPlaceholder}/mcp/rollorian-mcp`;
  const envBlock = createEnvBlock(baseUrl, resolvedToken);

  return [
    {
      provider: "codex",
      primaryLabel: "command",
      primarySnippet: [
        `codex mcp add ${serverName} --env ROLLORIAN_BASE_URL=${baseUrl} --env ROLLORIAN_AGENT_TOKEN=${resolvedToken} -- npm --prefix ${pathToMcp} run dev:stdio`,
        "codex mcp list",
      ].join("\n"),
      secondaryLabel: "env",
      secondarySnippet: envBlock,
    },
    {
      provider: "claude",
      primaryLabel: "command",
      primarySnippet: [
        `claude mcp add --transport stdio --env ROLLORIAN_BASE_URL=${baseUrl} --env ROLLORIAN_AGENT_TOKEN=${resolvedToken} ${serverName} -- npm --prefix ${pathToMcp} run dev:stdio`,
        "claude mcp list",
      ].join("\n"),
      secondaryLabel: "env",
      secondarySnippet: envBlock,
    },
    {
      provider: "cursor",
      primaryLabel: "json",
      primarySnippet: createCursorConfig(pathToMcp, baseUrl, resolvedToken, serverName),
      secondaryLabel: "env",
      secondarySnippet: envBlock,
    },
    {
      provider: "generic",
      primaryLabel: "json",
      primarySnippet: createGenericConfig(pathToMcp, baseUrl, resolvedToken),
      secondaryLabel: "curl",
      secondarySnippet: `curl -H "Authorization: Bearer ${resolvedToken}" ${baseUrl}/api/agent/v1/summary`,
    },
  ];
}
