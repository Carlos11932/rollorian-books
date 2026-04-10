import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, string | number>) => {
    if (values?.name) return `${key}:${String(values.name)}`;
    if (values?.rating) return `${key}:${String(values.rating)}`;
    return key;
  },
}));

vi.mock("@/features/books/components/book-cover", () => ({
  BookCover: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/features/shared/components/badge", () => ({
  Badge: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock("@/features/shared/components/ownership-badge", () => ({
  OwnershipBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

import { ProfileBookList } from "../profile-book-list";

describe("ProfileBookList", () => {
  it("shows compatibility snapshot messaging and hides synthesized ownership badges", async () => {
    const html = renderToStaticMarkup(await ProfileBookList({
      books: [{
        id: "ub-1",
        userId: "user-1",
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
      canView: true,
      isOwnProfile: false,
      isAuthenticated: true,
      targetUserName: "Casey",
      readState: "degraded",
    }));

    expect(html).toContain("Compatibility snapshot");
    expect(html).toContain("read-only");
    expect(html).toContain("Read-only snapshot");
    expect(html).not.toContain(">UNKNOWN<");
  });
});
