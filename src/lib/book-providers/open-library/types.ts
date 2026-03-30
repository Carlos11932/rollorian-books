export interface OpenLibrarySearchResponse {
  numFound: number;
  docs: OpenLibraryDoc[];
}

export interface OpenLibraryDoc {
  /** e.g., "/works/OL123W" */
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  /** Cover image ID */
  cover_i?: number;
  publisher?: string[];
  number_of_pages_median?: number;
  subject?: string[];
  subtitle?: string;
  /** Language codes like "eng", "spa" */
  language?: string[];
}
