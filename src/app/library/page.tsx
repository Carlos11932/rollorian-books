import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { BookRailSection } from "@/features/shared/ui/book-rail-section";
import { LibraryBookCard } from "@/features/books/components/library-book-card";
import { StatusTabs } from "@/features/books/components/status-tabs";
import { EmptyState } from "@/features/shared/components/empty-state";
import type { StatusTabValue, StatusCounts } from "@/features/books/components/status-tabs";
import type { BookStatus } from "@/features/shared/components/badge";
import LibraryLoading from "./loading";

const BOOK_STATUS = {
  WISHLIST: "WISHLIST",
  TO_READ: "TO_READ",
  READING: "READING",
  READ: "READ",
} as const;

const STATUS_ORDERED: BookStatus[] = [
  BOOK_STATUS.READING,
  BOOK_STATUS.TO_READ,
  BOOK_STATUS.WISHLIST,
  BOOK_STATUS.READ,
];

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

function isValidStatus(value: string): value is BookStatus {
  return Object.values(BOOK_STATUS).includes(value as BookStatus);
}

function resolveActiveStatus(param: string | undefined): StatusTabValue {
  if (!param) return "all";
  if (isValidStatus(param)) return param;
  return "all";
}

interface LibraryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const activeStatus = resolveActiveStatus(statusParam);

  // Fetch all books; if status is active fetch only that status
  const books = await prisma.book.findMany({
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
  });

  // Compute counts for the tab badges
  // When filtered: only count matching books; for "all" we need counts per status
  let counts: StatusCounts;

  if (activeStatus === "all") {
    const grouped = books.reduce<Record<BookStatus, number>>(
      (acc: Record<BookStatus, number>, book: (typeof books)[number]) => {
        acc[book.status as BookStatus] = (acc[book.status as BookStatus] ?? 0) + 1;
        return acc;
      },
      { WISHLIST: 0, TO_READ: 0, READING: 0, READ: 0 },
    );
    counts = grouped;
  } else {
    // For filtered view, query counts for all statuses separately
    const allCounts = await prisma.book.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    counts = allCounts.reduce<StatusCounts>(
      (acc, row) => {
        acc[row.status as BookStatus] = row._count.id;
        return acc;
      },
      { WISHLIST: 0, TO_READ: 0, READING: 0, READ: 0 },
    );
  }

  const isEmpty = books.length === 0;

  return (
    <div className="grid gap-6">
      {/* Page header */}
      <div className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] backdrop-blur-[16px] p-6 grid gap-4"
        style={{ backdropFilter: "blur(16px)" }}>
        <div className="grid gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Library</p>
          <h1
            className="text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Your Archive
          </h1>
          <p className="text-sm text-muted leading-relaxed max-w-lg">
            Your archive, split into rails that match reading intent. Filter by
            status or keep everything visible and scroll each shelf.
          </p>
        </div>

        {/* Status tabs — needs client interactivity */}
        <Suspense fallback={<div className="flex gap-2 h-9" />}>
          <StatusTabs activeStatus={activeStatus} counts={counts} />
        </Suspense>
      </div>

      {/* Content */}
      {isEmpty ? (
        <EmptyState
          title={
            activeStatus === "all"
              ? "Your library is empty"
              : `No ${activeStatus === "TO_READ" ? "To Read" : activeStatus.charAt(0) + activeStatus.slice(1).toLowerCase()} books`
          }
          description={
            activeStatus === "all"
              ? "Search the catalog, save a title, and the rails will start filling by status."
              : "Try another status or save something from Search."
          }
        />
      ) : activeStatus !== "all" ? (
        /* Single filtered list */
        <BookRailSection
          title={STATUS_EYEBROW[activeStatus as BookStatus]}
          eyebrow={activeStatus === "TO_READ" ? "To Read" : activeStatus.charAt(0) + activeStatus.slice(1).toLowerCase()}
          count={books.length}
          emptyCopy="No books match this filter."
        >
          {books.map((book) => (
            <div key={book.id} className="shrink-0 w-[clamp(260px,32vw,340px)]" style={{ scrollSnapAlign: "start" }}>
              <LibraryBookCard book={{
                ...book,
                status: book.status as BookStatus,
                coverUrl: book.coverUrl ?? null,
                rating: book.rating ?? null,
                notes: book.notes ?? null,
                publisher: book.publisher ?? null,
                publishedDate: book.publishedDate ?? null,
              }} />
            </div>
          ))}
        </BookRailSection>
      ) : (
        /* All statuses — one rail per status that has books */
        <div className="grid gap-4">
          {STATUS_ORDERED.map((status) => {
            const statusBooks = books.filter((b) => b.status === status);
            return (
              <BookRailSection
                key={status}
                title={STATUS_EYEBROW[status]}
                eyebrow={status === "TO_READ" ? "To Read" : status === "READ" ? "Read" : status.charAt(0) + status.slice(1).toLowerCase()}
                count={statusBooks.length}
                emptyTitle={`No ${status === "TO_READ" ? "To Read" : status.toLowerCase()} books`}
                emptyCopy={STATUS_EMPTY_COPY[status]}
              >
                {statusBooks.map((book) => (
                  <div key={book.id} className="shrink-0 w-[clamp(260px,32vw,340px)]" style={{ scrollSnapAlign: "start" }}>
                    <LibraryBookCard book={{
                      ...book,
                      status: book.status as BookStatus,
                      coverUrl: book.coverUrl ?? null,
                      rating: book.rating ?? null,
                      notes: book.notes ?? null,
                      publisher: book.publisher ?? null,
                      publishedDate: book.publishedDate ?? null,
                    }} />
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
