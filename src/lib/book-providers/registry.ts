import type { BookProvider } from "./types";
import { googleBooksProvider } from "./google-books";
import { openLibraryProvider } from "./open-library";

export function getProviders(): BookProvider[] {
  return [googleBooksProvider, openLibraryProvider];
}
