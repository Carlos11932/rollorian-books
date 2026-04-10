import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userBookFindManyMock } = vi.hoisted(() => ({
  userBookFindManyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userBook: {
      findMany: userBookFindManyMock,
    },
  },
}));

import { getLibrary } from "../get-library";

describe("getLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns persisted finishedAt values when the schema supports them", async () => {
    const finishedAt = new Date("2024-07-07T00:00:00.000Z");
    userBookFindManyMock.mockResolvedValueOnce([
      {
        id: "ub-1",
        userId: "user-1",
        bookId: "book-1",
        status: "READ",
        ownershipStatus: "OWNED",
        finishedAt,
        rating: null,
        notes: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
      },
    ]);

    const result = await getLibrary("user-1");

    expect(result[0]?.finishedAt).toEqual(finishedAt);
    expect(result[0]?.compatDegraded).toBeUndefined();
    expect(userBookFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ finishedAt: true }),
      }),
    );
  });

  it("falls back to finishedAt null only after a finishedAt schema mismatch", async () => {
    userBookFindManyMock
      .mockRejectedValueOnce(makeKnownRequestError("P2022", "The column `finishedAt` does not exist"))
      .mockResolvedValueOnce([
        {
          id: "ub-1",
          userId: "user-1",
          bookId: "book-1",
          status: "READ",
          ownershipStatus: "OWNED",
          rating: null,
          notes: null,
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          updatedAt: new Date("2024-01-01T00:00:00.000Z"),
          book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
        },
      ]);

    const result = await getLibrary("user-1");

    expect(result[0]?.finishedAt).toBeNull();
    expect(result[0]?.compatDegraded).toBe(true);
    expect(userBookFindManyMock).toHaveBeenCalledTimes(2);
    expect(userBookFindManyMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        select: expect.not.objectContaining({ finishedAt: true }),
      }),
    );
  });

  it("marks ownershipStatus fallbacks as compat degraded", async () => {
    userBookFindManyMock
      .mockRejectedValueOnce(makeKnownRequestError("P2022", "The column `ownershipStatus` does not exist"))
      .mockResolvedValueOnce([
        {
          id: "ub-1",
          userId: "user-1",
          bookId: "book-1",
          status: "READ",
          finishedAt: new Date("2024-07-07T00:00:00.000Z"),
          rating: null,
          notes: null,
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          updatedAt: new Date("2024-01-01T00:00:00.000Z"),
          book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
        },
      ]);

    const result = await getLibrary("user-1");

    expect(result[0]?.ownershipStatus).toBe("UNKNOWN");
    expect(result[0]?.compatDegraded).toBe(true);
  });
});

function makeKnownRequestError(code: string, message: string): Prisma.PrismaClientKnownRequestError {
  const error = new Error(message) as Prisma.PrismaClientKnownRequestError;
  Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);
  Object.assign(error, {
    code,
    clientVersion: "test",
    meta: {},
    batchRequestIdx: 0,
  });
  return error;
}
