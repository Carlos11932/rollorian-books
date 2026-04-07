import crypto from "node:crypto";

const TOKEN_PREFIX = "rla_";
const TOKEN_BYTES = 24;
const TOKEN_PREFIX_LENGTH = 14;

export function hashAgentToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createAgentToken(): {
  plainToken: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const plainToken = `${TOKEN_PREFIX}${crypto.randomBytes(TOKEN_BYTES).toString("hex")}`;

  return {
    plainToken,
    tokenHash: hashAgentToken(plainToken),
    tokenPrefix: plainToken.slice(0, TOKEN_PREFIX_LENGTH),
  };
}

