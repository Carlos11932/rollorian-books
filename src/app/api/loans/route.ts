import "server-only";

import type { NextRequest } from "next/server";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import {
  getUserLoans,
  requestLoan,
  offerLoan,
  LoanBookNotInLibraryError,
} from "@/lib/loans";

export async function GET(): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const loans = await getUserLoans(userId);
    return Response.json({ loans });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/loans]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const body = (await request.json()) as {
      type: "request" | "offer";
      targetUserId: string;
      bookId: string;
    };

    if (!body.type || !body.targetUserId || !body.bookId) {
      return Response.json({ error: "Missing type, targetUserId, or bookId" }, { status: 400 });
    }

    const loan = body.type === "request"
      ? await requestLoan(userId, body.targetUserId, body.bookId)
      : await offerLoan(userId, body.targetUserId, body.bookId);

    return Response.json(loan, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof LoanBookNotInLibraryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[POST /api/loans]", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
