import Link from "next/link";
import type { GoogleBookView } from "@/features/books/types";
import { BookCover } from "@/features/books/components/book-cover";
import { GoogleBookSaveClient } from "@/features/books/components/google-book-save-client";
import { MetadataCard } from "@/features/books/components/metadata-card";
import { BlurredBackground } from "@/features/shared/components/blurred-background";

interface GoogleBookDetailProps {
  view: GoogleBookView;
}

export function GoogleBookDetail({ view }: GoogleBookDetailProps) {
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
      <BlurredBackground coverUrl={view.coverUrl} />
      <div aria-hidden="true" className="bg-surface/50" style={{ position: "fixed", inset: 0, zIndex: 1 }} />

      <div style={{ position: "relative", zIndex: 2 }} className="grid gap-6 pb-12">
        <div>
          <Link
            href="/search"
            className="inline-flex items-center gap-1.5 text-sm text-on-surface/50 hover:text-on-surface transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
          >
            <span aria-hidden="true">←</span>
            Back to search
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
                coverUrl={view.coverUrl}
                title={view.title}
                tone="cool"
                priority
                className="w-[160px] h-[240px] md:w-[200px] md:h-[300px]"
                sizes="(max-width: 768px) 160px, 200px"
              />
            </div>

            <div className="flex flex-col gap-5 min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Google Books preview</p>

              <div className="grid gap-2">
                <h1
                  className="text-3xl md:text-4xl font-bold text-on-surface leading-tight"
                  style={{ fontFamily: "var(--font-headline)" }}
                >
                  {view.title}
                </h1>
                {view.subtitle && (
                  <p className="text-lg text-on-surface/60 leading-snug" style={{ fontFamily: "var(--font-headline)" }}>
                    {view.subtitle}
                  </p>
                )}
                <p className="text-base text-on-surface/60">
                  {authorLine}
                  {yearLine && <span className="text-on-surface/40"> · {yearLine}</span>}
                </p>
              </div>

              {view.description && (
                <p className="text-sm text-on-surface/70 leading-relaxed line-clamp-5">{view.description}</p>
              )}
            </div>
          </div>
        </section>

        <MetadataCard
          publisher={view.publisher}
          publishedDate={view.publishedDate}
          pageCount={view.pageCount}
          isbn10={view.isbn10}
          isbn13={view.isbn13}
          genres={view.genres}
        />

        <GoogleBookSaveClient payload={savePayload} />
      </div>
    </>
  );
}
