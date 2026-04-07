import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

const {
  groupMemberFindManyMock,
  groupCreateMock,
} = vi.hoisted(() => ({
  groupMemberFindManyMock: vi.fn(),
  groupCreateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findMany: groupMemberFindManyMock,
    },
    group: {
      create: groupCreateMock,
    },
  },
}));

import { GET, POST } from "@/app/api/groups/route";

const requireAuthMock = vi.mocked(requireAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGroupMembership(overrides: Record<string, unknown> = {}) {
  return {
    role: "MEMBER",
    status: "ACCEPTED",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    group: {
      id: "group-001",
      name: "Readers Club",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      _count: { members: 5 },
    },
    ...overrides,
  };
}

function makeGetRequest(): Request {
  const url = "http://localhost/api/groups";
  const req = new Request(url, { method: "GET" });
  const parsedUrl = new URL(url);
  (req as Request & { nextUrl: URL }).nextUrl = parsedUrl;
  return req;
}

function makePostRequest(body: unknown): Request {
  const url = "http://localhost/api/groups";
  const req = new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  (req as Request & { nextUrl: URL }).nextUrl = new URL(url);
  return req;
}

// ─── GET /api/groups ──────────────────────────────────────────────────────────

describe("GET /api/groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with groups array", async () => {
    groupMemberFindManyMock.mockResolvedValueOnce([makeGroupMembership()]);

    const res = await GET(makeGetRequest() as never);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body.groups)).toBe(true);
    expect((body.groups as unknown[]).length).toBe(1);
  });

  it("returns an empty groups array when user has no memberships", async () => {
    groupMemberFindManyMock.mockResolvedValueOnce([]);

    const res = await GET(makeGetRequest() as never);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.groups).toEqual([]);
  });

  it("maps membership to group summary shape", async () => {
    groupMemberFindManyMock.mockResolvedValueOnce([
      makeGroupMembership({ role: "ADMIN", status: "ACCEPTED" }),
    ]);

    const res = await GET(makeGetRequest() as never);

    const body = await res.json() as { groups: Array<Record<string, unknown>> };
    const group = body.groups[0]!;
    expect(group.id).toBe("group-001");
    expect(group.name).toBe("Readers Club");
    expect(group.memberCount).toBe(5);
    expect(group.userRole).toBe("ADMIN");
    expect(group.userStatus).toBe("ACCEPTED");
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const res = await GET(makeGetRequest() as never);

    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Unauthorized");
    expect(groupMemberFindManyMock).not.toHaveBeenCalled();
  });

  it("returns 500 when prisma throws an unexpected error", async () => {
    groupMemberFindManyMock.mockRejectedValueOnce(new Error("DB error"));

    const res = await GET(makeGetRequest() as never);

    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Internal server error");
  });

  it("queries groups where the authenticated user is a member", async () => {
    groupMemberFindManyMock.mockResolvedValueOnce([]);

    await GET(makeGetRequest() as never);

    expect(groupMemberFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "test-user-001" },
      }),
    );
  });
});

// ─── POST /api/groups ─────────────────────────────────────────────────────────

describe("POST /api/groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 with new group on valid input", async () => {
    groupCreateMock.mockResolvedValueOnce({
      id: "group-new",
      name: "Book Club",
      createdAt: new Date("2024-03-01T00:00:00.000Z"),
      _count: { members: 1 },
    });

    const res = await POST(makePostRequest({ name: "Book Club" }) as never);

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBe("group-new");
    expect(body.name).toBe("Book Club");
    expect(body.memberCount).toBe(1);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makePostRequest({}) as never);

    expect(res.status).toBe(400);
    expect(groupCreateMock).not.toHaveBeenCalled();
  });

  it("returns 400 when name is an empty string", async () => {
    const res = await POST(makePostRequest({ name: "" }) as never);

    expect(res.status).toBe(400);
    expect(groupCreateMock).not.toHaveBeenCalled();
  });

  it("creates group with creator as ADMIN member", async () => {
    groupCreateMock.mockResolvedValueOnce({
      id: "group-new",
      name: "My Club",
      createdAt: new Date(),
      _count: { members: 1 },
    });

    await POST(makePostRequest({ name: "My Club" }) as never);

    expect(groupCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "My Club",
          createdById: "test-user-001",
          members: {
            create: {
              userId: "test-user-001",
              role: "ADMIN",
              status: "ACCEPTED",
            },
          },
        }),
      }),
    );
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const res = await POST(makePostRequest({ name: "My Club" }) as never);

    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Unauthorized");
    expect(groupCreateMock).not.toHaveBeenCalled();
  });

  it("returns 500 when prisma throws an unexpected error", async () => {
    groupCreateMock.mockRejectedValueOnce(new Error("DB error"));

    const res = await POST(makePostRequest({ name: "My Club" }) as never);

    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Internal server error");
  });
});
