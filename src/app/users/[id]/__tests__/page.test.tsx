import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const {
  authMock,
  userFindUniqueMock,
  followFindUniqueMock,
  canViewUserBooksMock,
  getLibrarySnapshotMock,
  ProfileHeaderMock,
  ProfileBookListMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  followFindUniqueMock: vi.fn(),
  canViewUserBooksMock: vi.fn(),
  getLibrarySnapshotMock: vi.fn(),
  ProfileHeaderMock: vi.fn((_props: unknown) => null),
  ProfileBookListMock: vi.fn((_props: unknown) => null),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
    follow: { findUnique: followFindUniqueMock },
  },
}));

vi.mock("@/lib/books", () => ({
  getLibrarySnapshot: getLibrarySnapshotMock,
}));

vi.mock("@/lib/privacy/can-view-user-books", () => ({
  canViewUserBooks: canViewUserBooksMock,
}));

vi.mock("@/features/profile/components/profile-header", () => ({
  ProfileHeader: (props: unknown) => ProfileHeaderMock(props),
}));

vi.mock("@/features/profile/components/profile-book-list", () => ({
  ProfileBookList: (props: unknown) => ProfileBookListMock(props),
}));

vi.mock("@/lib/prisma-schema-compat", () => ({
  isMissingUserBookSchemaError: vi.fn(() => false),
}));

import UserProfilePage from "../page";

describe("UserProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "viewer-1" } });
    userFindUniqueMock.mockResolvedValue({
      id: "user-2",
      name: "Casey",
      image: null,
      _count: {
        followers: 1,
        following: 2,
        userBooks: 3,
      },
    });
    followFindUniqueMock.mockResolvedValue(null);
    canViewUserBooksMock.mockResolvedValue(true);
  });

  it("passes degraded read state and compat metadata to profile book list", async () => {
    getLibrarySnapshotMock.mockResolvedValueOnce({
      state: "degraded",
      entries: [{
        id: "ub-1",
        userId: "user-2",
        bookId: "book-1",
        status: "READ",
        ownershipStatus: "UNKNOWN",
        finishedAt: null,
        rating: 5,
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

    renderToStaticMarkup(await UserProfilePage({ params: Promise.resolve({ id: "user-2" }) }));

    expect(ProfileBookListMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      readState: "degraded",
      books: [expect.objectContaining({ compatDegraded: true, compatDegradedFields: ["ownershipStatus"] })],
    }));
  });
});
