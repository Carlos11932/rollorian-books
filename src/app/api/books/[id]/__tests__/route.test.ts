import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookStatus, type Book, type UserBookWithBook } from "@/lib/types/book";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

const {
  revalidatePathMock,
  getLibraryEntryMock,
  updateLibraryEntryMock,
  deleteLibraryEntryMock,
  LibraryEntryNotFoundError,
  LibraryEntryWriteConflictError,
  EmptyLibraryEntryUpdateError,
  OwnershipStatusSchemaCompatError,
  UserBookSchemaUnavailableError,
} = vi.hoisted(() => {
  class _LibraryEntryNotFoundError extends Error {
    constructor() {
      super("Book not found in library");
    }
  }
  class _OwnershipStatusSchemaCompatError extends Error {
    constructor() {
      super("Ownership status updates require a database schema that includes ownershipStatus");
    }
  }
  class _LibraryEntryWriteConflictError extends Error {
    constructor() {
      super("Could not update this library entry because another update happened at the same time. Please retry.");
    }
  }
  class _EmptyLibraryEntryUpdateError extends Error {
    constructor() {
      super("At least one field must be provided");
    }
  }
  class _UserBookSchemaUnavailableError extends Error {
    constructor() {
      super("Library write operations are unavailable until the database schema includes UserBook");
    }
  }
  return {
    revalidatePathMock: vi.fn(),
    getLibraryEntryMock: vi.fn(),
    updateLibraryEntryMock: vi.fn(),
    deleteLibraryEntryMock: vi.fn(),
    LibraryEntryNotFoundError: _LibraryEntryNotFoundError,
    LibraryEntryWriteConflictError: _LibraryEntryWriteConflictError,
    EmptyLibraryEntryUpdateError: _EmptyLibraryEntryUpdateError,
    OwnershipStatusSchemaCompatError: _OwnershipStatusSchemaCompatError,
    UserBookSchemaUnavailableError: _UserBookSchemaUnavailableError,
  };
});

// Mock the extracted business functions so the route tests focus on HTTP transport.
vi.mock("@/lib/books", () => ({
  getLibraryEntry: (...args: unknown[]) => getLibraryEntryMock(...args),
  updateLibraryEntry: (...args: unknown[]) => updateLibraryEntryMock(...args),
  deleteLibraryEntry: (...args: unknown[]) => deleteLibraryEntryMock(...args),
  LibraryEntryNotFoundError,
}));

vi.mock("@/lib/books/update-library-entry", () => ({
  EmptyLibraryEntryUpdateError,
  LibraryEntryWriteConflictError,
  OwnershipStatusSchemaCompatError,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/prisma-schema-compat", () => ({
  UserBookSchemaUnavailableError,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/revalidation", () => ({
  revalidateBookCollectionPaths: vi.fn(),
}));

// Import after mocks are established.
import { GET, PATCH, DELETE } from "@/app/api/books/[id]/route";

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
    ownershipStatus: "UNKNOWN",
    finishedAt: null,
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the userBook when it exists and belongs to the user", async () => {
    const book = makeBook();
    const userBook = makeUserBook(book);
    getLibraryEntryMock.mockResolvedValueOnce(userBook);

    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, makeRouteContext());

    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    expect((json as UserBookWithBook).id).toBe("ub-001");
    expect((json as UserBookWithBook).book.title).toBe("Clean Code");
  });

  it("returns 404 when the userBook does not exist", async () => {
    getLibraryEntryMock.mockRejectedValueOnce(new LibraryEntryNotFoundError());

    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, makeRouteContext("nonexistent-id"));

    expect(response.status).toBe(404);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Book not found");
  });

  it("returns 404 when book exists but user has no UserBook for it", async () => {
    getLibraryEntryMock.mockRejectedValueOnce(new LibraryEntryNotFoundError());

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
    expect(getLibraryEntryMock).not.toHaveBeenCalled();
  });

  it("calls getLibraryEntry with userId and bookId", async () => {
    const book = makeBook();
    const userBook = makeUserBook(book);
    getLibraryEntryMock.mockResolvedValueOnce(userBook);

    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await GET(request as any, makeRouteContext());

    expect(getLibraryEntryMock).toHaveBeenCalledWith("test-user-001", "book-123");
  });
});

// ─── PATCH /api/books/[id] ────────────────────────────────────────────────────

describe("PATCH /api/books/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the updated userBook when all valid fields are provided", async () => {
    const book = makeBook();
    const updated = makeUserBook(book, { status: BookStatus.READING, rating: 4, notes: "Great read" });

    updateLibraryEntryMock.mockResolvedValueOnce(updated);

    const request = makePatchRequest({ status: "READING", rating: 4, notes: "Great read" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    expect((json as UserBookWithBook).status).toBe(BookStatus.READING);
    expect((json as UserBookWithBook).rating).toBe(4);
    expect(updateLibraryEntryMock).toHaveBeenCalledOnce();
  });

  it("returns 200 when only status is provided (partial update)", async () => {
    const book = makeBook();
    const updated = makeUserBook(book, { status: BookStatus.READ });

    updateLibraryEntryMock.mockResolvedValueOnce(updated);

    const request = makePatchRequest({ status: "READ" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    expect((json as UserBookWithBook).status).toBe(BookStatus.READ);
    expect(updateLibraryEntryMock).toHaveBeenCalledOnce();
  });

  it("returns 200 when body is empty (no-op update — all fields are optional)", async () => {
    const request = makePatchRequest({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "At least one field must be provided" });
    expect(updateLibraryEntryMock).not.toHaveBeenCalled();
  });

  it("returns 400 when status is an invalid enum value", async () => {
    const request = makePatchRequest({ status: "ARCHIVED" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(400);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBeTruthy();
    expect(updateLibraryEntryMock).not.toHaveBeenCalled();
  });

  it("returns 400 when rating is below minimum (0)", async () => {
    const request = makePatchRequest({ rating: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(400);
    expect(updateLibraryEntryMock).not.toHaveBeenCalled();
  });

  it("returns 400 when rating exceeds maximum (6)", async () => {
    const request = makePatchRequest({ rating: 6 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(400);
    expect(updateLibraryEntryMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the JSON body is malformed", async () => {
    const request = new Request("http://localhost/api/books/book-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request" });
    expect(updateLibraryEntryMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the userBook does not exist", async () => {
    updateLibraryEntryMock.mockRejectedValueOnce(new LibraryEntryNotFoundError());

    const request = makePatchRequest({ status: "READING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext("nonexistent-id"));

    expect(response.status).toBe(404);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Book not found");
    expect(updateLibraryEntryMock).toHaveBeenCalledOnce();
  });

  it("returns 409 when ownershipStatus cannot be persisted on a lagging schema", async () => {
    updateLibraryEntryMock.mockRejectedValueOnce(new OwnershipStatusSchemaCompatError());

    const request = makePatchRequest({ ownershipStatus: "OWNED" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(409);
    const json: unknown = await response.json();
    expect(json).toEqual({
      error: "Ownership status updates require a database schema that includes ownershipStatus",
      code: "OWNERSHIP_STATUS_UNSUPPORTED",
    });
  });

  it("returns 503 when the UserBook table is unavailable on a lagging schema", async () => {
    updateLibraryEntryMock.mockRejectedValueOnce(new UserBookSchemaUnavailableError());

    const request = makePatchRequest({ status: "READ" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Library write operations are unavailable until the database schema includes UserBook",
      code: "USER_BOOK_SCHEMA_UNAVAILABLE",
    });
  });

  it("returns 409 when guarded READ retries are exhausted", async () => {
    updateLibraryEntryMock.mockRejectedValueOnce(new LibraryEntryWriteConflictError());

    const request = makePatchRequest({ status: "READ" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Could not update this library entry because another update happened at the same time. Please retry.",
      code: "CONCURRENT_UPDATE_CONFLICT",
    });
  });

  it("returns 500 when an unexpected error occurs", async () => {
    updateLibraryEntryMock.mockRejectedValueOnce(new Error("DB connection lost"));

    const request = makePatchRequest({ status: "READING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(500);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Internal server error");
  });

  it("passes userId and bookId to updateLibraryEntry", async () => {
    const book = makeBook();
    const existing = makeUserBook(book);

    updateLibraryEntryMock.mockResolvedValueOnce(existing);

    const request = makePatchRequest({ status: "READING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await PATCH(request as any, makeRouteContext());

    expect(updateLibraryEntryMock).toHaveBeenCalledWith(
      "test-user-001",
      "book-123",
      { status: "READING" },
    );
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const request = makePatchRequest({ status: "READING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PATCH(request as any, makeRouteContext());

    expect(response.status).toBe(401);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Unauthorized");
    expect(updateLibraryEntryMock).not.toHaveBeenCalled();
  });
});

// ─── DELETE /api/books/[id] ───────────────────────────────────────────────────

describe("DELETE /api/books/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 with no body when deletion succeeds", async () => {
    deleteLibraryEntryMock.mockResolvedValueOnce(undefined);

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await DELETE(request as any, makeRouteContext());

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(deleteLibraryEntryMock).toHaveBeenCalledWith("test-user-001", "book-123");
  });

  it("returns 404 when the userBook does not exist", async () => {
    deleteLibraryEntryMock.mockRejectedValueOnce(new LibraryEntryNotFoundError());

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await DELETE(request as any, makeRouteContext("nonexistent-id"));

    expect(response.status).toBe(404);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Book not found");
    expect(deleteLibraryEntryMock).toHaveBeenCalledOnce();
  });

  it("returns 500 when an unexpected error occurs during delete", async () => {
    deleteLibraryEntryMock.mockRejectedValueOnce(new Error("Constraint violation"));

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await DELETE(request as any, makeRouteContext());

    expect(response.status).toBe(500);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Internal server error");
  });

  it("passes userId and bookId to deleteLibraryEntry", async () => {
    deleteLibraryEntryMock.mockResolvedValueOnce(undefined);

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await DELETE(request as any, makeRouteContext());

    expect(deleteLibraryEntryMock).toHaveBeenCalledWith("test-user-001", "book-123");
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const request = makeDeleteRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await DELETE(request as any, makeRouteContext());

    expect(response.status).toBe(401);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Unauthorized");
    expect(deleteLibraryEntryMock).not.toHaveBeenCalled();
  });
});
