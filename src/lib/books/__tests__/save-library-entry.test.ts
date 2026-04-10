import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DuplicateLibraryEntryError } from "../errors";
import {
  LibraryEntryCreateConflictError,
  OwnershipStatusCreateCompatError,
} from "../save-library-entry";

const {
  transactionMock,
  queryRawMock,
  bookFindFirstMock,
  bookCreateMock,
  userBookFindFirstMock,
  userBookFindUniqueMock,
  userBookFindUniqueOrThrowMock,
  userBookCreateMock,
  revalidateBookCollectionPathsMock,
  isRetryableUserBookCompatErrorMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  queryRawMock: vi.fn(),
  bookFindFirstMock: vi.fn(),
  bookCreateMock: vi.fn(),
  userBookFindFirstMock: vi.fn(),
  userBookFindUniqueMock: vi.fn(),
  userBookFindUniqueOrThrowMock: vi.fn(),
  userBookCreateMock: vi.fn(),
  revalidateBookCollectionPathsMock: vi.fn(),
  isRetryableUserBookCompatErrorMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    book: {
      findFirst: bookFindFirstMock,
      create: bookCreateMock,
    },
    userBook: {
      findFirst: userBookFindFirstMock,
      findUnique: userBookFindUniqueMock,
      findUniqueOrThrow: userBookFindUniqueOrThrowMock,
      create: userBookCreateMock,
    },
    $queryRaw: queryRawMock,
  },
}));

vi.mock("@/lib/revalidation", () => ({
  revalidateBookCollectionPaths: revalidateBookCollectionPathsMock,
}));

vi.mock("@/lib/prisma-schema-compat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/prisma-schema-compat")>("@/lib/prisma-schema-compat");
  return {
    ...actual,
    isRetryableUserBookCompatError: isRetryableUserBookCompatErrorMock,
  };
});

import { saveLibraryEntry } from "../save-library-entry";

describe("saveLibraryEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (callback: (tx: { $queryRaw: typeof queryRawMock; book: { findFirst: typeof bookFindFirstMock; create: typeof bookCreateMock }; userBook: { findFirst: typeof userBookFindFirstMock; findUnique: typeof userBookFindUniqueMock; findUniqueOrThrow: typeof userBookFindUniqueOrThrowMock; create: typeof userBookCreateMock } }) => Promise<unknown>) => callback({
      $queryRaw: queryRawMock,
      book: {
        findFirst: bookFindFirstMock,
        create: bookCreateMock,
      },
      userBook: {
        findFirst: userBookFindFirstMock,
        findUnique: userBookFindUniqueMock,
        findUniqueOrThrow: userBookFindUniqueOrThrowMock,
        create: userBookCreateMock,
      },
    }));
    bookFindFirstMock.mockResolvedValue(null);
    bookCreateMock.mockResolvedValue({ id: "book-1" });
    userBookFindFirstMock.mockResolvedValue(null);
    userBookFindUniqueMock.mockResolvedValue(null);
    isRetryableUserBookCompatErrorMock.mockReturnValue(true);
  });

  it("omits UNKNOWN ownershipStatus up front when it was not explicitly requested", async () => {
    userBookCreateMock.mockResolvedValueOnce({ id: "ub-1" });
    userBookFindUniqueOrThrowMock.mockResolvedValueOnce({
      id: "ub-1",
      userId: "user-1",
      bookId: "book-1",
      status: "TO_READ",
      rating: null,
      notes: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
    });

    const result = await saveLibraryEntry("user-1", {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      genres: [],
      status: "TO_READ",
      ownershipStatus: "UNKNOWN",
    });

    expect(userBookCreateMock).toHaveBeenCalledTimes(1);
    expect(userBookCreateMock.mock.calls[0]?.[0]?.select).toEqual({ id: true });
    expect(userBookCreateMock.mock.calls[0]?.[0]?.data).not.toHaveProperty("ownershipStatus");
    expect(result.ownershipStatus).toBe("UNKNOWN");
  });

  it("treats explicit UNKNOWN ownershipStatus as droppable even when flagged as requested", async () => {
    userBookCreateMock.mockResolvedValueOnce({ id: "ub-1" });
    userBookFindUniqueOrThrowMock.mockResolvedValueOnce({
      id: "ub-1",
      userId: "user-1",
      bookId: "book-1",
      status: "TO_READ",
      rating: null,
      notes: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
    });

    const result = await saveLibraryEntry("user-1", {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      genres: [],
      status: "TO_READ",
      ownershipStatus: "UNKNOWN",
    }, {
      ownershipStatusRequested: true,
    });

    expect(userBookCreateMock).toHaveBeenCalledTimes(1);
    expect(userBookCreateMock.mock.calls[0]?.[0]?.data).not.toHaveProperty("ownershipStatus");
    expect(result.ownershipStatus).toBe("UNKNOWN");
  });

  it("retries by dropping finishedAt before ownershipStatus when finishedAt is unsupported", async () => {
    userBookCreateMock
      .mockRejectedValueOnce(makeKnownRequestError("P2022", "The column `finishedAt` does not exist"))
      .mockResolvedValueOnce({
        id: "ub-1",
        userId: "user-1",
        bookId: "book-1",
        status: "READ",
        rating: null,
        notes: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
      });
    userBookFindUniqueOrThrowMock.mockResolvedValueOnce({
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

    const result = await saveLibraryEntry("user-1", {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      genres: [],
      status: "READ",
      ownershipStatus: "OWNED",
    });

    expect(userBookCreateMock).toHaveBeenCalledTimes(2);
    expect(userBookCreateMock.mock.calls[1]?.[0]?.data).toEqual(
      expect.objectContaining({
        status: "READ",
        ownershipStatus: "OWNED",
      }),
    );
    expect(userBookCreateMock.mock.calls[1]?.[0]?.data).not.toHaveProperty("finishedAt");
    expect(result.ownershipStatus).toBe("OWNED");
    expect(result.finishedAt).toBeNull();
    expect(revalidateBookCollectionPathsMock).toHaveBeenCalledWith("book-1");
  });

  it("drops finishedAt before ownershipStatus for generic compat write failures", async () => {
    userBookCreateMock
      .mockRejectedValueOnce(makeKnownRequestError("P2022", "The column `(not available)` does not exist"))
      .mockResolvedValueOnce({ id: "ub-1" });
    userBookFindUniqueOrThrowMock.mockResolvedValueOnce({
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

    const result = await saveLibraryEntry("user-1", {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      genres: [],
      status: "READ",
      ownershipStatus: "OWNED",
    }, {
      ownershipStatusRequested: true,
    });

    expect(userBookCreateMock).toHaveBeenCalledTimes(2);
    expect(userBookCreateMock.mock.calls[1]?.[0]?.data).toEqual(
      expect.objectContaining({
        status: "READ",
        ownershipStatus: "OWNED",
      }),
    );
    expect(userBookCreateMock.mock.calls[1]?.[0]?.data).not.toHaveProperty("finishedAt");
    expect(result.ownershipStatus).toBe("OWNED");
  });

  it("fails explicitly when a requested ownershipStatus cannot be persisted", async () => {
    userBookCreateMock.mockRejectedValueOnce(
      makeKnownRequestError("P2022", "The column `ownershipStatus` does not exist"),
    );

    await expect(saveLibraryEntry("user-1", {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      genres: [],
      status: "TO_READ",
      ownershipStatus: "OWNED",
    }, {
      ownershipStatusRequested: true,
    })).rejects.toBeInstanceOf(OwnershipStatusCreateCompatError);

    expect(userBookCreateMock).toHaveBeenCalledTimes(1);
  });

  it("returns the persisted finishedAt value after a successful READ save", async () => {
    const finishedAt = new Date("2024-02-02T00:00:00.000Z");

    userBookCreateMock.mockResolvedValueOnce({
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
    userBookFindUniqueOrThrowMock.mockResolvedValueOnce({
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

    const result = await saveLibraryEntry("user-1", {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      genres: [],
      status: "READ",
      ownershipStatus: "OWNED",
    });

    expect(result.finishedAt).toEqual(finishedAt);
    expect(userBookFindUniqueOrThrowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          ownershipStatus: true,
          finishedAt: true,
        }),
      }),
    );
  });

  it("converts a duplicate userBook race into DuplicateLibraryEntryError", async () => {
    userBookCreateMock.mockRejectedValueOnce(makeKnownRequestError("P2002", "Unique constraint failed"));

    await expect(saveLibraryEntry("user-1", {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      genres: [],
      status: "TO_READ",
      ownershipStatus: "OWNED",
    })).rejects.toBeInstanceOf(DuplicateLibraryEntryError);
  });

  it("blocks logical ISBN duplicates across different book rows", async () => {
    bookFindFirstMock.mockResolvedValueOnce({ id: "book-2" });
    userBookFindUniqueMock.mockResolvedValueOnce(null);
    userBookFindFirstMock.mockResolvedValueOnce({ id: "ub-existing" });

    await expect(saveLibraryEntry("user-1", {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      genres: [],
      isbn13: "9780132350884",
      status: "TO_READ",
      ownershipStatus: "OWNED",
    })).rejects.toBeInstanceOf(DuplicateLibraryEntryError);

    expect(userBookCreateMock).not.toHaveBeenCalled();
    expect(userBookFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          bookId: { not: "book-2" },
        }),
      }),
    );
  });

  it("finds an existing book by isbn10 when isbn13 is also provided", async () => {
    bookFindFirstMock.mockResolvedValueOnce({ id: "book-10" });
    userBookFindUniqueMock.mockResolvedValueOnce(null);
    userBookCreateMock.mockResolvedValueOnce({ id: "ub-1" });
    userBookFindUniqueOrThrowMock.mockResolvedValueOnce({
      id: "ub-1",
      userId: "user-1",
      bookId: "book-10",
      status: "TO_READ",
      ownershipStatus: "OWNED",
      rating: null,
      notes: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      book: { id: "book-10", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
    });

    await saveLibraryEntry("user-1", {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      genres: [],
      isbn13: "9780132350884",
      isbn10: "0132350882",
      status: "TO_READ",
      ownershipStatus: "OWNED",
    });

    expect(bookFindFirstMock).toHaveBeenCalledWith({
      where: {
        OR: [
          { isbn13: "9780132350884" },
          { isbn10: "9780132350884" },
          { isbn13: "0132350882" },
          { isbn10: "0132350882" },
        ],
      },
    });
    expect(bookCreateMock).not.toHaveBeenCalled();
  });

  it("rejects logical duplicates before creating a new book row", async () => {
    bookFindFirstMock.mockResolvedValueOnce(null);
    userBookFindFirstMock.mockResolvedValueOnce({ id: "ub-existing" });

    await expect(saveLibraryEntry("user-1", {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      genres: [],
      isbn13: "9780132350884",
      isbn10: "0132350882",
      status: "TO_READ",
      ownershipStatus: "OWNED",
    })).rejects.toBeInstanceOf(DuplicateLibraryEntryError);

    expect(bookCreateMock).not.toHaveBeenCalled();
    expect(userBookFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          OR: [
            { book: { OR: [{ isbn13: "9780132350884" }, { isbn10: "9780132350884" }] } },
            { book: { OR: [{ isbn13: "0132350882" }, { isbn10: "0132350882" }] } },
          ],
        }),
      }),
    );
  });

  it("serializes ISBN saves inside a serializable transaction", async () => {
    userBookCreateMock.mockResolvedValueOnce({ id: "ub-1" });
    userBookFindUniqueOrThrowMock.mockResolvedValueOnce({
      id: "ub-1",
      userId: "user-1",
      bookId: "book-1",
      status: "TO_READ",
      ownershipStatus: "OWNED",
      rating: null,
      notes: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
    });

    await saveLibraryEntry("user-1", {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      genres: [],
      isbn13: "9780132350884",
      status: "TO_READ",
      ownershipStatus: "OWNED",
    });

    expect(transactionMock).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expect(queryRawMock).toHaveBeenCalledOnce();
  });

  it("throws a create conflict after serializable retries are exhausted", async () => {
    transactionMock.mockRejectedValue(makeKnownRequestError("P2034", "Transaction failed due to a write conflict"));

    await expect(saveLibraryEntry("user-1", {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      genres: [],
      status: "TO_READ",
      ownershipStatus: "OWNED",
    }, {
      ownershipStatusRequested: true,
    })).rejects.toBeInstanceOf(LibraryEntryCreateConflictError);

    expect(transactionMock).toHaveBeenCalledTimes(3);
    expect(revalidateBookCollectionPathsMock).not.toHaveBeenCalled();
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
