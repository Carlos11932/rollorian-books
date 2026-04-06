/**
 * Client-side API service for book operations.
 *
 * Centralizes all fetch calls to /api/books and /api/books/[id].
 * Components import these functions instead of calling fetch directly.
 */

import type { UserBookWithBook } from "@/lib/types/book";
import type { CreateBookInput, UpdateBookInput } from "@/lib/schemas/book";
import { apiFetch } from "./client";

// Re-export shared error + input types for consumers
export { ApiError } from "./client";
export type { CreateBookInput, UpdateBookInput };

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
