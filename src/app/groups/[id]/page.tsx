import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isRetryableUserBookCompatError } from "@/lib/prisma-schema-compat";
import { GroupLibraryCatalog } from "@/features/groups/components/group-library-catalog";
import type { CatalogBookOwner } from "@/features/groups/components/group-library-catalog";

interface GroupFeedPageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupFeedPage({ params }: GroupFeedPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const { id: groupId } = await params;
  const t = await getTranslations("groups");

  // Verify group exists and user is an ACCEPTED member
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { status: true },
  });

  if (!membership || membership.status !== "ACCEPTED") {
    notFound();
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      _count: { select: { members: { where: { status: "ACCEPTED" } } } },
    },
  });

  if (!group) {
    notFound();
  }

  // Fetch all ACCEPTED member IDs
  const acceptedMembers = await prisma.groupMember.findMany({
    where: { groupId, status: "ACCEPTED" },
    select: { userId: true },
  });

  const memberUserIds = acceptedMembers.map((m) => m.userId);

  // Fetch ALL unique books from group members with genres + current user status
  const books = memberUserIds.length > 0
    ? await getGroupBooks(userId, memberUserIds)
    : [];

  // Batch-fetch active loans for this group's books by member lenders
  const allBookIds = books.map((b) => b.id);
  const activeLoans = allBookIds.length > 0 && memberUserIds.length > 0
    ? await prisma.loan.findMany({
        where: {
          bookId: { in: allBookIds },
          lenderId: { in: memberUserIds },
          status: "ACTIVE",
        },
        select: { bookId: true, lenderId: true },
      })
    : [];

  // Build a Set keyed by "bookId:lenderId" for O(1) lookup
  const activeLoanKey = new Set(activeLoans.map((l) => `${l.bookId}:${l.lenderId}`));

  const catalogBooks = books.map((b) => {
    const myEntry = b.userBooks.find((ub) => ub.userId === userId) ?? null;
    const owners: CatalogBookOwner[] = b.userBooks
      .filter((ub) => memberUserIds.includes(ub.userId) && ub.ownershipStatus === "OWNED")
      .map((ub) => ({
        userId: ub.userId,
        userName: ub.user.name,
        hasActiveLoan: activeLoanKey.has(`${b.id}:${ub.userId}`),
      }));
    return {
      id: b.id,
      title: b.title,
      authors: b.authors,
      coverUrl: b.coverUrl,
      genres: b.genres,
      currentUserStatus: myEntry?.status ?? null,
      isRead: myEntry?.status === "READ",
      owners,
    };
  });

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Page header */}
      <div
        className="card-glass backdrop-blur-xl p-6 flex items-start justify-between gap-4"
      >
        <div className="grid gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            <Link
              href="/groups"
              className="hover:text-primary transition-colors"
            >
              {t("heading")}
            </Link>
            {" / "}
            {group.name}
          </p>
          <h1
            className="text-3xl font-bold text-text"
          >
            {group.name}
          </h1>
          <p className="text-sm text-muted">
            {t("memberCount", { count: group._count.members })}
            {" · "}
            {t("bookCount", { count: catalogBooks.length })}
          </p>
        </div>
        <Link
          href={`/groups/${groupId}/members`}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 text-text border border-line text-sm font-medium hover:-translate-y-px transition-transform"
        >
          <span className="material-symbols-outlined text-[16px]">group</span>
          {t("members")}
        </Link>
      </div>

      {/* Shared library catalog */}
          <GroupLibraryCatalog books={catalogBooks} />
    </div>
  );
}

async function getGroupBooks(currentUserId: string, memberUserIds: string[]) {
  const sharedWhere = {
    where: {
      userBooks: { some: { userId: { in: memberUserIds } } },
    },
    orderBy: { title: "asc" as const },
  };

  try {
    return await prisma.book.findMany({
      ...sharedWhere,
      select: {
        id: true,
        title: true,
        authors: true,
        coverUrl: true,
        genres: true,
        userBooks: {
          where: { userId: { in: [currentUserId, ...memberUserIds] } },
          select: {
            userId: true,
            status: true,
            ownershipStatus: true,
            user: { select: { name: true } },
          },
        },
      },
    });
  } catch (error) {
    if (!isRetryableUserBookCompatError(error)) {
      throw error;
    }

    const legacyBooks = await prisma.book.findMany({
      ...sharedWhere,
      select: {
        id: true,
        title: true,
        authors: true,
        coverUrl: true,
        genres: true,
        userBooks: {
          where: { userId: { in: [currentUserId, ...memberUserIds] } },
          select: {
            userId: true,
            status: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    return legacyBooks.map((book) => ({
      ...book,
      userBooks: book.userBooks.map((userBook) => ({
        ...userBook,
        ownershipStatus: "UNKNOWN" as const,
      })),
    }));
  }
}
