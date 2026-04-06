import type { NextRequest } from "next/server";
import crypto from "node:crypto";

export function validateInternalApiKey(request: NextRequest): boolean {
  const key = request.headers.get("x-api-key") ?? "";
  const expected = process.env["INTERNAL_API_KEY"] ?? "";

  if (expected.length === 0) {
    return false;
  }

  const constant = "internal-api-key-comparison";
  const keyDigest = crypto.createHmac("sha256", constant).update(key).digest();
  const expectedDigest = crypto.createHmac("sha256", constant).update(expected).digest();

  return crypto.timingSafeEqual(keyDigest, expectedDigest);
}
