import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const {
  authMock,
  redirectMock,
  notFoundMock,
  groupMemberFindUniqueMock,
  groupFindUniqueMock,
  groupMemberFindManyMock,
  bookFindManyMock,
  loanFindManyMock,
  getTranslationsMock,
  isMissingUserBookSchemaErrorMock,
  isRetryableUserBookCompatErrorMock,
  GroupLibraryCatalogMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
  notFoundMock: vi.fn(),
  groupMemberFindUniqueMock: vi.fn(),
  groupFindUniqueMock: vi.fn(),
  groupMemberFindManyMock: vi.fn(),
  bookFindManyMock: vi.fn(),
  loanFindManyMock: vi.fn(),
  getTranslationsMock: vi.fn(),
  isMissingUserBookSchemaErrorMock: vi.fn(),
  isRetryableUserBookCompatErrorMock: vi.fn(),
  GroupLibraryCatalogMock: vi.fn((_props?: unknown) => null),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: getTranslationsMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findUnique: groupMemberFindUniqueMock,
      findMany: groupMemberFindManyMock,
    },
    group: {
      findUnique: groupFindUniqueMock,
    },
    book: {
      findMany: bookFindManyMock,
    },
    loan: {
      findMany: loanFindManyMock,
    },
  },
}));

vi.mock("@/lib/prisma-schema-compat", () => ({
  isMissingUserBookSchemaError: isMissingUserBookSchemaErrorMock,
  isRetryableUserBookCompatError: isRetryableUserBookCompatErrorMock,
}));

vi.mock("@/features/groups/components/group-library-catalog", () => ({
  GroupLibraryCatalog: (props: unknown) => GroupLibraryCatalogMock(props),
}));

import GroupFeedPage from "../page";

describe("Group page availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getTranslationsMock.mockResolvedValue((key: string, values?: { count?: number }) => {
      if (typeof values?.count === "number") {
        return `${key}:${values.count}`;
      }

      return key;
    });
    isMissingUserBookSchemaErrorMock.mockReturnValue(false);
    isRetryableUserBookCompatErrorMock.mockReturnValue(false);
    groupMemberFindUniqueMock.mockResolvedValue({ status: "ACCEPTED" });
    groupFindUniqueMock.mockResolvedValue({
      id: "group-1",
      name: "Readers",
      _count: { members: 3 },
    });
    groupMemberFindManyMock.mockResolvedValue([
      { userId: "user-1" },
      { userId: "owner-requested" },
      { userId: "owner-free" },
    ]);
    bookFindManyMock.mockResolvedValue([
      {
        id: "book-1",
        title: "Refactoring",
        authors: ["Martin Fowler"],
        coverUrl: null,
        genres: ["Software"],
        userBooks: [
          {
            userId: "user-1",
            status: "TO_READ",
            ownershipStatus: "NOT_OWNED",
            user: { name: "You" },
          },
          {
            userId: "owner-requested",
            status: "READ",
            ownershipStatus: "OWNED",
            user: { name: "Requested Owner" },
          },
          {
            userId: "owner-free",
            status: "READ",
            ownershipStatus: "OWNED",
            user: { name: "Free Owner" },
          },
        ],
      },
    ]);
    loanFindManyMock.mockResolvedValue([{ bookId: "book-1", lenderId: "owner-requested" }]);
  });

  it("treats REQUESTED and OFFERED group loans as unavailable in catalog props", async () => {
    renderToStaticMarkup(await GroupFeedPage({ params: Promise.resolve({ id: "group-1" }) }));

    expect(loanFindManyMock).toHaveBeenCalledWith({
      where: {
        bookId: { in: ["book-1"] },
        lenderId: { in: ["user-1", "owner-requested", "owner-free"] },
        status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
      },
      select: { bookId: true, lenderId: true },
    });
    expect(GroupLibraryCatalogMock).toHaveBeenCalledWith(expect.objectContaining({
      books: [
        expect.objectContaining({
          id: "book-1",
          owners: [
            expect.objectContaining({ userId: "owner-requested", hasExclusiveLoan: true }),
            expect.objectContaining({ userId: "owner-free", hasExclusiveLoan: false }),
          ],
        }),
      ],
    }));
  });
});
