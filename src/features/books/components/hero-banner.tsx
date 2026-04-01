import Image from "next/image";
import Link from "next/link";
import { getTranslations } from 'next-intl/server';
import { Badge } from "@/features/shared/components/badge";
import { Button } from "@/features/shared/components/button";
import type { LibraryEntryView } from "../types";

interface HeroBannerProps {
  book: LibraryEntryView | null;
}

export async function HeroBanner({ book }: HeroBannerProps) {
  const t = await getTranslations();

  if (!book) {
    return (
      <div
        className="relative w-full rounded-[var(--radius-xl)] border border-line bg-surface overflow-hidden flex items-center justify-center"
        style={{ minHeight: "420px" }}
      >
        <div className="text-center grid gap-4 px-6 py-16">
          <p className="text-5xl" aria-hidden="true">
            📚
          </p>
          <h1
            className="text-4xl font-bold text-text"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            {t('home.heroTitle')}
          </h1>
          <p className="text-muted max-w-sm mx-auto">
            {t('home.heroDescription')}
          </p>
          <div className="flex justify-center">
            <Link href="/search">
              <Button variant="primary">{t('home.heroSearch')}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const authorLine =
    book.authors.length > 0 ? book.authors.join(", ") : t('common.unknownAuthor');
  const isReading = book.status === "READING" || book.status === "REREADING";

  return (
    <div
      className="relative w-full rounded-[var(--radius-xl)] border border-line overflow-hidden"
      style={{ minHeight: "420px" }}
    >
      {/* Blurred cover backdrop */}
      {book.coverUrl && (
        <div className="absolute inset-0" aria-hidden="true">
          <Image
            src={book.coverUrl}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover"
            style={{ opacity: 0.45 }}
          />
        </div>
      )}

      {/* Gradient overlays for text readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to right, rgba(8,11,18,0.92) 0%, rgba(8,11,18,0.6) 55%, transparent 100%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to top, rgba(8,11,18,0.75) 0%, transparent 50%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-end h-full p-8 gap-4" style={{ minHeight: "420px" }}>
        <div className="grid gap-3 max-w-lg">
          <Badge status={book.status} />

          <h1
            className="text-4xl md:text-5xl font-bold text-text leading-tight"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            {book.title}
          </h1>

          {book.subtitle && (
            <p className="text-lg text-muted">{book.subtitle}</p>
          )}

          <p className="text-sm text-muted">{authorLine}</p>

          {book.description && (
            <p className="text-sm text-text/80 line-clamp-3 max-w-md">
              {book.description}
            </p>
          )}

          <div className="flex gap-3 mt-2">
            <Link href={`/books/${book.id}`}>
              <Button variant="primary">
                {isReading ? t('home.heroContinue') : t('home.heroViewDetails')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
