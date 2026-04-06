/**
 * Client-side API service for book list (shelf) operations.
 *
 * Centralizes all fetch calls to /api/lists and /api/lists/[id].
 * Components import these functions instead of calling fetch directly.
 */

import type { BookListSummary, BookListWithItems } from "@/lib/types/book";
import type { CreateListInput, UpdateListInput } from "@/lib/schemas/list";
import { apiFetch } from "./client";

// Re-export shared error + input types for consumers
export { ApiError } from "./client";
export type { CreateListInput, UpdateListInput };

// ── Public API ───────────────────────────────────────────────────────────────

/** Fetch all lists for the current user. Maps to GET /api/lists. */
export async function fetchLists(bookId?: string): Promise<BookListSummary[]> {
  const searchParams = new URLSearchParams();
  if (bookId) {
    searchParams.set("bookId", bookId);
  }

  const query = searchParams.toString();
  return apiFetch<BookListSummary[]>(query ? `/api/lists?${query}` : "/api/lists");
}

/** Create a new list. Maps to POST /api/lists. */
export async function createList(data: CreateListInput): Promise<BookListSummary> {
  return apiFetch<BookListSummary>("/api/lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** Fetch a single list with its items. Maps to GET /api/lists/[id]. */
export async function fetchList(id: string): Promise<BookListWithItems> {
  return apiFetch<BookListWithItems>(`/api/lists/${id}`);
}

/** Update a list's name or description. Maps to PATCH /api/lists/[id]. */
export async function updateList(id: string, data: UpdateListInput): Promise<BookListSummary> {
  return apiFetch<BookListSummary>(`/api/lists/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** Delete a list. Maps to DELETE /api/lists/[id]. */
export async function deleteList(id: string): Promise<void> {
  await apiFetch<unknown>(`/api/lists/${id}`, { method: "DELETE" });
}

/** Add a book to a list. Maps to POST /api/lists/[id]/items. */
export async function addToList(listId: string, bookId: string): Promise<void> {
  await apiFetch<unknown>(`/api/lists/${listId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookId }),
  });
}

/** Remove a book from a list. Maps to DELETE /api/lists/[id]/items. */
export async function removeFromList(listId: string, bookId: string): Promise<void> {
  await apiFetch<unknown>(`/api/lists/${listId}/items`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookId }),
  });
}
