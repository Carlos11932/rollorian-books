import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { UserBookWithBook, Book } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { fetchBookById } from "@/lib/google-books/client";
import { stripHtml } from "@/lib/utils/text";
import type { GoogleBooksVolume } from "@/lib/google-books/types";
import type { GoogleBookView } from "@/features/books/types";
import { LocalBookDetail } from "@/features/books/components/local-book-detail";
import { GoogleBookDetail } from "@/features/books/components/google-book-detail";
import { DiscoveredBookDetail } from "@/features/books/components/discovered-book-detail";
import { USER_BOOK_SELECT } from "@/lib/books/user-book-select";
import { canViewUserBooks } from "@/lib/privacy/can-view-user-books";

interface BookDetailPageProps {
  params: Promise<{ id: string }>;
}

export interface BookOwner {
  userId: string;
  userName: string | null;
  userImage: string | null;
  status: string;
  rating: number | null;
}

type ResolvedBook =
  | { source: "local"; userBook: UserBookWithBook }
  | { source: "discovered"; book: Book; owners: BookOwner[] }
  | GoogleBookView;

const resolveBook = cache(async function resolveBook(id: string, userId: string): Promise<ResolvedBook | null> {
  // 1. Check if the current user has this book
  try {
    const result = await prisma.userBook.findUnique({
      where: { userId_bookId: { userId, bookId: id } },
      select: USER_BOOK_SELECT,
    });
    if (result) {
      return { source: "local", userBook: { ...result, finishedAt: null } };
    }
  } catch {
    // Invalid ID format for Prisma — fall through
  }

  // 2. Check if the book exists in the DB (e.g. from a recommendation)
  try {
    const book = await prisma.book.findUnique({ where: { id } });
    if (book) {
      // Find who among the user's connections has this book
      const allOwners = await prisma.userBook.findMany({
        where: { bookId: id, userId: { not: userId } },
        select: {
          userId: true,
          status: true,
          rating: true,
          user: { select: { id: true, name: true, image: true } },
        },
      });

      // Filter to only connections the user can see
      const visibleOwners: BookOwner[] = [];
      for (const owner of allOwners) {
        const canView = await canViewUserBooks(userId, owner.userId);
        if (canView) {
          visibleOwners.push({
            userId: owner.userId,
            userName: owner.user.name,
            userImage: owner.user.image,
            status: owner.status,
            rating: owner.rating,
          });
        }
      }

      return { source: "discovered", book, owners: visibleOwners };
    }
  } catch {
    // Fall through to Google Books
  }

  // 3. Try Google Books by external ID
  try {
    const volume = await fetchBookById(id);
    if (volume) {
      return googleVolumeToView(volume);
    }
  } catch {
    // Google Books unreachable — treat as not found
  }

  return null;
});

function selectIdentifier(
  identifiers: { type: string; identifier: string }[] | undefined,
  type: string,
): string | null {
  return identifiers?.find((identifier) => identifier.type === type)?.identifier ?? null;
}

function googleVolumeToView(volume: GoogleBooksVolume): GoogleBookView {
  const info = volume.volumeInfo ?? {};
  const identifiers = info.industryIdentifiers;

  return {
    source: "google",
    volume,
    title: info.title ?? "Untitled",
    subtitle: info.subtitle ?? null,
    authors: Array.isArray(info.authors) ? info.authors : [],
    description: stripHtml(info.description),
    coverUrl: info.imageLinks?.thumbnail?.replace("http://", "https://") ?? null,
    publisher: info.publisher ?? null,
    publishedDate: info.publishedDate ?? null,
    pageCount: info.pageCount ?? null,
    isbn10: selectIdentifier(identifiers, "ISBN_10"),
    isbn13: selectIdentifier(identifiers, "ISBN_13"),
    genres: Array.isArray(info.categories) ? info.categories : [],
  };
}

export async function generateMetadata({ params }: BookDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const resolved = await resolveBook(id, userId);

  if (!resolved) return { title: "Book not found" };

  if (resolved.source === "local") {
    const { book } = resolved.userBook;
    return {
      title: `${book.title} — Rollorian`,
      description: `Book detail for ${book.title} by ${book.authors.join(", ")}`,
    };
  }

  if (resolved.source === "discovered") {
    return {
      title: `${resolved.book.title} — Rollorian`,
      description: `Book detail for ${resolved.book.title} by ${resolved.book.authors.join(", ")}`,
    };
  }

  return {
    title: `${resolved.title} — Rollorian`,
    description: `Book detail for ${resolved.title} by ${resolved.authors.join(", ")}`,
  };
}

export default async function BookDetailPage({ params }: BookDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const resolved = await resolveBook(id, userId);

  if (!resolved) {
    notFound();
  }

  if (resolved.source === "local") {
    return <LocalBookDetail userBook={resolved.userBook} />;
  }

  if (resolved.source === "discovered") {
    return <DiscoveredBookDetail book={resolved.book} owners={resolved.owners} />;
  }

  return <GoogleBookDetail view={resolved} />;
}
