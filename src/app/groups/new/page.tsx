import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { CreateGroupForm } from '@/features/groups/components/create-group-form';

export default async function NewGroupPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const t = await getTranslations('groups');

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24 max-w-xl">
      {/* Page header */}
      <div
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 grid gap-1"
        style={{ backdropFilter: 'blur(16px)' }}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-muted">{t('heading')}</p>
        <h1
          className="text-3xl font-bold text-text"
          style={{ fontFamily: 'var(--font-headline)' }}
        >
          {t('newGroup')}
        </h1>
      </div>

      {/* Form */}
      <section
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6"
        style={{ backdropFilter: 'blur(16px)' }}
      >
        <CreateGroupForm />
      </section>
    </div>
  );
}
