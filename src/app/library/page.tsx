import { redirect } from "next/navigation";
import { getTranslations } from 'next-intl/server';
import { type BookStatus, BOOK_STATUS_VALUES } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserIdOrNull } from "@/lib/auth/require-auth";
import { LibraryBookCard } from "@/features/books/components/library-book-card";
import { StatusTabs, type StatusCounts, type StatusTabValue } from "@/features/books/components/status-tabs";
import { EmptyState } from "@/features/shared/components/empty-state";
import { BookRailSection } from "@/features/shared/ui/book-rail-section";

interface LibraryBookRow {
  id: string;
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  book: {
    id: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
    publisher: string | null;
    publishedDate: string | null;
  };
}

interface StatusCountRow {
  status: BookStatus;
  _count: { id: number };
}

const STATUS_ORDERED: BookStatus[] = ["READING", "REREADING", "TO_READ", "READ", "ON_HOLD", "WISHLIST"];

type SearchParams = Record<string, string | string[] | undefined>;

function isValidStatus(value: string): value is BookStatus {
  return (BOOK_STATUS_VALUES as readonly string[]).includes(value);
}

function resolveActiveStatus(param: string | undefined): StatusTabValue {
  if (!param) return "all";
  if (isValidStatus(param)) return param;
  return "all";
}

function toStringRecord(params: SearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

interface LibraryPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const userId = await getAuthenticatedUserIdOrNull();
  if (!userId) {
    redirect("/login");
  }

  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const activeStatus = resolveActiveStatus(statusParam);
  const tabSearchParams = toStringRecord(params);

  const t = await getTranslations();

  const [userBooks, groupedCounts]: [LibraryBookRow[], StatusCountRow[]] = await Promise.all([
    prisma.userBook.findMany({
      where: activeStatus !== "all" ? { userId, status: activeStatus } : { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        rating: true,
        notes: true,
        book: {
          select: {
            id: true,
            title: true,
            authors: true,
            coverUrl: true,
            publisher: true,
            publishedDate: true,
          },
        },
      },
    }),
    prisma.userBook.groupBy({ by: ["status"], where: { userId }, _count: { id: true } }),
  ]);

  const counts = groupedCounts.reduce<StatusCounts>(
    (acc, row) => {
      acc[row.status] = row._count.id;
      return acc;
    },
    { WISHLIST: 0, TO_READ: 0, READING: 0, REREADING: 0, READ: 0, ON_HOLD: 0 },
  );

  // Flatten UserBook + Book into the shape LibraryBookCard expects
  const books = userBooks.map((ub) => ({
    id: ub.book.id,
    title: ub.book.title,
    authors: ub.book.authors,
    coverUrl: ub.book.coverUrl,
    status: ub.status,
    rating: ub.rating,
    notes: ub.notes,
    publisher: ub.book.publisher,
    publishedDate: ub.book.publishedDate,
  }));

  const isEmpty = books.length === 0;

  function getFilterTitle(status: BookStatus): string {
    return `No ${t(`book.status.${status}`)} books`;
  }

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      <div
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 grid gap-4"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <div className="grid gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Library</p>
          <h1 className="text-3xl font-bold text-text" style={{ fontFamily: "var(--font-headline)" }}>
            {t('library.heading')}
          </h1>
          <p className="text-sm text-muted leading-relaxed max-w-lg">
            {t('library.description')}
          </p>
        </div>

        <StatusTabs activeStatus={activeStatus} counts={counts} searchParams={tabSearchParams} />
      </div>

      {isEmpty ? (
        <EmptyState
          title={activeStatus === "all" ? t('library.emptyAll') : getFilterTitle(activeStatus)}
          description={
            activeStatus === "all"
              ? t('library.searchPlaceholder')
              : t('library.tryAnotherStatus')
          }
        />
      ) : activeStatus !== "all" ? (
        <BookRailSection
          title={t(`library.statusEyebrow.${activeStatus}`)}
          eyebrow={t(`book.status.${activeStatus}`)}
          count={books.length}
          emptyCopy={t('library.emptyFilter')}
        >
          {books.map((book) => (
            <div key={book.id} className="shrink-0 w-[clamp(260px,32vw,340px)]" style={{ scrollSnapAlign: "start" }}>
              <LibraryBookCard book={book} />
            </div>
          ))}
        </BookRailSection>
      ) : (
        <div className="grid gap-4">
          {STATUS_ORDERED.map((status) => {
            const statusBooks = books.filter((book) => book.status === status);

            return (
              <BookRailSection
                key={status}
                title={t(`library.statusEyebrow.${status}`)}
                eyebrow={t(`book.status.${status}`)}
                count={statusBooks.length}
                emptyTitle={getFilterTitle(status)}
                emptyCopy={t(`library.statusEmpty.${status}`)}
              >
                {statusBooks.map((book) => (
                  <div key={book.id} className="shrink-0 w-[clamp(260px,32vw,340px)]" style={{ scrollSnapAlign: "start" }}>
                    <LibraryBookCard book={book} />
                  </div>
                ))}
              </BookRailSection>
            );
          })}
        </div>
      )}
    </div>
  );
}
