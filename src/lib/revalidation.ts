import { revalidatePath } from "next/cache";

export function revalidateBookCollectionPaths(bookId: string) {
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/books/${bookId}`);
}
