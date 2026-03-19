import Link from "next/link";
import type { BookStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BookRailSection } from "@/features/shared/ui/book-rail-section";
import { StatPill } from "@/features/shared/components/stat-pill";
import { EmptyState } from "@/features/shared/components/empty-state";
import { Button } from "@/features/shared/components/button";
import { HeroBanner } from "@/features/books/components/hero-banner";
import { BrowseCardWrapper } from "@/features/books/components/browse-card-wrapper";
import { serializeBook, type SerializableBook } from "@/features/books/types";

const STATUS_RAIL_CONFIG: Array<{
  status: BookStatus;
  title: string;
  eyebrow: string;
}> = [
  { status: "READING", title: "Currently Reading", eyebrow: "In progress" },
  { status: "READ", title: "Finished", eyebrow: "Completed" },
  { status: "TO_READ", title: "To Read", eyebrow: "Up next" },
  { status: "WISHLIST", title: "Wishlist", eyebrow: "Want to read" },
];

export default async function Home() {
  const books = await prisma.book.findMany({
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

  // Group books by status (serialized for client components)
  const byStatus: Record<BookStatus, SerializableBook[]> = {
    READING: [],
    READ: [],
    TO_READ: [],
    WISHLIST: [],
  };

  const serializedBooks = books.map(serializeBook);

  for (const book of serializedBooks) {
    byStatus[book.status].push(book);
  }

  // Featured book: first READING, or first overall
  const featuredBook =
    byStatus.READING[0] ?? serializedBooks[0] ?? null;

  // Stats
  const totalBooks = books.length;
  const readingCount = byStatus.READING.length;
  const readCount = byStatus.READ.length;
  const wishlistCount = byStatus.WISHLIST.length;

  return (
    <>
      {/* Hero */}
      <HeroBanner book={featuredBook} />

      {/* Stats row */}
      <div className="flex flex-wrap gap-2" role="region" aria-label="Library statistics">
        <StatPill value={totalBooks} label="total books" />
        <StatPill value={readingCount} label="reading" />
        <StatPill value={readCount} label="read" />
        <StatPill value={wishlistCount} label="on wishlist" />
      </div>

      {/* Book rails by status */}
      {STATUS_RAIL_CONFIG.map(({ status, title, eyebrow }) => {
        const railBooks = byStatus[status];
        if (railBooks.length === 0) return null;

        return (
          <BookRailSection
            key={status}
            title={title}
            eyebrow={eyebrow}
            count={railBooks.length}
          >
            {railBooks.map((book, index) => (
              <BrowseCardWrapper key={book.id} book={book} index={index} />
            ))}
          </BookRailSection>
        );
      })}
    </>
  );
}
