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
    const docs = await searchOpenLibrary(query, {
      limit: options?.maxResults ?? 20,
      language: options?.language,
    });
    return normalizeOpenLibraryResults(docs);
  },
  async fetchByIsbn(isbn: string): Promise<NormalizedBook | null> {
    const doc = await olFetchByIsbn(isbn);
    if (!doc) return null;
    const results = normalizeOpenLibraryResults([doc]);
    return results[0] ?? null;
  },
};
