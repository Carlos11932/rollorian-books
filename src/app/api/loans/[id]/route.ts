import "server-only";

import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";
import {
  acceptLoan,
  declineLoan,
  returnLoan,
  LoanNotFoundError,
  LoanForbiddenError,
  LoanInvalidTransitionError,
  LoanBookNotInLibraryError,
  LoanBookNotOwnedError,
  LoanOwnershipVerificationUnavailableError,
  LoanWriteConflictError,
} from "@/lib/loans";

const patchLoanSchema = z.object({
  action: z.enum(["accept", "decline", "return"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const payload: unknown = await request.json();
    const result = patchLoanSchema.safeParse(payload);

    if (!result.success) {
      const rawAction = (typeof payload === "object" && payload !== null && "action" in payload)
        ? (payload as { action: unknown }).action
        : undefined;

      if (rawAction !== undefined) {
        return Response.json({ error: "Invalid action" }, { status: 400 });
      }

      return Response.json({ error: "Missing action" }, { status: 400 });
    }

    let loan;
    switch (result.data.action) {
      case "accept":
        loan = await acceptLoan(id, userId);
        break;
      case "decline":
        loan = await declineLoan(id, userId);
        break;
      case "return":
        loan = await returnLoan(id, userId);
        break;
      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    return Response.json(loan);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof LoanNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof LoanForbiddenError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof LoanInvalidTransitionError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof LoanBookNotInLibraryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof LoanBookNotOwnedError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof LoanOwnershipVerificationUnavailableError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof LoanWriteConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    logger.error("Request failed", error, { endpoint: "PATCH /api/loans/[id]" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
