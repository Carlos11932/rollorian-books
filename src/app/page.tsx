import Link from "next/link";
import type { Book, BookStatus } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/features/shared/components/empty-state";
import { Button } from "@/features/shared/components/button";
import { serializeBook, type SerializableBook } from "@/features/books/types";

const STATUS_CONFIG: Array<{
  status: BookStatus;
  title: string;
}> = [
  { status: "READING", title: "Currently Reading" },
  { status: "READ", title: "Finished" },
  { status: "TO_READ", title: "To Read" },
  { status: "WISHLIST", title: "Wishlist" },
];

const STATUS_BADGE_LABEL: Record<BookStatus, string> = {
  READING: "Currently Reading",
  READ: "Finished",
  TO_READ: "To Read",
  WISHLIST: "Wishlist",
};

export default async function Home() {
  const books: Book[] = await prisma.book.findMany({
    orderBy: { updatedAt: "desc" },
  });

  if (books.length === 0) {
    return (
      <EmptyState
        icon="📚"
        title="Your archive is empty"
        description="Search for books and save them to your personal library."
        action={
          <Link href="/search">
            <Button variant="primary">Find your first book</Button>
          </Link>
        }
        className="mt-8 min-h-[60vh]"
      />
    );
  }

  const serializedBooks: SerializableBook[] = books.map((book: Book) =>
    serializeBook(book)
  );

  const byStatus: Record<BookStatus, SerializableBook[]> = {
    READING: [],
    READ: [],
    TO_READ: [],
    WISHLIST: [],
  };

  for (const book of serializedBooks) {
    byStatus[book.status].push(book);
  }

  const featuredBook = byStatus.READING[0] ?? serializedBooks[0] ?? null;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      {featuredBook && (
        <section className="relative w-full overflow-hidden min-h-[420px] flex flex-col items-center justify-center py-12 px-6">

          {/* Background: blurred cover image — creates atmospheric color from the book */}
          {featuredBook.coverUrl && (
            <div
              className="absolute inset-0 z-0"
              style={{
                backgroundImage: `url(${featuredBook.coverUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(60px) brightness(0.35) saturate(1.4)',
                transform: 'scale(1.1)',
              }}
            />
          )}
          {/* Fallback background if no cover */}
          {!featuredBook.coverUrl && (
            <div className="absolute inset-0 z-0 bg-surface-container" />
          )}

          {/* Dark vignette overlay for readability */}
          <div className="absolute inset-0 z-0 bg-surface/40 pointer-events-none" />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center text-center max-w-xl">

            {/* Status badge */}
            <span className="bg-secondary/20 text-secondary border border-secondary/30 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-6">
              Currently Reading
            </span>

            {/* Book cover — centered, portrait aspect, sharp */}
            {featuredBook.coverUrl ? (
              <img
                src={featuredBook.coverUrl}
                alt={featuredBook.title}
                className="h-56 md:h-72 w-auto object-contain rounded-lg shadow-[0_24px_64px_rgba(0,0,0,0.7)] mb-6"
              />
            ) : (
              <div className="h-56 md:h-72 aspect-[2/3] rounded-lg bg-surface-container-high flex items-center justify-center shadow-[0_24px_64px_rgba(0,0,0,0.7)] mb-6">
                <span className="material-symbols-outlined text-5xl text-tertiary/40">menu_book</span>
              </div>
            )}

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-on-surface mb-2 leading-tight">
              {featuredBook.title}
            </h1>

            {/* Author */}
            {featuredBook.authors?.length > 0 && (
              <p className="text-tertiary text-sm mb-6 font-medium">
                {featuredBook.authors.join(', ')}
              </p>
            )}

            {/* CTA */}
            <Link
              href={`/books/${featuredBook.id}`}
              className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm flex items-center gap-2 hover:scale-105 transition-transform"
            >
              <span className="material-symbols-outlined text-base">auto_stories</span>
              View Details
            </Link>
          </div>

          {/* Bottom fade into content below */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-surface to-transparent pointer-events-none z-10" />
        </section>
      )}

      {/* Collections */}
      <div className="px-12 md:px-20 space-y-16 pb-24">
        {STATUS_CONFIG.map(({ status, title }) => {
          const sectionBooks = byStatus[status];
          if (sectionBooks.length === 0) return null;

          return (
            <section key={status}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-3">
                  {title}
                  {status === "READING" && (
                    <span
                      className="material-symbols-outlined text-secondary text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      auto_stories
                    </span>
                  )}
                </h2>
                <Link
                  href="/library"
                  className="text-primary text-sm font-semibold hover:underline"
                >
                  View All
                </Link>
              </div>

              {/* Carousel */}
              <div className="flex gap-6 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4">
                {sectionBooks.map((book: SerializableBook) => {
                  const authorLine =
                    book.authors.length > 0
                      ? book.authors.join(", ")
                      : "Unknown author";
                  const year = book.publishedDate
                    ? new Date(book.publishedDate).getFullYear()
                    : null;

                  return (
                    <Link
                      key={book.id}
                      href={`/books/${book.id}`}
                      className="flex-none w-48 md:w-56 group cursor-pointer"
                    >
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-surface-container-low transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_20px_40px_rgba(0,17,12,0.8)]">
                        {book.coverUrl ? (
                          <img
                            className="w-full h-full object-cover"
                            src={book.coverUrl}
                            alt={book.title}
                          />
                        ) : (
                          <div className="w-full h-full bg-surface-container flex items-center justify-center">
                            <span className="material-symbols-outlined text-tertiary text-4xl">
                              menu_book
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                          <span className="text-secondary text-xs font-bold mb-1">
                            {STATUS_BADGE_LABEL[book.status]}
                          </span>
                        </div>
                      </div>
                      <h3 className="mt-4 text-on-surface font-bold text-sm group-hover:text-primary transition-colors">
                        {book.title}
                      </h3>
                      <p className="text-tertiary text-xs">
                        {authorLine}
                        {year ? ` • ${year}` : ""}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
