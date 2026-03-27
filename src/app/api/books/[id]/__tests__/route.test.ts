import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookStatus, type Book, type UserBookWithBook } from "@/lib/types/book";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

const { revalidatePathMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
}));

// Mock prisma BEFORE importing the route so the module initialiser never
// tries to connect to the database.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userBook: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

// Import after mocks are established.
import { GET, PATCH, DELETE } from "@/app/api/books/[id]/route";
import { prisma } from "@/lib/prisma";

// The global setup already mocks requireAuth — grab a typed reference
// so individual tests can override the resolved value.
const requireAuthMock = vi.mocked(requireAuth);

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
    genres: [],
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeUserBook(book: Book, overrides: Partial<UserBookWithBook> = {}): UserBookWithBook {
  return {
    id: "ub-001",
    userId: "test-user-001",
    bookId: book.id,
    status: BookStatus.WISHLIST,
    rating: null,
    notes: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    book,
    ...overrides,
  };
}

function makeGetRequest(): Request {
  return new Request("http://localhost/api/books/book-123", {
    method: "GET",
  });
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

// ─── GET /api/books/[id] ─────────────────────────────────────────────────────

describe("GET /api/books/[id]", () => {
  const userBookMock = prisma.userBook as unknown as {
    findUnique: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the userBook when it exists and belongs to the user", async () => {
    const book = makeBook();
    const userBook = makeUserBook(book);
    userBookMock.findUnique.mockResolvedValueOnce(userBook);

    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, makeRouteContext());

    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    expect((json as UserBookWithBook).id).toBe("ub-001");
    expect((json as UserBookWithBook).book.title).toBe("Clean Code");
  });

  it("returns 404 when the userBook does not exist", async () => {
    userBookMock.findUnique.mockResolvedValueOnce(null);

    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, makeRouteContext("nonexistent-id"));

    expect(response.status).toBe(404);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Book not found");
  });

  it("returns 404 when book exists but user has no UserBook for it", async () => {
    userBookMock.findUnique.mockResolvedValueOnce(null);

    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, makeRouteContext());

    expect(response.status).toBe(404);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Book not found");
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, makeRouteContext());

    expect(response.status).toBe(401);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Unauthorized");
    expect(userBookMock.findUnique).not.toHaveBeenCalled();
  });

  it("calls prisma.userBook.findUnique with userId_bookId compound key", async () => {
    const book = makeBook();
    const userBook = makeUserBook(book);
    userBookMock.findUnique.mockResolvedValueOnce(userBook);

    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await GET(request as any, makeRouteContext());

    const calledWith = userBookMock.findUnique.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(calledWith.where).toMatchObject({ userId_bookId: { userId: "test-user-001", bookId: "book-123" } });
  });
});

// ─── PATCH /api/books/[id] ────────────────────────────────────────────────────

describe("PATCH /api/books/[id]", () => {
  const userBookMock = prisma.userBook as unknown as {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the updated userBook when all valid fields are provided", async () => {
    const book = makeBook();
    const existing = makeUserBook(book);
    const updated = makeUserBook(book, { status: BookStatus.READING, rating: 4, notes: "Great read" });

    userBookMock.findUnique.mockResolvedValueOnce(existing);
    userBookMock.update.mockResolvedValueOnce(updated);

    const request = makePatchRequest({ status: "READING", rating: 4, notes: "Great read" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    expect((json as UserBookWithBook).status).toBe(BookStatus.READING);
    expect((json as UserBookWithBook).rating).toBe(4);
    expect(userBookMock.update).toHaveBeenCalledOnce();
  });

  it("returns 200 when only status is provided (partial update)", async () => {
    const book = makeBook();
    const existing = makeUserBook(book);
    const updated = makeUserBook(book, { status: BookStatus.READ });

    userBookMock.findUnique.mockResolvedValueOnce(existing);
    userBookMock.update.mockResolvedValueOnce(updated);

    const request = makePatchRequest({ status: "READ" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    expect((json as UserBookWithBook).status).toBe(BookStatus.READ);
    expect(userBookMock.update).toHaveBeenCalledOnce();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/library");
    expect(revalidatePathMock).toHaveBeenCalledWith("/books/book-123");
  });

  it("returns 200 when body is empty (no-op update — all fields are optional)", async () => {
    const book = makeBook();
    const existing = makeUserBook(book);

    userBookMock.findUnique.mockResolvedValueOnce(existing);
    userBookMock.update.mockResolvedValueOnce(existing);

    const request = makePatchRequest({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(200);
    expect(userBookMock.update).toHaveBeenCalledOnce();
  });

  it("returns 400 when status is an invalid enum value", async () => {
    const book = makeBook();
    const existing = makeUserBook(book);
    userBookMock.findUnique.mockResolvedValueOnce(existing);

    const request = makePatchRequest({ status: "ARCHIVED" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(400);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBeTruthy();
    expect(userBookMock.update).not.toHaveBeenCalled();
  });

  it("returns 400 when rating is below minimum (0)", async () => {
    const book = makeBook();
    const existing = makeUserBook(book);
    userBookMock.findUnique.mockResolvedValueOnce(existing);

    const request = makePatchRequest({ rating: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(400);
    expect(userBookMock.update).not.toHaveBeenCalled();
  });

  it("returns 400 when rating exceeds maximum (6)", async () => {
    const book = makeBook();
    const existing = makeUserBook(book);
    userBookMock.findUnique.mockResolvedValueOnce(existing);

    const request = makePatchRequest({ rating: 6 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(400);
    expect(userBookMock.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the userBook does not exist", async () => {
    userBookMock.findUnique.mockResolvedValueOnce(null);

    const request = makePatchRequest({ status: "READING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext("nonexistent-id"));

    expect(response.status).toBe(404);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Book not found");
    expect(userBookMock.update).not.toHaveBeenCalled();
  });

  it("returns 500 when prisma throws an unexpected error", async () => {
    const book = makeBook();
    const existing = makeUserBook(book);
    userBookMock.findUnique.mockResolvedValueOnce(existing);
    userBookMock.update.mockRejectedValueOnce(new Error("DB connection lost"));

    const request = makePatchRequest({ status: "READING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(500);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Internal server error");
  });

  it("passes userId_bookId compound key to prisma.userBook.findUnique", async () => {
    const book = makeBook();
    const existing = makeUserBook(book);
    userBookMock.findUnique.mockResolvedValueOnce(existing);
    userBookMock.update.mockResolvedValueOnce(existing);

    const request = makePatchRequest({ status: "READING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await PATCH(request as any, makeRouteContext());

    const calledWith = userBookMock.findUnique.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(calledWith.where).toMatchObject({ userId_bookId: { userId: "test-user-001", bookId: "book-123" } });
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const request = makePatchRequest({ status: "READING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(401);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Unauthorized");
    expect(userBookMock.findUnique).not.toHaveBeenCalled();
  });
});

// ─── DELETE /api/books/[id] ───────────────────────────────────────────────────

describe("DELETE /api/books/[id]", () => {
  const userBookMock = prisma.userBook as unknown as {
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 with no body when deletion succeeds", async () => {
    const book = makeBook();
    const existing = makeUserBook(book);
    userBookMock.findUnique.mockResolvedValueOnce(existing);
    userBookMock.delete.mockResolvedValueOnce(existing);

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await DELETE(request as any, makeRouteContext());

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(userBookMock.delete).toHaveBeenCalledOnce();
    expect(userBookMock.delete).toHaveBeenCalledWith({ where: { userId_bookId: { userId: "test-user-001", bookId: "book-123" } } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/library");
    expect(revalidatePathMock).toHaveBeenCalledWith("/books/book-123");
  });

  it("returns 404 when the userBook does not exist", async () => {
    userBookMock.findUnique.mockResolvedValueOnce(null);

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await DELETE(request as any, makeRouteContext("nonexistent-id"));

    expect(response.status).toBe(404);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Book not found");
    expect(userBookMock.delete).not.toHaveBeenCalled();
  });

  it("returns 500 when prisma throws an unexpected error during delete", async () => {
    const book = makeBook();
    const existing = makeUserBook(book);
    userBookMock.findUnique.mockResolvedValueOnce(existing);
    userBookMock.delete.mockRejectedValueOnce(new Error("Constraint violation"));

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await DELETE(request as any, makeRouteContext());

    expect(response.status).toBe(500);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Internal server error");
  });

  it("passes userId_bookId compound key to prisma.userBook.findUnique", async () => {
    const book = makeBook();
    const existing = makeUserBook(book);
    userBookMock.findUnique.mockResolvedValueOnce(existing);
    userBookMock.delete.mockResolvedValueOnce(existing);

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await DELETE(request as any, makeRouteContext());

    const calledWith = userBookMock.findUnique.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(calledWith.where).toMatchObject({ userId_bookId: { userId: "test-user-001", bookId: "book-123" } });
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await DELETE(request as any, makeRouteContext());

    expect(response.status).toBe(401);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Unauthorized");
    expect(userBookMock.findUnique).not.toHaveBeenCalled();
  });
});
