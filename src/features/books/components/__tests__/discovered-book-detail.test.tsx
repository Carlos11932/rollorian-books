import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => <img alt={alt} {...props} />,
}));

vi.mock("@/features/books/components/book-cover", () => ({
  BookCover: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/features/books/components/metadata-card", () => ({
  MetadataCard: () => <div>metadata</div>,
}));

vi.mock("@/features/shared/components/blurred-background", () => ({
  BlurredBackground: () => null,
}));

vi.mock("@/features/books/components/google-book-save-client", () => ({
  GoogleBookSaveClient: () => <div>save</div>,
}));

vi.mock("@/features/loans/components/request-loan-button", () => ({
  RequestLoanButton: ({ lenderId }: { lenderId: string }) => <button>{`request:${lenderId}`}</button>,
}));

import { DiscoveredBookDetail } from "../discovered-book-detail";

describe("DiscoveredBookDetail", () => {
  const book = {
    id: "book-1",
    title: "Refactoring",
    subtitle: null,
    authors: ["Martin Fowler"],
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
  };

  it("hides the request button for owners with exclusive loans", async () => {
    const html = renderToStaticMarkup(await DiscoveredBookDetail({
      book,
      owners: [
        {
          userId: "owner-requested",
          userName: "Requested Owner",
          userImage: null,
          status: "READ",
          rating: null,
          hasExclusiveLoan: true,
        },
        {
          userId: "owner-free",
          userName: "Free Owner",
          userImage: null,
          status: "READ",
          rating: null,
          hasExclusiveLoan: false,
        },
      ],
    }));

    expect(html).toContain("book.ownershipSocialLent");
    expect(html).toContain("request:owner-free");
    expect(html).not.toContain("request:owner-requested");
  });
});
