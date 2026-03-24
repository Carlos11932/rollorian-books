import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookStatus } from "@/lib/types/book";
import type { Book } from "@/lib/types/book";

// Mock prisma BEFORE importing the route so the module initialiser never
// tries to connect to the database.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    book: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Import after mocks are established.
import { PATCH, DELETE } from "@/app/api/books/[id]/route";
import { prisma } from "@/lib/prisma";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "book-123",
    title: "Clean Code",
    subtitle: null,
    authors: ["Robert C. Martin"],
    description: null,
    coverUrl: null,
    publisher: null,
    publishedDate: null,
    pageCount: null,
    isbn10: null,
    isbn13: null,
    status: BookStatus.WISHLIST,
    rating: null,
    notes: null,
    genres: [],
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makePatchRequest(body: unknown): Request {
  return new Request("http://localhost/api/books/book-123", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(): Request {
  return new Request("http://localhost/api/books/book-123", {
    method: "DELETE",
  });
}

function makeRouteContext(id = "book-123"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// ─── PATCH /api/books/[id] ────────────────────────────────────────────────────

describe("PATCH /api/books/[id]", () => {
  const prismaMock = prisma.book as unknown as {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the updated book when all valid fields are provided", async () => {
    const existing = makeBook();
    const updated = makeBook({ status: BookStatus.READING, rating: 4, notes: "Great read" });

    prismaMock.findUnique.mockResolvedValueOnce(existing);
    prismaMock.update.mockResolvedValueOnce(updated);

    const request = makePatchRequest({ status: "READING", rating: 4, notes: "Great read" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    expect((json as Book).status).toBe(BookStatus.READING);
    expect((json as Book).rating).toBe(4);
    expect(prismaMock.update).toHaveBeenCalledOnce();
  });

  it("returns 200 when only status is provided (partial update)", async () => {
    const existing = makeBook();
    const updated = makeBook({ status: BookStatus.READ });

    prismaMock.findUnique.mockResolvedValueOnce(existing);
    prismaMock.update.mockResolvedValueOnce(updated);

    const request = makePatchRequest({ status: "READ" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    expect((json as Book).status).toBe(BookStatus.READ);
    expect(prismaMock.update).toHaveBeenCalledOnce();
  });

  it("returns 200 when body is empty (no-op update — all fields are optional)", async () => {
    const existing = makeBook();

    prismaMock.findUnique.mockResolvedValueOnce(existing);
    prismaMock.update.mockResolvedValueOnce(existing);

    const request = makePatchRequest({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(200);
    expect(prismaMock.update).toHaveBeenCalledOnce();
  });

  it("returns 400 when status is an invalid enum value", async () => {
    const existing = makeBook();
    prismaMock.findUnique.mockResolvedValueOnce(existing);

    const request = makePatchRequest({ status: "ARCHIVED" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(400);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBeTruthy();
    expect(prismaMock.update).not.toHaveBeenCalled();
  });

  it("returns 400 when rating is below minimum (0)", async () => {
    const existing = makeBook();
    prismaMock.findUnique.mockResolvedValueOnce(existing);

    const request = makePatchRequest({ rating: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(400);
    expect(prismaMock.update).not.toHaveBeenCalled();
  });

  it("returns 400 when rating exceeds maximum (6)", async () => {
    const existing = makeBook();
    prismaMock.findUnique.mockResolvedValueOnce(existing);

    const request = makePatchRequest({ rating: 6 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(400);
    expect(prismaMock.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the book does not exist", async () => {
    prismaMock.findUnique.mockResolvedValueOnce(null);

    const request = makePatchRequest({ status: "READING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext("nonexistent-id"));

    expect(response.status).toBe(404);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Book not found");
    expect(prismaMock.update).not.toHaveBeenCalled();
  });

  it("returns 500 when prisma throws an unexpected error", async () => {
    const existing = makeBook();
    prismaMock.findUnique.mockResolvedValueOnce(existing);
    prismaMock.update.mockRejectedValueOnce(new Error("DB connection lost"));

    const request = makePatchRequest({ status: "READING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(500);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Internal server error");
  });
});

// ─── DELETE /api/books/[id] ───────────────────────────────────────────────────

describe("DELETE /api/books/[id]", () => {
  const prismaMock = prisma.book as unknown as {
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 with no body when deletion succeeds", async () => {
    const existing = makeBook();
    prismaMock.findUnique.mockResolvedValueOnce(existing);
    prismaMock.delete.mockResolvedValueOnce(existing);

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await DELETE(request as any, makeRouteContext());

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(prismaMock.delete).toHaveBeenCalledOnce();
    expect(prismaMock.delete).toHaveBeenCalledWith({ where: { id: "book-123" } });
  });

  it("returns 404 when the book does not exist", async () => {
    prismaMock.findUnique.mockResolvedValueOnce(null);

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await DELETE(request as any, makeRouteContext("nonexistent-id"));

    expect(response.status).toBe(404);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Book not found");
    expect(prismaMock.delete).not.toHaveBeenCalled();
  });

  it("returns 500 when prisma throws an unexpected error during delete", async () => {
    const existing = makeBook();
    prismaMock.findUnique.mockResolvedValueOnce(existing);
    prismaMock.delete.mockRejectedValueOnce(new Error("Constraint violation"));

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await DELETE(request as any, makeRouteContext());

    expect(response.status).toBe(500);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Internal server error");
  });
});
