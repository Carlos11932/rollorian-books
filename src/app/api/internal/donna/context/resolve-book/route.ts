import { type NextRequest, NextResponse } from "next/server";
import { resolveDonnaBook } from "@/lib/donna/books";
import { resolveBookRequestSchema } from "@/lib/donna/contracts";
import { DonnaUserNotConfiguredError, DonnaUserNotFoundError } from "@/lib/donna/user";
import { validateInternalApiKey } from "@/lib/internal-api";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resolveBookRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return NextResponse.json(await resolveDonnaBook(parsed.data.bookRef));
  } catch (error) {
    if (error instanceof DonnaUserNotConfiguredError || error instanceof DonnaUserNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    logger.error("Request failed", error, { endpoint: "POST /api/internal/donna/context/resolve-book" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
