"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/features/shared/components/empty-state";
import type { BookListWithItems } from "@/lib/types/book";

interface ListItemGridProps {
  items: BookListWithItems["items"];
  onRemoveBook: (bookId: string) => void;
}

export function ListItemGrid({ items, onRemoveBook }: ListItemGridProps) {
  const t = useTranslations("lists");

  if (items.length === 0) {
    return (
      <EmptyState
        title={t("emptyList")}
        description={t("emptyListDescription")}
        icon={
            <span className="material-symbols-outlined text-[48px]">
            menu_book
          </span>
        }
      />
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="card-glass backdrop-blur-xl p-4 flex items-center gap-4"
        >
          {/* Book cover thumbnail */}
          <Link href={`/books/${item.book.id}`} className="shrink-0">
            <div className="w-[48px] h-[72px] rounded-md overflow-hidden bg-surface-container-high relative">
              {item.book.coverUrl != null ? (
                <Image
                  src={item.book.coverUrl}
                  alt={item.book.title}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-muted text-[20px]">
                    menu_book
                  </span>
                </div>
              )}
            </div>
          </Link>

          {/* Book info */}
          <div className="flex-1 min-w-0 grid gap-0.5">
            <Link href={`/books/${item.book.id}`} className="hover:underline">
              <p className="font-semibold text-on-surface truncate text-sm">
                {item.book.title}
              </p>
            </Link>
            <p className="text-xs text-muted truncate">
              {item.book.authors.length > 0 ? item.book.authors.join(", ") : ""}
            </p>
          </div>

          {/* Remove button */}
          <button
            type="button"
            onClick={() => onRemoveBook(item.bookId)}
            className="shrink-0 text-muted hover:text-error transition-colors p-1"
            aria-label={t("removeFromList")}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      ))}
    </div>
  );
}
