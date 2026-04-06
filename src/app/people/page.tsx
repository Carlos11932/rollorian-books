"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/features/shared/components/button";

const PAGE_SIZE = 40;

interface UserResult {
  id: string;
  name: string | null;
  image: string | null;
  bookCount: number;
  isFollowing: boolean;
}

async function fetchUsers(q: string, offset = 0): Promise<{ users: UserResult[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  params.set("limit", String(PAGE_SIZE + 1));
  params.set("offset", String(offset));

  const res = await fetch(`/api/users/search?${params.toString()}`);
  if (!res.ok) return { users: [], hasMore: false };

  const data = (await res.json()) as { users: UserResult[] };
  const hasMore = data.users.length > PAGE_SIZE;
  return { users: data.users.slice(0, PAGE_SIZE), hasMore };
}

export default function PeoplePage() {
  const t = useTranslations("people");
  const tCommon = useTranslations("common");

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [followingMap, setFollowingMap] = useState<Map<string, boolean>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Debounced search — fires on every query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const result = await fetchUsers(query);
      setUsers(result.users);
      setHasMore(result.hasMore);
      setFollowingMap((prev) => {
        const next = new Map(prev);
        for (const u of result.users) next.set(u.id, u.isFollowing);
        return next;
      });
      setIsLoading(false);
    }, query.length > 0 ? 300 : 0);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  async function loadMore() {
    setIsLoadingMore(true);
    const result = await fetchUsers(query, users.length);
    setUsers((prev) => [...prev, ...result.users]);
    setHasMore(result.hasMore);
    setFollowingMap((prev) => {
      const next = new Map(prev);
      for (const u of result.users) next.set(u.id, u.isFollowing);
      return next;
    });
    setIsLoadingMore(false);
  }

  async function handleFollow(userId: string) {
    const isCurrentlyFollowing = followingMap.get(userId) ?? false;
    const newFollowing = !isCurrentlyFollowing;

    setFollowingMap((prev) => new Map(prev).set(userId, newFollowing));

    try {
      const res = await fetch(`/api/users/${userId}/follow`, {
        method: newFollowing ? "POST" : "DELETE",
      });
      if (!res.ok) {
        setFollowingMap((prev) => new Map(prev).set(userId, isCurrentlyFollowing));
      }
    } catch {
      setFollowingMap((prev) => new Map(prev).set(userId, isCurrentlyFollowing));
    }
  }

  return (
    <div className="px-6 md:px-12 lg:px-20 pt-8 pb-24 max-w-3xl">
      <h1
        className="text-3xl font-bold text-on-surface mb-2"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        {t("heading")}
      </h1>
      <p className="text-sm text-tertiary mb-6">{t("description")}</p>

      {/* Search input */}
      <div className="relative mb-8">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-tertiary text-[20px]">
          search
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => { setIsLoading(true); setQuery(e.target.value); }}
          placeholder={t("searchPlaceholder")}
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container-low/60 text-on-surface text-sm placeholder:text-tertiary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
          style={{ backdropFilter: "blur(8px)" }}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined text-tertiary animate-spin text-3xl">
            progress_activity
          </span>
        </div>
      )}

      {/* No results for search */}
      {!isLoading && users.length === 0 && query.trim().length > 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="material-symbols-outlined text-tertiary" style={{ fontSize: "48px" }}>
            person_search
          </span>
          <p className="text-on-surface-variant font-medium">
            {t("noResults", { query })}
          </p>
        </div>
      )}

      {/* No users at all */}
      {!isLoading && users.length === 0 && query.trim().length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="material-symbols-outlined text-tertiary" style={{ fontSize: "48px" }}>
            group_add
          </span>
          <p className="text-on-surface-variant font-medium">{t("emptyState")}</p>
          <p className="text-xs text-tertiary max-w-sm">{t("emptyDescription")}</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && users.length > 0 && (
        <div className="grid gap-3">
          {users.map((user) => {
            const isFollowing = followingMap.get(user.id) ?? false;

            return (
              <div
                key={user.id}
                className="flex items-center gap-4 rounded-[var(--radius-xl)] border border-outline-variant/15 bg-surface-container-low/40 p-4 transition-colors hover:border-outline-variant/30"
                style={{ backdropFilter: "blur(8px)" }}
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
                      <span className="material-symbols-outlined text-primary text-xl">
                        person
                      </span>
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
                  onClick={() => void handleFollow(user.id)}
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
          })}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="secondary"
                loading={isLoadingMore}
                onClick={() => void loadMore()}
              >
                {tCommon("viewAll")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
