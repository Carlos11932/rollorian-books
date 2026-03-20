import { notFound } from "next/navigation";
import type { Book } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { fetchBookById } from "@/lib/google-books/client";
import { serializeBook } from "@/features/books/types";
import { Badge } from "@/features/shared/components/badge";
import { BookCover } from "@/features/books/components/book-cover";
import { BookDetailClient } from "@/features/books/components/book-detail-client";
import { GoogleBookSaveClient } from "@/features/books/components/google-book-save-client";
import type { BookStatus } from "@/features/shared/components/badge";
import type { GoogleBooksVolume } from "@/lib/google-books/types";
import { stripHtml } from "@/lib/utils/text";
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

async function resolveBook(id: string): Promise<ResolvedBook | null> {
  try {
    const local: Book | null = await prisma.book.findUnique({ where: { id } });
    if (local) {
      return { source: "local", book: local };
    }
  } catch {
    // Invalid ID format for Prisma — fall through to Google Books
  }

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
    description: stripHtml(info.description),
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
// Status badge colour map (spec-driven)
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: BookStatus }) {
  const colorMap: Record<BookStatus, string> = {
    READING: "bg-primary/20 text-primary border-primary/30",
    READ: "bg-secondary/20 text-secondary border-secondary/30",
    TO_READ: "bg-white/10 text-on-surface/60 border-white/10",
    WISHLIST: "bg-purple-500/20 text-purple-300 border-purple-500/20",
  };

  const labelMap: Record<BookStatus, string> = {
    READING: "Reading",
    READ: "Read",
    TO_READ: "To Read",
    WISHLIST: "Wishlist",
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${colorMap[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Star rating display (read-only, for the hero section)
// ---------------------------------------------------------------------------

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) {
    return (
      <span className="text-xs text-on-surface/40 uppercase tracking-wide">
        Not rated
      </span>
    );
  }

  return (
    <span aria-label={`Rating: ${rating} out of 5`} className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= rating ? "text-secondary text-lg" : "text-on-surface/20 text-lg"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Blurred cover background
// ---------------------------------------------------------------------------

function BlurredCoverBackground({ coverUrl }: { coverUrl: string | null }) {
  if (!coverUrl) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverUrl}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scale(1.2)",
          filter: "blur(80px) brightness(0.25) saturate(1.5)",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local (library) book detail
// ---------------------------------------------------------------------------

function LocalBookDetail({ book }: { book: LocalBook }) {
  const serialized = serializeBook(book);
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : "Unknown author";
  const yearLine = book.publishedDate ? book.publishedDate.slice(0, 4) : null;

  return (
    <>
      {/* Blurred background */}
      <BlurredCoverBackground coverUrl={book.coverUrl} />

      {/* Fixed surface overlay */}
      <div
        aria-hidden="true"
        className="bg-surface/50"
        style={{ position: "fixed", inset: 0, zIndex: 1 }}
      />

      {/* Main content */}
      <div style={{ position: "relative", zIndex: 2 }} className="grid gap-6 pb-12">
        {/* Back link */}
        <div>
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 text-sm text-on-surface/50 hover:text-on-surface transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
          >
            <span aria-hidden="true">←</span>
            Back to library
          </Link>
        </div>

        {/* Hero card */}
        <section
          className="rounded-[var(--radius-xl)] border border-outline-variant/30 p-6 md:p-8"
          style={{ backdropFilter: "blur(20px)", background: "rgba(0,23,17,0.6)" }}
          aria-label="Book detail"
        >
          <div className="flex flex-col md:flex-row gap-8">
            {/* Cover */}
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

            {/* Info */}
            <div className="flex flex-col gap-5 min-w-0 flex-1">
              {/* Title + author + year */}
              <div className="grid gap-2">
                <h1
                  className="text-3xl md:text-4xl font-bold text-on-surface leading-tight"
                  style={{ fontFamily: "var(--font-headline)" }}
                >
                  {book.title}
                </h1>
                {book.subtitle && (
                  <p
                    className="text-lg text-on-surface/60 leading-snug"
                    style={{ fontFamily: "var(--font-headline)" }}
                  >
                    {book.subtitle}
                  </p>
                )}
                <p className="text-base text-on-surface/60">
                  {authorLine}
                  {yearLine && (
                    <span className="text-on-surface/40"> · {yearLine}</span>
                  )}
                </p>
              </div>

              {/* Status + rating row */}
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={book.status as BookStatus} />
                <StarRating rating={book.rating} />
              </div>

              {/* Description */}
              {book.description && (
                <p className="text-sm text-on-surface/70 leading-relaxed line-clamp-5">
                  {stripHtml(book.description)}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Metadata card */}
        <MetadataCard
          publisher={book.publisher}
          publishedDate={book.publishedDate}
          pageCount={book.pageCount}
          isbn10={book.isbn10}
          isbn13={book.isbn13}
          genres={book.genres}
        />

        {/* Notes card */}
        {book.notes && (
          <NotesCard notes={book.notes} />
        )}

        {/* Manage section */}
        <BookDetailClient book={serialized} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Google Books (external) detail — not yet saved to library
// ---------------------------------------------------------------------------

function GoogleBookDetail({ view }: { view: GoogleBookView }) {
  const authorLine = view.authors.length > 0 ? view.authors.join(", ") : "Unknown author";
  const yearLine = view.publishedDate ? view.publishedDate.slice(0, 4) : null;

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
    <>
      {/* Blurred background */}
      <BlurredCoverBackground coverUrl={view.coverUrl} />

      {/* Fixed surface overlay */}
      <div
        aria-hidden="true"
        className="bg-surface/50"
        style={{ position: "fixed", inset: 0, zIndex: 1 }}
      />

      {/* Main content */}
      <div style={{ position: "relative", zIndex: 2 }} className="grid gap-6 pb-12">
        {/* Back link */}
        <div>
          <Link
            href="/search"
            className="inline-flex items-center gap-1.5 text-sm text-on-surface/50 hover:text-on-surface transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
          >
            <span aria-hidden="true">←</span>
            Back to search
          </Link>
        </div>

        {/* Hero card */}
        <section
          className="rounded-[var(--radius-xl)] border border-outline-variant/30 p-6 md:p-8"
          style={{ backdropFilter: "blur(20px)", background: "rgba(0,23,17,0.6)" }}
          aria-label="Book detail"
        >
          <div className="flex flex-col md:flex-row gap-8">
            {/* Cover */}
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

            {/* Info */}
            <div className="flex flex-col gap-5 min-w-0 flex-1">
              {/* Google Books label */}
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Google Books preview
              </p>

              {/* Title + author + year */}
              <div className="grid gap-2">
                <h1
                  className="text-3xl md:text-4xl font-bold text-on-surface leading-tight"
                  style={{ fontFamily: "var(--font-headline)" }}
                >
                  {view.title}
                </h1>
                {view.subtitle && (
                  <p
                    className="text-lg text-on-surface/60 leading-snug"
                    style={{ fontFamily: "var(--font-headline)" }}
                  >
                    {view.subtitle}
                  </p>
                )}
                <p className="text-base text-on-surface/60">
                  {authorLine}
                  {yearLine && (
                    <span className="text-on-surface/40"> · {yearLine}</span>
                  )}
                </p>
              </div>

              {/* Description */}
              {view.description && (
                <p className="text-sm text-on-surface/70 leading-relaxed line-clamp-5">
                  {view.description}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Metadata card */}
        <MetadataCard
          publisher={view.publisher}
          publishedDate={view.publishedDate}
          pageCount={view.pageCount}
          isbn10={view.isbn10}
          isbn13={view.isbn13}
          genres={view.genres}
        />

        {/* Save to library */}
        <GoogleBookSaveClient payload={savePayload} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Metadata card (glassmorphism)
// ---------------------------------------------------------------------------

interface MetadataCardProps {
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  isbn10: string | null;
  isbn13: string | null;
  genres: string[];
}

function MetadataCard({
  publisher,
  publishedDate,
  pageCount,
  isbn10,
  isbn13,
  genres,
}: MetadataCardProps) {
  const hasContent =
    publisher ?? publishedDate ?? pageCount ?? isbn13 ?? isbn10 ?? genres.length > 0;

  if (!hasContent) return null;

  return (
    <section
      className="rounded-[var(--radius-xl)] border border-outline-variant/30 p-6"
      style={{ backdropFilter: "blur(20px)", background: "rgba(255,255,255,0.04)" }}
      aria-label="Book metadata"
    >
      <h2
        className="text-xs font-bold uppercase tracking-widest text-on-surface/40 mb-4"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        Details
      </h2>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        {publisher && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-on-surface/40">Publisher</dt>
            <dd className="text-sm text-on-surface mt-0.5">{publisher}</dd>
          </div>
        )}
        {publishedDate && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-on-surface/40">Published</dt>
            <dd className="text-sm text-on-surface mt-0.5">{publishedDate}</dd>
          </div>
        )}
        {pageCount && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-on-surface/40">Pages</dt>
            <dd className="text-sm text-on-surface mt-0.5">{pageCount.toLocaleString()}</dd>
          </div>
        )}
        {(isbn13 ?? isbn10) && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-on-surface/40">ISBN</dt>
            <dd className="text-sm text-on-surface mt-0.5 font-mono text-xs">{isbn13 ?? isbn10}</dd>
          </div>
        )}
        {genres.length > 0 && (
          <div className="col-span-2">
            <dt className="text-xs font-bold uppercase tracking-wide text-on-surface/40">Genres</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {genres.map((genre: string) => (
                <span
                  key={genre}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border border-outline-variant/30 bg-white/5 text-on-surface/60"
                >
                  {genre}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Notes card (glassmorphism)
// ---------------------------------------------------------------------------

function NotesCard({ notes }: { notes: string }) {
  return (
    <section
      className="rounded-[var(--radius-xl)] border border-outline-variant/30 p-6"
      style={{ backdropFilter: "blur(20px)", background: "rgba(255,255,255,0.04)" }}
      aria-label="Personal notes"
    >
      <h2
        className="text-xs font-bold uppercase tracking-widest text-on-surface/40 mb-3"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        Notes
      </h2>
      <p className="text-sm text-on-surface/80 leading-relaxed whitespace-pre-wrap">{notes}</p>
    </section>
  );
}
