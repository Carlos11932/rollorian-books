import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateBookSchema } from "@/lib/schemas/book";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { id } = await params;

    const book = await prisma.book.findUnique({ where: { id } });

    if (!book) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }

    return Response.json(book);
  } catch (error) {
    console.error("[GET /api/books/[id]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { id } = await params;

    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }

    const body: unknown = await request.json();
    const result = updateBookSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const book = await prisma.book.update({
      where: { id },
      data: result.data,
    });

    return Response.json(book);
  } catch (error) {
    console.error("[PATCH /api/books/[id]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { id } = await params;

    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }

    await prisma.book.delete({ where: { id } });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/books/[id]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
