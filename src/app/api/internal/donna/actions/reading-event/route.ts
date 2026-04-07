import { type NextRequest, NextResponse } from "next/server";
import { applyDonnaReadingEvent } from "@/lib/donna/books";
import { readingEventRequestSchema } from "@/lib/donna/contracts";
import { DonnaUserNotConfiguredError, DonnaUserNotFoundError } from "@/lib/donna/user";
import { validateInternalApiKey } from "@/lib/internal-api";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    console.error("[POST /api/internal/donna/actions/reading-event]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
