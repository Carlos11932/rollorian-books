import Link from "next/link";
import Image from "next/image";
import { getTranslations } from 'next-intl/server';
import type { UserBookWithBook } from "@/lib/types/book";
import type { FriendBookActivity } from "@/lib/books";
import { stripHtml } from "@/lib/utils/text";
import { toLibraryEntryView } from "@/features/books/types";
import { BookCover } from "@/features/books/components/book-cover";
import { BookDetailClient } from "@/features/books/components/book-detail-client";
import { Badge } from "@/features/shared/components/badge";
import { StarRating } from "@/features/books/components/star-rating";
import { MetadataCard } from "@/features/books/components/metadata-card";
import { NotesCard } from "@/features/books/components/notes-card";
import { BlurredBackground } from "@/features/shared/components/blurred-background";

interface LocalBookDetailProps {
  userBook: UserBookWithBook;
  friendActivities?: FriendBookActivity[];
}

export async function LocalBookDetail({ userBook, friendActivities = [] }: LocalBookDetailProps) {
  const t = await getTranslations();
  const book = userBook.book;
  const serialized = toLibraryEntryView(userBook);
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : t('common.unknownAuthor');
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
            {t('book.backToLibrary')}
          </Link>
        </div>

        <section
          className="rounded-[var(--radius-xl)] border border-outline-variant/30 p-6 md:p-8 backdrop-blur-[20px]"
          style={{ background: "rgba(0,23,17,0.6)" }}
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
                >
                  {book.title}
                </h1>
                {book.subtitle && (
                  <p className="text-lg text-on-surface/60 leading-snug">
                    {book.subtitle}
                  </p>
                )}
                <p className="text-base text-on-surface/60">
                  {authorLine}
                  {yearLine && <span className="text-on-surface/40"> · {yearLine}</span>}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge status={userBook.status} />
                <StarRating rating={userBook.rating} />
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

        {userBook.notes && <NotesCard notes={userBook.notes} />}

        {/* Friend activity */}
        {friendActivities.length > 0 && (
          <section
            className="rounded-[var(--radius-xl)] border border-outline-variant/30 p-6 backdrop-blur-[20px]"
            style={{ background: "rgba(0,23,17,0.6)" }}
            aria-label={t("book.friendActivityTitle")}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-indigo-400 text-[20px]" aria-hidden="true">group</span>
              <h2 className="text-base font-bold text-on-surface">{t("book.friendActivityTitle")}</h2>
            </div>

            <div className="grid gap-3">
              {friendActivities.map((activity) => (
                <Link
                  key={activity.userId}
                  href={`/users/${activity.userId}`}
                  className="flex gap-4 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 px-4 py-3 hover:bg-surface-container-low/60 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {/* Avatar */}
                  {activity.userImage ? (
                    <Image
                      src={activity.userImage}
                      alt={activity.userName ?? ""}
                      width={36}
                      height={36}
                      className="rounded-full object-cover w-9 h-9 shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-primary text-sm">person</span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    {/* Name + rating */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-on-surface truncate">
                        {activity.userName ?? t("common.anonymous")}
                      </span>
                      {activity.rating !== null && (
                        <span
                          className="text-xs text-gold tabular-nums shrink-0"
                          aria-label={t("book.ratingAriaLabel", { rating: activity.rating })}
                        >
                          {"★".repeat(activity.rating)}{"☆".repeat(5 - activity.rating)}
                        </span>
                      )}
                      <span className="text-[11px] text-on-surface/40 shrink-0 ml-auto">
                        {t(`book.status.${activity.status}`)}
                      </span>
                    </div>

                    {/* Notes */}
                    {activity.notes && (
                      <p className="text-sm text-on-surface/65 leading-relaxed line-clamp-3 italic">
                        &ldquo;{activity.notes}&rdquo;
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <BookDetailClient book={serialized} />
      </div>
    </>
  );
}
