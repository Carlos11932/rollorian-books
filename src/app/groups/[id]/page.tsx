import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { GroupBookFeed } from '@/features/groups/components/group-book-feed';

const DEFAULT_LIMIT = 20;

interface GroupFeedPageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupFeedPage({ params }: GroupFeedPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }
  const userId = session.user.id;

  const { id: groupId } = await params;
  const t = await getTranslations('groups');

  // Verify group exists and user is an ACCEPTED member
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { status: true, role: true },
  });

  if (!membership) {
    notFound();
  }

  if (membership.status !== 'ACCEPTED') {
    notFound();
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      _count: { select: { members: { where: { status: 'ACCEPTED' } } } },
    },
  });

  if (!group) {
    notFound();
  }

  // Fetch initial book feed
  const acceptedMemberIds = await prisma.groupMember
    .findMany({ where: { groupId, status: 'ACCEPTED' }, select: { userId: true } })
    .then((rows) => rows.map((r) => r.userId));

  let initialBooks: {
    book: {
      id: string;
      title: string;
      authors: string[];
      coverUrl: string | null;
      publisher: string | null;
      publishedDate: string | null;
    };
    memberRatings: {
      userId: string;
      userName: string | null;
      rating: number | null;
      status: string;
    }[];
  }[] = [];
  let initialNextCursor: string | null = null;

  if (acceptedMemberIds.length > 0) {
    const books = await prisma.book.findMany({
      where: { userBooks: { some: { userId: { in: acceptedMemberIds } } } },
      include: {
        userBooks: {
          where: { userId: { in: acceptedMemberIds } },
          select: {
            userId: true,
            status: true,
            rating: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: DEFAULT_LIMIT + 1,
    });

    if (books.length > DEFAULT_LIMIT) {
      const nextItem = books.pop();
      initialNextCursor = nextItem?.id ?? null;
    }

    initialBooks = books.map((b) => ({
      book: {
        id: b.id,
        title: b.title,
        authors: b.authors,
        coverUrl: b.coverUrl,
        publisher: b.publisher,
        publishedDate: b.publishedDate,
      },
      memberRatings: b.userBooks.map((ub) => ({
        userId: ub.userId,
        userName: ub.user.name,
        rating: ub.rating,
        status: ub.status,
      })),
    }));
  }

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Page header */}
      <div
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 flex items-start justify-between gap-4"
        style={{ backdropFilter: 'blur(16px)' }}
      >
        <div className="grid gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            <Link href="/groups" className="hover:text-primary transition-colors">
              {t('heading')}
            </Link>
            {' / '}
            {group.name}
          </p>
          <h1
            className="text-3xl font-bold text-text"
            style={{ fontFamily: 'var(--font-headline)' }}
          >
            {group.name}
          </h1>
          <p className="text-sm text-muted">{t('memberCount', { count: group._count.members })}</p>
        </div>
        <Link
          href={`/groups/${groupId}/members`}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 text-text border border-line text-sm font-medium hover:-translate-y-px transition-transform"
        >
          <span className="material-symbols-outlined text-[16px]">group</span>
          {t('members')}
        </Link>
      </div>

      {/* Book feed */}
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold text-on-surface">{t('feed')}</h2>
        <GroupBookFeed
          groupId={groupId}
          initialBooks={initialBooks}
          initialNextCursor={initialNextCursor}
        />
      </section>
    </div>
  );
}
