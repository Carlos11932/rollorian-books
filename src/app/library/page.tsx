import Link from "next/link";
import type { BookStatus as PrismaBookStatus } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

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

type BookStatus = "WISHLIST" | "TO_READ" | "READING" | "READ";

// ── Sub-components ────────────────────────────────────────────────────────────

/** READING section: landscape cards with cover background + progress bar */
function ReadingSection({ books }: { books: LibraryBookRow[] }) {
  if (books.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary" aria-hidden="true" />
        <h2 className="text-xl font-bold text-secondary" style={{ fontFamily: "var(--font-headline)" }}>
          Leyendo
        </h2>
        <span className="text-on-surface/40 text-sm font-normal ml-1">{books.length}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {books.map((book) => {
          const title = book.title ?? "Sin título";
          const cover = book.coverUrl ?? null;

          return (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="group relative aspect-[16/10] rounded-xl overflow-hidden cursor-pointer block
                         transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/40"
            >
              {/* Cover as background */}
              {cover ? (
                <img
                  src={cover}
                  alt={title}
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500"
                />
              ) : (
                <div className="w-full h-full bg-surface-container-high" />
              )}

              {/* Gradient overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, var(--color-surface-container-lowest) 0%, color-mix(in srgb, var(--color-surface-container-low) 40%, transparent) 50%, transparent 100%)",
                }}
                aria-hidden="true"
              />

              {/* Content */}
              <div className="absolute bottom-0 left-0 p-6 w-full">
                <p className="text-2xl font-bold text-on-surface leading-tight mb-3 line-clamp-2"
                   style={{ fontFamily: "var(--font-headline)" }}>
                  {title}
                </p>
                {/* Progress bar — placeholder 0% (no progress field in model) */}
                <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{
                      width: "0%",
                      boxShadow: "0 0 8px rgba(255,198,64,0.6)",
                    }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** READ section: horizontal carousel of portrait cards with check overlay */
function ReadSection({ books }: { books: LibraryBookRow[] }) {
  if (books.length === 0) return null;

  return (
    <section>
      <h2
        className="text-lg font-bold uppercase tracking-widest opacity-80 mb-5"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        Leídos
        <span className="ml-2 text-on-surface/40 font-normal normal-case tracking-normal text-sm opacity-100">
          {books.length}
        </span>
      </h2>

      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4">
        {books.map((book) => {
          const title = book.title ?? "Sin título";
          const author =
            book.authors && book.authors.length > 0
              ? book.authors.join(", ")
              : "Autor desconocido";
          const cover = book.coverUrl ?? null;

          return (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="min-w-[160px] md:min-w-[200px] group cursor-pointer flex-shrink-0 block"
            >
              {/* Portrait cover */}
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 transition-transform duration-300 group-hover:scale-105">
                {cover ? (
                  <img
                    src={cover}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-on-surface/30 text-4xl"
                      aria-hidden="true"
                    >
                      menu_book
                    </span>
                  </div>
                )}

                {/* Hover overlay with check icon */}
                <div
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                              flex items-center justify-center"
                >
                  <span
                    className="material-symbols-outlined text-green-400 text-4xl"
                    style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48" }}
                    aria-hidden="true"
                  >
                    check_circle
                  </span>
                </div>
              </div>

              <p className="text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors duration-200">
                {title}
              </p>
              <p className="text-xs text-tertiary truncate">{author}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** WISHLIST section: grayscale portrait cards with star badge */
function WishlistSection({ books }: { books: LibraryBookRow[] }) {
  if (books.length === 0) return null;

  return (
    <section>
      <h2
        className="text-lg font-bold uppercase tracking-widest opacity-80 mb-5"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        Deseados
        <span className="ml-2 text-on-surface/40 font-normal normal-case tracking-normal text-sm opacity-100">
          {books.length}
        </span>
      </h2>

      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4">
        {books.map((book) => {
          const title = book.title ?? "Sin título";
          const author =
            book.authors && book.authors.length > 0
              ? book.authors.join(", ")
              : "Autor desconocido";
          const cover = book.coverUrl ?? null;

          return (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="min-w-[160px] md:min-w-[200px] group cursor-pointer flex-shrink-0 block"
            >
              {/* Portrait cover — grayscale by default */}
              <div
                className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2
                            grayscale group-hover:grayscale-0 transition-all duration-300
                            group-hover:scale-105"
              >
                {cover ? (
                  <img
                    src={cover}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-on-surface/30 text-4xl"
                      aria-hidden="true"
                    >
                      menu_book
                    </span>
                  </div>
                )}

                {/* Star badge */}
                <div className="absolute top-2 right-2 p-1 bg-surface/80 rounded-full backdrop-blur-sm">
                  <span
                    className="material-symbols-outlined text-secondary text-base leading-none block"
                    style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
                    aria-hidden="true"
                  >
                    star
                  </span>
                </div>
              </div>

              <p className="text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors duration-200">
                {title}
              </p>
              <p className="text-xs text-tertiary truncate">{author}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** TO_READ section: simple carousel like READ but no special overlay */
function ToReadSection({ books }: { books: LibraryBookRow[] }) {
  if (books.length === 0) return null;

  return (
    <section>
      <h2
        className="text-lg font-bold uppercase tracking-widest opacity-80 mb-5"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        Por Leer
        <span className="ml-2 text-on-surface/40 font-normal normal-case tracking-normal text-sm opacity-100">
          {books.length}
        </span>
      </h2>

      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4">
        {books.map((book) => {
          const title = book.title ?? "Sin título";
          const author =
            book.authors && book.authors.length > 0
              ? book.authors.join(", ")
              : "Autor desconocido";
          const cover = book.coverUrl ?? null;

          return (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="min-w-[160px] md:min-w-[200px] group cursor-pointer flex-shrink-0 block"
            >
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 transition-transform duration-300 group-hover:scale-105">
                {cover ? (
                  <img
                    src={cover}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-on-surface/30 text-4xl"
                      aria-hidden="true"
                    >
                      menu_book
                    </span>
                  </div>
                )}
              </div>

              <p className="text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors duration-200">
                {title}
              </p>
              <p className="text-xs text-tertiary truncate">{author}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Full-page empty state */
function EmptyLibrary() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
      <span
        className="material-symbols-outlined text-on-surface/30 text-7xl"
        style={{ fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' 0, 'opsz' 48" }}
        aria-hidden="true"
      >
        menu_book
      </span>
      <div className="space-y-2">
        <p className="text-on-surface font-bold text-lg">Tu biblioteca está vacía</p>
        <p className="text-on-surface/50 text-sm max-w-xs mx-auto leading-relaxed">
          Busca libros y guárdalos aquí para empezar a construir tu colección.
        </p>
      </div>
      <Link
        href="/search"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-on-primary
                   transition-all duration-200 hover:brightness-110 hover:scale-[1.02]"
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
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LibraryPage() {
  // Fetch all library books — no status filter, sectioning handled in render
  const books: LibraryBookRow[] = await prisma.book.findMany({
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

  // Group by status
  const reading = books.filter((b) => b.status === "READING");
  const read = books.filter((b) => b.status === "READ");
  const wishlist = books.filter((b) => b.status === "WISHLIST");
  const toRead = books.filter((b) => b.status === "TO_READ");

  const isEmpty = books.length === 0;

  // Backdrop: first book with a cover
  const backdropUrl = books.find((b) => b.coverUrl != null)?.coverUrl ?? null;

  return (
    <div className="relative min-h-screen">
      {/* Blurred background wallpaper */}
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
      <div className="fixed inset-0 z-[1] bg-surface/50 pointer-events-none" aria-hidden="true" />

      {/* Main content */}
      <main className="relative z-[2] lg:ml-64 pt-24 pb-12 px-8 md:px-12">

        {/* Header */}
        <header className="mb-10">
          <h1
            className="text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            Tu Biblioteca
          </h1>
          <p className="text-tertiary font-light mt-2">
            Curando tu historia a través de cada página.
          </p>
        </header>

        {isEmpty ? (
          <EmptyLibrary />
        ) : (
          <div className="space-y-16">
            <ReadingSection books={reading} />
            <ReadSection books={read} />
            <WishlistSection books={wishlist} />
            <ToReadSection books={toRead} />
          </div>
        )}
      </main>
    </div>
  );
}
