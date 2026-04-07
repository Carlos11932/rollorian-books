"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/features/shared/components/badge";
import { BookCover } from "../book-cover";
import { CardOverlay } from "../card-overlay";
import type { BaseBookCardProps } from "./base-book-card";

export function BrowseBookCard({ book, index = 0 }: BaseBookCardProps) {
  const t = useTranslations("common");
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : t("unknownAuthor");

  return (
    <Link
      href={`/books/${book.id}`}
      className="group relative block rounded-[var(--radius-md)] border border-line bg-surface overflow-hidden transition-all duration-250 ease-out hover:scale-105 hover:z-10 hover:shadow-lg hover:border-white/28 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      style={{
        animationName: "fade-slide-up",
        animationDuration: "350ms",
        animationTimingFunction: "ease",
        animationFillMode: "both",
        animationDelay: `${index * 60}ms`,
        width: "118px",
        minWidth: "118px",
        scrollSnapAlign: "start",
      }}
      aria-label={`${book.title} by ${authorLine}`}
    >
      <BookCover
        coverUrl={book.coverUrl}
        title={book.title}
        tone="cool"
        className="w-full h-[176px] min-h-[176px]"
        sizes="118px"
      />

      <div className="p-2 grid gap-1">
        <Badge status={book.status} className="text-[10px] px-2 py-0.5" />
        <h3
          className="text-[0.78rem] font-bold text-text leading-tight line-clamp-2"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          {book.title}
        </h3>
        <p className="text-[0.7rem] text-muted truncate">{authorLine}</p>
      </div>

      <CardOverlay
        bookId={book.id}
        title={book.title}
        authors={book.authors}
        showLink={false}
      />
    </Link>
  );
}
