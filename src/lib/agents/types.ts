import type { AgentClientKind, AgentScope } from "@/lib/agents/constants";

export type AgentCredentialSummary = {
  id: string;
  tokenPrefix: string;
  scopes: AgentScope[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export type AgentAuditEventSummary = {
  id: string;
  action: string;
  outcome: "SUCCESS" | "FAILURE" | "REJECTED";
  resourceType: string | null;
  resourceId: string | null;
  idempotencyKey: string | null;
  createdAt: string;
};

export type AgentClientSummary = {
  id: string;
  name: string;
  kind: AgentClientKind;
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  credentials: AgentCredentialSummary[];
  recentEvents: AgentAuditEventSummary[];
};

export type AgentConnectionsResponse = {
  clients: AgentClientSummary[];
  recentEvents: AgentAuditEventSummary[];
};

export type AgentClientMutationResponse = {
  client: AgentClientSummary;
  recentEvents: AgentAuditEventSummary[];
  plainToken?: string;
};
