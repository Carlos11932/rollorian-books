import type { BookStatus } from "@/lib/types/book";
import { BOOK_STATUS_LABELS, BOOK_STATUS_VALUES } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { LibraryBookCard } from "@/features/books/components/library-book-card";
import { StatusTabs } from "@/features/books/components/status-tabs";
import type { StatusCounts, StatusTabValue } from "@/features/books/components/status-tabs";
import { EmptyState } from "@/features/shared/components/empty-state";
import { BookRailSection } from "@/features/shared/ui/book-rail-section";

interface LibraryBookRow {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  publisher: string | null;
  publishedDate: string | null;
}

interface StatusCountRow {
  status: BookStatus;
  _count: { id: number };
}

const STATUS_ORDERED: BookStatus[] = ["READING", "TO_READ", "WISHLIST", "READ"];

const STATUS_EYEBROW: Record<BookStatus, string> = {
  WISHLIST: "Wishlist",
  TO_READ: "Up next",
  READING: "In progress",
  READ: "Completed",
};

const STATUS_EMPTY_COPY: Record<BookStatus, string> = {
  WISHLIST: "Prospects worth keeping visible until they earn a stronger commitment.",
  TO_READ: "Confirmed next reads waiting for their turn.",
  READING: "Books currently in motion.",
  READ: "Completed titles with notes and history preserved.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function isValidStatus(value: string): value is BookStatus {
  return (BOOK_STATUS_VALUES as readonly string[]).includes(value);
}

function resolveActiveStatus(param: string | undefined): StatusTabValue {
  if (!param) return "all";
  if (isValidStatus(param)) return param;
  return "all";
}

function createSearchParams(params: SearchParams): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      searchParams.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        searchParams.append(key, entry);
      }
    }
  }

  return searchParams;
}

function createStatusHrefs(params: SearchParams, basePath: string): Record<StatusTabValue, string> {
  const baseSearchParams = createSearchParams(params);
  baseSearchParams.delete("status");

  const hrefs = {
    all: basePath,
    WISHLIST: basePath,
    TO_READ: basePath,
    READING: basePath,
    READ: basePath,
  } satisfies Record<StatusTabValue, string>;

  const baseQuery = baseSearchParams.toString();
  hrefs.all = baseQuery ? `${basePath}?${baseQuery}` : basePath;

  for (const status of BOOK_STATUS_VALUES) {
    const nextParams = new URLSearchParams(baseSearchParams);
    nextParams.set("status", status);
    hrefs[status] = `${basePath}?${nextParams.toString()}`;
  }

  return hrefs;
}

function getFilterTitle(status: BookStatus): string {
  return `No ${BOOK_STATUS_LABELS[status]} books`;
}

interface LibraryPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const activeStatus = resolveActiveStatus(statusParam);
  const tabHrefs = createStatusHrefs(params, "/library");

  const [books, groupedCounts]: [LibraryBookRow[], StatusCountRow[]] = await Promise.all([
    prisma.book.findMany({
      where: activeStatus !== "all" ? { status: activeStatus } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        authors: true,
        coverUrl: true,
        status: true,
        rating: true,
        notes: true,
        publisher: true,
        publishedDate: true,
      },
    }),
    prisma.book.groupBy({ by: ["status"], _count: { id: true } }),
  ]);

  const counts = groupedCounts.reduce<StatusCounts>(
    (acc, row) => {
      acc[row.status] = row._count.id;
      return acc;
    },
    { WISHLIST: 0, TO_READ: 0, READING: 0, READ: 0 },
  );

  const isEmpty = books.length === 0;

  return (
    <div className="grid gap-6">
      <div
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 grid gap-4"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <div className="grid gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Library</p>
          <h1 className="text-3xl font-bold text-text" style={{ fontFamily: "var(--font-display)" }}>
            Your Archive
          </h1>
          <p className="text-sm text-muted leading-relaxed max-w-lg">
            Your archive, split into rails that match reading intent. Filter by status or keep everything visible and scroll each shelf.
          </p>
        </div>

        <StatusTabs activeStatus={activeStatus} counts={counts} hrefs={tabHrefs} />
      </div>

      {isEmpty ? (
        <EmptyState
          title={activeStatus === "all" ? "Your library is empty" : getFilterTitle(activeStatus)}
          description={
            activeStatus === "all"
              ? "Search the catalog, save a title, and the rails will start filling by status."
              : "Try another status or save something from Search."
          }
        />
      ) : activeStatus !== "all" ? (
        <BookRailSection
          title={STATUS_EYEBROW[activeStatus]}
          eyebrow={BOOK_STATUS_LABELS[activeStatus]}
          count={books.length}
          emptyCopy="No books match this filter."
        >
          {books.map((book) => (
            <div key={book.id} className="shrink-0 w-[clamp(260px,32vw,340px)]" style={{ scrollSnapAlign: "start" }}>
              <LibraryBookCard book={book} />
            </div>
          ))}
        </BookRailSection>
      ) : (
        <div className="grid gap-4">
          {STATUS_ORDERED.map((status) => {
            const statusBooks = books.filter((book) => book.status === status);

            return (
              <BookRailSection
                key={status}
                title={STATUS_EYEBROW[status]}
                eyebrow={BOOK_STATUS_LABELS[status]}
                count={statusBooks.length}
                emptyTitle={getFilterTitle(status)}
                emptyCopy={STATUS_EMPTY_COPY[status]}
              >
                {statusBooks.map((book) => (
                  <div key={book.id} className="shrink-0 w-[clamp(260px,32vw,340px)]" style={{ scrollSnapAlign: "start" }}>
                    <LibraryBookCard book={book} />
                  </div>
                ))}
              </BookRailSection>
            );
          })}
        </div>
      )}
    </div>
  );
}
