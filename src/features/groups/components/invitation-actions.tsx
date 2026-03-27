'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/features/shared/components/button';

interface InvitationActionsProps {
  groupId: string;
  userId: string;
}

export function InvitationActions({ groupId, userId }: InvitationActionsProps) {
  const t = useTranslations('groups');
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  async function handleAction(status: 'ACCEPTED' | 'REJECTED') {
    const isAccepting = status === 'ACCEPTED';
    if (isAccepting) setAccepting(true);
    else setRejecting(true);

    try {
      const res = await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        router.refresh();
      }
    } finally {
      setAccepting(false);
      setRejecting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="primary"
        loading={accepting}
        disabled={rejecting}
        onClick={() => void handleAction('ACCEPTED')}
      >
        {accepting ? t('accepting') : t('accept')}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        loading={rejecting}
        disabled={accepting}
        onClick={() => void handleAction('REJECTED')}
      >
        {rejecting ? t('rejecting') : t('reject')}
      </Button>
    </div>
  );
}
