import type { OpenLibraryDoc, OpenLibrarySearchResponse } from "./types";

const BASE_URL = "https://openlibrary.org/search.json";
const DEFAULT_LIMIT = 20;
const TIMEOUT_MS = 8_000;

const REQUESTED_FIELDS = [
  "key",
  "title",
  "author_name",
  "first_publish_year",
  "isbn",
  "cover_i",
  "publisher",
  "number_of_pages_median",
  "subject",
  "subtitle",
  "language",
].join(",");

interface SearchOpenLibraryOptions {
  limit?: number;
  language?: string;
}

export async function searchOpenLibrary(
  query: string,
  options?: SearchOpenLibraryOptions
): Promise<OpenLibraryDoc[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(options?.limit ?? DEFAULT_LIMIT));
  url.searchParams.set("fields", REQUESTED_FIELDS);

  if (options?.language) {
    url.searchParams.set("language", options.language);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as OpenLibrarySearchResponse;
    return payload.docs ?? [];
  } catch {
    return [];
  }
}

export async function fetchByIsbn(
  isbn: string
): Promise<OpenLibraryDoc | null> {
  const docs = await searchOpenLibrary(`isbn:${isbn}`, { limit: 1 });
  return docs[0] ?? null;
}
