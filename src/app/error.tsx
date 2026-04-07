"use client";

import { useEffect } from "react";
import { useTranslations } from 'next-intl';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const t = useTranslations('errors');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-danger">
          Error
        </p>
        <h2
          className="text-4xl font-bold text-text"
        >
          {t('errorTitle')}
        </h2>
        <p className="text-muted text-sm max-w-sm">
          {t('errorDescription')}
        </p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-white font-bold text-sm transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent cursor-pointer"
      >
        {t('tryAgain')}
      </button>
    </div>
  );
}
