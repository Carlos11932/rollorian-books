import { z } from "zod";

/** Schema for creating a new book list */
export const createListSchema = z.object({
  name: z.string().min(1, { error: "List name is required" }).max(100),
  description: z.string().max(500).optional(),
});

/** Schema for updating an existing book list */
export const updateListSchema = z.object({
  name: z.string().min(1, { error: "List name is required" }).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

/** Schema for adding a book to a list */
export const addListItemSchema = z.object({
  bookId: z.string().min(1, { error: "Book ID is required" }),
});

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type AddListItemInput = z.infer<typeof addListItemSchema>;
