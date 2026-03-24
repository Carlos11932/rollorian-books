import Link from "next/link";
import type { Book } from "@/lib/types/book";
import { stripHtml } from "@/lib/utils/text";
import { serializeBook } from "@/features/books/types";
import { BookCover } from "@/features/books/components/book-cover";
import { BookDetailClient } from "@/features/books/components/book-detail-client";
import { Badge } from "@/features/shared/components/badge";
import { StarRating } from "@/features/books/components/star-rating";
import { MetadataCard } from "@/features/books/components/metadata-card";
import { NotesCard } from "@/features/books/components/notes-card";
import { BlurredBackground } from "@/features/shared/components/blurred-background";

interface LocalBookDetailProps {
  book: Book;
}

export function LocalBookDetail({ book }: LocalBookDetailProps) {
  const serialized = serializeBook(book);
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : "Unknown author";
  const yearLine = book.publishedDate ? book.publishedDate.slice(0, 4) : null;

  return (
    <>
      <BlurredBackground coverUrl={book.coverUrl} />
      <div aria-hidden="true" className="bg-surface/50" style={{ position: "fixed", inset: 0, zIndex: 1 }} />

      <div style={{ position: "relative", zIndex: 2 }} className="grid gap-6 pt-8 pb-12">
        <div>
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 text-sm text-on-surface/50 hover:text-on-surface transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
          >
            <span aria-hidden="true">←</span>
            Back to library
          </Link>
        </div>

        <section
          className="rounded-[var(--radius-xl)] border border-outline-variant/30 p-6 md:p-8"
          style={{ backdropFilter: "blur(20px)", background: "rgba(0,23,17,0.6)" }}
          aria-label="Book detail"
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

            <div className="flex flex-col gap-5 min-w-0 flex-1">
              <div className="grid gap-2">
                <h1
                  className="text-3xl md:text-4xl font-bold text-on-surface leading-tight"
                  style={{ fontFamily: "var(--font-headline)" }}
                >
                  {book.title}
                </h1>
                {book.subtitle && (
                  <p className="text-lg text-on-surface/60 leading-snug" style={{ fontFamily: "var(--font-headline)" }}>
                    {book.subtitle}
                  </p>
                )}
                <p className="text-base text-on-surface/60">
                  {authorLine}
                  {yearLine && <span className="text-on-surface/40"> · {yearLine}</span>}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge status={book.status} />
                <StarRating rating={book.rating} />
              </div>

              {book.description && (
                <p className="text-sm text-on-surface/70 leading-relaxed line-clamp-5">
                  {stripHtml(book.description)}
                </p>
              )}
            </div>
          </div>
        </section>

        <MetadataCard
          publisher={book.publisher}
          publishedDate={book.publishedDate}
          pageCount={book.pageCount}
          isbn10={book.isbn10}
          isbn13={book.isbn13}
          genres={book.genres}
        />

        {book.notes && <NotesCard notes={book.notes} />}

        <BookDetailClient book={serialized} />
      </div>
    </>
  );
}
