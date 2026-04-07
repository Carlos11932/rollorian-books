import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockDonnaDeleteMany,
  mockBookListFindMany,
  mockBookListItemDeleteMany,
  mockLoanUpdateMany,
  mockUserBookDeleteMany,
} = vi.hoisted(() => ({
  mockDonnaDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockBookListFindMany: vi.fn().mockResolvedValue([]),
  mockBookListItemDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockLoanUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockUserBookDeleteMany: vi.fn().mockResolvedValue({ count: 1 }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    donnaBookState: { deleteMany: mockDonnaDeleteMany },
    bookList: { findMany: mockBookListFindMany },
    bookListItem: { deleteMany: mockBookListItemDeleteMany },
    loan: { updateMany: mockLoanUpdateMany },
    userBook: { deleteMany: mockUserBookDeleteMany },
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

describe("deleteLibraryEntry", () => {
  const userId = "user-1";
  const bookId = "book-1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockDonnaDeleteMany.mockResolvedValue({ count: 0 });
    mockBookListFindMany.mockResolvedValue([]);
    mockBookListItemDeleteMany.mockResolvedValue({ count: 0 });
    mockLoanUpdateMany.mockResolvedValue({ count: 0 });
    mockUserBookDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("uses deleteMany to avoid Prisma 7 RETURNING * schema drift", async () => {
    await deleteLibraryEntry(userId, bookId);

    expect(mockUserBookDeleteMany).toHaveBeenCalledWith({
      where: { userId, bookId },
    });
  });

  it("throws LibraryEntryNotFoundError when count is 0", async () => {
    mockUserBookDeleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(deleteLibraryEntry(userId, bookId)).rejects.toThrow(
      LibraryEntryNotFoundError,
    );
  });

  it("continues if DonnaBookState table does not exist", async () => {
    mockDonnaDeleteMany.mockRejectedValueOnce(new Error("Table not found"));

    await deleteLibraryEntry(userId, bookId);

    expect(mockUserBookDeleteMany).toHaveBeenCalled();
  });

  it("cleans up BookListItems from user's lists", async () => {
    mockBookListFindMany.mockResolvedValue([
      { id: "list-1" },
      { id: "list-2" },
    ]);

    await deleteLibraryEntry(userId, bookId);

    expect(mockBookListItemDeleteMany).toHaveBeenCalledWith({
      where: { bookId, listId: { in: ["list-1", "list-2"] } },
    });
  });

  it("skips BookListItem cleanup when user has no lists", async () => {
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

  it("re-throws unexpected errors", async () => {
    mockUserBookDeleteMany.mockRejectedValueOnce(new Error("DB down"));

    await expect(deleteLibraryEntry(userId, bookId)).rejects.toThrow("DB down");
  });
});
