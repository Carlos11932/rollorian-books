import "server-only";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, UnauthorizedError, ForbiddenError } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    await requireSuperAdmin();

    const { id } = await params;

    const invitation = await prisma.invitation.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!invitation) {
      return Response.json({ error: "Invitation not found" }, { status: 404 });
    }

    // NF6: Only PENDING invitations can be revoked; ACCEPTED ones are audit records
    if (invitation.status !== "PENDING") {
      return Response.json(
        { error: "Only pending invitations can be revoked" },
        { status: 422 }
      );
    }

    await prisma.invitation.delete({ where: { id } });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    logger.error("Request failed", error, { endpoint: "DELETE /api/admin/invitations/[id]" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
