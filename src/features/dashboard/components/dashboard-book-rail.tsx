import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { LibraryEntryView } from "@/features/books/types";
import type { BookStatus } from "@/lib/types/book";

interface DashboardBookRailProps {
  title: string;
  books: LibraryEntryView[];
  emptyMessage: string;
  status: BookStatus;
  icon: string;
  maxVisible?: number;
}

export async function DashboardBookRail({
  title,
  books,
  emptyMessage: _emptyMessage,
  status,
  icon,
  maxVisible = 8,
}: DashboardBookRailProps) {
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  if (books.length === 0) return null;

  const visible = books.slice(0, maxVisible);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">
            {icon}
          </span>
          <h2 className="text-lg font-bold text-on-surface">{title}</h2>
          <span className="text-xs text-tertiary tabular-nums">
            {books.length}
          </span>
        </div>
        <Link
          href={`/library?status=${status}`}
          className="text-primary text-sm font-semibold hover:underline"
        >
          {t("viewAll")}
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-3">
        {visible.map((book) => {
          const authorLine =
            book.authors.length > 0
              ? book.authors.join(", ")
              : tCommon("unknownAuthor");

          return (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="flex-none w-32 group"
            >
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-container-low transition-transform duration-200 group-hover:scale-105">
                {book.coverUrl ? (
                  <Image
                    src={book.coverUrl}
                    alt={book.title}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-tertiary text-3xl">
                      menu_book
                    </span>
                  </div>
                )}
              </div>
              <h3 className="mt-2 text-xs font-bold text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                {book.title}
              </h3>
              <p className="text-[10px] text-tertiary truncate">{authorLine}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
