import "server-only";

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
} from "@/lib/loans";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const body = (await request.json()) as { action: "accept" | "decline" | "return" };

    if (!body.action) {
      return Response.json({ error: "Missing action" }, { status: 400 });
    }

    let loan;
    switch (body.action) {
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
    const message = error instanceof Error ? error.message : "Internal server error";
    logger.error("Request failed", error, { endpoint: "PATCH /api/loans/[id]" });
    return Response.json({ error: message }, { status: 500 });
  }
}
