import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const {
  authMock,
  getLibraryEntryMock,
  bookFindUniqueMock,
  userBookFindManyMock,
  loanFindManyMock,
  fetchBookByIdMock,
  fetchWorkByIdMock,
  getViewableUserIdsMock,
  isPrismaSchemaMismatchErrorMock,
  LocalBookDetailMock,
  DiscoveredBookDetailMock,
  GoogleBookDetailMock,
} = vi.hoisted(() => {
  return {
    authMock: vi.fn(),
    getLibraryEntryMock: vi.fn(),
    bookFindUniqueMock: vi.fn(),
    userBookFindManyMock: vi.fn(),
    loanFindManyMock: vi.fn(),
    fetchBookByIdMock: vi.fn(),
    fetchWorkByIdMock: vi.fn(),
    getViewableUserIdsMock: vi.fn(),
    isPrismaSchemaMismatchErrorMock: vi.fn(),
    LocalBookDetailMock: vi.fn((_props?: unknown) => null),
    DiscoveredBookDetailMock: vi.fn((_props?: unknown) => null),
    GoogleBookDetailMock: vi.fn((_props?: unknown) => null),
  };
});

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/books", () => ({
  getLibraryEntrySnapshot: (...args: unknown[]) => getLibraryEntryMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    book: { findUnique: bookFindUniqueMock },
    userBook: { findMany: userBookFindManyMock },
    loan: { findMany: loanFindManyMock },
  },
}));

vi.mock("@/lib/google-books/client", () => ({
  fetchBookById: fetchBookByIdMock,
}));

vi.mock("@/lib/book-providers/open-library/client", () => ({
  fetchWorkById: fetchWorkByIdMock,
}));

vi.mock("@/lib/privacy/can-view-user-books", () => ({
  getViewableUserIds: getViewableUserIdsMock,
}));

vi.mock("@/lib/prisma-schema-compat", () => ({
  isPrismaSchemaMismatchError: isPrismaSchemaMismatchErrorMock,
}));

vi.mock("@/features/books/components/local-book-detail", () => ({
  LocalBookDetail: (props: unknown) => LocalBookDetailMock(props),
}));

vi.mock("@/features/books/components/google-book-detail", () => ({
  GoogleBookDetail: (props: unknown) => GoogleBookDetailMock(props),
}));

vi.mock("@/features/books/components/discovered-book-detail", () => ({
  DiscoveredBookDetail: (props: unknown) => DiscoveredBookDetailMock(props),
}));

import BookDetailPage from "../page";

describe("Book detail page local resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getViewableUserIdsMock.mockResolvedValue(new Set());
    isPrismaSchemaMismatchErrorMock.mockReturnValue(false);
  });

  it("rethrows unexpected local library read errors instead of falling through to remote lookup", async () => {
    getLibraryEntryMock.mockRejectedValueOnce(new Error("local read failed"));

    await expect(BookDetailPage({ params: Promise.resolve({ id: "book-1" }) })).rejects.toThrow("local read failed");

    expect(bookFindUniqueMock).not.toHaveBeenCalled();
    expect(fetchBookByIdMock).not.toHaveBeenCalled();
    expect(fetchWorkByIdMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected local book lookup errors after a library miss", async () => {
    getLibraryEntryMock.mockResolvedValueOnce({ entry: null, state: "missing" });
    bookFindUniqueMock.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(BookDetailPage({ params: Promise.resolve({ id: "book-2" }) })).rejects.toThrow("database unavailable");

    expect(fetchBookByIdMock).not.toHaveBeenCalled();
    expect(fetchWorkByIdMock).not.toHaveBeenCalled();
  });

  it("degrades gracefully when local UserBook lookup hits a schema mismatch", async () => {
    getLibraryEntryMock.mockResolvedValueOnce({ entry: null, state: "unavailable" });
    bookFindUniqueMock.mockResolvedValueOnce({
      id: "book-3",
      title: "Clean Code",
      authors: ["Robert C. Martin"],
    });
    userBookFindManyMock.mockResolvedValueOnce([]);
    loanFindManyMock.mockResolvedValueOnce([]);

    await expect(BookDetailPage({ params: Promise.resolve({ id: "book-3" }) })).resolves.toBeTruthy();

    expect(bookFindUniqueMock).toHaveBeenCalledWith({ where: { id: "book-3" } });
    expect(DiscoveredBookDetailMock).not.toHaveBeenCalled();
    expect(GoogleBookDetailMock).not.toHaveBeenCalled();
  });

  it("renders a read-only fallback instead of editable local UI for compat-degraded local entries", async () => {
    getLibraryEntryMock.mockResolvedValueOnce({
      entry: {
        id: "ub-3",
        userId: "user-1",
        bookId: "book-3",
        status: "READ",
        ownershipStatus: "UNKNOWN",
        finishedAt: null,
        rating: 4,
        notes: "Keep this read-only",
        compatDegraded: true,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        book: {
          id: "book-3",
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
      },
      state: "degraded",
    });

    const html = renderToStaticMarkup(await BookDetailPage({ params: Promise.resolve({ id: "book-3" }) }));

    expect(html).toContain("Read-only compatibility mode");
    expect(html).toContain("Editing and ownership controls are temporarily disabled");
    expect(LocalBookDetailMock).not.toHaveBeenCalled();
    expect(DiscoveredBookDetailMock).not.toHaveBeenCalled();
    expect(GoogleBookDetailMock).not.toHaveBeenCalled();
  });

  it("renders compatibility messaging instead of discovered detail when local UserBook data is unavailable", async () => {
    getLibraryEntryMock.mockResolvedValueOnce({ entry: null, state: "unavailable" });
    bookFindUniqueMock.mockResolvedValueOnce({
      id: "book-9",
      title: "Domain-Driven Design",
      subtitle: null,
      authors: ["Eric Evans"],
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
    });

    const html = renderToStaticMarkup(await BookDetailPage({ params: Promise.resolve({ id: "book-9" }) }));

    expect(html).toContain("Compatibility mode");
    expect(html).toContain("UserBook table is missing");
    expect(html).toContain("Domain-Driven Design");
    expect(DiscoveredBookDetailMock).not.toHaveBeenCalled();
    expect(LocalBookDetailMock).not.toHaveBeenCalled();
  });

});
