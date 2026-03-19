"use client";

import { useRouter } from "next/navigation";
import type { SerializableBook } from "../types";
import { BookCard } from "./book-card";

interface BrowseCardWrapperProps {
  book: SerializableBook;
  index?: number;
}

export function BrowseCardWrapper({ book, index }: BrowseCardWrapperProps) {
  const router = useRouter();

  function handleOpen(id: string) {
    router.push(`/books/${id}`);
  }

  return (
    <BookCard
      variant="browse"
      book={book}
      index={index}
      onOpen={handleOpen}
    />
  );
}
