import type {
  CreateAgentClientInput,
  IssueAgentCredentialInput,
} from "@/lib/agents/contracts";
import type {
  AgentClientMutationResponse,
  AgentConnectionsResponse,
} from "@/lib/types/agent";
import { apiFetch } from "./client";

export async function fetchAgentConnections(): Promise<AgentConnectionsResponse> {
  return apiFetch<AgentConnectionsResponse>("/api/agent-clients");
}

export async function createAgentConnection(input: CreateAgentClientInput): Promise<AgentClientMutationResponse> {
  return apiFetch<AgentClientMutationResponse>("/api/agent-clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function issueAgentCredential(
  agentClientId: string,
  input: IssueAgentCredentialInput,
): Promise<AgentClientMutationResponse> {
  return apiFetch<AgentClientMutationResponse>(`/api/agent-clients/${agentClientId}/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function revokeAgentClient(agentClientId: string): Promise<AgentClientMutationResponse> {
  return apiFetch<AgentClientMutationResponse>(`/api/agent-clients/${agentClientId}/revoke`, {
    method: "POST",
  });
}

export async function revokeAgentCredential(
  agentClientId: string,
  credentialId: string,
): Promise<AgentClientMutationResponse> {
  return apiFetch<AgentClientMutationResponse>(`/api/agent-clients/${agentClientId}/credentials/${credentialId}/revoke`, {
    method: "POST",
  });
}

