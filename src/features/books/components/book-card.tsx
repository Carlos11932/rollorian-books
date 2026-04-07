"use client";

import type { BookStatus } from "@/lib/types/book";
import type { LibraryEntryView } from "../types";
import { BrowseBookCard } from "./book-card/browse-book-card";
import { SearchBookCard } from "./book-card/search-book-card";
import { LibraryVariantCard } from "./book-card/library-book-card";

// --- Discriminated union for variant-specific props ---

interface BrowseVariantProps {
  variant: "browse";
}

interface SearchVariantProps {
  variant: "search";
  savedStatus?: BookStatus | null;
  onSave?: (book: LibraryEntryView) => Promise<void>;
}

interface LibraryVariantProps {
  variant: "library";
  onOpen?: (id: string) => void;
  onStatusChange?: (id: string, status: BookStatus) => Promise<void>;
}

type VariantProps = BrowseVariantProps | SearchVariantProps | LibraryVariantProps;

interface BaseBookCardProps {
  book: LibraryEntryView;
  index?: number;
}

type BookCardProps = BaseBookCardProps & VariantProps;

// --- Polymorphic BookCard entry point ---

export function BookCard(props: BookCardProps) {
  if (props.variant === "browse") {
    return <BrowseBookCard book={props.book} index={props.index} />;
  }
  if (props.variant === "search") {
    return (
      <SearchBookCard
        book={props.book}
        index={props.index}
        savedStatus={props.savedStatus}
        onSave={props.onSave}
      />
    );
  }
  return (
    <LibraryVariantCard
      book={props.book}
      index={props.index}
      onOpen={props.onOpen}
      onStatusChange={props.onStatusChange}
    />
  );
}
