"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/features/shared/components/button";
import { PersonCard } from "./person-card";
import type { UserResult } from "../hooks/use-people-search";

interface PeopleListProps {
  users: UserResult[];
  query: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  followingMap: Map<string, boolean>;
  onFollow: (userId: string) => void;
  onLoadMore: () => void;
}

export function PeopleList({
  users,
  query,
  isLoading,
  isLoadingMore,
  hasMore,
  followingMap,
  onFollow,
  onLoadMore,
}: PeopleListProps) {
  const t = useTranslations("people");
  const tCommon = useTranslations("common");

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="material-symbols-outlined text-tertiary animate-spin text-3xl">
          progress_activity
        </span>
      </div>
    );
  }

  if (users.length === 0 && query.trim().length > 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="material-symbols-outlined text-tertiary text-[48px]">
          person_search
        </span>
        <p className="text-on-surface-variant font-medium">
          {t("noResults", { query })}
        </p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="material-symbols-outlined text-tertiary text-[48px]">
          group_add
        </span>
        <p className="text-on-surface-variant font-medium">{t("emptyState")}</p>
        <p className="text-xs text-tertiary max-w-sm">{t("emptyDescription")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {users.map((user) => (
        <PersonCard
          key={user.id}
          user={user}
          isFollowing={followingMap.get(user.id) ?? false}
          onFollow={onFollow}
        />
      ))}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="secondary"
            loading={isLoadingMore}
            onClick={onLoadMore}
          >
            {tCommon("viewAll")}
          </Button>
        </div>
      )}
    </div>
  );
}
