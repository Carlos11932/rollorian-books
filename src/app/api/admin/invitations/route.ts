import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, UnauthorizedError, ForbiddenError } from "@/lib/auth/require-auth";
import { z } from "zod";

const createInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function GET(): Promise<Response> {
  try {
    await requireSuperAdmin();

    const invitations = await prisma.invitation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        invitedBy: {
          select: { id: true, name: true },
        },
      },
    });

    return Response.json({ invitations });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[GET /api/admin/invitations]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireSuperAdmin();

    const body: unknown = await request.json();
    const result = createInvitationSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // EC5: Check if email is already registered
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return Response.json(
        { error: "User with this email is already registered" },
        { status: 409 }
      );
    }

    // Check for an existing PENDING invitation (EC2: allow re-invite after expiry)
    const existingPending = await prisma.invitation.findFirst({
      where: { email, status: "PENDING" },
      select: { id: true },
    });

    if (existingPending) {
      return Response.json(
        { error: "A pending invitation already exists for this email" },
        { status: 409 }
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.invitation.create({
      data: {
        email,
        invitedById: userId,
        status: "PENDING",
        expiresAt,
      },
      include: {
        invitedBy: {
          select: { id: true, name: true },
        },
      },
    });

    return Response.json(invitation, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[POST /api/admin/invitations]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
