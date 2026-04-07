import "server-only";

import { z } from "zod";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";
import {
  getUserLoans,
  requestLoan,
  offerLoan,
  LoanBookNotInLibraryError,
} from "@/lib/loans";

const createLoanSchema = z.object({
  type: z.enum(["request", "offer"]),
  targetUserId: z.string().min(1),
  bookId: z.string().min(1),
});

export async function GET(): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const loans = await getUserLoans(userId);
    return Response.json({ loans });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Request failed", error, { endpoint: "GET /api/loans" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const body: unknown = await request.json();
    const result = createLoanSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: "Invalid request", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { type, targetUserId, bookId } = result.data;

    const loan = type === "request"
      ? await requestLoan(userId, targetUserId, bookId)
      : await offerLoan(userId, targetUserId, bookId);

    return Response.json(loan, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof LoanBookNotInLibraryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    logger.error("Request failed", error, { endpoint: "POST /api/loans" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
