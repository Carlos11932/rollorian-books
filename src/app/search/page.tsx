"use client";

import { useSearch } from "@/features/search/hooks/use-search";
import { SearchHeader } from "@/features/search/components/search-header";
import { SearchResults } from "@/features/search/components/search-results";
import { DiscoverSection } from "@/features/search/components/discover-section";
import { IsbnScanner } from "@/features/search/components/isbn-scanner";

export default function SearchPage() {
  const search = useSearch();

  function handleIsbnScan(isbn: string) {
    search.setShowScanner(false);
    search.setInputValue(isbn);
    void search.handleSearch(isbn);
  }

  return (
    <div className="pt-8 px-12 md:px-20 pb-24">
      <SearchHeader
        inputValue={search.inputValue}
        onInputChange={search.setInputValue}
        onSearch={(q) => void search.handleSearch(q)}
        isLoading={search.isLoading}
        hasBarcodeApi={search.hasBarcodeApi}
        onOpenScanner={() => search.setShowScanner(true)}
      />

      <SearchResults
        query={search.query}
        results={search.results}
        isLoading={search.isLoading}
        hasSearched={search.hasSearched}
        error={search.error}
        getSavedStatus={search.getSavedStatus}
        onSave={search.handleSave}
      />

      {!search.hasSearched && !search.isLoading && (
        <DiscoverSection
          discoverGenres={search.discoverGenres}
          isDiscoverLoading={search.isDiscoverLoading}
          recommendations={search.recommendations}
          isRecommendationsLoading={search.isRecommendationsLoading}
          getSavedStatus={search.getSavedStatus}
          onDiscoverSave={search.handleDiscoverSave}
        />
      )}

      {search.showScanner && (
        <IsbnScanner
          onScan={handleIsbnScan}
          onClose={() => search.setShowScanner(false)}
        />
      )}
    </div>
  );
}
