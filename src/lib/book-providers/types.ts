export interface NormalizedBook {
  externalSource: "google_books" | "open_library";
  externalId: string;
  title: string;
  authors: string[];
  publishedYear: number | null;
  isbn: string | null;
  coverUrl: string | null;
  description?: string;
  pageCount?: number;
  publisher?: string;
  genres?: string[];
  subtitle?: string;
}

export interface SearchOptions {
  maxResults?: number;
  language?: string;
}

export interface BookProvider {
  name: string;
  search(query: string, options?: SearchOptions): Promise<NormalizedBook[]>;
  fetchByIsbn?(isbn: string): Promise<NormalizedBook | null>;
}
