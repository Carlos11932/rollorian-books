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
    book: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    userBook: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/revalidation", () => ({
  revalidateBookCollectionPaths: (bookId: string) => {
    revalidatePathMock("/");
    revalidatePathMock("/library");
    revalidatePathMock(`/books/${bookId}`);
  },
}));

// Import after mocks are established.
import { POST, GET } from "@/app/api/books/route";
import { prisma } from "@/lib/prisma";

// The global setup already mocks requireAuth — grab a typed reference
// so individual tests can override the resolved value.
const requireAuthMock = vi.mocked(requireAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "book-001",
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

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(searchParams = ""): Request {
  const url = `http://localhost/api/books${searchParams ? `?${searchParams}` : ""}`;
  const req = new Request(url, { method: "GET" });
  // The GET handler accesses `request.nextUrl.searchParams`.
  // NextRequest wraps the URL in a `nextUrl` property; we polyfill it here
  // so the route handler works in the Node.js test environment without
  // needing a full Next.js runtime.
  const parsedUrl = new URL(url);
  (req as Request & { nextUrl: URL }).nextUrl = parsedUrl;
  return req;
}

// ─── POST /api/books ──────────────────────────────────────────────────────────

describe("POST /api/books", () => {
  const bookMock = prisma.book as unknown as {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  const userBookMock = prisma.userBook as unknown as {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  const validBody = {
    title: "Clean Code",
    authors: ["Robert C. Martin"],
    status: BookStatus.WISHLIST,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing book found by ISBN, no existing userBook
    bookMock.findFirst.mockResolvedValue(null);
    userBookMock.findUnique.mockResolvedValue(null);
  });

  it("returns 201 with the created userBook on a valid payload", async () => {
    const createdBook = makeBook();
    const createdUserBook = makeUserBook(createdBook);
    bookMock.create.mockResolvedValue(createdBook);
    userBookMock.create.mockResolvedValue(createdUserBook);

    const request = makePostRequest(validBody);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);

    expect(response.status).toBe(201);
    const json: unknown = await response.json();
    expect((json as { id: string }).id).toBe("ub-001");
    expect(userBookMock.create).toHaveBeenCalledOnce();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/library");
    expect(revalidatePathMock).toHaveBeenCalledWith("/books/book-001");
  });

  it("returns 400 when title is missing", async () => {
    const { title: _title, ...bodyWithoutTitle } = validBody;
    const request = makePostRequest(bodyWithoutTitle);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);

    expect(response.status).toBe(400);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBeTruthy();
  });

  it("returns 400 when authors array is empty", async () => {
    const request = makePostRequest({ ...validBody, authors: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);

    expect(response.status).toBe(400);
  });

  it("returns 400 when status is invalid", async () => {
    const request = makePostRequest({ ...validBody, status: "ARCHIVED" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);

    expect(response.status).toBe(400);
  });

  it("returns 400 when rating is out of range (0)", async () => {
    const request = makePostRequest({ ...validBody, rating: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);

    expect(response.status).toBe(400);
  });

  it("returns 409 when the book is already in the user's library", async () => {
    const existingBook = makeBook();
    const existingUserBook = makeUserBook(existingBook);
    bookMock.findFirst.mockResolvedValue(existingBook);
    userBookMock.findUnique.mockResolvedValue(existingUserBook);

    const request = makePostRequest(validBody);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);

    expect(response.status).toBe(409);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toContain("already");
    expect(userBookMock.create).not.toHaveBeenCalled();
  });

  it("returns 500 when prisma throws an unexpected error", async () => {
    bookMock.create.mockRejectedValue(new Error("DB connection lost"));
    const request = makePostRequest(validBody);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);

    expect(response.status).toBe(500);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Internal server error");
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const request = makePostRequest(validBody);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);

    expect(response.status).toBe(401);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Unauthorized");
    expect(userBookMock.create).not.toHaveBeenCalled();
  });
});

// ─── GET /api/books ───────────────────────────────────────────────────────────

describe("GET /api/books", () => {
  const userBookMock = prisma.userBook as unknown as {
    findMany: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with an array of userBooks", async () => {
    const book1 = makeBook();
    const book2 = makeBook({ id: "book-002", title: "The Pragmatic Programmer" });
    const userBooks = [makeUserBook(book1), makeUserBook(book2, { id: "ub-002", bookId: "book-002" })];
    userBookMock.findMany.mockResolvedValue(userBooks);

    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);

    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    expect(Array.isArray(json)).toBe(true);
    expect((json as unknown[]).length).toBe(2);
  });

  it("returns 400 when status param is invalid", async () => {
    const request = makeGetRequest("status=INVALID");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);

    expect(response.status).toBe(400);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toContain("Invalid status");
  });

  it("accepts a valid status param and passes it to prisma.userBook", async () => {
    userBookMock.findMany.mockResolvedValue([]);
    const request = makeGetRequest("status=READING");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await GET(request as any);

    expect(userBookMock.findMany).toHaveBeenCalledOnce();
    const calledWith = userBookMock.findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(calledWith.where).toMatchObject({ status: "READING" });
  });

  it("passes userId from requireAuth to prisma.userBook.findMany where clause", async () => {
    userBookMock.findMany.mockResolvedValue([]);
    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await GET(request as any);

    expect(userBookMock.findMany).toHaveBeenCalledOnce();
    const calledWith = userBookMock.findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(calledWith.where).toMatchObject({ userId: "test-user-001" });
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);

    expect(response.status).toBe(401);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Unauthorized");
    expect(userBookMock.findMany).not.toHaveBeenCalled();
  });

  it("returns 500 when prisma throws", async () => {
    userBookMock.findMany.mockRejectedValue(new Error("DB error"));
    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);

    expect(response.status).toBe(500);
  });
});
