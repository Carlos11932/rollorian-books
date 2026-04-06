"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookCover } from "@/features/books/components/book-cover";
import { cn } from "@/lib/cn";

interface GroupBookCardProps {
  book: {
    id: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
    isRead: boolean;
  };
  index?: number;
}

export function GroupBookCard({ book, index = 0 }: GroupBookCardProps) {
  const t = useTranslations();
  const authorLine =
    book.authors.length > 0
      ? book.authors.join(", ")
      : t("common.unknownAuthor");

  return (
    <Link
      href={`/books/${book.id}`}
      className={cn(
        "group relative block rounded-[var(--radius-md)] border border-line bg-surface overflow-hidden",
        "transition-all duration-250 ease-out",
        "hover:scale-105 hover:z-10 hover:shadow-lg hover:border-white/28",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
      )}
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
      aria-label={`${book.title} — ${authorLine}`}
    >
      {/* Cover */}
      <BookCover
        coverUrl={book.coverUrl}
        title={book.title}
        tone="cool"
        className="w-full h-[176px] min-h-[176px]"
        sizes="118px"
      />

      {/* Read check badge */}
      {book.isRead && (
        <div
          className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-accent/90 text-white shadow-md"
          aria-label={t("groups.readCheck")}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "14px" }}
          >
            check
          </span>
        </div>
      )}

      {/* Info */}
      <div className="p-2 grid gap-1">
        <h3
          className="text-[0.78rem] font-bold text-text leading-tight line-clamp-2"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          {book.title}
        </h3>
        <p className="text-[0.7rem] text-muted truncate">{authorLine}</p>
      </div>
    </Link>
  );
}
