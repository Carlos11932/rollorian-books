import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { EmptyState } from '@/features/shared/components/empty-state';
import { InvitationActions } from '@/features/groups/components/invitation-actions';

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }
  const userId = session.user.id;

  const t = await getTranslations('groups');

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          _count: { select: { members: { where: { status: 'ACCEPTED' } } } },
          createdBy: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const acceptedGroups = memberships.filter((m) => m.status === 'ACCEPTED');
  const pendingGroups = memberships.filter((m) => m.status === 'PENDING');

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Page header */}
      <div
        className="card-glass backdrop-blur-xl p-6 flex items-start justify-between gap-4"
      >
        <div className="grid gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">{t('eyebrow')}</p>
          <h1
            className="text-3xl font-bold text-text"
            >
            {t('heading')}
          </h1>
          <p className="text-sm text-muted leading-relaxed max-w-lg">{t('description')}</p>
        </div>
        <Link
          href="/groups/new"
          className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-br from-accent to-accent-strong text-white text-sm font-bold transition-transform hover:-translate-y-px active:translate-y-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('newGroup')}
        </Link>
      </div>

      {/* Pending invitations */}
      {pendingGroups.length > 0 && (
        <section className="grid gap-4">
          <h2 className="text-lg font-semibold text-on-surface">{t('pendingInvitations')}</h2>
          <div className="grid gap-3">
            {pendingGroups.map((m) => (
              <div
                key={m.id}
                className="card-glass backdrop-blur-xl p-4 flex items-center justify-between gap-4"
              >
                <div className="grid gap-0.5">
                  <p className="font-semibold text-on-surface">{m.group.name}</p>
                  <p className="text-sm text-muted">
                    {t('invitedBy', { name: m.group.createdBy.name ?? m.group.createdBy.id })}
                  </p>
                </div>
                <InvitationActions groupId={m.group.id} userId={userId} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My groups */}
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold text-on-surface">{t('myGroups')}</h2>
        {acceptedGroups.length === 0 ? (
          <EmptyState
            title={t('noGroups')}
            description={t('noGroupsDescription')}
            icon={
              <span className="material-symbols-outlined text-[48px]">
                group
              </span>
            }
            action={
              <Link
                href="/groups/new"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-br from-accent to-accent-strong text-white text-sm font-bold"
              >
                {t('newGroup')}
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3">
            {acceptedGroups.map((m) => (
              <div
                key={m.id}
                className="card-glass backdrop-blur-xl p-4 flex items-center justify-between gap-4"
              >
                <div className="grid gap-0.5">
                  <p className="font-semibold text-on-surface">{m.group.name}</p>
                  <p className="text-sm text-muted">
                    {t('memberCount', { count: m.group._count.members })}
                  </p>
                </div>
                <Link
                  href={`/groups/${m.group.id}`}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 text-text border border-line text-sm font-medium hover:-translate-y-px transition-transform"
                >
                  {t('viewGroup')}
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
