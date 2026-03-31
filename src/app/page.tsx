import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from 'next-intl/server';
import type { BookStatus } from "@/lib/types/book";
import { auth } from "@/lib/auth";
import { getLibrary } from "@/lib/books";
import { EmptyState } from "@/features/shared/components/empty-state";
import { Button } from "@/features/shared/components/button";
import { toLibraryEntryView, type LibraryEntryView } from "@/features/books/types";
import { BookRailSection } from "@/features/shared/ui/book-rail-section";
import { BookCard } from "@/features/books/components/book-card";
import { topGenreRails } from "@/lib/utils/books";

const STATUS_ORDER: BookStatus[] = ["READING", "READ", "TO_READ", "WISHLIST"];

export default async function Home() {
  const t = await getTranslations();

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const userBooks = await getLibrary(userId);

  if (userBooks.length === 0) {
    return (
      <EmptyState
        icon="📚"
        title={t('home.emptyTitle')}
        description={t('home.emptyDescription')}
        action={
          <Link href="/search">
            <Button variant="primary">{t('home.emptyAction')}</Button>
          </Link>
        }
        className="mt-8 min-h-[60vh]"
      />
    );
  }

  const serializedBooks: LibraryEntryView[] = userBooks.map((ub) =>
    toLibraryEntryView(ub),
  );

  const byStatus: Record<BookStatus, LibraryEntryView[]> = {
    READING: [],
    READ: [],
    TO_READ: [],
    WISHLIST: [],
  };

  for (const book of serializedBooks) {
    byStatus[book.status].push(book);
  }

  const genreRails = topGenreRails(serializedBooks);

  return (
    <div className="relative min-h-screen">
      {byStatus.READING[0]?.coverUrl ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url(${byStatus.READING[0].coverUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(80px) brightness(0.25) saturate(1.5)",
            transform: "scale(1.2)",
          }}
        />
      ) : (
        <div className="fixed inset-0 z-0 bg-surface pointer-events-none" aria-hidden="true" />
      )}
      <div className="fixed inset-0 z-0 bg-surface/50 pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 px-12 md:px-20 space-y-16 pb-24 pt-8">
        {STATUS_ORDER.map((status) => {
          const sectionBooks = byStatus[status];
          if (sectionBooks.length === 0) return null;

          return (
            <section key={status}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-3">
                  {t(`book.status.${status}`)}
                  {status === "READING" && (
                    <span
                      className="material-symbols-outlined text-secondary text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      auto_stories
                    </span>
                  )}
                </h2>
                <Link href="/library" className="text-primary text-sm font-semibold hover:underline">
                  {t('common.viewAll')}
                </Link>
              </div>
              <div className="flex gap-6 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4">
                {sectionBooks.map((book: LibraryEntryView) => {
                  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : t('common.unknownAuthor');
                  const year = book.publishedDate ? new Date(book.publishedDate).getFullYear() : null;

                  return (
                    <Link
                      key={book.id}
                      href={`/books/${book.id}`}
                      className="flex-none w-48 md:w-56 group cursor-pointer"
                    >
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-surface-container-low transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_20px_40px_rgba(0,17,12,0.8)]">
                        {book.coverUrl ? (
                          <Image
                            src={book.coverUrl}
                            alt={book.title}
                            fill
                            sizes="(max-width: 768px) 192px, 224px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-surface-container flex items-center justify-center">
                            <span className="material-symbols-outlined text-tertiary text-4xl">menu_book</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                          <span className="text-secondary text-xs font-bold mb-1">{t(`book.status.${book.status}`)}</span>
                        </div>
                      </div>
                      <h3 className="mt-4 text-on-surface font-bold text-sm group-hover:text-primary transition-colors">{book.title}</h3>
                      <p className="text-tertiary text-xs">{authorLine}{year ? ` • ${year}` : ""}</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Genre discovery rails */}
        {genreRails.length > 0 && (
          <section aria-label={t('home.browseByGenre')}>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-xl font-bold tracking-tight text-on-surface">
                {t('home.browseByGenre')}
              </h2>
            </div>
            <div className="space-y-12">
              {genreRails.map(([genre, books]) => (
                <BookRailSection
                  key={genre}
                  title={genre}
                  count={books.length}
                >
                  {books.map((book, index) => (
                    <BookCard
                      key={book.id}
                      variant="browse"
                      book={book}
                      index={index}
                    />
                  ))}
                </BookRailSection>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
