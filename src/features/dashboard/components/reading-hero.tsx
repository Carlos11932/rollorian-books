import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/features/shared/components/badge";
import { Button } from "@/features/shared/components/button";
import type { LibraryEntryView } from "@/features/books/types";

interface ReadingHeroProps {
  books: LibraryEntryView[];
  hasToRead: boolean;
}

export async function ReadingHero({ books, hasToRead }: ReadingHeroProps) {
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  if (books.length === 0) {
    return (
      <section className="rounded-[var(--radius-xl)] border border-outline-variant/15 bg-surface-container-low/40 p-8 text-center">
        <span
          className="material-symbols-outlined text-tertiary mb-3 block"
          style={{ fontSize: "48px" }}
        >
          auto_stories
        </span>
        <p className="text-on-surface-variant font-medium mb-4">
          {t("currentlyReadingEmpty")}
        </p>
        {hasToRead && (
          <Link href="/library?status=TO_READ">
            <Button variant="secondary">{t("pickFromQueue")}</Button>
          </Link>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-primary text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_stories
          </span>
          <h2 className="text-lg font-bold text-on-surface">
            {t("currentlyReading")}
          </h2>
          <span className="text-xs text-tertiary tabular-nums">
            {books.length}
          </span>
        </div>
        <Link
          href="/library?status=READING"
          className="text-primary text-sm font-semibold hover:underline"
        >
          {t("viewAll")}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => {
          const authorLine =
            book.authors.length > 0
              ? book.authors.join(", ")
              : tCommon("unknownAuthor");

          return (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="group relative flex gap-4 rounded-[var(--radius-xl)] border border-outline-variant/15 overflow-hidden p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-lg"
              style={{ backdropFilter: "blur(8px)" }}
            >
              {/* Blurred cover backdrop */}
              {book.coverUrl && (
                <div className="absolute inset-0 -z-10" aria-hidden="true">
                  <Image
                    src={book.coverUrl}
                    alt=""
                    fill
                    sizes="400px"
                    className="object-cover"
                    style={{
                      opacity: 0.15,
                      filter: "blur(30px) saturate(1.4)",
                    }}
                  />
                </div>
              )}
              <div className="absolute inset-0 -z-10 bg-surface-container-lowest/80" aria-hidden="true" />

              {/* Cover */}
              <div className="shrink-0 w-[80px] aspect-[2/3] rounded-lg overflow-hidden bg-surface-container-low shadow-md">
                {book.coverUrl ? (
                  <Image
                    src={book.coverUrl}
                    alt={book.title}
                    width={80}
                    height={120}
                    className="object-cover w-full h-full transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-tertiary text-2xl">
                      menu_book
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-col gap-1.5 min-w-0 py-1">
                <Badge status={book.status} className="self-start text-[10px] px-2 py-0.5" />
                <h3
                  className="text-sm font-bold text-on-surface leading-tight line-clamp-2 group-hover:text-primary transition-colors"
                  style={{ fontFamily: "var(--font-headline)" }}
                >
                  {book.title}
                </h3>
                <p className="text-xs text-tertiary truncate">{authorLine}</p>
                {book.notes && (
                  <p className="text-[11px] text-on-surface/50 line-clamp-1 mt-auto">
                    {book.notes}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
