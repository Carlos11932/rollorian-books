import "server-only";

import type { DonnaBookRef, ReadingEventRequest } from "@/lib/donna/contracts";
import {
  applyReadingEventForUser,
  getLibrarySnapshotForOwner,
  getListsForOwner,
  getRecommendationsForUser,
  getStatusForOwner,
  getSummaryForOwner,
  resolveUserBookByReference,
} from "@/lib/donna";
import type { AgentReadingEventRequest } from "./contracts";
import type { AgentContext } from "./context";

export async function getAgentProfile(context: AgentContext) {
  const base = await getStatusForOwner(context.owner);

  return {
    ...base,
    agent: {
      id: context.agentClientId,
      name: context.agentName,
      kind: context.agentKind,
      scopes: context.scopes,
      tokenPrefix: context.tokenPrefix,
    },
  };
}

export async function getAgentSummary(context: AgentContext) {
  return getSummaryForOwner(context.owner);
}

export async function getAgentLibrarySnapshot(context: AgentContext) {
  return getLibrarySnapshotForOwner(context.owner);
}

export async function getAgentLists(context: AgentContext) {
  return getListsForOwner(context.owner);
}

export async function getAgentRecommendations(context: AgentContext) {
  return getRecommendationsForUser(context.userId);
}

export async function resolveAgentBook(context: AgentContext, ref: DonnaBookRef) {
  return resolveUserBookByReference(context.userId, ref);
}

export async function applyAgentReadingEvent(context: AgentContext, input: AgentReadingEventRequest) {
  const request: ReadingEventRequest = {
    event: input.event,
    bookRef: input.bookRef,
    payload: input.payload,
    source: {
      channel: input.source?.channel ?? "agent",
      actor: context.agentName,
    },
  };

  return applyReadingEventForUser(context.owner, request);
}
