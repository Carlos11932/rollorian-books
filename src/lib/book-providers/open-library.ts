import type { BookProvider, NormalizedBook, SearchOptions } from "./types";
import {
  searchOpenLibrary,
  fetchByIsbn as olFetchByIsbn,
} from "./open-library/client";
import { normalizeOpenLibraryResults } from "./open-library/normalize";

export const openLibraryProvider: BookProvider = {
  name: "open_library",
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<NormalizedBook[]> {
    const limit = options?.maxResults ?? 20;
    const searchOpts = { limit, language: options?.language };

    // Search both as general query AND as author-specific query.
    // This ensures "Santiago Posteguillo" finds books BY that author,
    // not just books mentioning those words in the title.
    const [generalDocs, authorDocs] = await Promise.all([
      searchOpenLibrary(query, searchOpts),
      searchOpenLibrary(`author:${query}`, { ...searchOpts, limit: 10 }),
    ]);

    // Merge and deduplicate by key
    const seen = new Set<string>();
    const merged = [...generalDocs, ...authorDocs].filter((doc) => {
      if (seen.has(doc.key)) return false;
      seen.add(doc.key);
      return true;
    });

    return normalizeOpenLibraryResults(merged);
  },
  async fetchByIsbn(isbn: string): Promise<NormalizedBook | null> {
    const doc = await olFetchByIsbn(isbn);
    if (!doc) return null;
    const results = normalizeOpenLibraryResults([doc]);
    return results[0] ?? null;
  },
};
