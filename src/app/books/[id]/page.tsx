import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import type { Book } from "@/lib/types/book";
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
import { getLibraryEntrySnapshot, getFriendBookActivities } from "@/lib/books";
import { getViewableUserIds } from "@/lib/privacy/can-view-user-books";
import { isPrismaSchemaMismatchError } from "@/lib/prisma-schema-compat";

type LocalLibraryEntry = NonNullable<Awaited<ReturnType<typeof getLibraryEntrySnapshot>>["entry"]>;

interface BookDetailPageProps {
  params: Promise<{ id: string }>;
}

export interface BookOwner {
  userId: string;
  userName: string | null;
  userImage: string | null;
  status: string;
  rating: number | null;
  hasExclusiveLoan: boolean;
}

const UNAVAILABLE_LOAN_STATUSES = ["REQUESTED", "OFFERED", "ACTIVE"] as const;

type ResolvedBook =
  | { source: "local"; userBook: LocalLibraryEntry }
  | { source: "local-readonly"; userBook: LocalLibraryEntry }
  | { source: "local-unavailable"; book: Book | null }
  | { source: "discovered"; book: Book; owners: BookOwner[] }
  | GoogleBookView
  | ExternalBookView;

const resolveBook = cache(async function resolveBook(id: string, userId: string): Promise<ResolvedBook | null> {
  // 1. Check if the current user has this book
  const libraryEntrySnapshot = await getLibraryEntrySnapshot(userId, id);

  if (libraryEntrySnapshot.entry) {
    if (libraryEntrySnapshot.state === "degraded") {
      return { source: "local-readonly", userBook: libraryEntrySnapshot.entry };
    }

    return { source: "local", userBook: libraryEntrySnapshot.entry };
  }

  if (libraryEntrySnapshot.state === "unavailable") {
    const localBook = await prisma.book.findUnique({ where: { id } });

    return { source: "local-unavailable", book: localBook };
  }

  // 2. Check if the book exists in the DB (e.g. from a recommendation)
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
        // ownershipStatus column missing — cannot confirm ownership,
        // show empty owners to avoid presenting non-owners as lenders
        allOwners = [];
      } else {
        throw ownershipErr;
      }
    }

    // Bulk visibility check — 2 queries instead of N per owner
    const ownerIds = allOwners.map((o) => o.userId);
    const viewableIds = await getViewableUserIds(userId, ownerIds);

    // Fetch unavailable loans for this book from the visible owners
    const visibleOwnerIds = ownerIds.filter((oid) => viewableIds.has(oid));
    const unavailableLoans = visibleOwnerIds.length > 0
      ? await prisma.loan.findMany({
          where: {
            bookId: id,
            lenderId: { in: visibleOwnerIds },
            status: { in: UNAVAILABLE_LOAN_STATUSES.slice() },
          },
          select: { lenderId: true },
        })
      : [];
    const unavailableLenderIds = new Set(unavailableLoans.map((l) => l.lenderId));

    const visibleOwners: BookOwner[] = allOwners
      .filter((o) => viewableIds.has(o.userId))
      .map((owner) => ({
        userId: owner.userId,
        userName: owner.user.name,
        userImage: owner.user.image,
        status: owner.status,
        rating: owner.rating,
        hasExclusiveLoan: unavailableLenderIds.has(owner.userId),
      }));

    return { source: "discovered", book, owners: visibleOwners };
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

  if (resolved.source === "local" || resolved.source === "local-readonly") {
    const { book } = resolved.userBook;
    return {
      title: `${book.title} — Rollorian`,
      description: `Book detail for ${book.title} by ${book.authors.join(", ")}`,
    };
  }

  if (resolved.source === "local-unavailable") {
    const title = resolved.book?.title ?? "Book temporarily unavailable";
    const authors = resolved.book?.authors.join(", ") ?? "your library";

    return {
      title: `${title} — Rollorian`,
      description: `Book detail temporarily unavailable while Rollorian waits for ${authors} to resync`,
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
  const tBook = await getTranslations("book");
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
    const friendActivities = await getFriendBookActivities(userId, resolved.userBook.book.id);
    return <LocalBookDetail userBook={resolved.userBook} friendActivities={friendActivities} />;
  }

  if (resolved.source === "local-readonly") {
    const { userBook } = resolved;
    const book = userBook.book;

    return (
      <section className="mx-auto max-w-4xl grid gap-6 pt-8 pb-12">
        <div className="rounded-[var(--radius-xl)] border border-amber-400/30 bg-surface/70 p-6 backdrop-blur-[20px]">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
            {tBook("compat.readOnlyModeEyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-on-surface leading-tight">{book.title}</h1>
          <p className="mt-2 text-base text-on-surface/60">{book.authors.join(", ")}</p>
          <p className="mt-4 text-sm text-on-surface/75 leading-relaxed">
            {tBook("compat.readOnlyDescription")}
          </p>
          <dl className="mt-6 grid gap-3 text-sm text-on-surface/75">
            <div>
              <dt className="font-semibold text-on-surface">{tBook("statusLabel")}</dt>
              <dd>{tBook(`status.${userBook.status}`)}</dd>
            </div>
            {userBook.rating != null && (
              <div>
                <dt className="font-semibold text-on-surface">{tBook("ratingLabel")}</dt>
                <dd>{userBook.rating}/5</dd>
              </div>
            )}
            {userBook.notes && (
              <div>
                <dt className="font-semibold text-on-surface">{tBook("notesLabel")}</dt>
                <dd>{userBook.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>
    );
  }

  if (resolved.source === "local-unavailable") {
    return (
      <section className="mx-auto max-w-4xl grid gap-6 pt-8 pb-12">
        <div className="rounded-[var(--radius-xl)] border border-amber-400/30 bg-surface/70 p-6 backdrop-blur-[20px]">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
            {tBook("compat.modeEyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-on-surface leading-tight">
            {resolved.book?.title ?? tBook("compat.unavailableTitle")}
          </h1>
          {resolved.book?.authors.length ? (
            <p className="mt-2 text-base text-on-surface/60">{resolved.book.authors.join(", ")}</p>
          ) : null}
          <p className="mt-4 text-sm text-on-surface/75 leading-relaxed">
            {tBook("compat.unavailableDescription")}
          </p>
        </div>
      </section>
    );
  }

  if (resolved.source === "discovered") {
    return <DiscoveredBookDetail book={resolved.book} owners={resolved.owners} />;
  }

  // Both "google" and "external" sources use the same detail layout
  return <GoogleBookDetail view={resolved} />;
}
