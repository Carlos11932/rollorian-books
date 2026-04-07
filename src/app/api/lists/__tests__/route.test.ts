import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

const {
  bookListFindManyMock,
  bookListCreateMock,
} = vi.hoisted(() => ({
  bookListFindManyMock: vi.fn(),
  bookListCreateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bookList: {
      findMany: bookListFindManyMock,
      create: bookListCreateMock,
    },
  },
}));

// isMissingListsSchemaError always returns false in tests (not a schema error)
vi.mock("@/lib/prisma-schema-compat", () => ({
  isMissingListsSchemaError: vi.fn().mockReturnValue(false),
}));

import { GET, POST } from "@/app/api/lists/route";

const requireAuthMock = vi.mocked(requireAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeList(overrides: Record<string, unknown> = {}) {
  return {
    id: "list-001",
    name: "To Read",
    description: null,
    userId: "test-user-001",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    _count: { items: 3 },
    items: [],
    ...overrides,
  };
}

function makeGetRequest(searchParams = ""): Request {
  const url = `http://localhost/api/lists${searchParams ? `?${searchParams}` : ""}`;
  const req = new Request(url, { method: "GET" });
  const parsedUrl = new URL(url);
  (req as Request & { nextUrl: URL }).nextUrl = parsedUrl;
  return req;
}

function makePostRequest(body: unknown): Request {
  const url = "http://localhost/api/lists";
  const req = new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  (req as Request & { nextUrl: URL }).nextUrl = new URL(url);
  return req;
}

// ─── GET /api/lists ───────────────────────────────────────────────────────────

describe("GET /api/lists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with lists array", async () => {
    bookListFindManyMock.mockResolvedValueOnce([makeList()]);

    const res = await GET(makeGetRequest() as never);

    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
  });

  it("returns an empty array when user has no lists", async () => {
    bookListFindManyMock.mockResolvedValueOnce([]);

    const res = await GET(makeGetRequest() as never);

    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toEqual([]);
  });

  it("maps list to summary shape", async () => {
    bookListFindManyMock.mockResolvedValueOnce([makeList({ name: "Fantasy Reads" })]);

    const res = await GET(makeGetRequest() as never);

    const body = await res.json() as Array<Record<string, unknown>>;
    expect(body[0]!.name).toBe("Fantasy Reads");
    expect(body[0]!.id).toBe("list-001");
    expect((body[0]!._count as Record<string, number>).items).toBe(3);
  });

  it("queries only lists for the authenticated user", async () => {
    bookListFindManyMock.mockResolvedValueOnce([]);

    await GET(makeGetRequest() as never);

    expect(bookListFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "test-user-001" },
      }),
    );
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const res = await GET(makeGetRequest() as never);

    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Unauthorized");
    expect(bookListFindManyMock).not.toHaveBeenCalled();
  });

  it("returns 500 when prisma throws an unexpected error", async () => {
    bookListFindManyMock.mockRejectedValueOnce(new Error("DB error"));

    const res = await GET(makeGetRequest() as never);

    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Internal server error");
  });
});

// ─── POST /api/lists ──────────────────────────────────────────────────────────

describe("POST /api/lists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 with the created list on valid input", async () => {
    bookListCreateMock.mockResolvedValueOnce(makeList({ name: "Sci-Fi Reads" }));

    const res = await POST(makePostRequest({ name: "Sci-Fi Reads" }) as never);

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBe("list-001");
    expect(body.name).toBe("Sci-Fi Reads");
  });

  it("returns 201 with optional description", async () => {
    bookListCreateMock.mockResolvedValueOnce(
      makeList({ name: "Classics", description: "All-time classics" }),
    );

    const res = await POST(makePostRequest({ name: "Classics", description: "All-time classics" }) as never);

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.description).toBe("All-time classics");
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makePostRequest({}) as never);

    expect(res.status).toBe(400);
    expect(bookListCreateMock).not.toHaveBeenCalled();
  });

  it("returns 400 when name is an empty string", async () => {
    const res = await POST(makePostRequest({ name: "" }) as never);

    expect(res.status).toBe(400);
    expect(bookListCreateMock).not.toHaveBeenCalled();
  });

  it("creates the list with the authenticated userId", async () => {
    bookListCreateMock.mockResolvedValueOnce(makeList());

    await POST(makePostRequest({ name: "My List" }) as never);

    expect(bookListCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "My List",
          userId: "test-user-001",
        }),
      }),
    );
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const res = await POST(makePostRequest({ name: "My List" }) as never);

    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Unauthorized");
    expect(bookListCreateMock).not.toHaveBeenCalled();
  });

  it("returns 500 when prisma throws an unexpected error", async () => {
    bookListCreateMock.mockRejectedValueOnce(new Error("DB error"));

    const res = await POST(makePostRequest({ name: "My List" }) as never);

    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Internal server error");
  });
});
