import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const {
  getAuthenticatedUserIdOrNullMock,
  redirectMock,
  getLibrarySnapshotMock,
  LibraryViewMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserIdOrNullMock: vi.fn(),
  redirectMock: vi.fn(),
  getLibrarySnapshotMock: vi.fn(),
  LibraryViewMock: vi.fn((_props: unknown) => null),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth/require-auth", () => ({
  getAuthenticatedUserIdOrNull: getAuthenticatedUserIdOrNullMock,
}));

vi.mock("@/lib/books", () => ({
  getLibrarySnapshot: getLibrarySnapshotMock,
}));

vi.mock("@/features/books/components/library-view", () => ({
  LibraryView: (props: unknown) => LibraryViewMock(props),
}));

import LibraryPage from "../page";

describe("LibraryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUserIdOrNullMock.mockResolvedValue("user-1");
  });

  it("passes degraded read state and compat metadata into the list view", async () => {
    getLibrarySnapshotMock.mockResolvedValueOnce({
      state: "degraded",
      entries: [{
        id: "ub-1",
        userId: "user-1",
        bookId: "book-1",
        status: "READ",
        ownershipStatus: "UNKNOWN",
        finishedAt: null,
        rating: 4,
        notes: null,
        compatDegraded: true,
        compatDegradedFields: ["ownershipStatus"],
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        book: {
          id: "book-1",
          title: "Clean Code",
          subtitle: null,
          authors: ["Robert C. Martin"],
          description: null,
          coverUrl: null,
          publisher: null,
          publishedDate: null,
          pageCount: null,
          isbn10: null,
          isbn13: null,
          genres: [],
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        },
      }],
    });

    renderToStaticMarkup(await LibraryPage({ searchParams: Promise.resolve({}) }));

    expect(LibraryViewMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      readState: "degraded",
      books: [expect.objectContaining({ compatDegraded: true, compatDegradedFields: ["ownershipStatus"] })],
    }));
  });
});
