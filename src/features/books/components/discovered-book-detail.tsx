import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Book } from "@/lib/types/book";
import { stripHtml } from "@/lib/utils/text";
import { BookCover } from "@/features/books/components/book-cover";
import { MetadataCard } from "@/features/books/components/metadata-card";
import { BlurredBackground } from "@/features/shared/components/blurred-background";
import { GoogleBookSaveClient } from "@/features/books/components/google-book-save-client";
import type { BookOwner } from "@/app/books/[id]/page";

interface DiscoveredBookDetailProps {
  book: Book;
  owners: BookOwner[];
}

export async function DiscoveredBookDetail({ book, owners }: DiscoveredBookDetailProps) {
  const t = await getTranslations();
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : t("common.unknownAuthor");
  const yearLine = book.publishedDate ? book.publishedDate.slice(0, 4) : null;

  const savePayload = {
    title: book.title,
    authors: book.authors,
    ...(book.subtitle ? { subtitle: book.subtitle } : {}),
    ...(book.description ? { description: book.description } : {}),
    ...(book.coverUrl ? { coverUrl: book.coverUrl } : {}),
    ...(book.publisher ? { publisher: book.publisher } : {}),
    ...(book.publishedDate ? { publishedDate: book.publishedDate } : {}),
    ...(book.pageCount ? { pageCount: book.pageCount } : {}),
    ...(book.isbn10 ? { isbn10: book.isbn10 } : {}),
    ...(book.isbn13 ? { isbn13: book.isbn13 } : {}),
    genres: book.genres,
  };

  return (
    <>
      <BlurredBackground coverUrl={book.coverUrl} />
      <div aria-hidden="true" className="bg-surface/50" style={{ position: "fixed", inset: 0, zIndex: 1 }} />

      <div style={{ position: "relative", zIndex: 2 }} className="grid gap-6 pt-8 pb-12">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-on-surface/50 hover:text-on-surface transition-colors duration-150"
          >
            <span aria-hidden="true">←</span>
            {t("book.backToHome")}
          </Link>
        </div>

        {/* Book header */}
        <section
          className="rounded-[var(--radius-xl)] border border-outline-variant/30 p-6 md:p-8"
          style={{ backdropFilter: "blur(20px)", background: "rgba(0,23,17,0.6)" }}
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

              {book.description && (
                <p className="text-sm text-on-surface/70 leading-relaxed line-clamp-5">
                  {stripHtml(book.description)}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Who has this book */}
        {owners.length > 0 && (
          <section
            className="rounded-[var(--radius-xl)] border border-outline-variant/30 p-6"
            style={{ backdropFilter: "blur(20px)", background: "rgba(0,23,17,0.6)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary text-[20px]">group</span>
              <h2 className="text-base font-bold text-on-surface">
                {t("book.ownedByConnections")}
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {owners.map((owner) => (
                <Link
                  key={owner.userId}
                  href={`/users/${owner.userId}`}
                  className="flex items-center gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 px-4 py-3 hover:border-primary/30 transition-colors"
                >
                  {owner.userImage ? (
                    <Image
                      src={owner.userImage}
                      alt={owner.userName ?? ""}
                      width={32}
                      height={32}
                      className="rounded-full object-cover w-8 h-8 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-sm">person</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {owner.userName ?? "Anonymous"}
                    </p>
                    <p className="text-[10px] text-tertiary">
                      {t(`book.status.${owner.status}`)}
                      {owner.rating != null && (
                        <span className="ml-1">· ⭐ {owner.rating}</span>
                      )}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <MetadataCard
          publisher={book.publisher}
          publishedDate={book.publishedDate}
          pageCount={book.pageCount}
          isbn10={book.isbn10}
          isbn13={book.isbn13}
          genres={book.genres}
        />

        {/* Save to library */}
        <GoogleBookSaveClient payload={savePayload} />
      </div>
    </>
  );
}
