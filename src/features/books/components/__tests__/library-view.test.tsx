import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      "nav.library": "Library",
      "library.heading": "Your Library",
      "library.description": "Manage your shelf",
      "library.compat.snapshotEyebrow": "Compatibility snapshot",
      "library.compat.readOnlyDescription": "Translated read-only snapshot description",
      "library.compat.ownershipUnavailable": "Translated ownership unavailable copy",
      "library.emptyFilter": "No books match this filter.",
      "library.tryAnotherStatus": "Try another status...",
    };

    return translations[key] ?? key;
  },
}));

vi.mock("../status-tabs", () => ({
  StatusTabs: () => <div>Status tabs</div>,
}));

vi.mock("../library-book-row", () => ({
  LibraryBookRow: () => <div>Book row</div>,
}));

vi.mock("../selection-toolbar", () => ({
  SelectionToolbar: () => <div>Selection toolbar</div>,
}));

vi.mock("@/features/shared/components/empty-state", () => ({
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div>{title} — {description}</div>
  ),
}));

vi.mock("@/features/books/hooks/use-batch-selection", () => ({
  useBatchSelection: () => ({
    selectionMode: false,
    selectedIds: new Set<string>(),
    enterSelectionMode: vi.fn(),
    exitSelectionMode: vi.fn(),
    toggleSelect: vi.fn(),
    selectAll: vi.fn(),
    deselectAll: vi.fn(),
    handleBatchStatusChange: vi.fn(),
  }),
}));

import { LibraryView } from "../library-view";

describe("LibraryView", () => {
  it("renders translated compatibility snapshot copy for degraded reads", () => {
    const html = renderToStaticMarkup(
      <LibraryView
        books={[]}
        readState="degraded"
        counts={{ WISHLIST: 0, TO_READ: 0, READING: 0, REREADING: 0, READ: 0, ON_HOLD: 0 }}
        activeStatus="all"
        searchParams={{}}
      />,
    );

    expect(html).toContain("Compatibility snapshot");
    expect(html).toContain("Translated read-only snapshot description");
  });

  it("renders translated ownership fallback copy when ownership is synthesized", () => {
    const html = renderToStaticMarkup(
      <LibraryView
        books={[{
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
          rating: null,
          notes: null,
          compatDegraded: true,
          compatDegradedFields: ["ownershipStatus"],
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        }]}
        readState="full"
        counts={{ WISHLIST: 0, TO_READ: 0, READING: 0, REREADING: 0, READ: 1, ON_HOLD: 0 }}
        activeStatus="all"
        searchParams={{}}
      />,
    );

    expect(html).toContain("Translated ownership unavailable copy");
  });
});
