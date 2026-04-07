-- CreateEnum
CREATE TYPE "AgentClientKind" AS ENUM ('PRIVATE_COMPANION', 'MCP_CLIENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AgentClientStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "AgentAuditOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'REJECTED');

-- CreateTable
CREATE TABLE "AgentClient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AgentClientKind" NOT NULL DEFAULT 'CUSTOM',
    "status" "AgentClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "AgentClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCredential" (
    "id" TEXT NOT NULL,
    "agentClientId" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "AgentCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentClientId" TEXT NOT NULL,
    "credentialId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "outcome" "AgentAuditOutcome" NOT NULL,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentClient_userId_idx" ON "AgentClient"("userId");
CREATE INDEX "AgentClient_userId_status_idx" ON "AgentClient"("userId", "status");
CREATE INDEX "AgentClient_createdAt_idx" ON "AgentClient"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCredential_tokenHash_key" ON "AgentCredential"("tokenHash");
CREATE INDEX "AgentCredential_agentClientId_idx" ON "AgentCredential"("agentClientId");
CREATE INDEX "AgentCredential_revokedAt_idx" ON "AgentCredential"("revokedAt");
CREATE INDEX "AgentCredential_createdAt_idx" ON "AgentCredential"("createdAt");

-- CreateIndex
CREATE INDEX "AgentAuditEvent_userId_idx" ON "AgentAuditEvent"("userId");
CREATE INDEX "AgentAuditEvent_agentClientId_idx" ON "AgentAuditEvent"("agentClientId");
CREATE INDEX "AgentAuditEvent_credentialId_idx" ON "AgentAuditEvent"("credentialId");
CREATE INDEX "AgentAuditEvent_createdAt_idx" ON "AgentAuditEvent"("createdAt");
CREATE INDEX "AgentAuditEvent_idempotencyKey_idx" ON "AgentAuditEvent"("idempotencyKey");
CREATE UNIQUE INDEX "AgentAuditEvent_agentClientId_action_idempotencyKey_key" ON "AgentAuditEvent"("agentClientId", "action", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "AgentClient" ADD CONSTRAINT "AgentClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentCredential" ADD CONSTRAINT "AgentCredential_agentClientId_fkey" FOREIGN KEY ("agentClientId") REFERENCES "AgentClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentAuditEvent" ADD CONSTRAINT "AgentAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentAuditEvent" ADD CONSTRAINT "AgentAuditEvent_agentClientId_fkey" FOREIGN KEY ("agentClientId") REFERENCES "AgentClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentAuditEvent" ADD CONSTRAINT "AgentAuditEvent_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AgentCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
