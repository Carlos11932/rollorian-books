"use client";

import { usePeopleSearch } from "@/features/people/hooks/use-people-search";
import { PeopleSearchHeader } from "@/features/people/components/people-search-header";
import { PeopleList } from "@/features/people/components/people-list";

export default function PeoplePage() {
  const {
    query,
    setQuery,
    users,
    isLoading,
    isLoadingMore,
    hasMore,
    followingMap,
    loadMore,
    handleFollow,
  } = usePeopleSearch();

  return (
    <div className="px-6 md:px-12 lg:px-20 pt-8 pb-24 max-w-3xl">
      <PeopleSearchHeader query={query} onQueryChange={setQuery} />
      <PeopleList
        users={users}
        query={query}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        followingMap={followingMap}
        onFollow={(userId) => void handleFollow(userId)}
        onLoadMore={() => void loadMore()}
      />
    </div>
  );
}
