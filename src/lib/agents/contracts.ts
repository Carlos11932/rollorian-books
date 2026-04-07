import { z } from "zod";
import {
  donnaBookRefSchema,
  readingEventPayloadSchema,
  readingEventSchema,
  resolveBookRequestSchema,
} from "@/lib/donna/contracts";
import { AGENT_CLIENT_KINDS, AGENT_SCOPES } from "./constants";

export const agentSourceSchema = z.object({
  channel: z.string().min(1).default("agent"),
  actor: z.string().min(1).optional(),
}).optional();

export const agentReadingEventRequestSchema = z.object({
  event: readingEventSchema,
  bookRef: donnaBookRefSchema,
  payload: readingEventPayloadSchema,
  source: agentSourceSchema,
});

export const createAgentClientSchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(AGENT_CLIENT_KINDS).default("CUSTOM"),
  scopes: z.array(z.enum(AGENT_SCOPES)).min(1),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

export const issueAgentCredentialSchema = z.object({
  scopes: z.array(z.enum(AGENT_SCOPES)).min(1),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

export { resolveBookRequestSchema };

export type AgentReadingEventRequest = z.infer<typeof agentReadingEventRequestSchema>;
export type CreateAgentClientInput = z.infer<typeof createAgentClientSchema>;
export type IssueAgentCredentialInput = z.infer<typeof issueAgentCredentialSchema>;

