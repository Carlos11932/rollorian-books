import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { InviteMemberForm } from '@/features/groups/components/invite-member-form';
import { RemoveMemberButton, LeaveGroupButton } from '@/features/groups/components/member-actions';

interface MembersPageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupMembersPage({ params }: MembersPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }
  const userId = session.user.id;

  const { id: groupId } = await params;
  const t = await getTranslations('groups');

  // Verify caller is an ACCEPTED member
  const callerMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { status: true, role: true },
  });

  if (!callerMembership || callerMembership.status !== 'ACCEPTED') {
    notFound();
  }

  const isAdmin = callerMembership.role === 'ADMIN';

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      members: {
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!group) {
    notFound();
  }

  const acceptedMembers = group.members.filter((m) => m.status === 'ACCEPTED');

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Page header */}
      <div
        className="card-glass backdrop-blur-xl p-6 grid gap-1"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-muted">
          <Link href="/groups" className="hover:text-primary transition-colors">
            {t('heading')}
          </Link>
          {' / '}
          <Link href={`/groups/${groupId}`} className="hover:text-primary transition-colors">
            {group.name}
          </Link>
          {' / '}
          {t('members')}
        </p>
        <h1
          className="text-3xl font-bold text-text"
        >
          {t('members')}
        </h1>
        <p className="text-sm text-muted leading-relaxed max-w-lg">{t('membersDescription')}</p>
      </div>

      {/* Invite form (admin only) */}
      {isAdmin && (
        <section
          className="card-glass backdrop-blur-xl p-6 grid gap-3"
        >
          <h2 className="text-base font-semibold text-on-surface">{t('inviteMember')}</h2>
          <InviteMemberForm groupId={groupId} />
        </section>
      )}

      {/* Members list */}
      <section
          className="card-glass backdrop-blur-xl p-6 grid gap-4"
      >
        <h2 className="text-base font-semibold text-on-surface">
          {t('members')} ({acceptedMembers.length})
        </h2>
        {acceptedMembers.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">{t('noMembers')}</p>
        ) : (
        <div className="grid gap-3">
          {acceptedMembers.map((member) => {
            const isSelf = member.user.id === userId;
            return (
              <div
                key={member.id}
                className="flex items-center justify-between gap-4 py-2"
              >
                <Link
                  href={`/users/${member.user.id}`}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-surface-container-high shrink-0 relative">
                    {member.user.image != null ? (
                      <Image
                        src={member.user.image}
                        alt={member.user.name ?? member.user.id}
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                         <span
                           className="material-symbols-outlined text-on-surface-variant/60 text-[20px]"
                         >
                           person
                         </span>
                      </div>
                    )}
                  </div>

                  {/* Name + role */}
                  <div>
                    <p className="text-sm font-medium text-on-surface">
                      {member.user.name ?? member.user.id}
                      {isSelf && (
                        <span className="ml-1.5 text-muted text-xs">{t('you')}</span>
                      )}
                    </p>
                    <span
                      className={[
                        'inline-block text-xs font-semibold px-2 py-0.5 rounded-full',
                        member.role === 'ADMIN'
                          ? 'bg-primary/20 text-primary'
                          : 'bg-surface-container-high text-muted',
                      ].join(' ')}
                    >
                      {member.role === 'ADMIN' ? t('roleAdmin') : t('roleMember')}
                    </span>
                  </div>
                </Link>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {isAdmin && !isSelf && (
                    <RemoveMemberButton groupId={groupId} targetUserId={member.user.id} />
                  )}
                  {isSelf && !isAdmin && (
                    <LeaveGroupButton groupId={groupId} userId={userId} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Non-admin leave button */}
        {!isAdmin && (
          <div className="pt-4 border-t border-line flex justify-end">
            <LeaveGroupButton groupId={groupId} userId={userId} />
          </div>
        )}
      </section>
    </div>
  );
}
