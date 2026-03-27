"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface FollowButtonProps {
  targetUserId: string;
  isFollowing: boolean;
}

export function FollowButton({ targetUserId, isFollowing }: FollowButtonProps) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [optimisticFollowing, setOptimisticFollowing] = useState(isFollowing);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const newFollowing = !optimisticFollowing;
    setOptimisticFollowing(newFollowing);

    try {
      const res = await fetch(`/api/users/${targetUserId}/follow`, {
        method: newFollowing ? "POST" : "DELETE",
      });

      if (!res.ok) {
        // Revert on error
        setOptimisticFollowing(!newFollowing);
      } else {
        router.refresh();
      }
    } catch {
      setOptimisticFollowing(!newFollowing);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={
        optimisticFollowing
          ? "px-5 py-2 rounded-xl text-sm font-semibold border border-outline-variant/50 text-on-surface hover:bg-error/10 hover:text-error hover:border-error/30 transition-colors disabled:opacity-50"
          : "px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
      }
    >
      {optimisticFollowing ? t("unfollow") : t("follow")}
    </button>
  );
}
