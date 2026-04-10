import { redirect } from "next/navigation";
import { type BookStatus, BOOK_STATUS_VALUES } from "@/lib/types/book";
import { getAuthenticatedUserIdOrNull } from "@/lib/auth/require-auth";
import type { StatusCounts, StatusTabValue } from "@/features/books/components/status-tabs";
import { LibraryView } from "@/features/books/components/library-view";
import { getLibrarySnapshot } from "@/lib/books";

type SearchParams = Record<string, string | string[] | undefined>;

function isValidStatus(value: string): value is BookStatus {
  return (BOOK_STATUS_VALUES as readonly string[]).includes(value);
}

function resolveActiveStatus(param: string | undefined): StatusTabValue {
  if (!param) return "all";
  if (isValidStatus(param)) return param;
  return "all";
}

function toStringRecord(params: SearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

interface LibraryPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const userId = await getAuthenticatedUserIdOrNull();
  if (!userId) {
    redirect("/login");
  }

  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const activeStatus = resolveActiveStatus(statusParam);
  const tabSearchParams = toStringRecord(params);

  const librarySnapshot = await getLibrarySnapshot(userId);

  if (librarySnapshot.state === "unavailable") {
    return (
      <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
        <section className="rounded-[var(--radius-xl)] border border-amber-400/30 bg-surface/70 p-6 backdrop-blur-[20px]">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
            Compatibility mode
          </p>
          <h1 className="mt-3 text-3xl font-bold text-on-surface">Library temporarily unavailable</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-on-surface/75">
            Rollorian could not read local library entries because the database schema is still catching up.
            We are intentionally avoiding editable library state until the UserBook table is available again.
          </p>
        </section>
      </div>
    );
  }

  const counts = librarySnapshot.entries.reduce<StatusCounts>(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { WISHLIST: 0, TO_READ: 0, READING: 0, REREADING: 0, READ: 0, ON_HOLD: 0 },
  );

  const visibleEntries = activeStatus === "all"
    ? librarySnapshot.entries
    : librarySnapshot.entries.filter((entry) => entry.status === activeStatus);

  const books = visibleEntries.map((ub) => ({
    id: ub.book.id,
    title: ub.book.title,
    subtitle: ub.book.subtitle,
    authors: ub.book.authors,
    description: ub.book.description,
    coverUrl: ub.book.coverUrl,
    publisher: ub.book.publisher,
    publishedDate: ub.book.publishedDate,
    pageCount: ub.book.pageCount,
    isbn10: ub.book.isbn10,
    isbn13: ub.book.isbn13,
    genres: ub.book.genres,
    status: ub.status,
    ownershipStatus: ub.ownershipStatus,
    rating: ub.rating,
    notes: ub.notes,
    compatDegraded: ub.compatDegraded,
    compatDegradedFields: ub.compatDegradedFields,
    createdAt: ub.createdAt.toISOString(),
    updatedAt: ub.updatedAt.toISOString(),
  }));

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      <LibraryView
        books={books}
        readState={librarySnapshot.state}
        counts={counts}
        activeStatus={activeStatus}
        searchParams={tabSearchParams}
      />
    </div>
  );
}
