'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/features/shared/components/button';

interface InviteMemberFormProps {
  groupId: string;
}

export function InviteMemberForm({ groupId }: InviteMemberFormProps) {
  const t = useTranslations('groups');
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = userId.trim();
    if (!trimmed) return;

    setInviting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: trimmed }),
      });

      if (res.ok) {
        setUserId('');
        setSuccess(true);
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? t('inviteError'));
      }
    } catch {
      setError(t('inviteError'));
    } finally {
      setInviting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder={t('inviteUserIdPlaceholder')}
          disabled={inviting}
          className="flex-1 bg-surface-container-lowest border border-line text-on-surface placeholder:text-outline text-sm py-2.5 px-4 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Button type="submit" size="sm" loading={inviting} disabled={!userId.trim()}>
          {inviting ? t('inviting') : t('inviteButton')}
        </Button>
      </div>
      {error != null && (
        <p
          role="alert"
          className="text-sm text-error px-3 py-2 rounded-xl border border-error/30 bg-error/10"
        >
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-secondary px-3 py-2 rounded-xl border border-secondary/30 bg-secondary/10">
          {t('inviteSuccess')}
        </p>
      )}
    </form>
  );
}
