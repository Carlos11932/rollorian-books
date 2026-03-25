import { notFound } from "next/navigation";
import { cache } from "react";
import type { Book } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { fetchBookById } from "@/lib/google-books/client";
import { stripHtml } from "@/lib/utils/text";
import type { GoogleBooksVolume } from "@/lib/google-books/types";
import type { GoogleBookView } from "@/features/books/types";
import { LocalBookDetail } from "@/features/books/components/local-book-detail";
import { GoogleBookDetail } from "@/features/books/components/google-book-detail";

interface BookDetailPageProps {
  params: Promise<{ id: string }>;
}

type ResolvedBook = { source: "local"; book: Book } | GoogleBookView;

const resolveBook = cache(async function resolveBook(id: string, userId: string): Promise<ResolvedBook | null> {
  try {
    const local: Book | null = await prisma.book.findUnique({ where: { id, ownerId: userId } });
    if (local) {
      return { source: "local", book: local };
    }
  } catch {
    // Invalid ID format for Prisma — fall through to Google Books
  }

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
  const userId = session!.user!.id;
  const resolved = await resolveBook(id, userId);

  if (!resolved) return { title: "Book not found" };

  if (resolved.source === "local") {
    const { book } = resolved;
    return {
      title: `${book.title} — Rollorian`,
      description: `Book detail for ${book.title} by ${book.authors.join(", ")}`,
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
  const userId = session!.user!.id;
  const resolved = await resolveBook(id, userId);

  if (!resolved) {
    notFound();
  }

  if (resolved.source === "local") {
    return <LocalBookDetail book={resolved.book} />;
  }

  return <GoogleBookDetail view={resolved} />;
}
