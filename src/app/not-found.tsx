import Link from "next/link";
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('errors');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          404
        </p>
        <h1 className="text-5xl font-bold text-text">
          {t('notFoundTitle')}
        </h1>
        <p className="text-muted text-base max-w-sm">
          {t('notFoundDescription')}
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-white font-bold text-sm transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {t('backToHome')}
      </Link>
    </div>
  );
}
