import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userBookFindUniqueMock } = vi.hoisted(() => ({
  userBookFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userBook: {
      findUnique: userBookFindUniqueMock,
    },
  },
}));

import { getLibraryEntry } from "../get-library-entry";

describe("getLibraryEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the persisted finishedAt when the schema supports it", async () => {
    const finishedAt = new Date("2024-06-06T00:00:00.000Z");
    userBookFindUniqueMock.mockResolvedValueOnce({
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
    });

    const result = await getLibraryEntry("user-1", "book-1");

    expect(result.finishedAt).toEqual(finishedAt);
    expect(result.compatDegraded).toBeUndefined();
    expect(userBookFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ finishedAt: true }),
      }),
    );
  });

  it("falls back to finishedAt null only after a finishedAt schema mismatch", async () => {
    userBookFindUniqueMock
      .mockRejectedValueOnce(makeKnownRequestError("P2022", "The column `finishedAt` does not exist"))
      .mockResolvedValueOnce({
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
      });

    const result = await getLibraryEntry("user-1", "book-1");

    expect(result.finishedAt).toBeNull();
    expect(result.compatDegraded).toBe(true);
    expect(userBookFindUniqueMock).toHaveBeenCalledTimes(2);
    expect(userBookFindUniqueMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        select: expect.not.objectContaining({ finishedAt: true }),
      }),
    );
  });

  it("marks ownershipStatus fallbacks as compat degraded", async () => {
    userBookFindUniqueMock
      .mockRejectedValueOnce(makeKnownRequestError("P2022", "The column `ownershipStatus` does not exist"))
      .mockResolvedValueOnce({
        id: "ub-1",
        userId: "user-1",
        bookId: "book-1",
        status: "READ",
        finishedAt: new Date("2024-06-06T00:00:00.000Z"),
        rating: null,
        notes: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
      });

    const result = await getLibraryEntry("user-1", "book-1");

    expect(result.ownershipStatus).toBe("UNKNOWN");
    expect(result.compatDegraded).toBe(true);
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
