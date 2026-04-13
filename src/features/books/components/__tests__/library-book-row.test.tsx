import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { refreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (key === "book.pageCountCompact") return `${String(values?.count)} pages`;
    if (key === "book.friendActivityAriaLabel") {
      const count = Number(values?.count ?? 0);
      return count === 1
        ? "1 friend has rated this book"
        : `${String(count)} friends have rated this book`;
    }
    if (key === "library.compat.snapshotEyebrow") return "Compatibility snapshot";
    if (values?.title) return `${key}:${String(values.title)}`;
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

import { LibraryBookRow } from "../library-book-row";

describe("LibraryBookRow", () => {
  it("renders compatibility read-only messaging instead of edit controls", () => {
    const html = renderToStaticMarkup(
      <LibraryBookRow
        readOnly
        book={{
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
          status: "READ",
          ownershipStatus: "UNKNOWN",
          rating: 4,
          notes: "compat",
          compatDegraded: true,
          compatDegradedFields: ["ownershipStatus"],
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        }}
      />,
    );

    expect(html).toContain("Compatibility snapshot");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("more_horiz");
    expect(html).not.toContain(">UNKNOWN<");
  });

  it("renders localized page count and friend activity labels via translations", () => {
    const html = renderToStaticMarkup(
      <LibraryBookRow
        book={{
          id: "book-2",
          title: "Domain-Driven Design",
          subtitle: null,
          authors: ["Eric Evans"],
          description: null,
          coverUrl: null,
          publisher: null,
          publishedDate: "2003-08-30",
          pageCount: 560,
          isbn10: null,
          isbn13: null,
          genres: [],
          status: "READ",
          ownershipStatus: "OWNED",
          rating: null,
          notes: null,
          compatDegraded: undefined,
          compatDegradedFields: undefined,
          friendActivityCount: 2,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        }}
      />,
    );

    expect(html).toContain("560 pages · 2003");
    expect(html).toContain("aria-label=\"2 friends have rated this book\"");
    expect(html).not.toContain("págs.");
    expect(html).not.toContain("amigos han valorado este libro");
  });
});
