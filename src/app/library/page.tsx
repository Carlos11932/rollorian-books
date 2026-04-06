import { redirect } from "next/navigation";
import { type BookStatus, BOOK_STATUS_VALUES } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserIdOrNull } from "@/lib/auth/require-auth";
import type { StatusCounts, StatusTabValue } from "@/features/books/components/status-tabs";
import { LibraryView } from "@/features/books/components/library-view";

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

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      <LibraryView
        books={books}
        counts={counts}
        activeStatus={activeStatus}
        searchParams={tabSearchParams}
      />
    </div>
  );
}
