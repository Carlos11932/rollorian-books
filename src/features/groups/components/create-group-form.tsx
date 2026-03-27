'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/features/shared/components/button';

export function CreateGroupForm() {
  const t = useTranslations('groups');
  const router = useRouter();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('groupNameRequired'));
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const errData = data as { error?: string };
        setError(errData.error ?? t('createError'));
        return;
      }

      const created = data as { id: string };
      router.push(`/groups/${created.id}`);
    } catch {
      setError(t('createError'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="group-name" className="text-sm font-medium text-on-surface">
          {t('groupNameLabel')}
        </label>
        <input
          id="group-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('groupNamePlaceholder')}
          maxLength={100}
          disabled={creating}
          className="w-full bg-surface-container-lowest border border-line text-on-surface placeholder:text-outline text-sm py-3 px-4 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {error != null && (
        <p
          role="alert"
          className="text-sm text-error px-4 py-3 rounded-xl border border-error/30 bg-error/10"
        >
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={creating} disabled={creating}>
          {creating ? t('creating') : t('createGroup')}
        </Button>
      </div>
    </form>
  );
}
