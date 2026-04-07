import { type NextRequest, NextResponse } from "next/server";
import { applyDonnaReadingEvent } from "@/lib/donna/books";
import { readingEventRequestSchema } from "@/lib/donna/contracts";
import { DonnaUserNotConfiguredError, DonnaUserNotFoundError } from "@/lib/donna/user";
import { validateInternalApiKey } from "@/lib/internal-api";
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = request.headers.get("x-api-key") ?? "unknown";
  const rateLimitResult = limiter.check(apiKey);
  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded", { endpoint: "POST /api/internal/donna/actions/reading-event", keyPrefix: apiKey.slice(0, 8) });
    return rateLimitResponse(rateLimitResult);
  }

  const body = await request.json().catch(() => null);
  const parsed = readingEventRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await applyDonnaReadingEvent(parsed.data);
    return NextResponse.json(result, { status: result.applied ? 200 : 409 });
  } catch (error) {
    if (error instanceof DonnaUserNotConfiguredError || error instanceof DonnaUserNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    logger.error("Request failed", error, { endpoint: "POST /api/internal/donna/actions/reading-event" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
