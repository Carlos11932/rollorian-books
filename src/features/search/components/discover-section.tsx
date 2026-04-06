"use client";

import { useTranslations } from "next-intl";
import type { NormalizedBook } from "@/lib/google-books/types";
import type { LibraryEntryView } from "@/features/books/types";
import type { BookStatus } from "@/lib/types/book";
import {
  type DiscoverGenre,
  type Recommendation,
  toDisplayBook,
  recommendationToDisplayBook,
} from "../lib/search-mappers";
import { BookCard } from "@/features/books/components/book-card";
import { BookRailSection } from "@/features/shared/ui/book-rail-section";
import { Skeleton } from "@/features/shared/components/skeleton";

const DISCOVER_GENRE_LABEL_KEYS: Record<string, string> = {
  Fiction: "discover.Fiction",
  "Science Fiction": "discover.Science Fiction",
  Fantasy: "discover.Fantasy",
  History: "discover.History",
  Romance: "discover.Romance",
  Mystery: "discover.Mystery",
  Philosophy: "discover.Philosophy",
};

interface DiscoverSectionProps {
  discoverGenres: DiscoverGenre[];
  isDiscoverLoading: boolean;
  recommendations: Recommendation[];
  isRecommendationsLoading: boolean;
  getSavedStatus: (book: NormalizedBook) => BookStatus | null;
  onDiscoverSave: (book: LibraryEntryView) => Promise<void>;
}

function GenreSkeletons() {
  return (
    <div className="space-y-12" aria-busy="true">
      {Array.from({ length: 3 }).map((_, sectionIdx) => (
        <div key={sectionIdx} className="space-y-4">
          <Skeleton variant="text" className="h-6 w-40" />
          <div className="flex gap-6 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 space-y-2" style={{ width: "160px" }}>
                <Skeleton variant="card" className="h-[220px] w-[160px]" />
                <Skeleton variant="text" className="h-3 w-3/4" />
                <Skeleton variant="text" className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationSkeletons() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton variant="text" className="h-6 w-56" />
      <div className="flex gap-6 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shrink-0 space-y-2" style={{ width: "160px" }}>
            <Skeleton variant="card" className="h-[220px] w-[160px]" />
            <Skeleton variant="text" className="h-3 w-3/4" />
            <Skeleton variant="text" className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiscoverSection({
  discoverGenres,
  isDiscoverLoading,
  recommendations,
  isRecommendationsLoading,
  getSavedStatus,
  onDiscoverSave,
}: DiscoverSectionProps) {
  const t = useTranslations();

  return (
    <>
      {/* Genre discovery carousels */}
      {(isDiscoverLoading || discoverGenres.length > 0) && (
        <section aria-label={t("discover.heading")} className="mt-16 space-y-12">
          <h2 className="text-xl md:text-2xl font-bold font-headline tracking-tight">
            {t("discover.heading")}
          </h2>

          {isDiscoverLoading && <GenreSkeletons />}

          {!isDiscoverLoading &&
            discoverGenres.map((genre) => {
              const labelKey = DISCOVER_GENRE_LABEL_KEYS[genre.name];
              const genreLabel = labelKey != null
                ? t(labelKey as Parameters<typeof t>[0])
                : genre.name;

              return (
                <BookRailSection key={genre.name} title={genreLabel}>
                  {genre.books.map((book, index) => (
                    <BookCard
                      key={book.externalId}
                      variant="search"
                      book={toDisplayBook(book)}
                      index={index}
                      savedStatus={getSavedStatus(book)}
                      onSave={onDiscoverSave}
                    />
                  ))}
                </BookRailSection>
              );
            })}
        </section>
      )}

      {/* Social recommendations */}
      {(isRecommendationsLoading || recommendations.length > 0) && (
        <section aria-label={t("recommendations.heading")} className="mt-16 space-y-6">
          {isRecommendationsLoading && <RecommendationSkeletons />}

          {!isRecommendationsLoading && recommendations.length > 0 && (
            <BookRailSection title={t("recommendations.heading")}>
              {recommendations.map((rec, index) => (
                <div
                  key={rec.book.id}
                  className="shrink-0"
                  style={{ width: "160px", minWidth: "160px", scrollSnapAlign: "start" }}
                >
                  <BookCard
                    variant="browse"
                    book={recommendationToDisplayBook(rec)}
                    index={index}
                  />
                  <p className="text-xs text-tertiary mt-1 px-1">
                    {t("recommendations.readerCount", { count: rec.readerCount })}
                  </p>
                </div>
              ))}
            </BookRailSection>
          )}
        </section>
      )}
    </>
  );
}
