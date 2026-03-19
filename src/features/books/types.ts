import type { Book } from "@prisma/client";

/**
 * Serializable version of the Prisma Book model.
 * Date fields are converted to ISO strings when passing from Server to Client components.
 */
export type SerializableBook = Omit<Book, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

/**
 * Converts a Prisma Book to a serialization-safe version for passing to Client Components.
 */
export function serializeBook(book: Book): SerializableBook {
  return {
    ...book,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}
