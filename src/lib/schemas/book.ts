import { z } from "zod";
import { BookStatus, BOOK_STATUS_VALUES } from "@/lib/types/book";

export const createBookSchema = z.object({
  title: z.string().min(1, { error: "Title is required" }),
  subtitle: z.string().optional(),
  authors: z.array(z.string().min(1)).min(1, { error: "At least one author is required" }),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  publisher: z.string().optional(),
  publishedDate: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
  isbn10: z.string().optional(),
  isbn13: z.string().optional(),
  status: z.enum(BOOK_STATUS_VALUES as [BookStatus, ...BookStatus[]]).default(BookStatus.WISHLIST),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
  genres: z.array(z.string()).default([]),
});

export const updateBookSchema = z.object({
  status: z.enum(BOOK_STATUS_VALUES as [BookStatus, ...BookStatus[]]).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, { error: "Search query cannot be empty" }),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
