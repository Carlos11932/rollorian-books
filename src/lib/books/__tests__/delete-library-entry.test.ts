import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Mocks — interactive transaction + best-effort donna cleanup
// ---------------------------------------------------------------------------

const {
  mockDonnaDeleteMany,
  mockBookListFindMany,
  mockBookListItemDeleteMany,
  mockLoanUpdateMany,
  mockUserBookDelete,
} = vi.hoisted(() => ({
  mockDonnaDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockBookListFindMany: vi.fn().mockResolvedValue([]),
  mockBookListItemDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockLoanUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockUserBookDelete: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/prisma", () => {
  const txClient = {
    bookList: { findMany: mockBookListFindMany },
    bookListItem: { deleteMany: mockBookListItemDeleteMany },
    loan: { updateMany: mockLoanUpdateMany },
    userBook: { delete: mockUserBookDelete },
  };
  return {
    prisma: {
      donnaBookState: { deleteMany: mockDonnaDeleteMany },
      $transaction: (fn: (tx: typeof txClient) => Promise<void>) => fn(txClient),
    },
  };
});

vi.mock("@/lib/revalidation", () => ({
  revalidateBookCollectionPaths: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

import { deleteLibraryEntry } from "../delete-library-entry";
import { LibraryEntryNotFoundError } from "../errors";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deleteLibraryEntry", () => {
  const userId = "user-1";
  const bookId = "book-1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockDonnaDeleteMany.mockResolvedValue({ count: 0 });
    mockBookListFindMany.mockResolvedValue([]);
    mockBookListItemDeleteMany.mockResolvedValue({ count: 0 });
    mockLoanUpdateMany.mockResolvedValue({ count: 0 });
    mockUserBookDelete.mockResolvedValue({});
  });

  it("attempts DonnaBookState cleanup before the transaction", async () => {
    await deleteLibraryEntry(userId, bookId);

    expect(mockDonnaDeleteMany).toHaveBeenCalledWith({
      where: { userId, bookId },
    });
  });

  it("continues if DonnaBookState table does not exist", async () => {
    mockDonnaDeleteMany.mockRejectedValueOnce(new Error("Table not found"));

    await deleteLibraryEntry(userId, bookId);

    // Should still delete the UserBook
    expect(mockUserBookDelete).toHaveBeenCalled();
  });

  it("queries user lists and deletes BookListItems with scalar filter", async () => {
    mockBookListFindMany.mockResolvedValue([
      { id: "list-1" },
      { id: "list-2" },
    ]);

    await deleteLibraryEntry(userId, bookId);

    expect(mockBookListFindMany).toHaveBeenCalledWith({
      where: { userId },
      select: { id: true },
    });
    expect(mockBookListItemDeleteMany).toHaveBeenCalledWith({
      where: {
        bookId,
        listId: { in: ["list-1", "list-2"] },
      },
    });
  });

  it("skips BookListItem deletion when user has no lists", async () => {
    mockBookListFindMany.mockResolvedValue([]);

    await deleteLibraryEntry(userId, bookId);

    expect(mockBookListItemDeleteMany).not.toHaveBeenCalled();
  });

  it("declines active loans where user is lender", async () => {
    await deleteLibraryEntry(userId, bookId);

    expect(mockLoanUpdateMany).toHaveBeenCalledWith({
      where: {
        lenderId: userId,
        bookId,
        status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
      },
      data: { status: "DECLINED" },
    });
  });

  it("deletes the UserBook entry", async () => {
    await deleteLibraryEntry(userId, bookId);

    expect(mockUserBookDelete).toHaveBeenCalledWith({
      where: { userId_bookId: { userId, bookId } },
    });
  });

  it("throws LibraryEntryNotFoundError on P2025", async () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "5.0.0",
    });
    mockUserBookDelete.mockRejectedValueOnce(p2025);

    await expect(deleteLibraryEntry(userId, bookId)).rejects.toThrow(
      LibraryEntryNotFoundError,
    );
  });

  it("re-throws unexpected errors", async () => {
    const unexpected = new Error("DB connection lost");
    mockUserBookDelete.mockRejectedValueOnce(unexpected);

    await expect(deleteLibraryEntry(userId, bookId)).rejects.toThrow(
      "DB connection lost",
    );
  });
});
