import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  transactionMock,
  userBookUpdateManyMock,
  userBookFindUniqueOrThrowMock,
  userBookUpdateMock,
  revalidateBookCollectionPathsMock,
  isRetryableUserBookCompatErrorMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  userBookUpdateManyMock: vi.fn(),
  userBookFindUniqueOrThrowMock: vi.fn(),
  userBookUpdateMock: vi.fn(),
  revalidateBookCollectionPathsMock: vi.fn(),
  isRetryableUserBookCompatErrorMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    userBook: {
      updateMany: userBookUpdateManyMock,
      findUniqueOrThrow: userBookFindUniqueOrThrowMock,
      update: userBookUpdateMock,
    },
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

import {
  EmptyLibraryEntryUpdateError,
  LibraryEntryWriteConflictError,
  OwnershipStatusSchemaCompatError,
  updateLibraryEntry,
} from "../update-library-entry";

describe("updateLibraryEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isRetryableUserBookCompatErrorMock.mockReturnValue(false);
    transactionMock.mockImplementation(async (callback: (tx: { userBook: { updateMany: typeof userBookUpdateManyMock; findUniqueOrThrow: typeof userBookFindUniqueOrThrowMock; update: typeof userBookUpdateMock } }) => Promise<unknown>) => callback({
      userBook: {
        updateMany: userBookUpdateManyMock,
        findUniqueOrThrow: userBookFindUniqueOrThrowMock,
        update: userBookUpdateMock,
      },
    }));
  });

  it("fails explicitly when a mixed READ update cannot persist ownershipStatus on a lagging schema", async () => {
    isRetryableUserBookCompatErrorMock.mockImplementation(
      (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError,
    );
    userBookUpdateManyMock.mockRejectedValueOnce(
      makeKnownRequestError("P2022", "The column `ownershipStatus` does not exist"),
    );
    userBookFindUniqueOrThrowMock.mockResolvedValueOnce({ status: "TO_READ" });

    await expect(updateLibraryEntry("user-1", "book-1", {
      status: "READ",
      ownershipStatus: "OWNED",
    })).rejects.toBeInstanceOf(OwnershipStatusSchemaCompatError);

    expect(userBookUpdateManyMock).toHaveBeenCalledTimes(1);
    expect(userBookUpdateManyMock.mock.calls[0]?.[0]?.data).toEqual(
      expect.objectContaining({
        status: "READ",
        finishedAt: expect.any(Date),
      }),
    );
    expect(userBookUpdateManyMock.mock.calls[0]?.[0]?.data).toHaveProperty("ownershipStatus", "OWNED");
    expect(revalidateBookCollectionPathsMock).not.toHaveBeenCalled();
  });

  it("does not overwrite finishedAt when an already-read entry is edited", async () => {
    const finishedAt = new Date("2024-02-02T00:00:00.000Z");

    userBookUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    userBookFindUniqueOrThrowMock
      .mockResolvedValueOnce({ status: "READ" })
      .mockResolvedValueOnce({
        id: "ub-1",
        userId: "user-1",
        bookId: "book-1",
        status: "READ",
        ownershipStatus: "OWNED",
        finishedAt,
        rating: 5,
        notes: "Updated note",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-02-03T00:00:00.000Z"),
        book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
      });

    const result = await updateLibraryEntry("user-1", "book-1", {
      status: "READ",
      notes: "Updated note",
    });

    expect(userBookUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "READ" }),
        data: expect.objectContaining({
          status: "READ",
          notes: "Updated note",
        }),
      }),
    );
    expect(userBookUpdateMock).not.toHaveBeenCalled();
    expect(result.finishedAt).toEqual(finishedAt);
  });

  it("returns the persisted finishedAt after a READ transition succeeds", async () => {
    const finishedAt = new Date("2024-03-03T00:00:00.000Z");

    userBookFindUniqueOrThrowMock
      .mockResolvedValueOnce({ status: "TO_READ" })
      .mockResolvedValueOnce({
        id: "ub-1",
        userId: "user-1",
        bookId: "book-1",
        status: "READ",
        ownershipStatus: "OWNED",
        finishedAt,
        rating: null,
        notes: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-03-03T00:00:00.000Z"),
        book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
      });
    userBookUpdateManyMock.mockResolvedValueOnce({ count: 1 });

    const result = await updateLibraryEntry("user-1", "book-1", {
      status: "READ",
    });

    expect(result.finishedAt).toEqual(finishedAt);
    expect(userBookFindUniqueOrThrowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ finishedAt: true }),
      }),
    );
  });

  it("returns truthful ownershipStatus and finishedAt for notes-only edits", async () => {
    const finishedAt = new Date("2024-04-04T00:00:00.000Z");

    userBookFindUniqueOrThrowMock
      .mockResolvedValueOnce({
        status: "READ",
        rating: 5,
        notes: null,
      })
      .mockResolvedValueOnce({
        id: "ub-1",
        userId: "user-1",
        bookId: "book-1",
        status: "READ",
        ownershipStatus: "OWNED",
        finishedAt,
        rating: 5,
        notes: "Sharpened note",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-04-04T00:00:00.000Z"),
        book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
      });
    userBookUpdateManyMock.mockResolvedValueOnce({ count: 1 });

    const result = await updateLibraryEntry("user-1", "book-1", {
      notes: "Sharpened note",
    });

    expect(userBookUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "READ",
          rating: 5,
          notes: null,
        }),
        data: { notes: "Sharpened note" },
      }),
    );
    expect(result.ownershipStatus).toBe("OWNED");
    expect(result.finishedAt).toEqual(finishedAt);
  });

  it("rejects empty updates instead of reporting success", async () => {
    await expect(updateLibraryEntry("user-1", "book-1", {})).rejects.toBeInstanceOf(EmptyLibraryEntryUpdateError);

    expect(userBookUpdateMock).not.toHaveBeenCalled();
    expect(userBookUpdateManyMock).not.toHaveBeenCalled();
    expect(revalidateBookCollectionPathsMock).not.toHaveBeenCalled();
  });

  it("fails explicitly when an ownership-only update cannot be persisted on a lagging schema", async () => {
    isRetryableUserBookCompatErrorMock.mockImplementation(
      (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError,
    );
    userBookFindUniqueOrThrowMock.mockResolvedValueOnce({
      status: "READ",
      rating: null,
      notes: null,
      ownershipStatus: "UNKNOWN",
    });
    userBookUpdateManyMock.mockRejectedValueOnce(
      makeKnownRequestError("P2022", "The column `ownershipStatus` does not exist"),
    );

    await expect(updateLibraryEntry("user-1", "book-1", {
      ownershipStatus: "OWNED",
    })).rejects.toBeInstanceOf(OwnershipStatusSchemaCompatError);

    expect(userBookUpdateManyMock).toHaveBeenCalledTimes(1);
    expect(revalidateBookCollectionPathsMock).not.toHaveBeenCalled();
  });

  it("retries notes-only updates when another write changes the snapshot first", async () => {
    const finishedAt = new Date("2024-05-01T00:00:00.000Z");

    userBookFindUniqueOrThrowMock
      .mockResolvedValueOnce({
        status: "READ",
        rating: 4,
        notes: "Original note",
      })
      .mockResolvedValueOnce({
        status: "READ",
        rating: 4,
        notes: "Changed elsewhere",
      })
      .mockResolvedValueOnce({
        id: "ub-1",
        userId: "user-1",
        bookId: "book-1",
        status: "READ",
        ownershipStatus: "OWNED",
        finishedAt,
        rating: 4,
        notes: "My edit",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-05-01T00:00:00.000Z"),
        book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
      });
    userBookUpdateManyMock
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await updateLibraryEntry("user-1", "book-1", {
      notes: "My edit",
    });

    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(userBookUpdateManyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ notes: "Original note" }),
        data: { notes: "My edit" },
      }),
    );
    expect(userBookUpdateManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ notes: "Changed elsewhere" }),
        data: { notes: "My edit" },
      }),
    );
    expect(result.notes).toBe("My edit");
  });

  it("throws LibraryEntryWriteConflictError when notes-only guarded retries are exhausted", async () => {
    userBookFindUniqueOrThrowMock
      .mockResolvedValueOnce({ status: "READ", rating: 4, notes: "v1" })
      .mockResolvedValueOnce({ status: "READ", rating: 4, notes: "v2" })
      .mockResolvedValueOnce({ status: "READ", rating: 4, notes: "v3" })
      .mockResolvedValueOnce({ status: "READ", rating: 4, notes: "v4" });
    userBookUpdateManyMock
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(updateLibraryEntry("user-1", "book-1", {
      notes: "Final",
    })).rejects.toBeInstanceOf(LibraryEntryWriteConflictError);

    expect(revalidateBookCollectionPathsMock).not.toHaveBeenCalled();
  });

  it("retries READ updates when the status changes between the decision read and guarded write", async () => {
    const finishedAt = new Date("2024-05-05T00:00:00.000Z");

    userBookFindUniqueOrThrowMock
      .mockResolvedValueOnce({ status: "READ" })
      .mockResolvedValueOnce({ status: "READING" })
      .mockResolvedValueOnce({
        id: "ub-1",
        userId: "user-1",
        bookId: "book-1",
        status: "READ",
        ownershipStatus: "OWNED",
        finishedAt,
        rating: null,
        notes: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-05-05T00:00:00.000Z"),
        book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
      });
    userBookUpdateManyMock
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await updateLibraryEntry("user-1", "book-1", {
      status: "READ",
      ownershipStatus: "OWNED",
    });

    expect(userBookUpdateManyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ status: "READ" }),
        data: { status: "READ", ownershipStatus: "OWNED" },
      }),
    );
    expect(userBookUpdateManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ status: "READING" }),
        data: expect.objectContaining({
          status: "READ",
          ownershipStatus: "OWNED",
          finishedAt: expect.any(Date),
        }),
      }),
    );
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(result.finishedAt).toEqual(finishedAt);
  });

  it("throws LibraryEntryWriteConflictError when guarded READ retries are exhausted", async () => {
    userBookFindUniqueOrThrowMock
      .mockResolvedValueOnce({ status: "TO_READ" })
      .mockResolvedValueOnce({ status: "READING" })
      .mockResolvedValueOnce({ status: "WISHLIST" })
      .mockResolvedValueOnce({ status: "TO_READ" });
    userBookUpdateManyMock
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(updateLibraryEntry("user-1", "book-1", {
      status: "READ",
    })).rejects.toBeInstanceOf(LibraryEntryWriteConflictError);

    expect(revalidateBookCollectionPathsMock).not.toHaveBeenCalled();
  });

  it("retries serializable transaction conflicts before succeeding", async () => {
    const finishedAt = new Date("2024-06-06T00:00:00.000Z");

    transactionMock
      .mockRejectedValueOnce(makeKnownRequestError("P2034", "Transaction failed due to a write conflict"))
      .mockImplementationOnce(async (callback: (tx: { userBook: { updateMany: typeof userBookUpdateManyMock; findUniqueOrThrow: typeof userBookFindUniqueOrThrowMock; update: typeof userBookUpdateMock } }) => Promise<unknown>) => callback({
        userBook: {
          updateMany: userBookUpdateManyMock,
          findUniqueOrThrow: userBookFindUniqueOrThrowMock,
          update: userBookUpdateMock,
        },
      }));
    userBookFindUniqueOrThrowMock
      .mockResolvedValueOnce({
        status: "READ",
        rating: null,
        notes: null,
      })
      .mockResolvedValueOnce({
        id: "ub-1",
        userId: "user-1",
        bookId: "book-1",
        status: "READ",
        ownershipStatus: "OWNED",
        finishedAt,
        rating: null,
        notes: "Recovered",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-06-06T00:00:00.000Z"),
        book: { id: "book-1", title: "Clean Code", authors: ["Robert C. Martin"], genres: [] },
      });
    userBookUpdateManyMock.mockResolvedValueOnce({ count: 1 });

    const result = await updateLibraryEntry("user-1", "book-1", {
      notes: "Recovered",
    });

    expect(result.finishedAt).toEqual(finishedAt);
    expect(transactionMock).toHaveBeenCalledTimes(2);
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
