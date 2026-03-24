import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookStatus, type Book } from "@/lib/types/book";

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
import { POST, GET } from "@/app/api/books/route";
import { prisma } from "@/lib/prisma";

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
    status: BookStatus.WISHLIST,
    rating: null,
    notes: null,
    genres: [],
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
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
  const prismaMock = prisma.book as unknown as {
    create: ReturnType<typeof vi.fn>;
  };

  const validBody = {
    title: "Clean Code",
    authors: ["Robert C. Martin"],
    status: BookStatus.WISHLIST,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 with the created book on a valid payload", async () => {
    const createdBook = makeBook();
    prismaMock.create.mockResolvedValue(createdBook);

    const request = makePostRequest(validBody);
    // The route handler expects a NextRequest; Request is compatible at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);

    expect(response.status).toBe(201);
    const json: unknown = await response.json();
    expect((json as { id: string }).id).toBe("book-001");
    expect(prismaMock.create).toHaveBeenCalledOnce();
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

  it("returns 500 when prisma throws an unexpected error", async () => {
    prismaMock.create.mockRejectedValue(new Error("DB connection lost"));
    const request = makePostRequest(validBody);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);

    expect(response.status).toBe(500);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Internal server error");
  });

  it("passes the validated data (not raw body) to prisma.create", async () => {
    const createdBook = makeBook();
    prismaMock.create.mockResolvedValue(createdBook);

    const bodyWithExtra = { ...validBody, unknownField: "should be stripped" };
    const request = makePostRequest(bodyWithExtra);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await POST(request as any);

    const calledWith = prismaMock.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(calledWith.data).not.toHaveProperty("unknownField");
  });
});

// ─── GET /api/books ───────────────────────────────────────────────────────────

describe("GET /api/books", () => {
  const prismaMock = prisma.book as unknown as {
    findMany: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with an array of books", async () => {
    const books = [makeBook(), makeBook({ id: "book-002", title: "The Pragmatic Programmer" })];
    prismaMock.findMany.mockResolvedValue(books);

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

  it("accepts a valid status param and passes it to prisma", async () => {
    prismaMock.findMany.mockResolvedValue([]);
    const request = makeGetRequest("status=READING");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await GET(request as any);

    expect(prismaMock.findMany).toHaveBeenCalledOnce();
    const calledWith = prismaMock.findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(calledWith.where).toMatchObject({ status: "READING" });
  });

  it("returns 500 when prisma throws", async () => {
    prismaMock.findMany.mockRejectedValue(new Error("DB error"));
    const request = makeGetRequest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);

    expect(response.status).toBe(500);
  });
});
