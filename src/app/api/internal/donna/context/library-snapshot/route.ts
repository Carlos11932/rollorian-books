import { type NextRequest, NextResponse } from "next/server";
import { getDonnaLibrarySnapshot } from "@/lib/donna/books";
import { DonnaUserNotConfiguredError, DonnaUserNotFoundError } from "@/lib/donna/user";
import { validateInternalApiKey } from "@/lib/internal-api";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getDonnaLibrarySnapshot());
  } catch (error) {
    if (error instanceof DonnaUserNotConfiguredError || error instanceof DonnaUserNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("[GET /api/internal/donna/context/library-snapshot]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
