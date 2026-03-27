'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/features/shared/components/button';

interface RemoveMemberButtonProps {
  groupId: string;
  targetUserId: string;
}

export function RemoveMemberButton({ groupId, targetUserId }: RemoveMemberButtonProps) {
  const t = useTranslations('groups');
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      loading={removing}
      onClick={() => void handleRemove()}
    >
      {removing ? t('removing') : t('removeMember')}
    </Button>
  );
}

interface LeaveGroupButtonProps {
  groupId: string;
  userId: string;
}

export function LeaveGroupButton({ groupId, userId }: LeaveGroupButtonProps) {
  const t = useTranslations('groups');
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function handleLeave() {
    setLeaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/groups');
      }
    } finally {
      setLeaving(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      loading={leaving}
      onClick={() => void handleLeave()}
    >
      {leaving ? t('leaving') : t('leaveGroup')}
    </Button>
  );
}
