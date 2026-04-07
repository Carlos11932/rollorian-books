import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTransaction = vi.fn();
const mockDonnaDeleteMany = vi.fn();
const mockBookListItemDeleteMany = vi.fn();
const mockLoanUpdateMany = vi.fn();
const mockUserBookDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (ops: unknown[]) => mockTransaction(ops),
    donnaBookState: { deleteMany: (args: unknown) => mockDonnaDeleteMany(args) },
    bookListItem: { deleteMany: (args: unknown) => mockBookListItemDeleteMany(args) },
    loan: { updateMany: (args: unknown) => mockLoanUpdateMany(args) },
    userBook: { delete: (args: unknown) => mockUserBookDelete(args) },
  },
}));

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
    mockTransaction.mockResolvedValue(undefined);
  });

  it("executes all cleanup operations in a single transaction", async () => {
    await deleteLibraryEntry(userId, bookId);

    expect(mockTransaction).toHaveBeenCalledOnce();
    const operations = mockTransaction.mock.calls[0]?.[0] as unknown[];
    // Transaction should contain 4 operations
    expect(operations).toHaveLength(4);
  });

  it("deletes DonnaBookState for the user+book", async () => {
    await deleteLibraryEntry(userId, bookId);

    expect(mockDonnaDeleteMany).toHaveBeenCalledWith({
      where: { userId, bookId },
    });
  });

  it("deletes BookListItems from the user's lists", async () => {
    await deleteLibraryEntry(userId, bookId);

    expect(mockBookListItemDeleteMany).toHaveBeenCalledWith({
      where: { bookId, list: { userId } },
    });
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
    mockTransaction.mockRejectedValueOnce(p2025);

    await expect(deleteLibraryEntry(userId, bookId)).rejects.toThrow(
      LibraryEntryNotFoundError,
    );
  });

  it("re-throws unexpected errors", async () => {
    const unexpected = new Error("DB connection lost");
    mockTransaction.mockRejectedValueOnce(unexpected);

    await expect(deleteLibraryEntry(userId, bookId)).rejects.toThrow(
      "DB connection lost",
    );
  });
});
