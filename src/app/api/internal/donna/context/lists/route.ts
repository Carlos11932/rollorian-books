import { type NextRequest, NextResponse } from "next/server";
import { getDonnaLists } from "@/lib/donna/books";
import { DonnaUserNotConfiguredError, DonnaUserNotFoundError } from "@/lib/donna/user";
import { validateInternalApiKey } from "@/lib/internal-api";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getDonnaLists());
  } catch (error) {
    if (error instanceof DonnaUserNotConfiguredError || error instanceof DonnaUserNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    logger.error("Request failed", error, { endpoint: "GET /api/internal/donna/context/lists" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
