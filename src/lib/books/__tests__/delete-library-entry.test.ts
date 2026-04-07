import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const { mockUserBookDelete } = vi.hoisted(() => ({
  mockUserBookDelete: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userBook: { delete: mockUserBookDelete },
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
    mockUserBookDelete.mockResolvedValue({});
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
    mockUserBookDelete.mockRejectedValueOnce(new Error("DB down"));

    await expect(deleteLibraryEntry(userId, bookId)).rejects.toThrow("DB down");
  });
});
