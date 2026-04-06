import { NextRequest, NextResponse } from "next/server";
import { getDonnaSummary } from "@/lib/donna/books";
import { DonnaUserNotConfiguredError, DonnaUserNotFoundError } from "@/lib/donna/user";
import { validateInternalApiKey } from "@/lib/internal-api";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getDonnaSummary());
  } catch (error) {
    if (error instanceof DonnaUserNotConfiguredError || error instanceof DonnaUserNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("[GET /api/internal/donna/context/summary]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
