import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { GroupLibraryCatalog } from "@/features/groups/components/group-library-catalog";

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
  const books =
    memberUserIds.length > 0
      ? await prisma.book.findMany({
          where: {
            userBooks: { some: { userId: { in: memberUserIds } } },
          },
          select: {
            id: true,
            title: true,
            authors: true,
            coverUrl: true,
            genres: true,
            userBooks: {
              where: { userId },
              select: { status: true },
              take: 1,
            },
          },
          orderBy: { title: "asc" },
        })
      : [];

  const catalogBooks = books.map((b) => {
    const myEntry = b.userBooks[0] ?? null;
    return {
      id: b.id,
      title: b.title,
      authors: b.authors,
      coverUrl: b.coverUrl,
      genres: b.genres,
      currentUserStatus: myEntry?.status ?? null,
      isRead: myEntry?.status === "READ",
    };
  });

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Page header */}
      <div
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 flex items-start justify-between gap-4"
        style={{ backdropFilter: "blur(16px)" }}
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
            style={{ fontFamily: "var(--font-headline)" }}
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
