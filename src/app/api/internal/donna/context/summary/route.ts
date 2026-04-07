import { type NextRequest, NextResponse } from "next/server";
import { getDonnaSummary } from "@/lib/donna";
import { DonnaUserNotConfiguredError, DonnaUserNotFoundError } from "@/lib/donna/user";
import { validateInternalApiKey } from "@/lib/internal-api";
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = request.headers.get("x-api-key") ?? "unknown";
  const rateLimitResult = limiter.check(apiKey);
  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded", { endpoint: "GET /api/internal/donna/context/summary", keyPrefix: apiKey.slice(0, 8) });
    return rateLimitResponse(rateLimitResult);
  }

  try {
    return NextResponse.json(await getDonnaSummary());
  } catch (error) {
    if (error instanceof DonnaUserNotConfiguredError || error instanceof DonnaUserNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    logger.error("Request failed", error, { endpoint: "GET /api/internal/donna/context/summary" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
