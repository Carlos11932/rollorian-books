import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

const {
  groupByMock,
  countMock,
  aggregateMock,
  findManyMock,
  loanFindManyMock,
} = vi.hoisted(() => ({
  groupByMock: vi.fn(),
  countMock: vi.fn(),
  aggregateMock: vi.fn(),
  findManyMock: vi.fn(),
  loanFindManyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userBook: {
      groupBy: groupByMock,
      count: countMock,
      aggregate: aggregateMock,
      findMany: findManyMock,
    },
    loan: {
      findMany: loanFindManyMock,
    },
  },
}));

import { GET } from "@/app/api/stats/route";

const requireAuthMock = vi.mocked(requireAuth);

describe("GET /api/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses finishedAt instead of updatedAt for completed-reading metrics", async () => {
    groupByMock.mockResolvedValueOnce([
      { status: "WISHLIST", _count: 1 },
      { status: "READ", _count: 2 },
    ]);
    countMock
      .mockResolvedValueOnce(2)   // booksReadThisYear
      .mockResolvedValueOnce(1)   // booksOwned
      .mockResolvedValueOnce(1);  // booksNotSpecified
    aggregateMock.mockResolvedValueOnce({ _avg: { rating: 4.5 } });
    findManyMock
      .mockResolvedValueOnce([{ book: { pageCount: 100 } }, { book: { pageCount: 250 } }])
      .mockResolvedValueOnce([
        { finishedAt: new Date("2026-03-10T00:00:00.000Z") },
        { finishedAt: new Date("2026-03-17T00:00:00.000Z") },
      ])
      .mockResolvedValueOnce([{ book: { genres: ["Fantasy", "Sci-Fi"] } }])
      .mockResolvedValueOnce([
        { finishedAt: new Date("2026-03-17T00:00:00.000Z") },
      ])
      .mockResolvedValueOnce([{ bookId: "book-1" }]); // ownedUserBooks
    loanFindManyMock
      .mockResolvedValueOnce([])  // activeLoanBookIds
      .mockResolvedValueOnce([]); // currentlyLentBookIds

    const response = await GET();

    expect(response.status).toBe(200);
    expect(countMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: "test-user-001",
        status: "READ",
        finishedAt: expect.any(Object),
      }),
    });
    expect(findManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "test-user-001",
          status: "READ",
          finishedAt: expect.any(Object),
        }),
        select: { finishedAt: true },
      }),
    );
    expect(findManyMock).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        where: { userId: "test-user-001", status: "READ" },
        select: { finishedAt: true },
        orderBy: { finishedAt: "desc" },
      }),
    );
  });

  it("returns 401 when auth fails", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const response = await GET();

    expect(response.status).toBe(401);
  });
});
