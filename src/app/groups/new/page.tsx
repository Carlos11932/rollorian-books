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
        className="card-glass backdrop-blur-xl p-6 grid gap-1"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-muted">{t('heading')}</p>
        <h1
          className="text-3xl font-bold text-text"
        >
          {t('newGroup')}
        </h1>
      </div>

      {/* Form */}
      <section
        className="card-glass backdrop-blur-xl p-6"
      >
        <CreateGroupForm />
      </section>
    </div>
  );
}
