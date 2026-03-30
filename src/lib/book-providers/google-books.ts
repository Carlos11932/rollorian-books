import type { BookProvider, NormalizedBook, SearchOptions } from "./types";
import { fetchBooks } from "../google-books/client";
import { normalizeSearchResults } from "../google-books/normalize";

export const googleBooksProvider: BookProvider = {
  name: "google_books",
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<NormalizedBook[]> {
    const volumes = await fetchBooks(query, {
      maxResults: options?.maxResults ?? 40,
    });
    return normalizeSearchResults(volumes);
  },
  async fetchByIsbn(isbn: string): Promise<NormalizedBook | null> {
    const volumes = await fetchBooks(`isbn:${isbn}`, { maxResults: 1 });
    if (volumes.length === 0) return null;
    return normalizeSearchResults(volumes)[0] ?? null;
  },
};
