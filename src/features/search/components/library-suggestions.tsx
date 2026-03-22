import Link from "next/link";
import type { SerializableBook } from "@/features/books/types";

interface LibrarySuggestionsProps {
  books: SerializableBook[];
}

export function LibrarySuggestions({ books }: LibrarySuggestionsProps) {
  if (books.length === 0) return null;

  return (
    <section aria-label="Archived Suggestions">
      <h2 className="text-xl md:text-2xl font-bold font-headline tracking-tight mb-8">
        Archived Suggestions
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {books.map((book) => (
          <Link
            key={book.id}
            href={`/books/${book.id}`}
            className="group relative block rounded-lg overflow-hidden cursor-pointer"
            aria-label={`${book.title}${book.authors.length > 0 ? ` — ${book.authors.join(", ")}` : ""}`}
          >
            {/* Portrait cover */}
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-surface-container-high relative">
              {book.coverUrl != null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 shadow-xl"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-on-surface-variant/40"
                    style={{ fontSize: "48px" }}
                  >
                    menu_book
                  </span>
                </div>
              )}

              {/* Bookmark button */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-surface-container-highest/90 p-2 rounded-full text-secondary"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  bookmark
                </span>
              </button>
            </div>

            {/* Book info */}
            <div className="pt-2 px-1">
              <p
                className="text-on-surface font-bold text-sm truncate mb-1"
                title={book.title}
              >
                {book.title}
              </p>
              <p className="text-on-surface-variant text-xs truncate">
                {book.authors.length > 0 ? book.authors.join(", ") : "Autor desconocido"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
