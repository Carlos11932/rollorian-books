"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { UserResult } from "../hooks/use-people-search";

interface PersonCardProps {
  user: UserResult;
  isFollowing: boolean;
  onFollow: (userId: string) => void;
}

export function PersonCard({ user, isFollowing, onFollow }: PersonCardProps) {
  const t = useTranslations("people");
  const tCommon = useTranslations("common");

  return (
    <div
      className="flex items-center gap-4 rounded-[var(--radius-xl)] border border-outline-variant/15 bg-surface-container-low/40 p-4 transition-colors hover:border-outline-variant/30 backdrop-blur"
    >
      <Link href={`/users/${user.id}`} className="shrink-0">
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name ?? ""}
            width={48}
            height={48}
            className="rounded-full object-cover w-12 h-12"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl">person</span>
          </div>
        )}
      </Link>

      <Link href={`/users/${user.id}`} className="flex-1 min-w-0">
        <p className="font-semibold text-on-surface truncate hover:text-primary transition-colors">
          {user.name ?? tCommon("anonymous")}
        </p>
        <p className="text-xs text-tertiary">
          {t("bookCount", { count: user.bookCount })}
        </p>
      </Link>

      <button
        type="button"
        onClick={() => onFollow(user.id)}
        className={
          isFollowing
            ? "shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border border-outline-variant/50 text-on-surface hover:bg-error/10 hover:text-error hover:border-error/30 transition-colors"
            : "shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors"
        }
      >
        {isFollowing ? t("following") : t("follow")}
      </button>
    </div>
  );
}
