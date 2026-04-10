import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLibrarySnapshot } from "@/lib/books";
import { canViewUserBooks } from "@/lib/privacy/can-view-user-books";
import type { UserBookWithBook } from "@/lib/types/book";
import {
  LIBRARY_READ_STATE,
  type LibraryCompatDegradedField,
  type LibraryReadState,
} from "@/features/books/types";
import { ProfileHeader } from "@/features/profile/components/profile-header";
import { ProfileBookList } from "@/features/profile/components/profile-book-list";
import { isMissingUserBookSchemaError } from "@/lib/prisma-schema-compat";

type ProfileLibraryEntry = UserBookWithBook & {
  compatDegraded?: true;
  compatDegradedFields?: LibraryCompatDegradedField[];
};

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
  let localBooksUnavailable = false;

  const targetUser = await (async () => {
    try {
      return await prisma.user.findUnique({
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
    } catch (error) {
      if (!isMissingUserBookSchemaError(error)) {
        throw error;
      }

      localBooksUnavailable = true;

      return prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          name: true,
          image: true,
          _count: {
            select: {
              followers: true,
              following: true,
            },
          },
        },
      }).then((user) => (
        user
          ? {
              ...user,
              _count: {
                ...user._count,
                userBooks: 0,
              },
            }
          : null
      ));
    }
  })();

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
  let books: ProfileLibraryEntry[] = [];
  let libraryReadState: LibraryReadState = LIBRARY_READ_STATE.FULL;

  if (isAuthenticated && viewerId) {
    canView = await canViewUserBooks(viewerId, targetUserId);
  }

  if (canView) {
    const librarySnapshot = await getLibrarySnapshot(targetUserId);
    localBooksUnavailable = localBooksUnavailable || librarySnapshot.state === "unavailable";
    libraryReadState = librarySnapshot.state;

    if (librarySnapshot.state !== "unavailable") {
      books = librarySnapshot.entries;
    }
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
        {localBooksUnavailable ? (
          <div className="rounded-2xl border border-amber-400/30 bg-surface/70 p-6 text-sm text-on-surface/75">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
              Compatibility mode
            </p>
            <p className="mt-3 leading-relaxed">
              This profile&apos;s library is temporarily unavailable while the database schema catches up.
              Rollorian is intentionally hiding local reading state instead of pretending the shelf is empty.
            </p>
          </div>
        ) : (
          <ProfileBookList
            books={books}
            readState={libraryReadState}
            canView={canView}
            isOwnProfile={isOwnProfile}
            isAuthenticated={isAuthenticated}
            targetUserName={targetUser.name}
          />
        )}
      </section>
    </div>
  );
}
