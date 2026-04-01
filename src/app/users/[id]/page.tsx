import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewUserBooks } from "@/lib/privacy/can-view-user-books";
import type { UserBookWithBook } from "@/lib/types/book";
import { ProfileHeader } from "@/features/profile/components/profile-header";
import { ProfileBookList } from "@/features/profile/components/profile-book-list";
import { USER_BOOK_SELECT } from "@/lib/books/user-book-select";

interface UserProfilePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: UserProfilePageProps) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!user) return { title: "User not found" };
  return {
    title: `${user.name ?? "User"} — Rollorian`,
    description: `${user.name ?? "User"}'s profile on Rollorian Books`,
  };
}

export default async function UserProfilePage({
  params,
}: UserProfilePageProps) {
  const { id: targetUserId } = await params;

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const isAuthenticated = viewerId !== null;
  const isOwnProfile = viewerId === targetUserId;

  // Fetch target user
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      image: true,
      _count: {
        select: {
          followers: true,
          following: true,
          userBooks: true,
        },
      },
    },
  });

  if (!targetUser) {
    notFound();
  }

  // Determine if viewer follows this user
  let isFollowing = false;
  if (viewerId && !isOwnProfile) {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: targetUserId,
        },
      },
      select: { id: true },
    });
    isFollowing = follow !== null;
  }

  // Privacy gate for books
  let canView = false;
  let books: UserBookWithBook[] = [];

  if (isAuthenticated && viewerId) {
    canView = await canViewUserBooks(viewerId, targetUserId);
  }

  if (canView) {
    const results = await prisma.userBook.findMany({
      where: { userId: targetUserId },
      select: USER_BOOK_SELECT,
      orderBy: { createdAt: "desc" },
    });
    books = results.map((r) => ({ ...r, finishedAt: null }));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      <ProfileHeader
        userId={targetUser.id}
        name={targetUser.name}
        image={targetUser.image}
        bookCount={targetUser._count.userBooks}
        followerCount={targetUser._count.followers}
        followingCount={targetUser._count.following}
        isFollowing={isFollowing}
        isOwnProfile={isOwnProfile}
        isAuthenticated={isAuthenticated}
      />

      <section>
        <ProfileBookList
          books={books}
          canView={canView}
          isOwnProfile={isOwnProfile}
          isAuthenticated={isAuthenticated}
          targetUserName={targetUser.name}
        />
      </section>
    </div>
  );
}
