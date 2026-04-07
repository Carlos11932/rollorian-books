"use client";

import { useState, useEffect, useRef } from "react";

const PAGE_SIZE = 40;

export interface UserResult {
  id: string;
  name: string | null;
  image: string | null;
  bookCount: number;
  isFollowing: boolean;
}

async function fetchUsers(
  q: string,
  offset = 0,
): Promise<{ users: UserResult[]; hasMore: boolean }> {
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

export interface UsePeopleSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  users: UserResult[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  followingMap: Map<string, boolean>;
  loadMore: () => Promise<void>;
  handleFollow: (userId: string) => Promise<void>;
}

export function usePeopleSearch(): UsePeopleSearchReturn {
  const [query, setQueryState] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [followingMap, setFollowingMap] = useState<Map<string, boolean>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  function setQuery(q: string) {
    setIsLoading(true);
    setQueryState(q);
  }

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

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
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

  return {
    query,
    setQuery,
    users,
    isLoading,
    isLoadingMore,
    hasMore,
    followingMap,
    loadMore,
    handleFollow,
  };
}
