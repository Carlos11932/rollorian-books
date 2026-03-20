import { Suspense } from "react";
import Link from "next/link";
import type { BookStatus as PrismaBookStatus } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { LibraryBookCard } from "@/features/books/components/library-book-card";
import { StatusTabs } from "@/features/books/components/status-tabs";
import type { StatusTabValue, StatusCounts } from "@/features/books/components/status-tabs";
import type { BookStatus } from "@/features/shared/components/badge";

/** Explicit shape for books fetched with the select clause below. */
interface LibraryBookRow {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  status: PrismaBookStatus;
  rating: number | null;
  notes: string | null;
  publisher: string | null;
  publishedDate: string | null;
}

const BOOK_STATUS = {
  WISHLIST: "WISHLIST",
  TO_READ: "TO_READ",
  READING: "READING",
  READ: "READ",
} as const;

const STATUS_ORDERED: BookStatus[] = [
  BOOK_STATUS.READING,
  BOOK_STATUS.TO_READ,
  BOOK_STATUS.WISHLIST,
  BOOK_STATUS.READ,
];

const STATUS_TAB_LABELS: Record<StatusTabValue, string> = {
  all: "Todos",
  WISHLIST: "Wishlist",
  TO_READ: "Por Leer",
  READING: "Leyendo",
  READ: "Leídos",
};

function isValidStatus(value: string): value is BookStatus {
  return Object.values(BOOK_STATUS).includes(value as BookStatus);
}

function resolveActiveStatus(param: string | undefined): StatusTabValue {
  if (!param) return "all";
  if (isValidStatus(param)) return param;
  return "all";
}

interface LibraryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const activeStatus = resolveActiveStatus(statusParam);

  // Fetch books filtered by status if active
  const books: LibraryBookRow[] = await prisma.book.findMany({
    where: activeStatus !== "all" ? { status: activeStatus } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      authors: true,
      coverUrl: true,
      status: true,
      rating: true,
      notes: true,
      publisher: true,
      publishedDate: true,
    },
  });

  // Compute counts for tab badges
  let counts: StatusCounts;

  if (activeStatus === "all") {
    counts = books.reduce<StatusCounts>(
      (acc, book) => {
        acc[book.status as BookStatus] = (acc[book.status as BookStatus] ?? 0) + 1;
        return acc;
      },
      { WISHLIST: 0, TO_READ: 0, READING: 0, READ: 0 },
    );
  } else {
    const allCounts = await prisma.book.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    counts = allCounts.reduce<StatusCounts>(
      (acc, row) => {
        acc[row.status as BookStatus] = row._count.id;
        return acc;
      },
      { WISHLIST: 0, TO_READ: 0, READING: 0, READ: 0 },
    );
  }

  const totalBooks = Object.values(counts).reduce((a, b) => a + b, 0);

  // Background image: first book of the active tab, or first book overall
  const backdropBook =
    activeStatus !== "all"
      ? (books.find((b) => b.coverUrl !== null) ?? null)
      : (books.find((b) => b.coverUrl !== null) ?? null);

  const backdropUrl = backdropBook?.coverUrl ?? null;

  // For rendering: group by status when "all" tab is active
  const booksByStatus: Record<BookStatus, LibraryBookRow[]> =
    activeStatus === "all"
      ? STATUS_ORDERED.reduce<Record<BookStatus, LibraryBookRow[]>>(
          (acc, status) => {
            acc[status] = books.filter((b) => b.status === status);
            return acc;
          },
          { READING: [], TO_READ: [], WISHLIST: [], READ: [] },
        )
      : { READING: [], TO_READ: [], WISHLIST: [], READ: [] };

  const isEmpty = books.length === 0;

  return (
    <div className="relative min-h-screen">

      {/* ── Blurred background wallpaper ── */}
      {backdropUrl ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url(${backdropUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(80px) brightness(0.25) saturate(1.5)",
            transform: "scale(1.2)",
          }}
        />
      ) : (
        <div className="fixed inset-0 z-0 bg-surface pointer-events-none" aria-hidden="true" />
      )}
      {/* Dark overlay for readability */}
      <div className="fixed inset-0 z-[1] bg-surface/50 pointer-events-none" aria-hidden="true" />

      {/* ── Main content ── */}
      <div className="relative z-[2] px-6 md:px-12 lg:px-20 pt-10 pb-24 space-y-8">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1
              className="text-4xl font-bold text-on-surface tracking-tight"
              style={{ fontFamily: "var(--font-headline)" }}
            >
              Mi Biblioteca
            </h1>
          </div>
          <span className="text-on-surface/50 text-sm font-semibold tabular-nums">
            {totalBooks} {totalBooks === 1 ? "libro" : "libros"}
          </span>
        </div>

        {/* Status tabs */}
        <Suspense fallback={<div className="flex gap-2 h-10" />}>
          <StatusTabs activeStatus={activeStatus} counts={counts} />
        </Suspense>

        {/* Content */}
        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
            <span
              className="material-symbols-outlined text-on-surface/30 text-7xl"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' 0, 'opsz' 48" }}
              aria-hidden="true"
            >
              menu_book
            </span>
            <div className="space-y-2">
              <p className="text-on-surface font-bold text-lg">
                {activeStatus === "all"
                  ? "Tu biblioteca está vacía"
                  : `No hay libros en ${STATUS_TAB_LABELS[activeStatus]}`}
              </p>
              <p className="text-on-surface/50 text-sm max-w-xs mx-auto leading-relaxed">
                {activeStatus === "all"
                  ? "Busca libros y guárdalos aquí para empezar a construir tu colección."
                  : "Prueba otro estado o busca algo nuevo para añadir."}
              </p>
            </div>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-all duration-200 hover:brightness-110 hover:scale-[1.02]"
            >
              <span
                className="material-symbols-outlined text-base"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
                aria-hidden="true"
              >
                search
              </span>
              Buscar libros
            </Link>
          </div>
        ) : activeStatus !== "all" ? (
          /* Single filtered grid */
          <BookGrid books={books} />
        ) : (
          /* All statuses — one section per status */
          <div className="space-y-14">
            {STATUS_ORDERED.map((status) => {
              const sectionBooks = booksByStatus[status];
              if (sectionBooks.length === 0) return null;
              return (
                <section key={status}>
                  <h2
                    className="text-lg font-bold text-on-surface/70 mb-5 uppercase tracking-widest text-xs"
                    style={{ fontFamily: "var(--font-headline)" }}
                  >
                    {STATUS_TAB_LABELS[status]}
                    <span className="ml-2 text-on-surface/30 font-normal normal-case tracking-normal text-sm">
                      {sectionBooks.length}
                    </span>
                  </h2>
                  <BookGrid books={sectionBooks} />
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Responsive grid of LibraryBookCards */
function BookGrid({ books }: { books: LibraryBookRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
      {books.map((book) => (
        <LibraryBookCard
          key={book.id}
          book={{
            ...book,
            status: book.status as BookStatus,
            coverUrl: book.coverUrl ?? null,
            rating: book.rating ?? null,
            notes: book.notes ?? null,
            publisher: book.publisher ?? null,
            publishedDate: book.publishedDate ?? null,
          }}
        />
      ))}
    </div>
  );
}
