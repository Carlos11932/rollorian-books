import "server-only";

import type { GoogleBooksVolume } from "./types";
import { env } from "@/lib/env";

const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";
const DEFAULT_SEARCH_LIMIT = 40;

interface FetchBooksOptions {
  maxResults?: number;
}

export async function fetchBooks(
  query: string,
  options: FetchBooksOptions = {}
): Promise<GoogleBooksVolume[]> {
  const url = new URL(GOOGLE_BOOKS_URL);
  url.searchParams.set("q", query);
  url.searchParams.set(
    "maxResults",
    String(options.maxResults ?? DEFAULT_SEARCH_LIMIT)
  );
  url.searchParams.set("printType", "books");
  url.searchParams.set("orderBy", "relevance");

  const apiKey = env.GOOGLE_BOOKS_API_KEY;
  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to reach Google Books: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`Google Books request failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();

  if (
    typeof payload === "object" &&
    payload !== null &&
    "items" in payload &&
    Array.isArray((payload as { items: unknown }).items)
  ) {
    return (payload as { items: GoogleBooksVolume[] }).items;
  }

  return [];
}

/**
 * Fetches a single volume by its Google Books ID.
 * Returns null when the volume does not exist (404).
 */
export async function fetchBookById(
  volumeId: string
): Promise<GoogleBooksVolume | null> {
  const url = new URL(`${GOOGLE_BOOKS_URL}/${encodeURIComponent(volumeId)}`);

  const apiKey = env.GOOGLE_BOOKS_API_KEY;
  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to reach Google Books: ${message}`);
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Google Books request failed with status ${response.status}`
    );
  }

  const payload: unknown = await response.json();

  if (
    typeof payload === "object" &&
    payload !== null &&
    "id" in payload &&
    "volumeInfo" in payload
  ) {
    return payload as GoogleBooksVolume;
  }

  return null;
}
