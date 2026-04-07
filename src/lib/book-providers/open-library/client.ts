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

/**
 * Fetches a single work by OpenLibrary work ID (e.g. "OL34942758W").
 * Uses the Works API: https://openlibrary.org/works/OL34942758W.json
 * Then enriches with author names from the search API.
 */
export async function fetchWorkById(
  workId: string,
): Promise<OpenLibraryDoc | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Fetch work data
    const workUrl = `https://openlibrary.org/works/${encodeURIComponent(workId)}.json`;
    const workRes = await fetch(workUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!workRes.ok) return null;

    const work = (await workRes.json()) as {
      title?: string;
      covers?: number[];
      subjects?: string[];
      description?: string | { value: string };
      authors?: { author: { key: string } }[];
    };

    if (!work.title) return null;

    // Resolve author names from author keys
    let authorNames: string[] = [];
    if (work.authors && work.authors.length > 0) {
      const authorPromises = work.authors.slice(0, 3).map(async (a) => {
        try {
          const authorRes = await fetch(`https://openlibrary.org${a.author.key}.json`, {
            headers: { Accept: "application/json" },
          });
          if (!authorRes.ok) return null;
          const author = (await authorRes.json()) as { name?: string };
          return author.name ?? null;
        } catch {
          return null;
        }
      });
      authorNames = (await Promise.all(authorPromises)).filter((n): n is string => n !== null);
    }

    return {
      key: `/works/${workId}`,
      title: work.title,
      author_name: authorNames.length > 0 ? authorNames : undefined,
      cover_i: work.covers?.[0],
      subject: work.subjects?.slice(0, 10),
    };
  } catch {
    return null;
  }
}
