import { notFound } from "next/navigation";
import type { Book } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchBookById } from "@/lib/google-books/client";
import { serializeBook } from "@/features/books/types";
import { Badge } from "@/features/shared/components/badge";
import { BookCover } from "@/features/books/components/book-cover";
import { BookDetailClient } from "@/features/books/components/book-detail-client";
import { GoogleBookSaveClient } from "@/features/books/components/google-book-save-client";
import type { BookStatus } from "@/features/shared/components/badge";
import type { GoogleBooksVolume } from "@/lib/google-books/types";
import Link from "next/link";

interface BookDetailPageProps {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Helpers to resolve the book from multiple sources
// ---------------------------------------------------------------------------

type LocalBook = Book;

interface GoogleBookView {
  source: "google";
  volume: GoogleBooksVolume;
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  coverUrl: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  isbn10: string | null;
  isbn13: string | null;
  genres: string[];
}

type ResolvedBook =
  | { source: "local"; book: LocalBook }
  | GoogleBookView;

/**
 * Attempts to resolve a book by the given `id` param.
 *
 * 1. Prisma lookup by primary key (CUID).
 *    - Prisma CUIDs always start with a lowercase letter, so we skip the DB
 *      query entirely when the id looks like a Google Books volume ID.
 * 2. Google Books API single-volume fetch.
 */
async function resolveBook(id: string): Promise<ResolvedBook | null> {
  // --- 1. Try local Prisma DB ---
  // CUIDs are 25-char strings starting with a lowercase letter (c…).
  // Google Books IDs are typically alphanumeric with mixed case and sometimes
  // contain hyphens/underscores. We attempt Prisma first; if it throws because
  // the ID format is invalid we treat it as "not found locally".
  try {
    const local: Book | null = await prisma.book.findUnique({ where: { id } });
    if (local) {
      return { source: "local", book: local };
    }
  } catch {
    // Invalid ID format for Prisma — fall through to Google Books
  }

  // --- 2. Google Books API ---
  try {
    const volume = await fetchBookById(id);
    if (volume) {
      return googleVolumeToView(volume);
    }
  } catch {
    // Google Books unreachable — treat as not found
  }

  return null;
}

function selectIdentifier(
  identifiers: { type: string; identifier: string }[] | undefined,
  type: string,
): string | null {
  return identifiers?.find((i: { type: string; identifier: string }) => i.type === type)?.identifier ?? null;
}

function googleVolumeToView(volume: GoogleBooksVolume): GoogleBookView {
  const info = volume.volumeInfo ?? {};
  const identifiers = info.industryIdentifiers;

  return {
    source: "google",
    volume,
    title: info.title ?? "Untitled",
    subtitle: info.subtitle ?? null,
    authors: Array.isArray(info.authors) ? info.authors : [],
    description: info.description ?? null,
    coverUrl: info.imageLinks?.thumbnail?.replace("http://", "https://") ?? null,
    publisher: info.publisher ?? null,
    publishedDate: info.publishedDate ?? null,
    pageCount: info.pageCount ?? null,
    isbn10: selectIdentifier(identifiers, "ISBN_10"),
    isbn13: selectIdentifier(identifiers, "ISBN_13"),
    genres: Array.isArray(info.categories) ? info.categories : [],
  };
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: BookDetailPageProps) {
  const { id } = await params;
  const resolved = await resolveBook(id);

  if (!resolved) return { title: "Book not found" };

  if (resolved.source === "local") {
    const { book } = resolved;
    return {
      title: `${book.title} — Rollorian`,
      description: `Book detail for ${book.title} by ${book.authors.join(", ")}`,
    };
  }

  return {
    title: `${resolved.title} — Rollorian`,
    description: `Book detail for ${resolved.title} by ${resolved.authors.join(", ")}`,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BookDetailPage({ params }: BookDetailPageProps) {
  const { id } = await params;
  const resolved = await resolveBook(id);

  if (!resolved) {
    notFound();
  }

  if (resolved.source === "local") {
    return <LocalBookDetail book={resolved.book} />;
  }

  return <GoogleBookDetail view={resolved} />;
}

// ---------------------------------------------------------------------------
// Local (library) book detail
// ---------------------------------------------------------------------------

function LocalBookDetail({ book }: { book: LocalBook }) {
  const serialized = serializeBook(book);
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : "Unknown author";

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/library"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm"
        >
          <span aria-hidden="true">←</span>
          Back to library
        </Link>
      </div>

      <section
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 md:p-8"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <div className="flex flex-col md:flex-row gap-8">
          <div className="shrink-0 flex justify-center md:justify-start">
            <BookCover
              coverUrl={book.coverUrl}
              title={book.title}
              tone="warm"
              priority
              className="w-[160px] h-[240px] md:w-[200px] md:h-[300px]"
              sizes="(max-width: 768px) 160px, 200px"
            />
          </div>

          <div className="flex flex-col gap-4 min-w-0 flex-1">
            <div className="grid gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">
                Book detail
              </p>
              <h1
                className="text-3xl md:text-4xl font-bold text-text leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {book.title}
              </h1>
              {book.subtitle && (
                <p
                  className="text-lg text-muted leading-snug"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {book.subtitle}
                </p>
              )}
              <p className="text-base text-muted">{authorLine}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge status={book.status as BookStatus} />
              {book.rating !== null && (
                <span
                  className="text-sm text-gold"
                  aria-label={`Rating: ${book.rating} out of 5`}
                >
                  {"★".repeat(book.rating)}
                  {"☆".repeat(5 - book.rating)}
                </span>
              )}
            </div>

            <BookFactsGrid
              publisher={book.publisher}
              publishedDate={book.publishedDate}
              pageCount={book.pageCount}
              isbn10={book.isbn10}
              isbn13={book.isbn13}
              genres={book.genres}
            />

            {book.notes && (
              <div className="grid gap-1.5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Notes</p>
                <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{book.notes}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <BookDetailClient book={serialized} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google Books (external) detail — not yet saved to library
// ---------------------------------------------------------------------------

function GoogleBookDetail({ view }: { view: GoogleBookView }) {
  const authorLine = view.authors.length > 0 ? view.authors.join(", ") : "Unknown author";

  const savePayload = {
    title: view.title,
    authors: view.authors,
    ...(view.subtitle ? { subtitle: view.subtitle } : {}),
    ...(view.description ? { description: view.description } : {}),
    ...(view.coverUrl ? { coverUrl: view.coverUrl } : {}),
    ...(view.publisher ? { publisher: view.publisher } : {}),
    ...(view.publishedDate ? { publishedDate: view.publishedDate } : {}),
    ...(view.pageCount ? { pageCount: view.pageCount } : {}),
    ...(view.isbn10 ? { isbn10: view.isbn10 } : {}),
    ...(view.isbn13 ? { isbn13: view.isbn13 } : {}),
    genres: view.genres,
  };

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm"
        >
          <span aria-hidden="true">←</span>
          Back to search
        </Link>
      </div>

      <section
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 md:p-8"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <div className="flex flex-col md:flex-row gap-8">
          <div className="shrink-0 flex justify-center md:justify-start">
            <BookCover
              coverUrl={view.coverUrl}
              title={view.title}
              tone="cool"
              priority
              className="w-[160px] h-[240px] md:w-[200px] md:h-[300px]"
              sizes="(max-width: 768px) 160px, 200px"
            />
          </div>

          <div className="flex flex-col gap-4 min-w-0 flex-1">
            <div className="grid gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">
                Google Books preview
              </p>
              <h1
                className="text-3xl md:text-4xl font-bold text-text leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {view.title}
              </h1>
              {view.subtitle && (
                <p
                  className="text-lg text-muted leading-snug"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {view.subtitle}
                </p>
              )}
              <p className="text-base text-muted">{authorLine}</p>
            </div>

            {view.description && (
              <div className="grid gap-1.5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Description</p>
                <p className="text-sm text-text leading-relaxed line-clamp-6">{view.description}</p>
              </div>
            )}

            <BookFactsGrid
              publisher={view.publisher}
              publishedDate={view.publishedDate}
              pageCount={view.pageCount}
              isbn10={view.isbn10}
              isbn13={view.isbn13}
              genres={view.genres}
            />
          </div>
        </div>
      </section>

      <GoogleBookSaveClient payload={savePayload} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared facts grid
// ---------------------------------------------------------------------------

interface BookFactsGridProps {
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  isbn10: string | null;
  isbn13: string | null;
  genres: string[];
}

function BookFactsGrid({
  publisher,
  publishedDate,
  pageCount,
  isbn10,
  isbn13,
  genres,
}: BookFactsGridProps) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
      {publisher && (
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Publisher</dt>
          <dd className="text-sm text-text mt-0.5">{publisher}</dd>
        </div>
      )}
      {publishedDate && (
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Published</dt>
          <dd className="text-sm text-text mt-0.5">{publishedDate}</dd>
        </div>
      )}
      {pageCount && (
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Pages</dt>
          <dd className="text-sm text-text mt-0.5">{pageCount.toLocaleString()}</dd>
        </div>
      )}
      {(isbn13 ?? isbn10) && (
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">ISBN</dt>
          <dd className="text-sm text-text mt-0.5 font-mono text-xs">{isbn13 ?? isbn10}</dd>
        </div>
      )}
      {genres.length > 0 && (
        <div className="col-span-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Genres</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {genres.map((genre: string) => (
              <span
                key={genre}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border border-line bg-white/6 text-muted"
              >
                {genre}
              </span>
            ))}
          </dd>
        </div>
      )}
    </dl>
  );
}
