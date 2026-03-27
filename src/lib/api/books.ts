/**
 * Client-side API service for book operations.
 *
 * Centralizes all fetch calls to /api/books and /api/books/[id].
 * Components import these functions instead of calling fetch directly.
 */

import type { UserBookWithBook } from "@/lib/types/book";
import type { CreateBookInput, UpdateBookInput } from "@/lib/schemas/book";

// Re-export input types for consumers
export type { CreateBookInput, UpdateBookInput };

// ── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Internal fetch helper ────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }

  // 204 No Content — return undefined cast to T (callers that use void are safe)
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Save a Google Books entry to the user's library.
 * Maps to POST /api/books.
 */
export async function saveBook(data: CreateBookInput): Promise<UserBookWithBook> {
  return apiFetch<UserBookWithBook>("/api/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/**
 * Update the status, rating, or notes of a saved book.
 * Maps to PATCH /api/books/[id].
 */
export async function updateBook(id: string, data: UpdateBookInput): Promise<void> {
  await apiFetch<unknown>(`/api/books/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/**
 * Remove a book from the user's library.
 * Maps to DELETE /api/books/[id].
 */
export async function deleteBook(id: string): Promise<void> {
  await apiFetch<unknown>(`/api/books/${id}`, { method: "DELETE" });
}
