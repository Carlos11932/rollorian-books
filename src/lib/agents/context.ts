import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAgentScope, type AgentClientKind, type AgentScope } from "./constants";
import { AgentAuthError, AgentScopeError } from "./errors";
import { hashAgentToken } from "./tokens";

export type AgentOwner = {
  userId: string;
  email: string;
  name: string | null;
};

export type AgentContext = {
  userId: string;
  owner: AgentOwner;
  agentClientId: string;
  credentialId: string;
  agentName: string;
  agentKind: AgentClientKind;
  scopes: AgentScope[];
  tokenPrefix: string;
};

export function getBearerToken(request: NextRequest | Request): string {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AgentAuthError("Missing Bearer token");
  }

  return token;
}

export async function resolveAgentRequestContext(request: NextRequest | Request): Promise<AgentContext> {
  const token = getBearerToken(request);
  const tokenHash = hashAgentToken(token);

  const credential = await prisma.agentCredential.findUnique({
    where: { tokenHash },
    include: {
      agentClient: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!credential) {
    throw new AgentAuthError("Invalid token");
  }

  if (credential.revokedAt) {
    throw new AgentAuthError("Token revoked");
  }

  if (credential.expiresAt && credential.expiresAt <= new Date()) {
    throw new AgentAuthError("Token expired");
  }

  if (credential.agentClient.status !== "ACTIVE") {
    throw new AgentAuthError("Agent connection revoked");
  }

  const scopes = credential.scopes.filter(isAgentScope);
  const now = new Date();

  await prisma.$transaction([
    prisma.agentCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: now },
    }),
    prisma.agentClient.update({
      where: { id: credential.agentClientId },
      data: { lastUsedAt: now },
    }),
  ]);

  return {
    userId: credential.agentClient.userId,
    owner: {
      userId: credential.agentClient.user.id,
      email: credential.agentClient.user.email,
      name: credential.agentClient.user.name,
    },
    agentClientId: credential.agentClientId,
    credentialId: credential.id,
    agentName: credential.agentClient.name,
    agentKind: credential.agentClient.kind,
    scopes,
    tokenPrefix: credential.tokenPrefix,
  };
}

export function requireAgentScope(context: AgentContext, scope: AgentScope): void {
  if (!context.scopes.includes(scope)) {
    throw new AgentScopeError(`Missing required scope: ${scope}`);
  }
}
