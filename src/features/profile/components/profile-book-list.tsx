import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { UserBookWithBook } from "@/lib/types/book";
import { BookCover } from "@/features/books/components/book-cover";
import { Badge } from "@/features/shared/components/badge";
import { OwnershipBadge } from "@/features/shared/components/ownership-badge";
import {
  hasCompatDegradedField,
  LIBRARY_COMPAT_DEGRADED_FIELD,
  LIBRARY_READ_STATE,
  type LibraryCompatDegradedField,
  type LibraryReadState,
} from "@/features/books/types";

type CompatProfileBook = UserBookWithBook & {
  compatDegraded?: true;
  compatDegradedFields?: LibraryCompatDegradedField[];
};

interface ProfileBookListProps {
  books: CompatProfileBook[];
  canView: boolean;
  isOwnProfile: boolean;
  isAuthenticated: boolean;
  targetUserName: string | null;
  readState?: LibraryReadState;
  /** Whether to show ownership badges (default true) */
  showOwnership?: boolean;
}

export async function ProfileBookList({
  books,
  canView,
  isOwnProfile,
  isAuthenticated,
  targetUserName,
  readState = LIBRARY_READ_STATE.FULL,
  showOwnership = true,
}: ProfileBookListProps) {
  const t = await getTranslations("profile");
  const tBook = await getTranslations("book");
  const name = targetUserName ?? t("thisUser");

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <span className="material-symbols-outlined text-tertiary text-[48px]">
          lock
        </span>
        <p className="text-sm text-tertiary">
          {isAuthenticated
            ? t("noBooksFollow", { name })
            : t("noBooksSignIn")}
        </p>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <span className="material-symbols-outlined text-tertiary text-[48px]">
          auto_stories
        </span>
        <p className="text-sm text-tertiary">
          {isOwnProfile ? t("ownBooksEmpty") : t("noBooksTitle")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {readState === LIBRARY_READ_STATE.DEGRADED && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-on-surface/80">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
            Compatibility snapshot
          </p>
          <p className="mt-2 leading-relaxed">
            Part of this profile library was synthesized from a compatibility reader. Rollorian shows
            it as read-only and hides unsupported ownership details until authoritative local data is available.
          </p>
        </div>
      )}

      {books.map((entry) => {
        const { book, status, rating, ownershipStatus } = entry;
        const ownershipSynthesized = hasCompatDegradedField(
          entry,
          LIBRARY_COMPAT_DEGRADED_FIELD.OWNERSHIP_STATUS,
        );

        return (
          <article
            key={book.id}
            className="flex gap-4 rounded-xl border border-outline-variant/20 p-4 bg-surface-container-low hover:bg-surface-container transition-colors"
          >
            <Link
              href={`/books/${book.id}`}
              className="shrink-0"
              aria-label={`${tBook("openDetail")} ${book.title}`}
            >
              <BookCover
                coverUrl={book.coverUrl}
                title={book.title}
                tone="cool"
                className="w-[56px] h-[84px]"
                sizes="56px"
              />
            </Link>

            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <Link
                href={`/books/${book.id}`}
                className="block truncate text-sm font-bold text-on-surface hover:text-primary transition-colors"
              >
                {book.title}
              </Link>
              {book.authors.length > 0 && (
                <p className="truncate text-xs text-tertiary">
                  {book.authors.join(", ")}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge status={status} />
                {showOwnership && !ownershipSynthesized && ownershipStatus !== "UNKNOWN" && (
                  <OwnershipBadge status={ownershipStatus} />
                )}
                {entry.compatDegraded && (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-300">
                    Read-only snapshot
                  </span>
                )}
                {rating !== null && (
                  <span
                    className="text-xs text-amber-400 tabular-nums"
                    aria-label={tBook("ratingAriaLabel", { rating })}
                  >
                    {"★".repeat(rating)}{"☆".repeat(5 - rating)}
                  </span>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
