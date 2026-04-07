export const AGENT_CLIENT_KINDS = [
  "PRIVATE_COMPANION",
  "MCP_CLIENT",
  "CUSTOM",
] as const;

export type AgentClientKind = (typeof AGENT_CLIENT_KINDS)[number];

export const AGENT_SCOPES = [
  "profile:read",
  "summary:read",
  "library:read",
  "lists:read",
  "recommendations:read",
  "books:resolve",
  "reading-events:write",
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

export const AGENT_SCOPE_LABELS: Record<AgentScope, { title: string; description: string }> = {
  "profile:read": {
    title: "Profile",
    description: "Read the agent owner profile and active connection metadata.",
  },
  "summary:read": {
    title: "Summary",
    description: "Read the high-level reading summary used by companions and dashboards.",
  },
  "library:read": {
    title: "Library",
    description: "Read the complete library snapshot with semantic reading states.",
  },
  "lists:read": {
    title: "Lists",
    description: "Read user-created book lists and their item counts.",
  },
  "recommendations:read": {
    title: "Recommendations",
    description: "Read personalized recommendations based on follows, groups, and overlap.",
  },
  "books:resolve": {
    title: "Resolve books",
    description: "Resolve book references against the existing library without mutating data.",
  },
  "reading-events:write": {
    title: "Write reading events",
    description: "Apply reading events such as started, finished, rated, paused, or noted.",
  },
};

export function isAgentScope(value: string): value is AgentScope {
  return AGENT_SCOPES.includes(value as AgentScope);
}

