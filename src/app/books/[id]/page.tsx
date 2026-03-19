import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serializeBook } from "@/features/books/types";
import { Badge } from "@/features/shared/components/badge";
import { BookCover } from "@/features/books/components/book-cover";
import { BookDetailClient } from "@/features/books/components/book-detail-client";
import type { BookStatus } from "@/features/shared/components/badge";
import Link from "next/link";

interface BookDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: BookDetailPageProps) {
  const { id } = await params;
  const book = await prisma.book.findUnique({ where: { id }, select: { title: true, authors: true } });
  if (!book) return { title: "Book not found" };
  return {
    title: `${book.title} — Rollorian`,
    description: `Book detail for ${book.title} by ${book.authors.join(", ")}`,
  };
}

export default async function BookDetailPage({ params }: BookDetailPageProps) {
  const { id } = await params;
  const book = await prisma.book.findUnique({ where: { id } });

  if (!book) {
    notFound();
  }

  const serialized = serializeBook(book);
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : "Unknown author";

  return (
    <div className="grid gap-6">
      {/* Back link */}
      <div>
        <Link
          href="/library"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm"
        >
          <span aria-hidden="true">←</span>
          Back to library
        </Link>
      </div>

      {/* Hero section — cinematic layout */}
      <section
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 md:p-8"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <div className="flex flex-col md:flex-row gap-8">
          {/* Cover — large on desktop */}
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

          {/* Metadata */}
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

            {/* Status + rating */}
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

            {/* Book facts grid */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {book.publisher && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">Publisher</dt>
                  <dd className="text-sm text-text mt-0.5">{book.publisher}</dd>
                </div>
              )}
              {book.publishedDate && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">Published</dt>
                  <dd className="text-sm text-text mt-0.5">{book.publishedDate}</dd>
                </div>
              )}
              {book.pageCount && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">Pages</dt>
                  <dd className="text-sm text-text mt-0.5">{book.pageCount.toLocaleString()}</dd>
                </div>
              )}
              {(book.isbn13 ?? book.isbn10) && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">ISBN</dt>
                  <dd className="text-sm text-text mt-0.5 font-mono text-xs">{book.isbn13 ?? book.isbn10}</dd>
                </div>
              )}
              {book.genres.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">Genres</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {book.genres.map((genre) => (
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

            {/* Notes preview (read-only) */}
            {book.notes && (
              <div className="grid gap-1.5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Notes</p>
                <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{book.notes}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Edit form */}
      <BookDetailClient book={serialized} />
    </div>
  );
}
