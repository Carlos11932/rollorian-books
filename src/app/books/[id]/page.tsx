import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { UserBookWithBook, Book } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { fetchBookById } from "@/lib/google-books/client";
import { stripHtml } from "@/lib/utils/text";
import type { GoogleBooksVolume } from "@/lib/google-books/types";
import type { GoogleBookView, ExternalBookView } from "@/features/books/types";
import { LocalBookDetail } from "@/features/books/components/local-book-detail";
import { GoogleBookDetail } from "@/features/books/components/google-book-detail";
import { DiscoveredBookDetail } from "@/features/books/components/discovered-book-detail";
import { fetchWorkById } from "@/lib/book-providers/open-library/client";
import { USER_BOOK_SELECT } from "@/lib/books/user-book-select";
import { getViewableUserIds } from "@/lib/privacy/can-view-user-books";
import { isPrismaSchemaMismatchError } from "@/lib/prisma-schema-compat";

interface BookDetailPageProps {
  params: Promise<{ id: string }>;
}

export interface BookOwner {
  userId: string;
  userName: string | null;
  userImage: string | null;
  status: string;
  rating: number | null;
  hasActiveLoan: boolean;
}

type ResolvedBook =
  | { source: "local"; userBook: UserBookWithBook }
  | { source: "discovered"; book: Book; owners: BookOwner[] }
  | GoogleBookView
  | ExternalBookView;

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
  } catch (err) {
    if (isPrismaSchemaMismatchError(err)) {
      // ownershipStatus column missing — retry without it
      const fallbackSelect = {
        id: true,
        userId: true,
        bookId: true,
        status: true,
        rating: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        book: true,
      } as const;
      try {
        const result = await prisma.userBook.findUnique({
          where: { userId_bookId: { userId, bookId: id } },
          select: fallbackSelect,
        });
        if (result) {
          return {
            source: "local",
            userBook: { ...result, ownershipStatus: "UNKNOWN" as const, finishedAt: null },
          };
        }
      } catch {
        // Fall through
      }
    }
    // Invalid ID format for Prisma or other error — fall through
  }

  // 2. Check if the book exists in the DB (e.g. from a recommendation)
  try {
    const book = await prisma.book.findUnique({ where: { id } });
    if (book) {
      // Find who among the user's connections actually owns this book
      let allOwners: { userId: string; status: string; rating: number | null; user: { id: string; name: string | null; image: string | null } }[];
      try {
        allOwners = await prisma.userBook.findMany({
          where: { bookId: id, userId: { not: userId }, ownershipStatus: "OWNED" },
          select: {
            userId: true,
            status: true,
            rating: true,
            user: { select: { id: true, name: true, image: true } },
          },
        });
      } catch (ownershipErr) {
        if (isPrismaSchemaMismatchError(ownershipErr)) {
          // ownershipStatus column missing — fall back to all UserBook holders
          allOwners = await prisma.userBook.findMany({
            where: { bookId: id, userId: { not: userId } },
            select: {
              userId: true,
              status: true,
              rating: true,
              user: { select: { id: true, name: true, image: true } },
            },
          });
        } else {
          throw ownershipErr;
        }
      }

      // Bulk visibility check — 2 queries instead of N per owner
      const ownerIds = allOwners.map((o) => o.userId);
      const viewableIds = await getViewableUserIds(userId, ownerIds);

      // Fetch active loans for this book from the visible owners
      const visibleOwnerIds = ownerIds.filter((oid) => viewableIds.has(oid));
      const activeLoans = visibleOwnerIds.length > 0
        ? await prisma.loan.findMany({
            where: {
              bookId: id,
              lenderId: { in: visibleOwnerIds },
              status: "ACTIVE",
            },
            select: { lenderId: true },
          })
        : [];
      const activeLenderIds = new Set(activeLoans.map((l) => l.lenderId));

      const visibleOwners: BookOwner[] = allOwners
        .filter((o) => viewableIds.has(o.userId))
        .map((owner) => ({
          userId: owner.userId,
          userName: owner.user.name,
          userImage: owner.user.image,
          status: owner.status,
          rating: owner.rating,
          hasActiveLoan: activeLenderIds.has(owner.userId),
        }));

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

  // 4. Try OpenLibrary by work ID (e.g. "OL34942758W")
  if (/^OL\d+[A-Z]$/.test(id)) {
    try {
      const olDoc = await fetchWorkById(id);
      if (olDoc) {
        const coverUrl = olDoc.cover_i
          ? `https://covers.openlibrary.org/b/id/${olDoc.cover_i}-L.jpg`
          : null;

        return {
          source: "external",
          externalId: id,
          title: olDoc.title,
          subtitle: olDoc.subtitle ?? null,
          authors: olDoc.author_name ?? [],
          description: null,
          coverUrl,
          publisher: null,
          publishedDate: olDoc.first_publish_year ? String(olDoc.first_publish_year) : null,
          pageCount: olDoc.number_of_pages_median ?? null,
          isbn10: null,
          isbn13: null,
          genres: olDoc.subject?.slice(0, 5) ?? [],
        } satisfies ExternalBookView;
      }
    } catch {
      // OpenLibrary unreachable — treat as not found
    }
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

  // "google" or "external" — both have title and authors at top level
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

  // Both "google" and "external" sources use the same detail layout
  return <GoogleBookDetail view={resolved} />;
}
