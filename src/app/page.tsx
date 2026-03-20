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
      {/* Hero Section — split layout */}
      {featuredBook && (
        <section className="relative w-full bg-surface overflow-hidden">
          <div className="flex flex-col md:flex-row items-center min-h-[420px] md:min-h-[480px]">

            {/* Left: text content */}
            <div className="flex-1 px-12 md:px-20 py-16 flex flex-col justify-center relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-secondary/20 text-secondary border border-secondary/30 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase">
                  Currently Reading
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-on-surface mb-4 leading-none">
                {featuredBook.title}
              </h1>
              {featuredBook.authors?.length > 0 && (
                <p className="text-tertiary text-base mb-4 font-medium">
                  {featuredBook.authors.join(', ')}
                </p>
              )}
              {featuredBook.description && (
                <p className="text-tertiary/80 text-sm md:text-base max-w-md mb-8 leading-relaxed font-light line-clamp-3">
                  {featuredBook.description}
                </p>
              )}
              <div className="flex flex-wrap gap-4">
                <Link
                  href={`/books/${featuredBook.id}`}
                  className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm flex items-center gap-2 hover:scale-105 transition-transform"
                >
                  <span className="material-symbols-outlined text-base">auto_stories</span>
                  View Details
                </Link>
              </div>
            </div>

            {/* Right: book cover */}
            <div className="relative flex-shrink-0 flex items-center justify-end pr-12 md:pr-20 py-12 md:py-16">
              {/* Gradient fade — blends cover into background on the left */}
              <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-surface to-transparent z-10 pointer-events-none" />

              {featuredBook.coverUrl ? (
                <img
                  src={featuredBook.coverUrl}
                  alt={featuredBook.title}
                  className="relative z-0 h-64 md:h-80 w-auto object-contain rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
                />
              ) : (
                <div className="relative z-0 h-64 md:h-80 aspect-[2/3] rounded-lg bg-surface-container-high flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                  <span className="material-symbols-outlined text-5xl text-tertiary/40">menu_book</span>
                </div>
              )}
            </div>

          </div>

          {/* Bottom gradient — blends into collections below */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
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
