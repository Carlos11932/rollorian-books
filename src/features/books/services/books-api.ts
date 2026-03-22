/**
 * Books domain API service.
 *
 * All book CRUD operations go through here. Components and hooks MUST NOT
 * call fetch() directly — they use these functions instead.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from "@/services/api-client";
import type { Book } from "@/lib/types/book";
import type { CreateBookPayload, UpdateBookPayload } from "@/features/books/types";

export async function fetchAllBooks(params?: {
  status?: string;
  q?: string;
}): Promise<Book[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.q) searchParams.set("q", params.q);

  const qs = searchParams.toString();
  const path = qs ? `/api/books?${qs}` : "/api/books";

  return apiGet<Book[]>(path);
}

export async function createBook(payload: CreateBookPayload): Promise<Book> {
  return apiPost<Book>("/api/books", payload);
}

export async function updateBook(
  id: string,
  data: UpdateBookPayload,
): Promise<Book> {
  return apiPatch<Book>(`/api/books/${id}`, data);
}

export async function deleteBook(id: string): Promise<void> {
  return apiDelete(`/api/books/${id}`);
}
