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

  const primary = books[0];
  const extras = books.slice(1, 4);
  const authorLine =
    primary.authors.length > 0
      ? primary.authors.join(", ")
      : tCommon("unknownAuthor");
  const isReading =
    primary.status === "READING" || primary.status === "REREADING";

  return (
    <section>
      <h2 className="text-lg font-bold text-on-surface mb-4">
        {t("currentlyReading")}
      </h2>

      {/* Primary book — hero card */}
      <div className="relative rounded-[var(--radius-xl)] border border-outline-variant/15 overflow-hidden min-h-[280px]">
        {/* Blurred backdrop */}
        {primary.coverUrl && (
          <div className="absolute inset-0" aria-hidden="true">
            <Image
              src={primary.coverUrl}
              alt=""
              fill
              sizes="100vw"
              priority
              className="object-cover"
              style={{ opacity: 0.35, filter: "blur(40px) saturate(1.4)" }}
            />
          </div>
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(to right, rgba(8,11,18,0.92) 0%, rgba(8,11,18,0.55) 60%, transparent 100%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex gap-6 p-6 md:p-8 items-end min-h-[280px]">
          {/* Cover */}
          {primary.coverUrl && (
            <Link
              href={`/books/${primary.id}`}
              className="hidden sm:block shrink-0 w-[140px] md:w-[160px] aspect-[2/3] rounded-xl overflow-hidden shadow-2xl transition-transform hover:scale-105"
            >
              <Image
                src={primary.coverUrl}
                alt={primary.title}
                width={160}
                height={240}
                className="object-cover w-full h-full"
              />
            </Link>
          )}

          {/* Text */}
          <div className="flex flex-col gap-3 max-w-lg">
            <Badge status={primary.status} />
            <h3
              className="text-2xl md:text-3xl font-bold text-on-surface leading-tight"
              style={{ fontFamily: "var(--font-headline)" }}
            >
              {primary.title}
            </h3>
            <p className="text-sm text-tertiary">{authorLine}</p>
            {primary.description && (
              <p className="text-sm text-on-surface/70 line-clamp-2 max-w-md">
                {primary.description}
              </p>
            )}
            <div className="flex gap-3 mt-1">
              <Link href={`/books/${primary.id}`}>
                <Button variant="primary">
                  {isReading ? t("continueReading") : t("viewDetails")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Extra books — thumbnails */}
      {extras.length > 0 && (
        <div className="flex gap-3 mt-4">
          {extras.map((book) => (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="flex items-center gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-3 flex-1 min-w-0 group hover:border-primary/30 transition-colors"
            >
              {book.coverUrl ? (
                <Image
                  src={book.coverUrl}
                  alt={book.title}
                  width={40}
                  height={60}
                  className="rounded-md object-cover shrink-0 w-10 h-[60px]"
                />
              ) : (
                <div className="shrink-0 w-10 h-[60px] rounded-md bg-surface-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-tertiary text-lg">
                    menu_book
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                  {book.title}
                </p>
                <p className="text-[10px] text-tertiary truncate">
                  {book.authors.length > 0
                    ? book.authors.join(", ")
                    : tCommon("unknownAuthor")}
                </p>
                <Badge
                  status={book.status}
                  className="text-[9px] px-1.5 py-0 mt-1"
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
